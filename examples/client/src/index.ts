import type {App} from '@kaito-http-examples/bench/src/index.ts';
import {createKaitoHTTPClient} from '@kaito-http/client';

const api = createKaitoHTTPClient<App>({
	base: 'http://localhost:3000',
});

const test = await api.get('/hello/:test', {
	params: {
		test: '123',
	},
	query: {
		limit: 0,
	},
});

console.log(test);

const stream = await api.post('/stream', {
	sse: true,
});

for await (const chunk of stream) {
	console.log(chunk);
}
