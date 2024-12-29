module server

import picoev
import picohttpparser

// Request handler callback for the HTTP server
fn callback(data voidptr, req picohttpparser.Request, mut res picohttpparser.Response) {
	if req.method != 'POST' {
		res.status(405)
		res.header('Content-Type', 'application/json')
		res.header('Connection', if req.client_wants_keep_alive() { 'keep-alive' } else { 'close' })
		res.body('{"error":"Only POST method is allowed"}')
		res.end() or {}
		return
	}

	// Get the body reader if available
	mut body := ''
	if mut br := req.get_body_reader() {
		body_bytes := br.read_all() or {
			res.status(400)
			res.header('Content-Type', 'application/json')
			res.header('Connection', 'close')
			res.body('{"error":"Failed to read request body"}')
			res.end() or {}
			return
		}
		body = body_bytes.bytestr()
	}

	if body.len == 0 {
		res.status(400)
		res.header('Content-Type', 'application/json')
		res.header('Connection', if req.client_wants_keep_alive() { 'keep-alive' } else { 'close' })
		res.body('{"error":"No body provided"}')
		res.end() or {}
		return
	}

	res.status(200)
	res.header('Content-Type', 'text/plain')
	res.header('Connection', if req.client_wants_keep_alive() { 'keep-alive' } else { 'close' })
	res.body(body)
	res.end() or {}
}

// start creates and starts a new HTTP server on the specified port
pub fn start(port int) ! {
	mut s := picoev.new(
		port: port,
		cb: callback,
		timeout_secs: 30,
		max_read: 8192,
		max_write: 8192
	)!

	s.serve()
}
