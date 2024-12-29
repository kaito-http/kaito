module napi

#flag -I @VMODROOT/../../node_modules/node-api-headers/include
#flag darwin -undefined dynamic_lookup
#include <js_native_api.h>
#include <node_api.h>

// Basic types
type Napi_env = voidptr
type Napi_value = voidptr
type Napi_callback_info = voidptr
type Napi_callback = fn (env Napi_env, info Napi_callback_info) Napi_value

type Napi_finalize = fn (env Napi_env, data voidptr, hint voidptr)

// Core NAPI function declarations - ALL must be at the top
fn C.napi_create_function(env Napi_env, utf8name &char, length usize, cb Napi_callback, data voidptr, result &Napi_value) Napi_status
fn C.napi_throw_error(env Napi_env, code &char, msg &char) Napi_status
fn C.napi_set_named_property(env Napi_env, object Napi_value, utf8name &char, value Napi_value) Napi_status
fn C.napi_create_int32(env Napi_env, value int, result &Napi_value) Napi_status
fn C.napi_get_value_int32(env Napi_env, value Napi_value, result &int) Napi_status
fn C.napi_create_string_utf8(env Napi_env, str &char, length usize, result &Napi_value) Napi_status
fn C.napi_get_value_string_utf8(env Napi_env, value Napi_value, buf &char, bufsize usize, result &usize) Napi_status
fn C.napi_create_object(env Napi_env, result &Napi_value) Napi_status
fn C.napi_create_array(env Napi_env, result &Napi_value) Napi_status
fn C.napi_create_array_with_length(env Napi_env, length usize, result &Napi_value) Napi_status
fn C.napi_get_array_length(env Napi_env, value Napi_value, result &u32) Napi_status
fn C.napi_get_value_bool(env Napi_env, value Napi_value, result &bool) Napi_status
fn C.napi_get_boolean(env Napi_env, value bool, result &Napi_value) Napi_status
fn C.napi_create_double(env Napi_env, value f64, result &Napi_value) Napi_status
fn C.napi_get_value_double(env Napi_env, value Napi_value, result &f64) Napi_status
fn C.napi_get_undefined(env Napi_env, result &Napi_value) Napi_status
fn C.napi_get_null(env Napi_env, result &Napi_value) Napi_status
fn C.napi_get_global(env Napi_env, result &Napi_value) Napi_status
fn C.napi_get_cb_info(env Napi_env, cbinfo Napi_callback_info, argc &usize, argv &Napi_value, this &Napi_value, data &voidptr) Napi_status
fn C.napi_create_reference(env Napi_env, value Napi_value, initial_refcount u32, result &Napi_ref) Napi_status
fn C.napi_delete_reference(env Napi_env, ref Napi_ref) Napi_status
fn C.napi_get_reference_value(env Napi_env, ref Napi_ref, result &Napi_value) Napi_status
fn C.napi_call_function(env Napi_env, recv Napi_value, func Napi_value, argc usize, argv &Napi_value, result &Napi_value) Napi_status

// Define the property descriptor struct properly
pub struct Napi_property_descriptor {
pub mut:
	utf8name   &char                    = unsafe { nil } // property name
	name       &Napi_value              = unsafe { nil } // property name as napi_value
	method     Napi_callback            = unsafe { nil }
	getter     Napi_callback            = unsafe { nil }
	setter     Napi_callback            = unsafe { nil }
	value      &Napi_value              = unsafe { nil }
	attributes Napi_property_attributes = .napi_default
	data       voidptr                  = unsafe { nil }
}

// Reference types
type Napi_ref = voidptr
type Napi_deferred = voidptr
type Napi_handle_scope = voidptr
type Napi_escapable_handle_scope = voidptr
type Napi_callback_scope = voidptr
type Napi_async_context = voidptr
type Napi_async_work = voidptr
type Napi_threadsafe_function = voidptr

// Additional types for completeness
type Napi_async_execute_callback = fn (env Napi_env, data voidptr)

type Napi_async_complete_callback = fn (env Napi_env, status Napi_status, data voidptr)

type Napi_threadsafe_function_call_js = fn (env Napi_env, js_callback Napi_value, context voidptr, data voidptr)

// Status enum
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

// Value type enum
pub enum Napi_valuetype {
	napi_undefined
	napi_null
	napi_boolean
	napi_number
	napi_string
	napi_symbol
	napi_object
	napi_function
	napi_external
	napi_bigint
}

// Property attributes
pub enum Napi_property_attributes {
	napi_default      = 0
	napi_writable     = 1
	napi_enumerable   = 2
	napi_configurable = 4
	napi_static       = 1024
}

// High-level wrapper structs
pub struct NapiEnv {
pub:
	env Napi_env
}

pub struct NapiValue {
pub:
	env   Napi_env
	value Napi_value
}

pub struct NapiObject {
pub:
	env Napi_env
	obj Napi_value
}

pub struct NapiArray {
pub:
	env Napi_env
	arr Napi_value
}

// Helper functions for error handling
@[inline]
pub fn check_status(status Napi_status) ! {
	if status != .napi_ok {
		return error('NAPI error: ${status}')
	}
}

// Error handling helpers
@[inline]
pub fn (env &NapiEnv) throw_error(msg &char) Napi_value {
	C.napi_throw_error(env.env, unsafe { nil }, msg)
	return unsafe { nil }
}

// String conversion helpers
pub fn (env &NapiEnv) create_string(s string) !NapiValue {
	mut result := unsafe { nil }
	status := C.napi_create_string_utf8(env.env, s.str, s.len, &result)
	check_status(status)!
	return NapiValue{env.env, unsafe { result }}
}

pub fn (val &NapiValue) to_string() !string {
	mut len := usize(0)
	mut status := C.napi_get_value_string_utf8(val.env, val.value, unsafe { nil }, 0,
		&len)
	check_status(status)!

	mut buf := []u8{len: int(len) + 1}
	status = C.napi_get_value_string_utf8(val.env, val.value, unsafe { &char(buf.data) },
		len + 1, &len)
	check_status(status)!
	return buf[..len].bytestr()
}

// Number conversion helpers
pub fn (env &NapiEnv) create_int(n int) !NapiValue {
	mut result := unsafe { nil }
	status := C.napi_create_int32(env.env, n, &result)
	check_status(status)!
	return NapiValue{env.env, unsafe { result }}
}

pub fn (env &NapiEnv) create_double(n f64) !NapiValue {
	mut result := unsafe { nil }
	status := C.napi_create_double(env.env, n, &result)
	check_status(status)!
	return NapiValue{env.env, unsafe { result }}
}

pub fn (val &NapiValue) to_int() !int {
	mut result := 0
	status := C.napi_get_value_int32(val.env, val.value, &result)
	check_status(status)!
	return result
}

pub fn (val &NapiValue) to_double() !f64 {
	mut result := f64(0)
	status := C.napi_get_value_double(val.env, val.value, &result)
	check_status(status)!
	return result
}

// Boolean helpers
pub fn (env &NapiEnv) create_bool(b bool) !NapiValue {
	mut result := unsafe { nil }
	status := C.napi_get_boolean(env.env, b, &result)
	check_status(status)!
	return NapiValue{env.env, unsafe { result }}
}

pub fn (val &NapiValue) to_bool() !bool {
	mut result := false
	status := C.napi_get_value_bool(val.env, val.value, &result)
	check_status(status)!
	return result
}

// Object helpers
pub fn (env &NapiEnv) create_object() !NapiObject {
	mut result := unsafe { nil }
	status := C.napi_create_object(env.env, &result)
	check_status(status)!
	return NapiObject{env.env, unsafe { result }}
}

pub fn (obj &NapiObject) set_named_property(name &char, val NapiValue) ! {
	status := C.napi_set_named_property(obj.env, obj.obj, name, val.value)
	check_status(status)!
}

// Array helpers
pub fn (env &NapiEnv) create_array() !NapiArray {
	mut result := unsafe { nil }
	status := C.napi_create_array(env.env, &result)
	check_status(status)!
	return NapiArray{env.env, unsafe { result }}
}

pub fn (env &NapiEnv) create_array_with_length(length usize) !NapiArray {
	mut result := unsafe { nil }
	status := C.napi_create_array_with_length(env.env, length, &result)
	check_status(status)!
	return NapiArray{env.env, unsafe { result }}
}

pub fn (arr &NapiArray) get_length() !u32 {
	mut result := u32(0)
	status := C.napi_get_array_length(arr.env, arr.arr, &result)
	check_status(status)!
	return result
}

// Function creation and export helpers
pub struct ExportedFunction {
pub:
	name &char
	len usize
	func Napi_callback = unsafe { nil } // Initialize with nil
}

pub fn create_function(env Napi_env, name &char, length usize, callback Napi_callback) !Napi_value {
	mut result := unsafe { nil }

	status := C.napi_create_function(env, unsafe { nil }, length, callback, unsafe { nil },
		&result)

	if status != .napi_ok {
		return error('napi_create_function failed with status ${status}')
	}

	return result
}

// Module exports helper
pub fn export_functions(env Napi_env, exports Napi_value, functions []ExportedFunction) ! {
	for func in functions {
		if func.func == unsafe { nil } {
			return error('Function is null')
		}

		value := create_function(env, func.name, func.len, func.func) or {
			return error('Failed to create function: ${err}')
		}

		status := C.napi_set_named_property(env, exports, func.name, value)
		if status != .napi_ok {
			return error('Failed to set property with status ${status}')
		}
	}
}

// Special values
pub fn (env &NapiEnv) get_undefined() !NapiValue {
	mut result := &Napi_value(unsafe { nil })
	status := C.napi_get_undefined(env.env, result)
	check_status(status)!
	return NapiValue{env.env, unsafe { *result }}
}

pub fn (env &NapiEnv) get_null() !NapiValue {
	mut result := &Napi_value(unsafe { nil })
	status := C.napi_get_null(env.env, result)
	check_status(status)!
	return NapiValue{env.env, unsafe { *result }}
}

pub fn (env &NapiEnv) get_global() !NapiValue {
	mut result := &Napi_value(unsafe { nil })
	status := C.napi_get_global(env.env, result)
	check_status(status)!
	return NapiValue{env.env, unsafe { *result }}
}

// Module initialization helper
pub fn init(env Napi_env, exports Napi_value) Napi_value {
	return exports
}

// Example usage:
/*
fn hello_world(env Napi_env, info Napi_callback_info) Napi_value {
    napi_env := &NapiEnv{env}
    result := napi_env.create_string("Hello, World!") or {
        C.napi_throw_error(env, "", "Failed to create string")
        return Napi_value(0)
    }
    return result.value
}

fn init(env Napi_env, exports Napi_value) Napi_value {
    functions := [
        ExportedFunction{
            name: "hello"
            func: hello_world
        }
    ]
    export_functions(env, exports, functions) or {
        C.napi_throw_error(env, "", "Failed to export functions")
        return exports
    }
    return exports
}
*/

// Callback info helpers
pub fn get_callback_info(env Napi_env, info Napi_callback_info, max_argc usize) !([]Napi_value, Napi_value) {
	mut argc := max_argc
	mut argv := []Napi_value{len: int(max_argc), init: unsafe { nil }}
	mut this_arg := unsafe { nil }
	mut data := unsafe { nil }

	unsafe {
		status := C.napi_get_cb_info(env, info, &argc, &argv[0], &this_arg, &data)
		check_status(status)!
	}
	return argv[..argc], this_arg
}

// Reference handling
fn C.napi_create_reference(env Napi_env, value Napi_value, initial_refcount u32, result &Napi_ref) Napi_status
fn C.napi_delete_reference(env Napi_env, ref Napi_ref) Napi_status
fn C.napi_get_reference_value(env Napi_env, ref Napi_ref, result &Napi_value) Napi_status

pub fn create_reference(env Napi_env, value Napi_value, initial_refcount u32) !Napi_ref {
	mut result := unsafe { nil }
	status := C.napi_create_reference(env, value, initial_refcount, &result)
	check_status(status)!
	return result
}

pub fn delete_reference(env Napi_env, ref Napi_ref) ! {
	status := C.napi_delete_reference(env, ref)
	check_status(status)!
}

pub fn get_reference_value(env Napi_env, ref Napi_ref) !Napi_value {
	mut result := unsafe { nil }
	status := C.napi_get_reference_value(env, ref, &result)
	check_status(status)!
	return result
}
