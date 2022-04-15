import {ServerResponse} from 'http';

export type ErroredAPIResponse = {success: false; data: null; message: string};
export type SuccessfulAPIResponse<T> = {success: true; data: T; message: 'OK'};
export type APIResponse<T> = ErroredAPIResponse | SuccessfulAPIResponse<T>;
export type AnyResponse = APIResponse<unknown>;

export class KaitoResponse<T = unknown> {
	constructor(public readonly raw: ServerResponse) {}

	header(key: string, value: string | readonly string[]) {
		this.raw.setHeader(key, value);
		return this;
	}

	status(code: number) {
		this.raw.statusCode = code;
		return this;
	}

	json(data: APIResponse<T>) {
		const json = JSON.stringify(data);
		this.raw.setHeader('Content-Type', 'application/json');
		this.raw.setHeader('Content-Length', Buffer.byteLength(json));
		this.raw.end(json);
		return this;
	}
}
