import {KaitoServer} from './src/server.ts';

const s = new KaitoServer({
	fetch: async req => Response.json(req.url),
});

await s.listen(3000, '127.0.0.1');

console.log('Listening', s.url);
