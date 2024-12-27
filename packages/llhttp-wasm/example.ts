import {HTTPSocketServer} from './src/server.ts';

const s = new HTTPSocketServer({
	onError: console.log,
	onRequest: async (request, socket) => {
		console.log(request.url);

		return new Response('COOL', {
			status: 200,
		});
	},
});

await s.listen(3000, '127.0.0.1');
