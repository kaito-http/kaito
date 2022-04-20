import {createClient} from '@kaito-http/client';
import type {App} from './index';

const client = createClient<App>('http://localhost:8080');

type g = App['routes'];

const result = client.fetch('GET', '/v1/users/:id', {
	params: {
		id: '',
	},
	input: null,
});

void client.fetch('GET', '/v1/time', {
	input: null,
});
