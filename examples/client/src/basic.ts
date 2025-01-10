import type {App} from '@kaito-http-examples/basic/src/index.ts';
import {createKaitoHTTPClient} from '@kaito-http/client';

const api = createKaitoHTTPClient<App>({
	base: 'http://localhost:3000',
});

function assertNever(x: never): never {
	throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}

const getSSE = await api.get('/v1/sse_stream', {
	sse: true,
	query: {
		content: 'This is an example of SSE streaming text',
	},
});

for await (const event of getSSE) {
	console.log('event', event.data);
}

const postSSE = await api.post('/v1/sse_stream', {
	sse: true,
	body: {
		count: 20,
	},
});

for await (const event of postSSE) {
	if (!event.data) {
		// data missing and event set is legal in SSE but not in this api
		throw new Error('missing data');
	}

	switch (event.event) {
		case 'numbers':
			const foo: number = event.data.digits;
			console.log(foo);
			break;
		case 'data':
			const bar: object = event.data.obj;
			console.log(bar);
			break;
		case 'text':
			console.log(event.data.text);
			break;
		case undefined:
			throw new Error('event name missing');
		default:
			assertNever(event);
	}
}

const postUnionSSE = await api.post('/v1/sse_stream_union', {
	sse: true,
	body: {
		count: 20,
	},
});

for await (const event of postUnionSSE) {
	// this is a union
	const data = event.data;
	if (!data) {
		// data missing and event set is legal in SSE but not in this api
		throw new Error('missing data');
	}

	if ('digits' in data) {
		// ts knows this is a number
		console.log(data.digits);
	} else if ('text' in data) {
		// ts knows this is a string
		console.log(data.text);
	} else {
		// ts knows this is the only remaining possibility and it's a record.
		console.log(data.obj);
	}
}
