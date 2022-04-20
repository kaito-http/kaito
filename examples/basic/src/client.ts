import {createClient, ExtractRoute} from '@kaito-http/client';
import type {App} from './index';

type G = ExtractRoute<App, 'GET', '/v1/time'>;

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
