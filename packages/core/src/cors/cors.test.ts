import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {createCORSTransform, createOriginMatcher} from './cors.ts';

describe('CORS', () => {
	describe('createOriginMatcher', () => {
		it('should match exact origins', () => {
			const matcher = createOriginMatcher(['https://example.com']);

			assert.equal(matcher('https://example.com'), true);
			assert.equal(matcher('http://example.com'), false);
			assert.equal(matcher('https://subdomain.example.com'), false);
		});

		it('should match wildcard subdomains', () => {
			const matcher = createOriginMatcher(['*.example.com']);

			assert.equal(matcher('https://app.example.com'), true);
			assert.equal(matcher('http://staging.example.com'), true);
			assert.equal(matcher('https://example.com'), false);
			assert.equal(matcher('https://evil-example.com'), false);
		});

		it('should handle multiple patterns', () => {
			const matcher = createOriginMatcher(['https://example.com', '*.trusted.com', 'http://localhost:3000']);

			assert.equal(matcher('https://example.com'), true);
			assert.equal(matcher('https://app.trusted.com'), true);
			assert.equal(matcher('http://localhost:3000'), true);
			assert.equal(matcher('https://untrusted.com'), false);
		});

		it('should escape special regex characters', () => {
			const matcher = createOriginMatcher(['https://special-chars.com?test=1', '*.special-chars.com+test']);

			assert.equal(matcher('https://special-chars.com?test=1'), true);
			assert.equal(matcher('https://app.special-chars.com+test'), true);
			assert.equal(matcher('https://special-chars.comtest'), false);
		});

		it('should handle empty origins array', () => {
			const matcher = createOriginMatcher([]);
			assert.equal(matcher('https://example.com'), false);
		});
	});

	describe('createCORSTransform', () => {
		it('should set CORS headers for allowed origins', () => {
			const corsTransform = createCORSTransform(['https://example.com']);
			const request = new Request('https://api.example.com', {
				headers: {Origin: 'https://example.com'},
			});
			const response = new Response(null, {
				headers: new Headers(),
			});

			corsTransform(request, response);

			assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://example.com');
			assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, POST, PUT, DELETE, OPTIONS');
			assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'Content-Type, Authorization');
			assert.equal(response.headers.get('Access-Control-Max-Age'), '86400');
			assert.equal(response.headers.get('Access-Control-Allow-Credentials'), 'true');
		});

		it('should not set CORS headers for disallowed origins', () => {
			const corsTransform = createCORSTransform(['https://example.com']);
			const request = new Request('https://api.example.com', {
				headers: {Origin: 'https://evil.com'},
			});
			const response = new Response(null, {
				headers: new Headers(),
			});

			corsTransform(request, response);

			assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
			assert.equal(response.headers.get('Access-Control-Allow-Methods'), null);
			assert.equal(response.headers.get('Access-Control-Allow-Headers'), null);
			assert.equal(response.headers.get('Access-Control-Max-Age'), null);
			assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
		});

		it('should handle requests without Origin header', () => {
			const corsTransform = createCORSTransform(['https://example.com']);
			const request = new Request('https://api.example.com');
			const response = new Response(null, {
				headers: new Headers(),
			});

			corsTransform(request, response);

			assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
		});

		it('should support wildcard origins in transform', () => {
			const corsTransform = createCORSTransform(['*.example.com']);
			const request = new Request('https://api.example.com', {
				headers: {Origin: 'https://app.example.com'},
			});
			const response = new Response(null, {
				headers: new Headers(),
			});

			corsTransform(request, response);

			assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://app.example.com');
		});

		it('should preserve existing headers not related to CORS', () => {
			const corsTransform = createCORSTransform(['https://example.com']);
			const request = new Request('https://api.example.com', {
				headers: {Origin: 'https://example.com'},
			});
			const response = new Response(null, {
				headers: new Headers({
					'Content-Type': 'application/json',
					'X-Custom-Header': 'test',
				}),
			});

			corsTransform(request, response);

			assert.equal(response.headers.get('Content-Type'), 'application/json');
			assert.equal(response.headers.get('X-Custom-Header'), 'test');
			assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://example.com');
		});
	});
});
