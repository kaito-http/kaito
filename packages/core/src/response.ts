// export class KaitoResponse {
// 	private readonly response: Response;

// 	public static json<T>(data: T): KaitoResponse {
// 		return new KaitoResponse(JSON.stringify(data), {
// 			headers: {
// 				'Content-Type': 'application/json',
// 			},
// 		});
// 	}

// 	public static plainText(text: string): KaitoResponse {
// 		return new KaitoResponse(text, {
// 			headers: {
// 				'Content-Type': 'text/plain',
// 			},
// 		});
// 	}

// 	public static html(html: string): KaitoResponse {
// 		return new KaitoResponse(html, {
// 			headers: {
// 				'Content-Type': 'text/html',
// 			},
// 		});
// 	}

// 	public constructor(response: Response);
// 	public constructor(body: BodyInit, init?: ResponseInit);
// 	public constructor(responseOrBody?: Response | BodyInit, init?: ResponseInit) {
// 		this.response = responseOrBody instanceof Response ? responseOrBody : new Response(responseOrBody, init);
// 	}

// 	public clone() {
// 		return new KaitoResponse(this.response);
// 	}

// 	public get headers() {
// 		return this.response.headers;
// 	}

// 	public get url() {
// 		return this.response.url;
// 	}

// 	public async arrayBuffer(): Promise<ArrayBuffer> {
// 		return this.response.arrayBuffer();
// 	}

// 	public async blob(): Promise<Blob> {
// 		return this.response.blob();
// 	}

// 	public async formData(): Promise<FormData> {
// 		return this.response.formData();
// 	}

// 	public async bytes(): Promise<Uint8Array> {
// 		const buffer = await this.arrayBuffer();
// 		return new Uint8Array(buffer);
// 	}

// 	public async json(): Promise<unknown> {
// 		return this.response.json();
// 	}

// 	public async text(): Promise<string> {
// 		return this.response.text();
// 	}
// }
