module napi

#flag -I @VMODROOT/../../node_modules/node-api-headers/include
#flag darwin -undefined dynamic_lookup
#include <node_api.h>

type Napi_env = voidptr
type Napi_value = voidptr
type Napi_callback_info = voidptr

type Napi_callback = fn (env Napi_env, info Napi_callback_info) Napi_value

fn C.napi_create_function(env Napi_env, utf8name &i8, length usize, cb Napi_callback, data voidptr, result &Napi_value) Napi_status

fn C.napi_throw_error(env Napi_env, code &i8, msg &i8) Napi_status

fn C.napi_set_named_property(env Napi_env, object Napi_value, utf8name &i8, value Napi_value) Napi_status

fn C.napi_create_int32(env Napi_env, value int, result &Napi_value) Napi_status

pub enum Napi_status {
	napi_ok
	napi_invalid_arg
	napi_object_expected
	napi_string_expected
	napi_name_expected
	napi_function_expected
	napi_number_expected
	napi_boolean_expected
	napi_array_expected
	napi_generic_failure
	napi_pending_exception
	napi_cancelled
	napi_escape_called_twice
	napi_handle_scope_mismatch
	napi_callback_scope_mismatch
	napi_queue_full
	napi_closing
	napi_bigint_expected
	napi_date_expected
	napi_arraybuffer_expected
	napi_detachable_arraybuffer_expected
	napi_would_deadlock
	napi_no_external_buffers_allowed
}
