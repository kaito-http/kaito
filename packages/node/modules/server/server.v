module server

import picoev
import picohttpparser
import time

// simulate_token_generation simulates an LLM generating tokens
fn simulate_token_generation(prompt string) []string {
	// Split the prompt into words to simulate tokens
	words := prompt.split(' ')
	return words
}

// Request handler callback for the HTTP server
fn callback(data voidptr, req picohttpparser.Request, mut res picohttpparser.Response) {
	if req.method != 'POST' {
		res.status(405)
		res.header('Content-Type', 'application/json')
		res.header('Connection', if req.client_wants_keep_alive() { 'keep-alive' } else { 'close' })
		res.body('{"error":"Only POST method is allowed"}')
		_ := res.end()
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
			_ := res.end()
			return
		}
		body = body_bytes.bytestr()
	}

	if body.len == 0 {
		res.status(400)
		res.header('Content-Type', 'application/json')
		res.header('Connection', if req.client_wants_keep_alive() { 'keep-alive' } else { 'close' })
		res.body('{"error":"No body provided"}')
		_ := res.end()
		return
	}

	// Start streaming response
	res.stream_start() or {
		res.status(500)
		res.header('Content-Type', 'application/json')
		res.header('Connection', 'close')
		res.body('{"error":"Failed to start streaming response"}')
		_ := res.end()
		return
	}

	// Simulate token generation and stream each token
	tokens := simulate_token_generation(body)
	for token in tokens {
		// Add a small delay to simulate processing time
		time.sleep(100 * time.millisecond)
		
		// Stream the token with a space
		res.stream_chunk(token + ' ') or {
			// If streaming fails, we can't recover, just return
			return
		}
	}

	// End the stream
	res.stream_end() or {
		// If ending fails, we can't do much about it
		return
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
