module main

import napi
import server

@[export: 'napi_register_module_v1']
fn napi_register_module_v1(env napi.Napi_env, exports napi.Napi_value) napi.Napi_value {
	mut name := unsafe { nil }
	if C.napi_create_string_utf8(env, c'server', 5, &name) != .napi_ok {
		C.napi_throw_error(env, unsafe { nil }, c'Failed to create string')
		return unsafe { nil }
	}

	mut function := unsafe { nil }
	if C.napi_create_function(env, &name, 1, start, unsafe { nil }, &function) != .napi_ok {
		C.napi_throw_error(env, unsafe { nil }, c'Failed to create function')
		return unsafe { nil }
	}

	if C.napi_set_named_property(env, exports, c'server', function) != .napi_ok {
		C.napi_throw_error(env, unsafe { nil }, c'Failed to add function to exports')
		return unsafe { nil }
	}

	return exports
}

fn start(env napi.Napi_env, info napi.Napi_callback_info) napi.Napi_value {
	port := 8080

	mut result := unsafe { nil }
	go server.start(port)

	value := 0

	if C.napi_create_int32(env, value, &result) != .napi_ok {
		C.napi_throw_error(env, unsafe { nil }, c'Failed to create return value')
		return unsafe { nil }
	}

	return result
}
