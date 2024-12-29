module server

import picoev
import picohttpparser

fn callback(data voidptr, req picohttpparser.Request, mut res picohttpparser.Response) {
	if req.method != 'GET' {
		mut reader := req.get_body_reader() or {
			res.status(400)
			res.body(err.msg())
			res.end()
			return
		}

		body := reader.read_all() or {
			res.status(400)
			res.body(err.msg())
			res.end()
			return
		}

		body_as_utf8 := body.bytestr()
		println('Received body: ${body_as_utf8}')

		res.status(200)
		res.body('{"status":"ok"}')
		res.end()
		return
	}

	res.status(200)
	res.body('{"status":"ok"}')
	res.end()
}

pub fn start(port int) ! {
	mut s := picoev.new(
		port: port,
		cb: callback,
		timeout_secs: 30  // Increase timeout to 30 seconds
	)!
	s.serve()
}
