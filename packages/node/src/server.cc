#include <node_api.h>
#include "../../../deps/llhttp/build/llhttp.h"
#include "../libuv/include/uv.h"  // Using the exact path from your monorepo
#include "../libuv/include/uv/unix.h"  // For UV_HANDLE_CLOSING
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <signal.h>
#include <execinfo.h>
#include <unistd.h>

// Forward declarations
static void on_close(uv_handle_t* handle);
static void on_write(uv_write_t* req, int status);
static void on_read(uv_stream_t* stream, ssize_t nread, const uv_buf_t* buf);
static void alloc_buffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf);
static void on_connection(uv_stream_t* server, int status);
static void on_walk(uv_handle_t* handle, void* arg);

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

// Handle walking callback
static void on_walk(uv_handle_t* handle, void* arg) {
    const char* type_name;
    switch (handle->type) {
        case UV_ASYNC: type_name = "UV_ASYNC"; break;
        case UV_CHECK: type_name = "UV_CHECK"; break;
        case UV_FS_EVENT: type_name = "UV_FS_EVENT"; break;
        case UV_FS_POLL: type_name = "UV_FS_POLL"; break;
        case UV_HANDLE: type_name = "UV_HANDLE"; break;
        case UV_IDLE: type_name = "UV_IDLE"; break;
        case UV_NAMED_PIPE: type_name = "UV_NAMED_PIPE"; break;
        case UV_POLL: type_name = "UV_POLL"; break;
        case UV_PREPARE: type_name = "UV_PREPARE"; break;
        case UV_PROCESS: type_name = "UV_PROCESS"; break;
        case UV_STREAM: type_name = "UV_STREAM"; break;
        case UV_TCP: type_name = "UV_TCP"; break;
        case UV_TIMER: type_name = "UV_TIMER"; break;
        case UV_TTY: type_name = "UV_TTY"; break;
        case UV_UDP: type_name = "UV_UDP"; break;
        case UV_SIGNAL: type_name = "UV_SIGNAL"; break;
        case UV_FILE: type_name = "UV_FILE"; break;
        default: type_name = "UNKNOWN"; break;
    }
    
    const char* flag_desc = "";
    if (handle->flags & 0x01) flag_desc = " (ACTIVE)";
    else if (handle->flags & 0x02) flag_desc = " (CLOSING)";
    else if (handle->flags & 0x04) flag_desc = " (CLOSED)";
    else flag_desc = " (INACTIVE)";
    
    printf("[DEBUG_POINT] Handle %p - type: %s (%d), flags: 0x%x%s, data: %p\n",
           (void*)handle, type_name, handle->type, handle->flags, flag_desc, handle->data);
    
    // Check if handle is active
    if (uv_is_active(handle)) {
        printf("[DEBUG_POINT] Handle is ACTIVE\n");
    }
    
    // Check if handle is closing
    if (uv_is_closing(handle)) {
        printf("[DEBUG_POINT] Handle is CLOSING\n");
    }
    
    // For stream handles, check if they are readable/writable
    if (handle->type == UV_TCP || handle->type == UV_NAMED_PIPE || handle->type == UV_TTY) {
        uv_stream_t* stream = (uv_stream_t*)handle;
        printf("[DEBUG_POINT] Stream is %s and %s\n",
               uv_is_readable(stream) ? "readable" : "not readable",
               uv_is_writable(stream) ? "writable" : "not writable");
    }
    
    fflush(stdout);
}

static void on_prepare(uv_prepare_t* handle) {
    printf("[DEBUG_POINT] Event loop iteration starting - handle: %p\n", (void*)handle);
    uv_loop_t* loop = handle->loop;
    printf("[DEBUG_POINT] Loop state - alive: %d, active handles: %d\n",
           uv_loop_alive(loop), loop->active_handles);
    printf("[DEBUG_POINT] Walking handles at start of iteration:\n");
    uv_walk(loop, on_walk, NULL);
    fflush(stdout);
}

static void on_check(uv_check_t* handle) {
    printf("[DEBUG_POINT] Event loop iteration ending - handle: %p\n", (void*)handle);
    uv_loop_t* loop = handle->loop;
    printf("[DEBUG_POINT] Loop state - alive: %d, active handles: %d\n",
           uv_loop_alive(loop), loop->active_handles);
    printf("[DEBUG_POINT] Walking handles at end of iteration:\n");
    uv_walk(loop, on_walk, NULL);
    fflush(stdout);
}

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
} client_t;

typedef struct {
    uv_write_t req;
    uv_buf_t buf;
} write_req_t;

// Forward declarations
static void free_client(client_t* client);
static void on_close(uv_handle_t* handle);
static void write_cb(uv_write_t* req, int status);
static void send_response(client_t* client);
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
    printf("\n[DEBUG_ENTER] ========== on_connection ==========\n");
    printf("[DEBUG_POINT] Status: %d\n", status);
    
    if (status < 0) {
        printf("[DEBUG_ERROR] Connection error: %s\n", uv_strerror(status));
        printf("[DEBUG_EXIT] ================================\n\n");
        fflush(stdout);
        return;
    }
    
    tcp_server_t* server_data = (tcp_server_t*)server->data;
    if (!server_data) {
        printf("[DEBUG_ERROR] Server data is NULL\n");
        printf("[DEBUG_EXIT] ================================\n\n");
        fflush(stdout);
        return;
    }
    
    // Allocate client structure
    client_t* client = (client_t*)calloc(1, sizeof(client_t));
    if (!client) {
        printf("[DEBUG_ERROR] Failed to allocate client\n");
        printf("[DEBUG_EXIT] ================================\n\n");
        fflush(stdout);
        return;
    }
    
    // Initialize TCP handle
    int err = uv_tcp_init(server->loop, &client->handle);
    if (err != 0) {
        printf("[DEBUG_ERROR] Failed to initialize client TCP handle: %s\n", uv_strerror(err));
        free(client);
        printf("[DEBUG_EXIT] ================================\n\n");
        fflush(stdout);
        return;
    }
    
    client->handle.data = client;
    client->env = server_data->env;
    client->on_request = server_data->callback;
    
    // Accept the connection
    err = uv_accept(server, (uv_stream_t*)&client->handle);
    if (err != 0) {
        printf("[DEBUG_ERROR] Failed to accept connection: %s\n", uv_strerror(err));
        uv_close((uv_handle_t*)&client->handle, on_close);
        printf("[DEBUG_EXIT] ================================\n\n");
        fflush(stdout);
        return;
    }
    
    // Initialize HTTP parser
    llhttp_settings_init(&client->settings);
    client->settings.on_message_begin = on_message_begin;
    client->settings.on_url = on_url;
    client->settings.on_header_field = on_header_field;
    client->settings.on_header_value = on_header_value;
    client->settings.on_body = on_body;
    client->settings.on_message_complete = on_message_complete;
    
    llhttp_init(&client->parser, HTTP_REQUEST, &client->settings);
    client->parser.data = client;
    
    // Start reading
    err = uv_read_start((uv_stream_t*)&client->handle, alloc_buffer, on_read);
    if (err != 0) {
        printf("[DEBUG_ERROR] Failed to start reading: %s\n", uv_strerror(err));
        uv_close((uv_handle_t*)&client->handle, on_close);
        printf("[DEBUG_EXIT] ================================\n\n");
        fflush(stdout);
        return;
    }
    
    printf("[DEBUG_EXIT] ================================\n\n");
    fflush(stdout);
}

static void free_client(client_t* client) {
    if (client->url) {
        free(client->url);
    }
    if (client->current_field) {
        free(client->current_field);
    }
    if (client->current_value) {
        free(client->current_value);
    }
    if (client->body) {
        free(client->body);
    }
    free(client);
}

static void on_close(uv_handle_t* handle) {
    printf("[DEBUG_POINT] Closing handle %p\n", (void*)handle);
    client_t* client = (client_t*)handle->data;
    if (client) {
        free_client(client);
    }
    printf("[DEBUG_POINT] Handle closed and client freed\n");
    fflush(stdout);
}

static void write_cb(uv_write_t* req, int status) {
    printf("[DEBUG_POINT] Write callback - status: %d\n", status);
    if (!req) {
        printf("[DEBUG_ERROR] Write request is NULL\n");
        return;
    }
    
    if (status < 0) {
        printf("[DEBUG_ERROR] Write error: %s\n", uv_strerror(status));
    }
    
    // Free the write request and buffer
    write_req_t* wr = (write_req_t*)req;
    if (wr && wr->buf.base) {
        free(wr->buf.base);
    }
    free(wr);
    
    // Close the handle
    if (req->handle && !uv_is_closing((uv_handle_t*)req->handle)) {
        uv_close((uv_handle_t*)req->handle, on_close);
    }
    
    printf("[DEBUG_POINT] Write callback completed\n");
    fflush(stdout);
}

static void send_response(client_t* client) {
    printf("[DEBUG_POINT] Sending response for client %p\n", (void*)client);
    if (!client) {
        printf("[DEBUG_ERROR] Client is NULL\n");
        return;
    }
    
    // Stop reading from the client since we're going to close after write
    uv_read_stop((uv_stream_t*)&client->handle);
    
    // Allocate write request
    write_req_t* wr = (write_req_t*)calloc(1, sizeof(write_req_t));
    if (!wr) {
        printf("[DEBUG_ERROR] Failed to allocate write request\n");
        uv_close((uv_handle_t*)&client->handle, on_close);
        return;
    }
    
    // Prepare response
    const char* response = "HTTP/1.1 200 OK\r\nContent-Length: 13\r\nConnection: close\r\n\r\nHello, World!\n";
    size_t len = strlen(response);
    
    // Allocate and copy response buffer
    wr->buf.base = (char*)malloc(len);
    if (!wr->buf.base) {
        printf("[DEBUG_ERROR] Failed to allocate response buffer\n");
        free(wr);
        uv_close((uv_handle_t*)&client->handle, on_close);
        return;
    }
    memcpy(wr->buf.base, response, len);
    wr->buf.len = len;
    
    printf("[DEBUG_POINT] Writing response - length: %zu\n", len);
    int err = uv_write((uv_write_t*)wr, (uv_stream_t*)&client->handle, &wr->buf, 1, write_cb);
    if (err != 0) {
        printf("[DEBUG_ERROR] Failed to write response: %s\n", uv_strerror(err));
        free(wr->buf.base);
        free(wr);
        uv_close((uv_handle_t*)&client->handle, on_close);
        return;
    }
    printf("[DEBUG_POINT] Response write initiated\n");
    fflush(stdout);
}

static int on_message_begin(llhttp_t* parser) {
    printf("[DEBUG_POINT] Message begin\n");
    return 0;
}

static int on_url(llhttp_t* parser, const char* at, size_t length) {
    printf("[DEBUG_POINT] URL received - length: %zu\n", length);
    client_t* client = (client_t*)parser->data;
    if (!client) {
        printf("[DEBUG_ERROR] Client data is NULL in on_url\n");
        return -1;
    }
    
    if (client->url) {
        free(client->url);
    }
    client->url = (char*)malloc(length + 1);
    if (!client->url) {
        printf("[DEBUG_ERROR] Failed to allocate URL buffer\n");
        return -1;
    }
    memcpy(client->url, at, length);
    client->url[length] = '\0';
    client->url_len = length;
    printf("[DEBUG_POINT] URL stored: %s\n", client->url);
    return 0;
}

static int on_header_field(llhttp_t* parser, const char* at, size_t length) {
    printf("[DEBUG_POINT] Header field received - length: %zu\n", length);
    client_t* client = (client_t*)parser->data;
    if (!client) {
        printf("[DEBUG_ERROR] Client data is NULL in on_header_field\n");
        return -1;
    }
    
    if (client->current_field) {
        free(client->current_field);
    }
    client->current_field = (char*)malloc(length + 1);
    if (!client->current_field) {
        printf("[DEBUG_ERROR] Failed to allocate header field buffer\n");
        return -1;
    }
    memcpy(client->current_field, at, length);
    client->current_field[length] = '\0';
    client->current_field_len = length;
    printf("[DEBUG_POINT] Header field stored: %s\n", client->current_field);
    return 0;
}

static int on_header_value(llhttp_t* parser, const char* at, size_t length) {
    printf("[DEBUG_POINT] Header value received - length: %zu\n", length);
    client_t* client = (client_t*)parser->data;
    if (!client) {
        printf("[DEBUG_ERROR] Client data is NULL in on_header_value\n");
        return -1;
    }
    
    if (client->current_value) {
        free(client->current_value);
    }
    client->current_value = (char*)malloc(length + 1);
    if (!client->current_value) {
        printf("[DEBUG_ERROR] Failed to allocate header value buffer\n");
        return -1;
    }
    memcpy(client->current_value, at, length);
    client->current_value[length] = '\0';
    client->current_value_len = length;
    printf("[DEBUG_POINT] Header value stored: %s\n", client->current_value);
    return 0;
}

static int on_body(llhttp_t* parser, const char* at, size_t length) {
    printf("[DEBUG_POINT] Body received - length: %zu\n", length);
    client_t* client = (client_t*)parser->data;
    if (!client) {
        printf("[DEBUG_ERROR] Client data is NULL in on_body\n");
        return -1;
    }
    
    if (length == 0) {
        printf("[DEBUG_POINT] Empty body chunk\n");
        return 0;
    }
    
    // For now, we'll just ignore the body data since we don't need it
    printf("[DEBUG_POINT] Ignoring body data\n");
    return 0;
}

static int on_message_complete(llhttp_t* parser) {
    printf("[DEBUG_POINT] Message complete\n");
    client_t* client = (client_t*)parser->data;
    if (!client) {
        printf("[DEBUG_ERROR] Client data is NULL in on_message_complete\n");
        return -1;
    }
    
    send_response(client);
    printf("[DEBUG_POINT] Response sent\n");
    return 0;
}

static void alloc_buffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf) {
    printf("[DEBUG_POINT] Allocating buffer - suggested size: %zu\n", suggested_size);
    buf->base = (char*)malloc(suggested_size);
    if (!buf->base) {
        printf("[DEBUG_ERROR] Failed to allocate read buffer\n");
        buf->len = 0;
        return;
    }
    buf->len = suggested_size;
    printf("[DEBUG_POINT] Buffer allocated - base: %p, length: %zu\n", 
           (void*)buf->base, buf->len);
}

static void on_read(uv_stream_t* stream, ssize_t nread, const uv_buf_t* buf) {
    printf("\n[DEBUG_ENTER] ========== on_read ==========\n");
    printf("[DEBUG_POINT] Read callback - nread: %zd\n", nread);
    printf("[DEBUG_POINT] Stream handle: %p\n", (void*)stream);
    printf("[DEBUG_POINT] Stream type: %s (%d)\n", 
           stream->type == UV_TCP ? "UV_TCP" : "UNKNOWN", stream->type);
    printf("[DEBUG_POINT] Stream flags: %d\n", stream->flags);
    printf("[DEBUG_POINT] Stream data: %p\n", (void*)stream->data);
    
    client_t* client = (client_t*)stream->data;
    if (!client) {
        printf("[DEBUG_ERROR] Client data is NULL\n");
        if (buf->base) {
            free(buf->base);
        }
        printf("[DEBUG_EXIT] ================================\n\n");
        fflush(stdout);
        return;
    }
    printf("[DEBUG_POINT] Client data retrieved - env: %p, callback: %p\n", 
           (void*)client->env, (void*)client->on_request);
    
    // Get the loop
    uv_loop_t* loop = stream->loop;
    printf("[DEBUG_POINT] Loop state - alive: %d, active handles: %d\n",
           uv_loop_alive(loop), loop->active_handles);
    printf("[DEBUG_POINT] Walking handles at read start:\n");
    uv_walk(loop, on_walk, NULL);
    fflush(stdout);
    
    if (nread < 0) {
        if (nread != UV_EOF) {
            printf("[DEBUG_ERROR] Read error: %s\n", uv_strerror(nread));
        } else {
            printf("[DEBUG_POINT] End of stream\n");
        }
        printf("[DEBUG_POINT] Closing connection\n");
        if (buf->base) {
            free(buf->base);
        }
        uv_close((uv_handle_t*)stream, on_close);
        printf("[DEBUG_EXIT] ================================\n\n");
        fflush(stdout);
        return;
    }

    if (nread == 0) {
        printf("[DEBUG_POINT] Empty read\n");
        if (buf->base) {
            free(buf->base);
        }
        printf("[DEBUG_EXIT] ================================\n\n");
        fflush(stdout);
        return;
    }

    printf("[DEBUG_POINT] Received %zd bytes\n", nread);
    if (buf->base) {
        printf("[DEBUG_POINT] First 32 bytes of data: ");
        for (ssize_t i = 0; i < nread && i < 32; i++) {
            printf("%c", buf->base[i]);
        }
        printf("\n");
    }
    
    printf("[DEBUG_POINT] Parsing request data\n");
    enum llhttp_errno err = llhttp_execute(&client->parser, buf->base, nread);
    if (buf->base) {
        free(buf->base);
    }

    if (err != HPE_OK) {
        printf("[DEBUG_ERROR] Parse error: %s\n", llhttp_errno_name(err));
        uv_close((uv_handle_t*)stream, on_close);
        printf("[DEBUG_EXIT] ================================\n\n");
        fflush(stdout);
        return;
    }

    printf("[DEBUG_POINT] Data parsed successfully\n");
    printf("[DEBUG_EXIT] ================================\n\n");
    fflush(stdout);
}

static void on_server_close(uv_handle_t* handle) {
    printf("[DEBUG_POINT] Server handle closing at %p\n", (void*)handle);
    printf("[DEBUG_POINT] Server handle type: %s (%d)\n", 
           handle->type == UV_TCP ? "UV_TCP" : "UNKNOWN", handle->type);
    printf("[DEBUG_POINT] Server handle flags: 0x%x\n", handle->flags);
    
    if (handle->data) {
        tcp_server_t* server = (tcp_server_t*)handle->data;
        printf("[DEBUG_POINT] Server data found at %p\n", (void*)server);
        printf("[DEBUG_POINT] Server env: %p, callback: %p\n", 
               (void*)server->env, (void*)server->callback);
        
        // Get the loop
        uv_loop_t* loop = handle->loop;
        printf("[DEBUG_POINT] Loop state before cleanup - alive: %d, active handles: %d\n",
               uv_loop_alive(loop), loop->active_handles);
        printf("[DEBUG_POINT] Walking handles before cleanup:\n");
        uv_walk(loop, on_walk, NULL);
        
        // Free the server structure
        free(server);
        printf("[DEBUG_POINT] Server structure freed\n");
        
        // Check loop state after cleanup
        printf("[DEBUG_POINT] Loop state after cleanup - alive: %d, active handles: %d\n",
               uv_loop_alive(loop), loop->active_handles);
        printf("[DEBUG_POINT] Walking handles after cleanup:\n");
        uv_walk(loop, on_walk, NULL);
    } else {
        printf("[DEBUG_ERROR] Server handle data is NULL\n");
    }
    
    printf("[DEBUG_POINT] Server handle closed\n");
    fflush(stdout);
}

static void cleanup_server(napi_env env, void* data, void* hint) {
    printf("[DEBUG_POINT] Cleaning up server at %p\n", data);
    tcp_server_t* server = (tcp_server_t*)data;
    if (server) {
        printf("[DEBUG_POINT] Server found with env=%p, callback=%p, ref=%p\n", 
               (void*)server->env, (void*)server->callback, (void*)server->ref);
        
        // Delete the callback reference
        if (server->callback) {
            printf("[DEBUG_POINT] Deleting callback reference\n");
            napi_delete_reference(env, server->callback);
            server->callback = NULL;
        }
        
        // Delete the server reference
        if (server->ref) {
            printf("[DEBUG_POINT] Deleting server reference\n");
            napi_delete_reference(env, server->ref);
            server->ref = NULL;
        }
        
        // Get the loop
        uv_loop_t* loop = server->server.loop;
        printf("[DEBUG_POINT] Loop state before cleanup - alive: %d, active handles: %d\n",
               uv_loop_alive(loop), loop->active_handles);
        printf("[DEBUG_POINT] Walking handles before cleanup:\n");
        uv_walk(loop, on_walk, NULL);
        
        // Check handle state
        printf("[DEBUG_POINT] Server handle type: %s (%d)\n", 
               server->server.type == UV_TCP ? "UV_TCP" : "UNKNOWN", server->server.type);
        printf("[DEBUG_POINT] Server handle flags: 0x%x\n", server->server.flags);
        
        if (uv_is_active((uv_handle_t*)&server->server)) {
            printf("[DEBUG_POINT] Server handle is active before close\n");
        }
        if (uv_is_closing((uv_handle_t*)&server->server)) {
            printf("[DEBUG_POINT] Server handle is already closing\n");
        } else {
            printf("[DEBUG_POINT] Closing server handle\n");
            uv_close((uv_handle_t*)&server->server, on_server_close);
        }
    } else {
        printf("[DEBUG_ERROR] Server data is NULL\n");
    }
    printf("[DEBUG_POINT] Server cleanup complete\n");
    fflush(stdout);
}

static napi_value Create(napi_env env, napi_callback_info info) {
    printf("\n[DEBUG] ========== Create Server ==========\n");
    printf("[DEBUG] Create called\n");
    
    // Get the default loop
    uv_loop_t* loop = uv_default_loop();
    if (!loop) {
        printf("[DEBUG_ERROR] Failed to get default loop\n");
        return NULL;
    }
    printf("[DEBUG] Got event loop at %p\n", (void*)loop);
    
    // Check loop state
    int is_alive = uv_loop_alive(loop);
    int active_handles = loop->active_handles;
    printf("[DEBUG] Loop state - alive: %d, active handles: %d\n",
           is_alive, active_handles);
    
    // Allocate server structure
    printf("[DEBUG] Allocating server structure\n");
    tcp_server_t* server = (tcp_server_t*)calloc(1, sizeof(tcp_server_t));
    if (!server) {
        printf("[DEBUG_ERROR] Failed to allocate server structure\n");
        return NULL;
    }
    printf("[DEBUG] Server structure allocated at %p and zeroed\n", (void*)server);
    
    // Initialize TCP server handle
    printf("[DEBUG] Initializing TCP server handle\n");
    int err = uv_tcp_init(loop, &server->server);
    if (err != 0) {
        printf("[DEBUG_ERROR] Failed to initialize TCP handle: %s\n", uv_strerror(err));
        free(server);
        return NULL;
    }
    printf("[DEBUG] TCP server handle initialized with type %d\n", server->server.type);
    printf("[DEBUG] Server handle flags: 0x%x\n", server->server.flags);
    
    // Set the server data pointer
    server->server.data = server;
    printf("[DEBUG] Server data pointer set to %p\n", (void*)server->server.data);
    printf("[DEBUG] Server handle flags after data set: 0x%x\n", server->server.flags);
    
    // Check handle state
    if (uv_is_active((uv_handle_t*)&server->server)) {
        printf("[DEBUG_ERROR] Server handle is active before initialization\n");
        uv_close((uv_handle_t*)&server->server, on_server_close);
        return NULL;
    }
    if (uv_is_closing((uv_handle_t*)&server->server)) {
        printf("[DEBUG_ERROR] Server handle is closing before initialization\n");
        return NULL;
    }
    
    // Create JavaScript object
    printf("[DEBUG] Creating JavaScript object\n");
    napi_value obj;
    napi_status status = napi_create_object(env, &obj);
    if (status != napi_ok) {
        printf("[DEBUG_ERROR] Failed to create object\n");
        uv_close((uv_handle_t*)&server->server, on_server_close);
        return NULL;
    }
    
    // Wrap native object
    printf("[DEBUG] Wrapping native object\n");
    status = napi_wrap(env, obj, server, cleanup_server, NULL, NULL);
    if (status != napi_ok) {
        printf("[DEBUG_ERROR] Failed to wrap object\n");
        uv_close((uv_handle_t*)&server->server, on_server_close);
        return NULL;
    }
    printf("[DEBUG] Server handle flags after wrap: 0x%x\n", server->server.flags);
    
    // Create strong reference to prevent GC
    printf("[DEBUG] Creating strong reference\n");
    napi_ref ref;
    status = napi_create_reference(env, obj, 1, &ref);
    if (status != napi_ok) {
        printf("[DEBUG_ERROR] Failed to create reference\n");
        uv_close((uv_handle_t*)&server->server, on_server_close);
        return NULL;
    }
    printf("[DEBUG] Server handle flags after reference: 0x%x\n", server->server.flags);
    
    // Create listen function
    printf("[DEBUG] Creating listen function\n");
    napi_value listen_fn;
    status = napi_create_function(env, "listen", NAPI_AUTO_LENGTH, Listen, NULL, &listen_fn);
    if (status != napi_ok) {
        printf("[DEBUG_ERROR] Failed to create listen function\n");
        napi_delete_reference(env, ref);
        uv_close((uv_handle_t*)&server->server, on_server_close);
        return NULL;
    }
    
    // Add listen function to server object
    status = napi_set_named_property(env, obj, "listen", listen_fn);
    if (status != napi_ok) {
        printf("[DEBUG_ERROR] Failed to set listen property\n");
        napi_delete_reference(env, ref);
        uv_close((uv_handle_t*)&server->server, on_server_close);
        return NULL;
    }
    printf("[DEBUG] Server object created with listen function\n");
    printf("[DEBUG] Server handle flags after listen function: 0x%x\n", server->server.flags);
    
    // Store server reference in global object
    printf("[DEBUG] Storing server reference in global object\n");
    napi_value global;
    status = napi_get_global(env, &global);
    if (status != napi_ok) {
        printf("[DEBUG_ERROR] Failed to get global object\n");
        napi_delete_reference(env, ref);
        uv_close((uv_handle_t*)&server->server, on_server_close);
        return NULL;
    }
    
    status = napi_set_named_property(env, global, "_http_server", obj);
    if (status != napi_ok) {
        printf("[DEBUG_ERROR] Failed to set global server reference\n");
        napi_delete_reference(env, ref);
        uv_close((uv_handle_t*)&server->server, on_server_close);
        return NULL;
    }
    printf("[DEBUG] Server reference stored in global object\n");
    printf("[DEBUG] Server handle flags after global reference: 0x%x\n", server->server.flags);
    
    // Check final handle state
    if (uv_is_active((uv_handle_t*)&server->server)) {
        printf("[DEBUG_ERROR] Server handle is active after initialization\n");
        napi_delete_reference(env, ref);
        uv_close((uv_handle_t*)&server->server, on_server_close);
        return NULL;
    }
    if (uv_is_closing((uv_handle_t*)&server->server)) {
        printf("[DEBUG_ERROR] Server handle is closing after initialization\n");
        napi_delete_reference(env, ref);
        return NULL;
    }
    
    // Check if handle is readable/writable
    uv_stream_t* stream = (uv_stream_t*)&server->server;
    if (uv_is_readable(stream)) {
        printf("[DEBUG_ERROR] Server handle is readable before listen\n");
    }
    if (uv_is_writable(stream)) {
        printf("[DEBUG_ERROR] Server handle is writable before listen\n");
    }
    
    // Store the reference in the server structure
    server->ref = ref;
    
    printf("[DEBUG] ==================================\n\n");
    fflush(stdout);
    
    return obj;
}

static napi_value Listen(napi_env env, napi_callback_info info) {
    printf("\n[DEBUG_ENTER] ========== Listen ==========\n");
    printf("[DEBUG_POINT] Listen called\n");
    size_t argc = 2;
    napi_value argv[2];
    napi_value this_arg;
    void* data;
    
    napi_status status = napi_get_cb_info(env, info, &argc, argv, &this_arg, &data);
    if (status != napi_ok) {
        printf("[DEBUG_ERROR] Failed to get callback info: %d\n", status);
        return NULL;
    }
    printf("[DEBUG_POINT] Got callback info with %zu arguments\n", argc);
    
    // Get the server pointer from the wrapped object
    tcp_server_t* server;
    status = napi_unwrap(env, this_arg, (void**)&server);
    if (status != napi_ok) {
        printf("[DEBUG_ERROR] Failed to unwrap server: %d\n", status);
        return NULL;
    }
    printf("[DEBUG_POINT] Unwrapped server object at %p\n", (void*)server);
    printf("[DEBUG_POINT] Server handle type: %s (%d)\n", 
           server->server.type == UV_TCP ? "UV_TCP" : "UNKNOWN", server->server.type);
    printf("[DEBUG_POINT] Server handle flags: 0x%x\n", server->server.flags);
    printf("[DEBUG_POINT] Server handle data pointer: %p\n", (void*)server->server.data);
    
    int32_t port;
    status = napi_get_value_int32(env, argv[0], &port);
    if (status != napi_ok) {
        printf("[DEBUG_ERROR] Failed to get port number: %d\n", status);
        return NULL;
    }
    printf("[DEBUG_POINT] Port: %d\n", port);
    
    // Create a reference to the callback
    status = napi_create_reference(env, argv[1], 1, &server->callback);
    if (status != napi_ok) {
        printf("[DEBUG_ERROR] Failed to create callback reference: %d\n", status);
        return NULL;
    }
    server->env = env;
    printf("[DEBUG_POINT] Callback reference created with env=%p, callback=%p\n", 
           (void*)server->env, (void*)server->callback);
    
    // Get the default loop
    uv_loop_t* loop = uv_default_loop();
    if (!loop) {
        printf("[DEBUG_ERROR] Failed to get default loop\n");
        return NULL;
    }
    
    // Check loop state
    int is_alive = uv_loop_alive(loop);
    int active_handles = loop->active_handles;
    printf("[DEBUG_POINT] Loop state - alive: %d, active handles: %d\n",
           is_alive, active_handles);
    
    printf("[DEBUG_POINT] Walking handles in loop before listen:\n");
    uv_walk(loop, on_walk, NULL);
    fflush(stdout);
    
    // Check server handle state
    if (uv_is_closing((uv_handle_t*)&server->server)) {
        printf("[DEBUG_ERROR] Server handle is closing before setup\n");
        return NULL;
    }
    
    // Set TCP options
    printf("[DEBUG_POINT] Setting TCP options\n");
    int err = uv_tcp_nodelay(&server->server, 1);
    if (err != 0) {
        printf("[DEBUG_ERROR] Failed to set TCP_NODELAY: %s\n", uv_strerror(err));
        return NULL;
    }
    printf("[DEBUG_POINT] TCP_NODELAY set\n");
    
    err = uv_tcp_simultaneous_accepts(&server->server, 1);
    if (err != 0) {
        printf("[DEBUG_ERROR] Failed to set simultaneous accepts: %s\n", uv_strerror(err));
        return NULL;
    }
    printf("[DEBUG_POINT] Simultaneous accepts enabled\n");
    
    // Bind to IPv4 address
    printf("[DEBUG_POINT] Creating IPv4 address\n");
    struct sockaddr_in addr;
    err = uv_ip4_addr("0.0.0.0", port, &addr);
    if (err != 0) {
        printf("[DEBUG_ERROR] Failed to create IPv4 address: %s\n", uv_strerror(err));
        return NULL;
    }
    
    printf("[DEBUG_POINT] Binding to address\n");
    err = uv_tcp_bind(&server->server, (const struct sockaddr*)&addr, 0);
    if (err != 0) {
        printf("[DEBUG_ERROR] Failed to bind: %s\n", uv_strerror(err));
        return NULL;
    }
    printf("[DEBUG_POINT] Server bound to 0.0.0.0:%d\n", port);
    
    // Set the server data pointer
    server->server.data = server;
    printf("[DEBUG_POINT] Server data set with env=%p, callback=%p, server.data=%p\n", 
           (void*)server->env, (void*)server->callback, (void*)server->server.data);
    printf("[DEBUG_POINT] Server handle type after data set: %s (%d)\n", 
           server->server.type == UV_TCP ? "UV_TCP" : "UNKNOWN", server->server.type);
    printf("[DEBUG_POINT] Server handle flags after data set: 0x%x\n", server->server.flags);
    
    printf("[DEBUG_POINT] Starting to listen\n");
    // Cast the server handle to a stream handle
    uv_stream_t* stream = (uv_stream_t*)&server->server;
    printf("[DEBUG_POINT] Server handle cast to stream at %p\n", (void*)stream);
    printf("[DEBUG_POINT] Stream handle type: %s (%d)\n", 
           stream->type == UV_TCP ? "UV_TCP" : "UNKNOWN", stream->type);
    printf("[DEBUG_POINT] Stream handle flags: 0x%x\n", stream->flags);
    printf("[DEBUG_POINT] Stream handle data: %p\n", (void*)stream->data);
    
    printf("[DEBUG_POINT] Setting up connection callback to %p\n", (void*)on_connection);
    printf("[DEBUG_POINT] Connection callback function address: %p\n", (void*)&on_connection);
    printf("[DEBUG_POINT] Connection callback function value: %p\n", (void*)on_connection);
    printf("[DEBUG_POINT] Stream handle before listen: %p\n", (void*)stream);
    printf("[DEBUG_POINT] Stream handle type before listen: %s (%d)\n", 
           stream->type == UV_TCP ? "UV_TCP" : "UNKNOWN", stream->type);
    printf("[DEBUG_POINT] Stream handle flags before listen: 0x%x\n", stream->flags);
    printf("[DEBUG_POINT] Stream handle data before listen: %p\n", (void*)stream->data);
    
    // Check handle state before listen
    if (uv_is_closing((uv_handle_t*)stream)) {
        printf("[DEBUG_ERROR] Stream handle is closing before listen\n");
        return NULL;
    }
    if (uv_is_active((uv_handle_t*)stream)) {
        printf("[DEBUG_ERROR] Stream handle is already active before listen\n");
        return NULL;
    }
    
    // Add debug logging for the listen call
    printf("[DEBUG_POINT] Calling uv_listen with stream=%p, backlog=128, callback=%p\n", 
           (void*)stream, (void*)on_connection);
    err = uv_listen(stream, 128, on_connection);
    printf("[DEBUG_POINT] uv_listen returned %d\n", err);
    if (err != 0) {
        printf("[DEBUG_ERROR] Failed to listen: %s\n", uv_strerror(err));
        return NULL;
    }
    printf("[DEBUG_POINT] Server listening with backlog 128\n");
    printf("[DEBUG_POINT] Server handle type after listen: %s (%d)\n", 
           server->server.type == UV_TCP ? "UV_TCP" : "UNKNOWN", server->server.type);
    printf("[DEBUG_POINT] Server handle flags after listen: 0x%x\n", server->server.flags);
    printf("[DEBUG_POINT] Server handle data after listen: %p\n", (void*)server->server.data);
    
    // Check handle state after listen
    if (uv_is_closing((uv_handle_t*)stream)) {
        printf("[DEBUG_ERROR] Stream handle is closing after listen\n");
        return NULL;
    }
    if (!uv_is_active((uv_handle_t*)stream)) {
        printf("[DEBUG_ERROR] Stream handle is not active after listen\n");
        return NULL;
    }
    printf("[DEBUG_POINT] Stream handle is active and not closing\n");
    
    // Check loop state after listen
    is_alive = uv_loop_alive(loop);
    active_handles = loop->active_handles;
    printf("[DEBUG_POINT] Loop state after listen - alive: %d, active handles: %d\n",
           is_alive, active_handles);
    
    printf("[DEBUG_POINT] Walking handles in loop after listen:\n");
    uv_walk(loop, on_walk, NULL);
    fflush(stdout);
    
    // Keep a global reference to the server object
    printf("[DEBUG_POINT] Storing server reference in global object\n");
    napi_value global;
    status = napi_get_global(env, &global);
    if (status != napi_ok) {
        printf("[DEBUG_ERROR] Failed to get global object: %d\n", status);
        return NULL;
    }
    
    status = napi_set_named_property(env, global, "_http_server", this_arg);
    if (status != napi_ok) {
        printf("[DEBUG_ERROR] Failed to set global server reference: %d\n", status);
        return NULL;
    }
    printf("[DEBUG_POINT] Server reference stored in global object\n");
    
    // Check final loop state
    is_alive = uv_loop_alive(loop);
    active_handles = loop->active_handles;
    printf("[DEBUG_POINT] Final loop state - alive: %d, active handles: %d\n",
           is_alive, active_handles);
    printf("[DEBUG_EXIT] ============================\n\n");
    fflush(stdout);
    
    // Start the event loop
    uv_run(loop, UV_RUN_DEFAULT);
    
    printf("[DEBUG_EXIT] ============================\n\n");
    fflush(stdout);
    
    // Return undefined instead of NULL
    napi_value undefined;
    napi_get_undefined(env, &undefined);
    return undefined;
}

NAPI_MODULE_INIT() {
    printf("\n[DEBUG] ========== Module Init ==========\n");
    printf("[DEBUG] NAPI_MODULE_INIT called\n");
    
    // Install signal handlers
    signal(SIGSEGV, signal_handler);
    signal(SIGABRT, signal_handler);
    signal(SIGBUS, signal_handler);
    signal(SIGILL, signal_handler);
    signal(SIGFPE, signal_handler);
    printf("[DEBUG] Signal handlers installed\n");
    
    // Get the default loop
    uv_loop_t* loop = uv_default_loop();
    if (!loop) {
        fprintf(stderr, "[ERROR] Failed to get default loop\n");
        return NULL;
    }
    printf("[DEBUG] Got default loop at %p\n", (void*)loop);
    
    // Check loop state
    int is_alive = uv_loop_alive(loop);
    int active_handles = loop->active_handles;
    printf("[DEBUG] Loop state - alive: %d, active handles: %d\n",
           is_alive, active_handles);
    
    // Create the create function
    napi_value create_fn;
    napi_status status = napi_create_function(env, "create", NAPI_AUTO_LENGTH, Create, loop, &create_fn);
    if (status != napi_ok) {
        fprintf(stderr, "[ERROR] Failed to create function\n");
        return NULL;
    }
    printf("[DEBUG] Create function created\n");
    
    // Add the create function to exports
    status = napi_set_named_property(env, exports, "create", create_fn);
    if (status != napi_ok) {
        fprintf(stderr, "[ERROR] Failed to set property\n");
        return NULL;
    }
    printf("[DEBUG] Create function exported\n");
    
    // Store the event loop in a global reference
    napi_value global;
    status = napi_get_global(env, &global);
    if (status != napi_ok) {
        fprintf(stderr, "[ERROR] Failed to get global object\n");
        return NULL;
    }
    
    // Create an external value to hold the loop pointer
    napi_value loop_external;
    status = napi_create_external(env, loop, NULL, NULL, &loop_external);
    if (status != napi_ok) {
        fprintf(stderr, "[ERROR] Failed to create external\n");
        return NULL;
    }
    
    // Store the loop in the global object
    status = napi_set_named_property(env, global, "_uv_loop", loop_external);
    if (status != napi_ok) {
        fprintf(stderr, "[ERROR] Failed to set global loop reference\n");
        return NULL;
    }
    printf("[DEBUG] Event loop reference stored in global object\n");
    
    // Check final loop state
    is_alive = uv_loop_alive(loop);
    active_handles = loop->active_handles;
    printf("[DEBUG] Final loop state - alive: %d, active handles: %d\n",
           is_alive, active_handles);
    
    // Walk the handles in the loop
    printf("[DEBUG] Walking handles in loop:\n");
    uv_walk(loop, on_walk, NULL);
    
    printf("[DEBUG] ================================\n\n");
    fflush(stdout);
    
    return exports;
}