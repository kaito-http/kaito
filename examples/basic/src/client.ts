import {createClient} from '@kaito-http/client';
import type {App} from './index';

const client = createClient<App>('http://localhost:8080');

const result1 = client.fetch('GET', '/v1/users/:id', {
	params: {
		id: '',
	},
	input: null,
});

const result2 = client.fetch('POST', '/v1/time');

void Promise.all([result1, result2]).then(console.log);
