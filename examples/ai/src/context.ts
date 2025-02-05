import {create} from '@kaito-http/core';
import {getRemoteAddress} from '@kaito-http/uws';

const serverStarted = Date.now();

export const router = create({
	getContext: async (req, _res) => {
		// Use `getRemoteAddress()` in Kaito 3.0.0+ in Node.js. Can only be called
		// inside this getContext function, or inside of a route (or the callstack of a route)
		const ip = getRemoteAddress();

		// Passing req is OK, but I personally prefer to avoid it.
		// Instead, the logic I would have used req for should be
		// included in this context file, allowing for it to be
		// shared between routes.

		return {
			req,
			ip,
			uptime: Date.now() - serverStarted,
		};
	},

	onError: async error => ({
		status: 500,
		message: error.message,
	}),
});
