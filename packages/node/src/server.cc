#include <node_api.h>
#include <uv.h>
#include "llhttp.h"
#include <string.h>
#include <stdlib.h>

#define BACKLOG 511

typedef struct {
    napi_env env;
    napi_ref callback;
    napi_ref ref;
    uv_tcp_t server;
} server_t;

typedef struct {
    napi_env env;
    napi_ref callback;
    llhttp_t parser;
    llhttp_settings_t settings;
    char* url;
    size_t url_len;
    char* method;
    size_t method_len;
    napi_ref headers;
} client_t;

static void on_close(uv_handle_t* handle) {
    free(handle);
}

static void allocator(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf) {
    buf->base = (char*)malloc(suggested_size);
    buf->len = suggested_size;
}

static void after_write(uv_write_t* req, int status) {
    if (req->handle) {
        uv_close((uv_handle_t*)req->handle, on_close);
    }
    free(req);
}

static int on_url(llhttp_t* parser, const char* at, size_t length) {
    client_t* client = (client_t*)parser->data;
    if (client->url) free(client->url);
    client->url = (char*)malloc(length + 1);
    memcpy(client->url, at, length);
    client->url[length] = '\0';
    client->url_len = length;
    return 0;
}

static int on_headers_complete(llhttp_t* parser) {
    client_t* client = (client_t*)parser->data;
    const char* method = llhttp_method_name((llhttp_method_t)parser->method);
    size_t method_len = strlen(method);
    if (client->method) free(client->method);
    client->method = (char*)malloc(method_len + 1);
    memcpy(client->method, method, method_len);
    client->method[method_len] = '\0';
    client->method_len = method_len;
    return 0;
}

static void send_response(uv_stream_t* client, const char* response) {
    uv_write_t* req = (uv_write_t*)malloc(sizeof(uv_write_t));
    size_t response_len = strlen(response);
    
    char* header = (char*)malloc(1024);
    int header_len = snprintf(header, 1024,
        "HTTP/1.1 200 OK\r\n"
        "Content-Length: %zu\r\n"
        "Connection: close\r\n"
        "\r\n", response_len);
    
    uv_buf_t bufs[2];
    bufs[0] = uv_buf_init(header, header_len);
    bufs[1] = uv_buf_init((char*)response, response_len);
    
    uv_write(req, client, bufs, 2, after_write);
}

static void after_read(uv_stream_t* client, ssize_t nread, const uv_buf_t* buf) {
    if (nread <= 0) {
        free(buf->base);
        return;
    }

    client_t* client_data = (client_t*)client->data;
    napi_env env = client_data->env;

    // Create handle scope
    napi_handle_scope scope;
    napi_open_handle_scope(env, &scope);

    // Parse HTTP request
    enum llhttp_errno err = llhttp_execute(&client_data->parser, buf->base, nread);
    if (err != HPE_OK) {
        printf("HTTP parsing error: %s\n", llhttp_errno_name(err));
        uv_close((uv_handle_t*)client, on_close);
        free(buf->base);
        napi_close_handle_scope(env, scope);
        return;
    }

    // Create request object
    napi_value request, headers;
    napi_create_object(env, &request);
    napi_create_object(env, &headers);

    // Set URL
    napi_value url;
    napi_create_string_utf8(env, client_data->url, client_data->url_len, &url);
    napi_set_named_property(env, request, "url", url);

    // Set method
    napi_value method;
    napi_create_string_utf8(env, client_data->method, client_data->method_len, &method);
    napi_set_named_property(env, request, "method", method);

    // Set headers
    napi_set_named_property(env, request, "headers", headers);

    // Call JavaScript callback
    napi_value global, callback, args[1], result;
    napi_get_global(env, &global);
    napi_get_reference_value(env, client_data->callback, &callback);
    args[0] = request;
    napi_call_function(env, global, callback, 1, args, &result);

    // Get response string
    size_t response_len;
    napi_get_value_string_utf8(env, result, NULL, 0, &response_len);
    char* response = (char*)malloc(response_len + 1);
    napi_get_value_string_utf8(env, result, response, response_len + 1, &response_len);

    // Send response
    send_response(client, response);
    free(response);
    free(buf->base);

    // Close handle scope
    napi_close_handle_scope(env, scope);
}

static void on_connection(uv_stream_t* server, int status) {
    if (status < 0) return;

    server_t* server_data = (server_t*)server->data;
    uv_tcp_t* client = (uv_tcp_t*)malloc(sizeof(uv_tcp_t));
    client_t* client_data = (client_t*)calloc(1, sizeof(client_t));

    // Create handle scope
    napi_handle_scope scope;
    napi_open_handle_scope(server_data->env, &scope);

    // Initialize HTTP parser
    llhttp_settings_init(&client_data->settings);
    client_data->settings.on_url = on_url;
    client_data->settings.on_headers_complete = on_headers_complete;

    llhttp_init(&client_data->parser, HTTP_REQUEST, &client_data->settings);
    client_data->parser.data = client_data;

    // Store callback and env
    client_data->env = server_data->env;
    napi_value callback;
    napi_get_reference_value(server_data->env, server_data->callback, &callback);
    napi_create_reference(server_data->env, callback, 1, &client_data->callback);

    // Initialize client
    client->data = client_data;
    uv_tcp_init(server->loop, client);

    if (uv_accept(server, (uv_stream_t*)client) == 0) {
        uv_read_start((uv_stream_t*)client, allocator, after_read);
    } else {
        uv_close((uv_handle_t*)client, on_close);
    }

    // Close handle scope
    napi_close_handle_scope(server_data->env, scope);
}

static void cleanup_server(napi_env env, void* data, void* hint) {
    server_t* server = (server_t*)data;
    if (server) {
        if (server->callback) {
            napi_delete_reference(env, server->callback);
        }
        if (server->ref) {
            napi_delete_reference(env, server->ref);
        }
        if (!uv_is_closing((uv_handle_t*)&server->server)) {
            uv_close((uv_handle_t*)&server->server, on_close);
        }
    }
}

static napi_value Listen(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value argv[2];
    napi_value this_arg;
    server_t* server;

    // Create handle scope
    napi_handle_scope scope;
    napi_open_handle_scope(env, &scope);

    napi_get_cb_info(env, info, &argc, argv, &this_arg, (void**)&server);
    if (argc < 2) {
        napi_throw_error(env, NULL, "Wrong number of arguments");
        napi_close_handle_scope(env, scope);
        return NULL;
    }

    int32_t port;
    napi_get_value_int32(env, argv[0], &port);
    napi_create_reference(env, argv[1], 1, &server->callback);

    // Get event loop
    uv_loop_t* loop;
    napi_get_uv_event_loop(env, &loop);

    // Initialize server
    uv_tcp_init(loop, &server->server);
    server->server.data = server;

    // Bind to address
    struct sockaddr_in addr;
    uv_ip4_addr("0.0.0.0", port, &addr);
    uv_tcp_bind(&server->server, (const struct sockaddr*)&addr, 0);

    // Start listening
    int result = uv_listen((uv_stream_t*)&server->server, BACKLOG, on_connection);
    if (result != 0) {
        napi_throw_error(env, NULL, "Failed to start server");
        napi_close_handle_scope(env, scope);
        return NULL;
    }

    napi_close_handle_scope(env, scope);
    return NULL;
}

static napi_value Close(napi_env env, napi_callback_info info) {
    napi_value this_arg;
    server_t* server;

    // Create handle scope
    napi_handle_scope scope;
    napi_open_handle_scope(env, &scope);

    napi_get_cb_info(env, info, NULL, NULL, &this_arg, (void**)&server);
    uv_close((uv_handle_t*)&server->server, on_close);

    napi_close_handle_scope(env, scope);
    return NULL;
}

static napi_value Create(napi_env env, napi_callback_info info) {
    // Create handle scope
    napi_handle_scope scope;
    napi_open_handle_scope(env, &scope);

    napi_value server_obj;
    napi_create_object(env, &server_obj);

    server_t* server = (server_t*)calloc(1, sizeof(server_t));
    server->env = env;

    napi_wrap(env, server_obj, server, cleanup_server, NULL, &server->ref);

    napi_value listen_fn;
    napi_create_function(env, "listen", NAPI_AUTO_LENGTH, Listen, server, &listen_fn);
    napi_set_named_property(env, server_obj, "listen", listen_fn);

    napi_value close_fn;
    napi_create_function(env, "close", NAPI_AUTO_LENGTH, Close, server, &close_fn);
    napi_set_named_property(env, server_obj, "close", close_fn);

    napi_value result;
    napi_create_reference(env, server_obj, 1, &server->ref);
    napi_get_reference_value(env, server->ref, &result);

    napi_close_handle_scope(env, scope);
    return result;
}

NAPI_MODULE_INIT() {
    napi_handle_scope scope;
    napi_open_handle_scope(env, &scope);

    napi_value create_fn;
    napi_create_function(env, "create", NAPI_AUTO_LENGTH, Create, NULL, &create_fn);
    napi_set_named_property(env, exports, "create", create_fn);

    napi_close_handle_scope(env, scope);
    return exports;
}