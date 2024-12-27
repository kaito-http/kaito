#include "../../../node_modules/node-api-headers/include/node_api.h"
#include "../../../deps/llhttp/build/llhttp.h"
#include "../libuv/include/uv.h"
#include <string.h>
#include <stdlib.h>

typedef struct {
    uv_tcp_t handle;
    llhttp_t parser;
    llhttp_settings_t settings;
    napi_ref on_request;
    char* current_header_field;
    char* current_header_value;
    napi_env env;
    napi_ref current_request_obj;
    char* body;
    size_t body_len;
} client_t;

typedef struct {
    uv_tcp_t server;
    napi_ref callback;
    napi_env env;
} tcp_server_t;

static void free_client(client_t* client) {
    if (client->body) {
        free(client->body);
    }
    if (client->current_header_field) {
        free(client->current_header_field);
    }
    if (client->current_header_value) {
        free(client->current_header_value);
    }
    free(client);
}

static int on_message_begin(llhttp_t* parser) {
    client_t* client = (client_t*)parser->data;
    
    napi_handle_scope scope;
    napi_open_handle_scope(client->env, &scope);
    
    napi_value request_obj;
    napi_create_object(client->env, &request_obj);
    
    napi_value headers_obj;
    napi_create_object(client->env, &headers_obj);
    napi_set_named_property(client->env, request_obj, "headers", headers_obj);
    
    client->body = NULL;
    client->body_len = 0;
    
    napi_create_reference(client->env, request_obj, 1, &client->current_request_obj);
    
    napi_close_handle_scope(client->env, scope);
    return HPE_OK;
}

static int on_url(llhttp_t* parser, const char* at, size_t length) {
    client_t* client = (client_t*)parser->data;
    
    napi_handle_scope scope;
    napi_open_handle_scope(client->env, &scope);
    
    napi_value request_obj;
    napi_get_reference_value(client->env, client->current_request_obj, &request_obj);
    
    napi_value url_str;
    napi_create_string_utf8(client->env, at, length, &url_str);
    napi_set_named_property(client->env, request_obj, "url", url_str);
    
    napi_close_handle_scope(client->env, scope);
    return HPE_OK;
}

static int on_header_field(llhttp_t* parser, const char* at, size_t length) {
    client_t* client = (client_t*)parser->data;
    client->current_header_field = (char*)malloc(length + 1);
    memcpy(client->current_header_field, at, length);
    client->current_header_field[length] = '\0';
    return HPE_OK;
}

static int on_header_value(llhttp_t* parser, const char* at, size_t length) {
    client_t* client = (client_t*)parser->data;
    
    napi_handle_scope scope;
    napi_open_handle_scope(client->env, &scope);
    
    napi_value request_obj;
    napi_get_reference_value(client->env, client->current_request_obj, &request_obj);
    
    napi_value headers_obj;
    napi_get_named_property(client->env, request_obj, "headers", &headers_obj);
    
    napi_value header_value;
    napi_create_string_utf8(client->env, at, length, &header_value);
    napi_set_named_property(client->env, headers_obj, client->current_header_field, header_value);
    
    free(client->current_header_field);
    client->current_header_field = NULL;
    
    napi_close_handle_scope(client->env, scope);
    return HPE_OK;
}

static int on_body(llhttp_t* parser, const char* at, size_t length) {
    client_t* client = (client_t*)parser->data;
    
    client->body = (char*)realloc(client->body, client->body_len + length);
    memcpy(client->body + client->body_len, at, length);
    client->body_len += length;
    
    return HPE_OK;
}

static void write_cb(uv_write_t* req, int status) {
    free(req->data);
    free(req);
}

typedef struct {
    uv_write_t req;
    uv_buf_t buf;
} write_req_t;

static void on_close(uv_handle_t* handle) {
    client_t* client = (client_t*)handle->data;
    free_client(client);
}

static int on_message_complete(llhttp_t* parser) {
    client_t* client = (client_t*)parser->data;
    
    napi_handle_scope scope;
    napi_open_handle_scope(client->env, &scope);
    
    napi_value request_obj;
    napi_get_reference_value(client->env, client->current_request_obj, &request_obj);
    
    napi_value method_str;
    napi_create_string_utf8(client->env, llhttp_method_name((llhttp_method_t)parser->method), NAPI_AUTO_LENGTH, &method_str);
    napi_set_named_property(client->env, request_obj, "method", method_str);
    
    if (client->body_len > 0) {
        napi_value body_buffer;
        void* body_data;
        napi_create_buffer(client->env, client->body_len, &body_data, &body_buffer);
        memcpy(body_data, client->body, client->body_len);
        napi_set_named_property(client->env, request_obj, "body", body_buffer);
    }
    
    napi_value callback;
    napi_get_reference_value(client->env, client->on_request, &callback);
    
    napi_value global;
    napi_get_global(client->env, &global);
    
    napi_value argv[] = { request_obj };
    napi_value result;
    napi_call_function(client->env, global, callback, 1, argv, &result);
    
    napi_delete_reference(client->env, client->current_request_obj);
    napi_close_handle_scope(client->env, scope);
    
    uv_close((uv_handle_t*)&client->handle, on_close);
    return HPE_OK;
}

static void alloc_buffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf) {
    static char buffer[65536];
    buf->base = buffer;
    buf->len = sizeof(buffer);
}

static void on_read(uv_stream_t* stream, ssize_t nread, const uv_buf_t* buf) {
    client_t* client = (client_t*)stream->data;
    
    if (nread < 0) {
        uv_close((uv_handle_t*)stream, on_close);
        return;
    }
    
    enum llhttp_errno err = llhttp_execute(&client->parser, buf->base, nread);
    if (err != HPE_OK) {
        fprintf(stderr, "Parse error: %s %s\n", llhttp_errno_name(err), client->parser.reason);
        uv_close((uv_handle_t*)stream, on_close);
    }
}

static void on_connection(uv_stream_t* server, int status) {
    if (status < 0) return;
    
    tcp_server_t* server_data = (tcp_server_t*)server->data;
    
    client_t* client = (client_t*)malloc(sizeof(client_t));
    memset(client, 0, sizeof(client_t));
    
    uv_tcp_init(uv_default_loop(), &client->handle);
    client->handle.data = client;
    client->env = server_data->env;
    client->on_request = server_data->callback;
    
    llhttp_settings_init(&client->settings);
    client->settings.on_message_begin = on_message_begin;
    client->settings.on_url = on_url;
    client->settings.on_header_field = on_header_field;
    client->settings.on_header_value = on_header_value;
    client->settings.on_body = on_body;
    client->settings.on_message_complete = on_message_complete;
    
    llhttp_init(&client->parser, HTTP_REQUEST, &client->settings);
    client->parser.data = client;
    
    uv_accept(server, (uv_stream_t*)&client->handle);
    uv_read_start((uv_stream_t*)&client->handle, alloc_buffer, on_read);
}

static napi_value Listen(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value argv[2];
    tcp_server_t* server;
    
    napi_get_cb_info(env, info, &argc, argv, NULL, (void**)&server);
    
    int32_t port;
    napi_get_value_int32(env, argv[0], &port);
    
    napi_create_reference(env, argv[1], 1, &server->callback);
    server->env = env;
    
    struct sockaddr_in addr;
    uv_ip4_addr("0.0.0.0", port, &addr);
    uv_tcp_bind(&server->server, (struct sockaddr*)&addr, 0);
    
    server->server.data = server;
    
    uv_listen((uv_stream_t*)&server->server, 128, on_connection);
    
    return NULL;
}

static void cleanup_server(napi_env env, void* data, void* hint) {
    tcp_server_t* server = (tcp_server_t*)data;
    uv_close((uv_handle_t*)&server->server, NULL);
    free(server);
}

static napi_value Create(napi_env env, napi_callback_info info) {
    tcp_server_t* server = (tcp_server_t*)malloc(sizeof(tcp_server_t));
    memset(server, 0, sizeof(tcp_server_t));
    
    uv_tcp_init(uv_default_loop(), &server->server);
    
    napi_value obj;
    napi_create_object(env, &obj);
    
    napi_wrap(env, obj, server, cleanup_server, NULL, NULL);
    
    napi_value listen_fn;
    napi_create_function(env, "listen", NAPI_AUTO_LENGTH, Listen, NULL, &listen_fn);
    napi_set_named_property(env, obj, "listen", listen_fn);
    
    return obj;
}

NAPI_MODULE_INIT() {
    napi_value create_fn;
    napi_create_function(env, "create", NAPI_AUTO_LENGTH, Create, NULL, &create_fn);
    napi_set_named_property(env, exports, "create", create_fn);
    return exports;
}