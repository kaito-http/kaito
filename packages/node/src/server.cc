#include <node_api.h>
#include "llhttp.h"
#include "uv.h"
#include "uv/unix.h" // For UV_HANDLE_CLOSING
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <signal.h>
#include <execinfo.h> 
#include <unistd.h>

// Type definitions
typedef struct {
    napi_env env;
    napi_ref callback;
    napi_ref ref;  // Strong reference to the server object
    uv_tcp_t server;
} tcp_server_t;

typedef struct {
    napi_env env;
    napi_ref on_request;
    uv_tcp_t handle;
    llhttp_t parser;
    llhttp_settings_t settings;
    char* url;
    size_t url_len;
    char* current_field;
    size_t current_field_len;
    char* current_value;
    size_t current_value_len;
    char* body;
    size_t body_len;
    napi_ref headers_obj;  // Reference to headers object
    char* method;  // Store HTTP method
    size_t method_len;
} client_t;

typedef struct {
    uv_write_t req;
    uv_buf_t buf;
} write_req_t;

// Forward declarations
static void on_close(uv_handle_t* handle);
static void on_write(uv_write_t* req, int status);
static void on_read(uv_stream_t* stream, ssize_t nread, const uv_buf_t* buf);
static void alloc_buffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf);
static void on_connection(uv_stream_t* server, int status);
static void create_request_object(client_t* client, napi_value* result);

// HTTP parser callbacks
static int on_message_begin(llhttp_t* parser);
static int on_url(llhttp_t* parser, const char* at, size_t length);
static int on_header_field(llhttp_t* parser, const char* at, size_t length);
static int on_header_value(llhttp_t* parser, const char* at, size_t length);
static int on_body(llhttp_t* parser, const char* at, size_t length);
static int on_message_complete(llhttp_t* parser);

// Signal handler
static void signal_handler(int sig) {
    void* array[10];
    size_t size;

    // Get void*'s for all entries on the stack
    size = backtrace(array, 10);

    // Print out all the frames to stderr
    fprintf(stderr, "\nError: signal %d:\n", sig);
    backtrace_symbols_fd(array, size, STDOUT_FILENO);
    exit(1);
}

// Forward declarations
static void free_client(client_t* client);
static void on_close(uv_handle_t* handle);
static void write_cb(uv_write_t* req, int status);
static void send_response(client_t* client, const char* response_str);
static int on_message_begin(llhttp_t* parser);
static int on_url(llhttp_t* parser, const char* at, size_t length);
static int on_header_field(llhttp_t* parser, const char* at, size_t length);
static int on_header_value(llhttp_t* parser, const char* at, size_t length);
static int on_body(llhttp_t* parser, const char* at, size_t length);
static int on_message_complete(llhttp_t* parser);
static void alloc_buffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf);
static void on_read(uv_stream_t* stream, ssize_t nread, const uv_buf_t* buf);
static void on_connection(uv_stream_t* server, int status);
static napi_value Listen(napi_env env, napi_callback_info info);
static void on_server_close(uv_handle_t* handle);
static void cleanup_server(napi_env env, void* data, void* hint);
static napi_value Create(napi_env env, napi_callback_info info);
static napi_value respond_callback(napi_env env, napi_callback_info info);

// Function implementations
static void on_connection(uv_stream_t* server, int status) {
    if (status < 0) {
        return;
    }
    
    tcp_server_t* server_data = (tcp_server_t*)server->data;
    if (!server_data) {
        return;
    }
    
    client_t* client = (client_t*)calloc(1, sizeof(client_t));
    if (!client) {
        return;
    }
    
    int err = uv_tcp_init(server->loop, &client->handle);
    if (err != 0) {
        free(client);
        return;
    }
    
    client->handle.data = client;
    client->env = server_data->env;
    client->on_request = server_data->callback;
    
    err = uv_accept(server, (uv_stream_t*)&client->handle);
    if (err != 0) {
        uv_close((uv_handle_t*)&client->handle, on_close);
        return;
    }
    
    llhttp_settings_init(&client->settings);
    client->settings.on_message_begin = on_message_begin;
    client->settings.on_url = on_url;
    client->settings.on_header_field = on_header_field;
    client->settings.on_header_value = on_header_value;
    client->settings.on_body = on_body;
    client->settings.on_message_complete = on_message_complete;
    
    llhttp_init(&client->parser, HTTP_REQUEST, &client->settings);
    client->parser.data = client;
    
    err = uv_read_start((uv_stream_t*)&client->handle, alloc_buffer, on_read);
    if (err != 0) {
        uv_close((uv_handle_t*)&client->handle, on_close);
        return;
    }
}

static void free_client(client_t* client) {
    if (client->url) free(client->url);
    if (client->current_field) free(client->current_field);
    if (client->current_value) free(client->current_value);
    if (client->body) free(client->body);
    free(client);
}

static void on_close(uv_handle_t* handle) {
    client_t* client = (client_t*)handle->data;
    if (client) {
        free_client(client);
    }
}

static void write_cb(uv_write_t* req, int status) {
    if (!req) return;
    
    write_req_t* wr = (write_req_t*)req;
    if (wr && wr->buf.base) {
        free(wr->buf.base);
    }
    free(wr);
    
    if (req->handle && !uv_is_closing((uv_handle_t*)req->handle)) {
        uv_close((uv_handle_t*)req->handle, on_close);
    }
}

static void send_response(client_t* client, const char* response_str) {
    if (!client) return;
    
    uv_read_stop((uv_stream_t*)&client->handle);
    
    write_req_t* wr = (write_req_t*)calloc(1, sizeof(write_req_t));
    if (!wr) {
        uv_close((uv_handle_t*)&client->handle, on_close);
        return;
    }
    
    // Format the HTTP response with the provided string
    const char* response_template = "HTTP/1.1 200 OK\r\nContent-Length: %zu\r\nConnection: close\r\n\r\n%s";
    size_t content_length = strlen(response_str);
    size_t total_length = snprintf(NULL, 0, response_template, content_length, response_str) + 1;
    
    wr->buf.base = (char*)malloc(total_length);
    if (!wr->buf.base) {
        free(wr);
        uv_close((uv_handle_t*)&client->handle, on_close);
        return;
    }

    snprintf(wr->buf.base, total_length, response_template, content_length, response_str);
    wr->buf.len = total_length - 1;  // Exclude null terminator
    
    int err = uv_write((uv_write_t*)wr, (uv_stream_t*)&client->handle, &wr->buf, 1, write_cb);
    if (err != 0) {
        free(wr->buf.base);
        free(wr);
        uv_close((uv_handle_t*)&client->handle, on_close);
        return;
    }
}

static int on_message_begin(llhttp_t* parser) {
    client_t* client = (client_t*)parser->data;
    if (!client) return -1;
    
    // Store HTTP method
    const char* method = llhttp_method_name((llhttp_method_t)parser->method);
    size_t method_len = strlen(method);
    client->method = (char*)malloc(method_len + 1);
    if (!client->method) return -1;
    memcpy(client->method, method, method_len);
    client->method[method_len] = '\0';
    client->method_len = method_len;
    
    return 0;
}

static int on_url(llhttp_t* parser, const char* at, size_t length) {
    client_t* client = (client_t*)parser->data;
    if (!client) return -1;
    
    if (client->url) free(client->url);
    client->url = (char*)malloc(length + 1);
    if (!client->url) return -1;
    
    memcpy(client->url, at, length);
    client->url[length] = '\0';
    client->url_len = length;
    return 0;
}

static int on_header_field(llhttp_t* parser, const char* at, size_t length) {
    client_t* client = (client_t*)parser->data;
    if (!client) return -1;
    
    if (client->current_field) free(client->current_field);
    client->current_field = (char*)malloc(length + 1);
    if (!client->current_field) return -1;
    
    memcpy(client->current_field, at, length);
    client->current_field[length] = '\0';
    client->current_field_len = length;
    return 0;
}

static int on_header_value(llhttp_t* parser, const char* at, size_t length) {
    client_t* client = (client_t*)parser->data;
    if (!client) return -1;
    
    napi_value headers;
    napi_get_reference_value(client->env, client->headers_obj, &headers);
    
    napi_value field_name, field_value;
    napi_create_string_utf8(client->env, client->current_field, client->current_field_len, &field_name);
    napi_create_string_utf8(client->env, at, length, &field_value);
    
    napi_set_property(client->env, headers, field_name, field_value);
    return 0;
}

static int on_body(llhttp_t* parser, const char* at, size_t length) {
    return 0;
}

static int on_message_complete(llhttp_t* parser) {
    client_t* client = (client_t*)parser->data;
    if (!client) return -1;
    
    napi_value request_obj;
    create_request_object(client, &request_obj);
    
    // Call the JavaScript callback with the request object
    napi_value callback;
    napi_get_reference_value(client->env, client->on_request, &callback);
    
    napi_value global;
    napi_get_global(client->env, &global);
    
    napi_value argv[1] = { request_obj };
    napi_value result;
    napi_call_function(client->env, global, callback, 1, argv, &result);
    
    // Get the string response from JavaScript
    size_t response_length;
    napi_get_value_string_utf8(client->env, result, NULL, 0, &response_length);
    char* response_str = (char*)malloc(response_length + 1);
    napi_get_value_string_utf8(client->env, result, response_str, response_length + 1, &response_length);
    
    // Send the response
    send_response(client, response_str);
    
    // Clean up
    free(response_str);
    
    return 0;
}

static void alloc_buffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf) {
    buf->base = (char*)malloc(suggested_size);
    if (!buf->base) {
        buf->len = 0;
        return;
    }
    buf->len = suggested_size;
}

static void on_read(uv_stream_t* stream, ssize_t nread, const uv_buf_t* buf) {
    client_t* client = (client_t*)stream->data;
    if (!client) {
        if (buf->base) free(buf->base);
        return;
    }
    
    if (nread < 0) {
        if (buf->base) free(buf->base);
        uv_close((uv_handle_t*)stream, on_close);
        return;
    }

    if (nread == 0) {
        if (buf->base) free(buf->base);
        return;
    }

    enum llhttp_errno err = llhttp_execute(&client->parser, buf->base, nread);
    if (buf->base) free(buf->base);

    if (err != HPE_OK) {
        uv_close((uv_handle_t*)stream, on_close);
        return;
    }
}

static void on_server_close(uv_handle_t* handle) {
    if (handle->data) {
        tcp_server_t* server = (tcp_server_t*)handle->data;
        free(server);
    }
}

static void cleanup_server(napi_env env, void* data, void* hint) {
    tcp_server_t* server = (tcp_server_t*)data;
    if (server) {
        if (server->callback) {
            napi_delete_reference(env, server->callback);
            server->callback = NULL;
        }
        
        if (server->ref) {
            napi_delete_reference(env, server->ref);
            server->ref = NULL;
        }
        
        if (!uv_is_closing((uv_handle_t*)&server->server)) {
            uv_close((uv_handle_t*)&server->server, on_server_close);
        }
    }
}

static napi_value Create(napi_env env, napi_callback_info info) {
    size_t argc = 0;
    napi_value this_arg;
    napi_status status = napi_get_cb_info(env, info, &argc, NULL, &this_arg, NULL);
    if (status != napi_ok) return NULL;
    
    // Get the event loop
    napi_value global;
    status = napi_get_global(env, &global);
    if (status != napi_ok) return NULL;
    
    napi_value loop_external;
    status = napi_get_named_property(env, global, "_uv_loop", &loop_external);
    if (status != napi_ok) return NULL;
    
    void* loop_ptr;
    status = napi_get_value_external(env, loop_external, &loop_ptr);
    if (status != napi_ok) return NULL;
    
    uv_loop_t* loop = (uv_loop_t*)loop_ptr;
    if (!loop) return NULL;
    
    // Create server structure
    tcp_server_t* server = (tcp_server_t*)calloc(1, sizeof(tcp_server_t));
    if (!server) return NULL;
    
    server->env = env;
    
    // Initialize TCP server handle
    int err = uv_tcp_init(loop, &server->server);
    if (err != 0) {
        free(server);
        return NULL;
    }
    
    server->server.data = server;
    
    // Create JavaScript object
    napi_value obj;
    status = napi_create_object(env, &obj);
    if (status != napi_ok) {
        free(server);
        return NULL;
    }
    
    // Wrap native object
    status = napi_wrap(env, obj, server, cleanup_server, NULL, &server->ref);
    if (status != napi_ok) {
        free(server);
        return NULL;
    }
    
    // Create listen function
    napi_value listen_fn;
    status = napi_create_function(env, "listen", NAPI_AUTO_LENGTH, Listen, server, &listen_fn);
    if (status != napi_ok) return NULL;
    
    // Add listen function to server object
    status = napi_set_named_property(env, obj, "listen", listen_fn);
    if (status != napi_ok) return NULL;
    
    // Store server reference in global object
    status = napi_set_named_property(env, global, "_http_server", this_arg);
    if (status != napi_ok) return NULL;
    
    return obj;
}

static napi_value Listen(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value argv[2];
    napi_value this_arg;
    void* data;
    
    napi_status status = napi_get_cb_info(env, info, &argc, argv, &this_arg, &data);
    if (status != napi_ok) {
        return NULL;
    }
    
    // Get the server pointer from the wrapped object
    tcp_server_t* server;
    status = napi_unwrap(env, this_arg, (void**)&server);
    if (status != napi_ok) {
        return NULL;
    }
    
    int32_t port;
    status = napi_get_value_int32(env, argv[0], &port);
    if (status != napi_ok) {
        return NULL;
    }
    
    // Create a reference to the callback
    status = napi_create_reference(env, argv[1], 1, &server->callback);
    if (status != napi_ok) {
        return NULL;
    }
    server->env = env;
    
    // Get the default loop
    uv_loop_t* loop = uv_default_loop();
    if (!loop) {
        return NULL;
    }
    
    // Set TCP options
    int err = uv_tcp_nodelay(&server->server, 1);
    if (err != 0) {
        return NULL;
    }
    
    err = uv_tcp_simultaneous_accepts(&server->server, 1);
    if (err != 0) {
        return NULL;
    }
    
    // Bind to IPv4 address
    struct sockaddr_in addr;
    err = uv_ip4_addr("0.0.0.0", port, &addr);
    if (err != 0) {
        return NULL;
    }
    
    err = uv_tcp_bind(&server->server, (const struct sockaddr*)&addr, 0);
    if (err != 0) {
        return NULL;
    }
    
    // Set the server data pointer
    server->server.data = server;
    
    // Cast the server handle to a stream handle
    uv_stream_t* stream = (uv_stream_t*)&server->server;
    
    // Check handle state before listen
    if (uv_is_closing((uv_handle_t*)stream)) {
        return NULL;
    }
    if (uv_is_active((uv_handle_t*)stream)) {
        return NULL;
    }
    
    err = uv_listen(stream, 128, on_connection);
    if (err != 0) {
        return NULL;
    }
    
    // Check handle state after listen
    if (uv_is_closing((uv_handle_t*)stream)) {
        return NULL;
    }
    if (!uv_is_active((uv_handle_t*)stream)) {
        return NULL;
    }
    
    // Keep a global reference to the server object
    napi_value global;
    status = napi_get_global(env, &global);
    if (status != napi_ok) {
        return NULL;
    }
    
    status = napi_set_named_property(env, global, "_http_server", this_arg);
    if (status != napi_ok) {
        return NULL;
    }
    
    // Start the event loop
    uv_run(loop, UV_RUN_DEFAULT);
    
    // Return undefined instead of NULL
    napi_value undefined;
    napi_get_undefined(env, &undefined);
    return undefined;
}

static void create_request_object(client_t* client, napi_value* result) {
    napi_env env = client->env;
    napi_value obj;
    
    // Create request info object
    napi_create_object(env, &obj);
    
    // Add method
    napi_value method;
    napi_create_string_utf8(env, client->method, client->method_len, &method);
    napi_set_named_property(env, obj, "method", method);
    
    // Add url
    napi_value url;
    napi_create_string_utf8(env, client->url, client->url_len, &url);
    napi_set_named_property(env, obj, "url", url);
    
    // Add headers object
    napi_value headers;
    napi_create_object(env, &headers);
    
    // Store headers in client for later use
    napi_create_reference(env, headers, 1, &client->headers_obj);
    napi_set_named_property(env, obj, "headers", headers);
    
    // Create readable stream for body
    napi_value read_stream;
    napi_create_object(env, &read_stream);
    napi_set_named_property(env, obj, "bodyStream", read_stream);
    
    *result = obj;
}

NAPI_MODULE_INIT() {
    signal(SIGSEGV, signal_handler);
    signal(SIGABRT, signal_handler);
    signal(SIGBUS, signal_handler);
    signal(SIGILL, signal_handler);
    signal(SIGFPE, signal_handler);
    
    uv_loop_t* loop = uv_default_loop();
    if (!loop) return NULL;
    
    napi_value create_fn;
    napi_status status = napi_create_function(env, "create", NAPI_AUTO_LENGTH, Create, loop, &create_fn);
    if (status != napi_ok) return NULL;
    
    status = napi_set_named_property(env, exports, "create", create_fn);
    if (status != napi_ok) return NULL;
    
    napi_value global;
    status = napi_get_global(env, &global);
    if (status != napi_ok) return NULL;
    
    napi_value loop_external;
    status = napi_create_external(env, loop, NULL, NULL, &loop_external);
    if (status != napi_ok) return NULL;
    
    status = napi_set_named_property(env, global, "_uv_loop", loop_external);
    if (status != napi_ok) return NULL;
    
    return exports;
}