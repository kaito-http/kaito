import {createClient} from '@kaito-http/client';
import type {App} from './index';

const client = createClient<App>('http://localhost:8080');

const result = client.fetch('GET', '/v1/users/:id', {
	params: {
		id: '',
	},
	input: '',
});

void client.fetch('GET', '/v1/time', {
	input: null,
});
