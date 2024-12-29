module server

import picoev
import picohttpparser

fn callback(data voidptr, req picohttpparser.Request, mut res picohttpparser.Response) {
	if req.method != 'POST' {
		res.status(405)
		res.body('{"error":"Only POST method is allowed"}')
		res.end()
		return
	}

	mut reader := req.get_body_reader() or {
		res.status(400)
		res.body('{"error":"No body provided"}')
		res.end()
		return
	}

	// Read the entire body
	body := reader.read_all() or {
		res.status(400)
		res.body('{"error":"Failed to read body: ${err}"}')
		res.end()
		return
	}

	println('Read complete body: ${body.bytestr()}')
	res.status(200)
	res.body(body.bytestr())
	res.end()
}

pub fn start(port int) ! {
	mut s := picoev.new(
		port: port,
		cb: callback,
		timeout_secs: 30
	)!

	s.serve()
}
