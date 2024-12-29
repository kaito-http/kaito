module socket

$if !windows {
	#include <sys/socket.h>
}

// read_socket reads from a socket into a buffer
@[inline]
pub fn read_socket(fd int, buffer &u8, max_len int, offset int) int {
	// use `recv` instead of `read` for windows compatibility
	return unsafe { C.recv(fd, buffer + offset, max_len - offset, 0) }
}

// is_fatal_error returns true if the socket error is fatal
@[inline]
pub fn is_fatal_error(fd int) bool {
	if C.errno == C.EAGAIN {
		// try again later
		return false
	}
	$if windows {
		if C.errno == C.WSAEWOULDBLOCK {
			// try again later
			return false
		}
	} $else {
		if C.errno == C.EWOULDBLOCK {
			// try again later
			return false
		}
	}
	return true
} 