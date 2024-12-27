import {KaitoServer} from './src/server.ts';

const s = new KaitoServer({
	onError: console.log,
	onRequest: async request => {
		return Response.json({
			time: Date.now(),
			url: request.url,
		});
	},
});

await s.listen(3000, '127.0.0.1');

console.log('Listening', `http://${s.address}`);
