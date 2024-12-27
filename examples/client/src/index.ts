import type {App} from '@kaito-http-examples/basic/src/index.ts';
import {createKaitoHTTPClient} from '@kaito-http/client';

const api = createKaitoHTTPClient<App>({
	base: 'http://localhost:8080',
});

const result = await api.post('/v1/users/:id', {
	body: {
		name: 'testing',
	},
	params: {
		id: 'alistair',
	},
	query: {
		skip: '0',
	},
});

console.log(result.body.name);
