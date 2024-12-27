export class KaitoRequest {
	private readonly request: Request;

	private _url: URL | undefined;

	public constructor(request: Request) {
		this.request = request;
	}

	public get headers() {
		return this.request.headers;
	}

	public get method() {
		return this.request.method;
	}

	public get url() {
		return this.request.url;
	}

	public parseURL() {
		if (!this._url) {
			this._url = new URL(this.url);
		}

		return this._url;
	}

	public async arrayBuffer(): Promise<ArrayBuffer> {
		return this.request.arrayBuffer();
	}

	public async blob(): Promise<Blob> {
		return this.request.blob();
	}

	public async formData(): Promise<FormData> {
		return this.request.formData();
	}

	public async bytes(): Promise<Uint8Array> {
		const buffer = await this.arrayBuffer();
		return new Uint8Array(buffer);
	}

	public async json(): Promise<unknown> {
		return this.request.json();
	}

	public async text(): Promise<string> {
		return this.request.text();
	}
}
