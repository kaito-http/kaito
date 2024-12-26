import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {HTTPRequestParser, type ParseOptions} from '../src/parser/request.ts';

const options: ParseOptions = {
	secure: false,
	hostname: 'google.com',
};

await describe('HTTPRequestParser', async () => {
	await test('did parse bare GET', async () => {
		const r = await HTTPRequestParser.parse(Buffer.from('GET / HTTP/1.1\r\n'), options);
		assert(r, 'Parser result should exist');
		assert.strictEqual(r.method, 'GET', 'Method should be GET');
		assert.strictEqual(r.url, '/', 'URL should be /');
	});

	await test('did parse GET with query parameters', async () => {
		const r = await HTTPRequestParser.parse(Buffer.from('GET /test?a=b&c=d HTTP/1.1\r\n'), options);

		const kaito_data = r._kaito_parsed_url;
		assert.strictEqual(r.method, 'GET', 'Method should be GET');
		assert.strictEqual(r.url, '/test?a=b&c=d', 'URL should be /test?a=b&c=d');
		assert.strictEqual(kaito_data.searchParams.get('a'), 'b', 'a query param should equal b');
		assert.strictEqual(kaito_data.searchParams.get('c'), 'd', 'c query param should equal d');
	});

	await test('did parse bare POST', async () => {
		const r = await HTTPRequestParser.parse(Buffer.from('POST / HTTP/1.1\r\n'), options);

		assert.strictEqual(r.method, 'POST', 'Method should be POST');
		assert.strictEqual(r.url, '/', 'URL should be /');
	});

	await test('did parse POST JSON body and headers', async () => {
		const body = {
			foo: 'bar',
			t: true,
			f: false,
			n: 10,
		};

		const r = await HTTPRequestParser.parse(
			Buffer.from(
				[
					'POST /test HTTP/1.1',
					'h1: value1',
					'h2: value2',
					`Content-Length: ${JSON.stringify(body).length}`,
					'',
					JSON.stringify(body),
					'',
				].join('\r\n'),
			),
			options,
		);
		const json = await r.json();
		assert.strictEqual(r.method, 'POST', 'Method should be POST');
		assert.strictEqual(r.url, '/test', 'URL should be /test');
		assert.deepStrictEqual(json, body, 'JSON should be equal');
		assert.strictEqual(r.headers.get('h1'), 'value1', 'h1 should be value1');
		assert.strictEqual(r.headers.get('h2'), 'value2', 'h2 should be value2');
	});
});
