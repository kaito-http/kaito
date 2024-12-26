import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {HTTPRequestParser, type ParseOptions} from '../src/parser/request.ts';
import {requestInitToHttp} from './utils.ts';

const options: ParseOptions = {
	secure: false,
	hostname: 'google.com',
};

async function post(path: `/${string}`, init?: RequestInit) {
	return Buffer.from(await requestInitToHttp(`http://${options.hostname}${path}`, {...init, method: 'POST'}));
}

describe('HTTPRequestParser', async () => {
	test('did parse bare GET', async () => {
		const r = await HTTPRequestParser.parse(Buffer.from('GET / HTTP/1.1\r\n\r\n'), options);
		assert(r, 'Parser result should exist');
		assert.strictEqual(r.method, 'GET', 'Method should be GET');
		assert.strictEqual(r.url, 'http://google.com/', 'URL should be /');
	});

	test('did parse POST with query parameters', async () => {
		const r = await HTTPRequestParser.parse(await post('/test?a=b&c=d'), options);

		const kaito_data = (r as {} as {_kaito_parsed_url: URL})._kaito_parsed_url;
		assert.strictEqual(r.method, 'POST', 'Method should be POST');
		assert.strictEqual(r.url, 'http://google.com/test?a=b&c=d', 'URL should be /test?a=b&c=d');
		assert.strictEqual(kaito_data.searchParams.get('a'), 'b', 'a query param should equal b');
		assert.strictEqual(kaito_data.searchParams.get('c'), 'd', 'c query param should equal d');
	});

	test('did parse bare POST', async () => {
		const r = await HTTPRequestParser.parse(await post('/'), options);

		assert.strictEqual(r.method, 'POST', 'Method should be POST');
		assert.strictEqual(r.url, 'http://google.com/', 'URL should be /');
	});

	test('did parse POST JSON body and headers', async () => {
		const body = {
			foo: 'bar',
			t: true,
			f: false,
			n: 10,
		};

		const r = await HTTPRequestParser.parse(
			await post('/test', {
				headers: {
					h1: 'value1',
					h2: 'value2',
				},
				body: JSON.stringify(body),
			}),
			options,
		);

		const json = await r.json();

		assert.strictEqual(r.method, 'POST', 'Method should be POST');
		assert.strictEqual(r.url, 'http://google.com/test', 'URL should be /test');
		assert.deepStrictEqual(json, body, 'JSON should be equal');
		assert.strictEqual(r.headers.get('h1'), 'value1', 'h1 should be value1');
		assert.strictEqual(r.headers.get('h2'), 'value2', 'h2 should be value2');
	});
});
