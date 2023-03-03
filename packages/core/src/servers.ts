import {KaitoHeaders} from './headers.ts';
import type {KaitoMethod, KaitoServer} from './types.ts';

export const servers = {
	node: async resolve => {
		const http = await import('node:http');

		const server = http.createServer(async (req, res) => {
			const {status, body, headers} = await resolve({
				path: req.url ?? '/',
				method: req.method as KaitoMethod,
				headers: new KaitoHeaders(Object.entries(req.headers) as Array<[string, string | string[]]>),
				body: req,
			});

			res.statusCode = status;

			for (const [key, value] of headers) {
				res.setHeader(key, value);
			}

			res.end(body);
		});

		return {
			listen: async port => {
				return new Promise(resolve => {
					server.listen(port, resolve);
				});
			},
		};
	},
} satisfies Record<string, KaitoServer>;
