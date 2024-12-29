module server

import json
import picoev
import picohttpparser

struct Message {
	message string
}

@[inline]
fn json_response() string {
	msg := Message{
		message: 'Hello, World!'
	}
	return json.encode(msg)
}

@[inline]
fn hello_response() string {
	return 'Hello, World!'
}

fn callback(data voidptr, req picohttpparser.Request, mut res picohttpparser.Response) {
	if req.method == 'GET' {
		if req.path == '/t' {
			res.http_ok()
			res.header_server()
			res.header_date()
			res.plain()
			res.body(hello_response())
		} else if req.path == '/j' {
			res.http_ok()
			res.header_server()
			res.header_date()
			res.json()
			res.body(json_response())
		} else {
			res.http_ok()
			res.header_server()
			res.header_date()
			res.html()
			res.body('Hello Picoev!\n')
		}
	} else {
		res.http_405()
	}
	res.end()
}

pub fn start(port int) ! {
	mut s := picoev.new(port: port, cb: callback)!
	s.serve()
}
