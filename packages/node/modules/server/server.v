module server

import picoev
import picohttpparser

// Request handler callback for the HTTP server
fn callback(data voidptr, req picohttpparser.Request, mut res picohttpparser.Response) {
	eprintln('Handling request: ${req.method} ${req.path}')
	if req.method != 'POST' {
		eprintln('Method not allowed: ${req.method}')
		res.status(405)
		res.header('Content-Type', 'application/json')
		res.header('Connection', if req.client_wants_keep_alive() { 'keep-alive' } else { 'close' })
		res.body('{"error":"Only POST method is allowed"}')
		if res.end() < 0 {
			eprintln('Failed to send error response')
		}
		return
	}

	// Get the body reader if available
	mut body := ''
	if mut br := req.get_body_reader() {
		body_bytes := br.read_all() or {
			eprintln('Failed to read body: ${err}')
			res.status(400)
			res.header('Content-Type', 'application/json')
			res.header('Connection', 'close')
			res.body('{"error":"Failed to read request body"}')
			if res.end() < 0 {
				eprintln('Failed to send error response')
			}
			return
		}
		body = body_bytes.bytestr()
	}

	if body.len == 0 {
		eprintln('No body provided')
		res.status(400)
		res.header('Content-Type', 'application/json')
		res.header('Connection', if req.client_wants_keep_alive() { 'keep-alive' } else { 'close' })
		res.body('{"error":"No body provided"}')
		if res.end() < 0 {
			eprintln('Failed to send error response')
		}
		return
	}

	eprintln('Received complete body: ${body} ${body.len}')
	res.status(200)
	res.header('Content-Type', 'text/plain')
	res.header('Connection', if req.client_wants_keep_alive() { 'keep-alive' } else { 'close' })
	res.body(body)
	if res.end() < 0 {
		eprintln('Failed to send response')
	}
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
