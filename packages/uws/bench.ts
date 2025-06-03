import {KaitoServer} from './src/index.ts';

await KaitoServer.serve({
	port: 3000,
	fetch: () => new Response('Hello, world!'),
});
