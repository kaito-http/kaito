import {HTTPMethod} from 'find-my-way';
import {IncomingMessage} from 'http';
import {TLSSocket} from 'tls';
import {getLastEntryInMultiHeaderValue} from './util';

export class KaitoRequest {
	private _url: URL | null = null;

	constructor(public readonly raw: IncomingMessage) {}

	get fullURL() {
		return `${this.protocol}://${this.hostname}${this.raw.url ?? ''}`;
	}

	get url() {
		if (this._url) {
			return this._url;
		}

		this._url = new URL(this.fullURL);

		return this._url;
	}

	get method() {
		if (!this.raw.method) {
			throw new Error('Request method is not defined, somehow...');
		}

		return this.raw.method as HTTPMethod;
	}

	get protocol(): 'http' | 'https' {
		if (this.raw.socket instanceof TLSSocket) {
			return this.raw.socket.encrypted ? 'https' : 'http';
		}

		return 'http';
	}

	get headers() {
		return this.raw.headers;
	}

	get hostname() {
		return this.raw.headers.host ?? getLastEntryInMultiHeaderValue(this.raw.headers[':authority'] ?? []);
	}
}
