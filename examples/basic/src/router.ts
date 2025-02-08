import {create} from '@kaito-http/core';
import {getRemoteAddress} from '@kaito-http/uws';
import {serialize, type SerializeOptions} from 'cookie';

const serverStarted = Date.now();

const ALLOWED_ORIGINS = ['http://localhost:3000', 'https://app.example.com'];

export const router = create({
	getContext: async (req, head) => {
		// Use `getRemoteAddress()` in Kaito 3.0.0+ in Node.js.
		const ip = getRemoteAddress(req);

		return {
			req,
			ip,

			cookie(name: string, value: string, options: SerializeOptions = {}) {
				head.headers.set('Set-Cookie', serialize(name, value, options));
			},

			uptime: Date.now() - serverStarted,
		};
	},

	onError: error => ({
		status: 500,
		message: error.message,
	}),

	// Runs before the router is called. In this case we are handling OPTIONS requests
	// If you return a response from this function, it WILL be passed to `.transform()` before being sent to the client
	before: async req => {
		if (req.method === 'OPTIONS') {
			return new Response(null, {status: 204});
		}
	},

	transform: async (request, response) => {
		const origin = request.headers.get('origin');

		// Include CORS headers if the origin is allowed
		if (origin && ALLOWED_ORIGINS.includes(origin)) {
			response.headers.set('Access-Control-Allow-Origin', origin);
			response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
			response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
			response.headers.set('Access-Control-Max-Age', '86400');
			response.headers.set('Access-Control-Allow-Credentials', 'true');
		}
	},
});
