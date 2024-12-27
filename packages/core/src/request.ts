export class KaitoRequest {
	public readonly url: URL;

	private readonly _request: Request;

	public constructor(url: URL, request: Request) {
		this._request = request;
		this.url = url;
	}

	public get headers() {
		return this._request.headers;
	}

	public get method() {
		return this._request.method;
	}

	public async arrayBuffer(): Promise<ArrayBuffer> {
		return this._request.arrayBuffer();
	}

	public async blob(): Promise<Blob> {
		return this._request.blob();
	}

	public async formData(): Promise<FormData> {
		return this._request.formData();
	}

	public async bytes(): Promise<Uint8Array> {
		const buffer = await this.arrayBuffer();
		return new Uint8Array(buffer);
	}

	public async json(): Promise<unknown> {
		return this._request.json();
	}

	public async text(): Promise<string> {
		return this._request.text();
	}

	public get request() {
		return this._request;
	}
}
