module main

import napi
import server

@[export: 'napi_register_module_v1']
fn napi_register_module_v1(env napi.Napi_env, exports napi.Napi_value) napi.Napi_value {
	napi_env := &napi.NapiEnv{env}

	napi.export_functions(env, exports, [
		napi.ExportedFunction{c'server', 0, start},
	]) or {
		return napi_env.throw_error(c'Failed to export functions')
	}

	return exports
}

fn start(env napi.Napi_env, info napi.Napi_callback_info) napi.Napi_value {
	napi_env := &napi.NapiEnv{env}

	port := 8080
	server.start(port) or { return napi_env.throw_error(c'Failed to start server') }

	// Return 0 to indicate success
	result := napi_env.create_int(0) or {
		return napi_env.throw_error(c'Failed to create return value')
	}

	return result.value
}
