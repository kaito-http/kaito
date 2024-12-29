module server

import picoev
import picohttpparser

fn callback(data voidptr, req picohttpparser.Request, mut res picohttpparser.Response) {
	res.http_ok()
	res.body('hi')
	res.end()
}

pub fn start(port int) ! {
	mut s := picoev.new(port: port, cb: callback)!
	s.serve()
}
