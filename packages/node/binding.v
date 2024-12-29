module main

import napi
import server

@[export: 'napi_register_module_v1']
fn napi_register_module_v1(env napi.Napi_env, exports napi.Napi_value) napi.Napi_value {
	mut function := unsafe { nil }
	if C.napi_create_function(env, unsafe { nil }, 0, foo, unsafe { nil }, &function) != .napi_ok {
		C.napi_throw_error(env, unsafe { nil }, c'Failed to create function')
		return unsafe { nil }
	}

	if C.napi_set_named_property(env, exports, c'foo', function) != .napi_ok {
		C.napi_throw_error(env, unsafe { nil }, c'Failed to add function to exports')
		return unsafe { nil }
	}

	return exports
}

fn foo(env napi.Napi_env, info napi.Napi_callback_info) napi.Napi_value {
	mut result := unsafe { nil }
	server.start() or { return unsafe { nil } }

	value := 0

	if C.napi_create_int32(env, value, &result) != .napi_ok {
		C.napi_throw_error(env, unsafe { nil }, c'Failed to create return value')
		return unsafe { nil }
	}

	return result
}
