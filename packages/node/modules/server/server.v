module server

import picoev
import picohttpparser

fn callback(data voidptr, req picohttpparser.Request, mut res picohttpparser.Response) {
	if req.method != 'GET' {
		mut body_reader := req.get_body_reader(req.fd) or { panic('Failed to get body reader') }

		body := body_reader.read_all() or {
			res.status(400)
			res.body('Failed to read body')
			res.end()
			return
		}

		body_as_utf8 := body.bytestr()
		println(body_as_utf8)
	}

	res.status(200)
	res.body('hi')
	res.end()
}

pub fn start(port int) ! {
	mut s := picoev.new(port: port, cb: callback)!
	s.serve()
}
