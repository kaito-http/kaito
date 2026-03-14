import {KaitoServer} from './src/index.ts';

const b = 'ok';
const server = await KaitoServer.serve({
	port: 3000,
	fetch: () => Response.json(b),
});

console.log(`Listening at ${server.url}`);
