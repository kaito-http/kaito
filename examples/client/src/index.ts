import type {App} from '@kaito-http-examples/bench/src/index.ts';
import {createKaitoHTTPClient} from '@kaito-http/client';

const api = createKaitoHTTPClient<App>({
	base: 'http://localhost:3000',
});

const stream = await api.get('/stream', {
	stream: true,
});

for await (const chunk of stream) {
	console.log(chunk);
}
