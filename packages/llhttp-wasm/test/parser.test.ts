import assert from 'node:assert/strict';
import {before, describe, test} from 'node:test';
import {HTTPRequestParser, type ParseOptions} from '../src/protocol/parser.ts';
import {httpStringFromRequest} from './utils.ts';

const options: ParseOptions = {
	secure: false,
	host: '127.0.0.1:3000',
};

async function parse(path: `/${string}`, init?: RequestInit) {
	const url = `${options.secure ? 'https' : 'http'}://${options.host}${path}`;
	const request = new Request(url, init);
	const httpString = await httpStringFromRequest(request);

	return HTTPRequestParser.parse(Buffer.from(httpString), options).then(({request}) => request);
}

before(async () => {
	await parse('/warmup');
});

describe('HTTPRequestParser', async () => {
	test('did parse bare GET', async () => {
		const r = await parse('/');

		assert(r, 'Parser result should exist');
		assert.strictEqual(r.method, 'GET', 'Method should be GET');
		assert.strictEqual(r.url, 'http://127.0.0.1:3000/', 'URL should be /');
	});

	test('did parse GET with query parameters', async () => {
		const r = await parse('/test?a=b&c=d');

		assert.strictEqual(r.method, 'GET', 'Method should be GET');
		assert.strictEqual(r.url, 'http://127.0.0.1:3000/test?a=b&c=d', 'URL should be /test?a=b&c=d');
	});

	test('did parse bare POST', async () => {
		const r = await parse('/', {
			method: 'POST',
		});

		assert.strictEqual(r.method, 'POST', 'Method should be POST');
		assert.strictEqual(r.url, 'http://127.0.0.1:3000/', 'URL should be /');
	});

	test('did parse POST JSON body and headers', async () => {
		const body = {
			foo: 'bar',
			t: true,
			f: false,
			n: 10,
		};

		const r = await parse('/test', {
			method: 'POST',
			headers: {
				h1: 'value1',
				h2: 'value2',
				'content-type': 'application/json',
			},
			body: JSON.stringify(body),
		});

		const json = await r.json();

		assert.strictEqual(r.method, 'POST', 'Method should be POST');
		assert.strictEqual(r.url, 'http://127.0.0.1:3000/test', 'URL should be /test');
		assert.deepStrictEqual(json, body, 'JSON should be equal');
		assert.strictEqual(r.headers.get('h1'), 'value1', 'h1 should be value1');
		assert.strictEqual(r.headers.get('h2'), 'value2', 'h2 should be value2');
	});
});
