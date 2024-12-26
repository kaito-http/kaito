// describe('HTTPRequestParser', () => {
// 	before(async () => {
// 		await initializeParser(resolve(__dirname, '../../llhttp/build/wasm/llhttp.wasm'));
// 	});
// });

import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
o;
describe('HTTPRequestParser', async () => {
	before(async () => {
		await HTTPParser.initialize();
	});

	await test('did get successful parse', async () => {
		const r = await HTTPRequestParser.parse(
			Buffer.from(['POST /owo HTTP/1.1', 'X: Y', 'Content-Length: 9', '', 'uh, meow?', ''].join('\r\n')),
		);

		assert.equal;
		console.log(r);
		await HTTPParser.initialize();
	});
});
