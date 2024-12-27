#include <node_api.h>
#include <uv.h>
#include "./node_modules/llhttp/include/llhttp.h"
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
} client_t;

typedef struct {
    uv_tcp_t server;
    napi_ref callback;
    napi_env env;
} tcp_server_t;

static int on_message_begin(llhttp_t* parser) {
    client_t* client = (client_t*)parser->data;
    
    napi_handle_scope scope;
    napi_open_handle_scope(client->env, &scope);
    
    napi_value request_obj;
    napi_create_object(client->env, &request_obj);
    
    napi_value headers_obj;
    napi_create_object(client->env, &headers_obj);
    napi_set_named_property(client->env, request_obj, "headers", headers_obj);
    
    napi_create_reference(client->env, request_obj, 1, &client->current_request_obj);
    
    napi_close_handle_scope(client->env, scope);
    return 0;
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
    return 0;
}

static int on_header_field(llhttp_t* parser, const char* at, size_t length) {
    client_t* client = (client_t*)parser->data;
    client->current_header_field = strndup(at, length);
    return 0;
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
    
    napi_close_handle_scope(client->env, scope);
    return 0;
}

static void write_cb(uv_write_t* req, int status) {
    free(req->data);
    free(req);
}

static void on_message_complete(llhttp_t* parser) {
    client_t* client = (client_t*)parser->data;
    
    napi_handle_scope scope;
    napi_open_handle_scope(client->env, &scope);
    
    napi_value request_obj;
    napi_get_reference_value(client->env, client->current_request_obj, &request_obj);
    
    napi_value method_str;
    napi_create_string_utf8(client->env, llhttp_method_name(parser->method), NAPI_AUTO_LENGTH, &method_str);
    napi_set_named_property(client->env, request_obj, "method", method_str);
    
    napi_value callback;
    napi_get_reference_value(client->env, client->on_request, &callback);
    
    napi_value global;
    napi_get_global(client->env, &global);
    
    napi_value argv[] = { request_obj };
    napi_value result;
    napi_call_function(client->env, global, callback, 1, argv, &result);
    
    const char* response = "HTTP/1.1 200 OK\r\nContent-Length: 13\r\nContent-Type: text/plain\r\n\r\nHello, World!\n";
    size_t response_len = strlen(response);
    
    uv_write_t* write_req = (uv_write_t*)malloc(sizeof(uv_write_t));
    char* response_copy = (char*)malloc(response_len);
    memcpy(response_copy, response, response_len);
    write_req->data = response_copy;
    
    uv_buf_t buf = uv_buf_init(response_copy, response_len);
    uv_write(write_req, (uv_stream_t*)&client->handle, &buf, 1, write_cb);
    
    napi_delete_reference(client->env, client->current_request_obj);
    napi_close_handle_scope(client->env, scope);
}

static void alloc_buffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf) {
    static char buffer[65536];
    buf->base = buffer;
    buf->len = sizeof(buffer);
}

static void on_read(uv_stream_t* stream, ssize_t nread, const uv_buf_t* buf) {
    client_t* client = (client_t*)stream->data;
    
    if (nread < 0) {
        uv_close((uv_handle_t*)stream, NULL);
        free(client);
        return;
    }
    
    enum llhttp_errno err = llhttp_execute(&client->parser, buf->base, nread);
    if (err != HPE_OK) {
        fprintf(stderr, "Parse error: %s %s\n", llhttp_errno_name(err), client->parser.reason);
        uv_close((uv_handle_t*)stream, NULL);
        free(client);
    }
}

static void on_connection(uv_stream_t* server, int status) {
    if (status < 0) return;
    
    tcp_server_t* server_data = (tcp_server_t*)server->data;
    
    client_t* client = (client_t*)malloc(sizeof(client_t));
    uv_tcp_init(uv_default_loop(), &client->handle);
    client->handle.data = client;
    client->env = server_data->env;
    client->on_request = server_data->callback;
    
    llhttp_settings_init(&client->settings);
    client->settings.on_message_begin = on_message_begin;
    client->settings.on_url = on_url;
    client->settings.on_header_field = on_header_field;
    client->settings.on_header_value = on_header_value;
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

static napi_value Create(napi_env env, napi_callback_info info) {
    tcp_server_t* server = (tcp_server_t*)malloc(sizeof(tcp_server_t));
    uv_tcp_init(uv_default_loop(), &server->server);
    
    napi_value obj;
    napi_create_object(env, &obj);
    
    napi_wrap(env, obj, server, NULL, NULL, NULL);
    
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