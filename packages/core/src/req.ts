import type {HTTPMethod} from 'find-my-way';
import type {IncomingMessage} from 'node:http';
import {TLSSocket} from 'node:tls';
import {getLastEntryInMultiHeaderValue} from './util';

export class KaitoRequest {
	private _url: URL | null = null;

	constructor(public readonly raw: IncomingMessage) {}

	/**
	 * The full URL of the request, including the protocol, hostname, and path.
	 * Note: does not include the query string or hash
	 */
	get fullURL() {
		return `${this.protocol}://${this.hostname}${this.raw.url ?? ''}`;
	}

	/**
	 * A new URL instance for the full URL of the request.
	 */
	get url() {
		if (this._url) {
			return this._url;
		}

		this._url = new URL(this.fullURL);

		return this._url;
	}

	/**
	 * The HTTP method of the request.
	 */
	get method() {
		if (!this.raw.method) {
			throw new Error('Request method is not defined, somehow...');
		}

		return this.raw.method as HTTPMethod;
	}

	/**
	 * The protocol of the request, either `http` or `https`.
	 */
	get protocol(): 'http' | 'https' {
		if (this.raw.socket instanceof TLSSocket) {
			return this.raw.socket.encrypted ? 'https' : 'http';
		}

		return 'http';
	}

	/**
	 * The request headers
	 */
	get headers() {
		return this.raw.headers;
	}

	/**
	 * The hostname of the request.
	 */
	get hostname() {
		return this.raw.headers.host ?? getLastEntryInMultiHeaderValue(this.raw.headers[':authority'] ?? []);
	}
}
