import type {App} from '@kaito-http-examples/basic/src/index.ts';
import {createKaitoHTTPClient} from '@kaito-http/client';

const api = createKaitoHTTPClient<App>({
	base: 'http://localhost:3000',
});

// This returns a `Response`, since that is what the server also returns! This works by setting a header on the response
// to tell the client not to parse the response as JSON.
const valueOfAResponse = await api.get('/v1/response/stream');

const decoder = new TextDecoder();

for await (const chunk of valueOfAResponse.body!) {
	console.log(decoder.decode(chunk));
}
