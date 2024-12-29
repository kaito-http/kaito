module main

import napi
import server

@[export: 'napi_register_module_v1']
fn napi_register_module_v1(env napi.Napi_env, exports napi.Napi_value) napi.Napi_value {
	napi_env := &napi.NapiEnv{env}
	
	println('Registering module...')  // Debug log
	
	// Define the start function - no need for explicit cast
	functions := [
		napi.ExportedFunction{
			name: c'server'
			func: start
		}
	]

	println('Exporting functions...')  // Debug log
	napi.export_functions(env, exports, functions) or {
		return napi_env.throw_error('Failed to export functions: ${err}')
	}

	return exports
}

fn start(env napi.Napi_env, info napi.Napi_callback_info) napi.Napi_value {
	port := 8080
	napi_env := &napi.NapiEnv{env}

	println('Starting server...')  // Debug log
	go server.start(port)

	// Return 0 to indicate success
	result := napi_env.create_int(0) or {
		return napi_env.throw_error('Failed to create return value: ${err}')
	}

	return result.value
}
