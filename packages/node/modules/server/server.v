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
		res.header('Connection', 'close')
		res.body('{"error":"Only POST method is allowed"}')
		return
	}

	// With the new streaming API, the body is already accumulated in req.body
	// by the time this callback is called
	if req.body.len == 0 {
		eprintln('No body provided')
		res.status(400)
		res.header('Content-Type', 'application/json')
		res.header('Connection', 'close')
		res.body('{"error":"No body provided"}')
		return
	}

	eprintln('Received complete body: ${req.body} ${req.body.len}')
	res.status(200)
	res.header('Content-Type', 'text/plain')
	res.header('Connection', 'close')
	res.body(req.body)
	eprintln('Response prepared')
}

// start creates and starts a new HTTP server on the specified port
pub fn start(port int) ! {
	eprintln('Starting server on port ${port}')
	mut s := picoev.new(
		port: port,
		cb: callback,
		timeout_secs: 30,
		max_read: 8192,
		max_write: 8192
	)!

	eprintln('Server initialized, starting event loop')
	s.serve()
}
