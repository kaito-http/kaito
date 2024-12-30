/* eslint-disable arrow-body-style */

import {createUtilities} from '@kaito-http/core';
import {getSocket} from '@kaito-http/llhttp-wasm';
import {serialize, type SerializeOptions} from 'cookie';

const serverStarted = Date.now();

export const {getContext, router} = createUtilities(async (req, res) => {
	// Use `getSocket()` in Kaito 3.0.0+ in Node.js for accessing the raw socket.
	// Only really useful if you want the IP address of the client
	const ip = getSocket().remoteAddress;

	// Passing req is OK, but I personally prefer to avoid it.
	// Instead, the logic I would have used req for should be
	// included in this context file, allowing for it to be
	// shared between routes.

	return {
		req,
		ip,

		cookie(name: string, value: string, options: SerializeOptions = {}) {
			res.headers.set('Set-Cookie', serialize(name, value, options));
		},

		uptime: Date.now() - serverStarted,
	};
});
