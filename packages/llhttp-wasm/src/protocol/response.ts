import {Socket} from 'node:net';

export class HTTPResponseWriter {
	private async writeHeaders(response: Response, socket: Socket): Promise<void> {
		const statusLine = `HTTP/1.1 ${response.status} ${response.statusText}\r\n`;
		const headers = new Map(response.headers);

		if (response.body instanceof ReadableStream) {
			// For streams, we need to use chunked transfer encoding if no content-length
			if (!headers.has('Content-Length')) {
				headers.set('Transfer-Encoding', 'chunked');
			}
		}

		const headerLines = Array.from(headers.entries())
			.map(([key, value]) => `${key}: ${value}\r\n`)
			.join('');

		const headerBuffer = Buffer.from(`${statusLine}${headerLines}\r\n`);

		await new Promise<void>((resolve, reject) => {
			socket.write(headerBuffer, error => {
				if (error) reject(error);
				else resolve();
			});
		});
	}

	private async writeChunk(chunk: Uint8Array, socket: Socket, useChunkedEncoding: boolean): Promise<void> {
		if (useChunkedEncoding) {
			const size = chunk.length.toString(16);
			const chunkHeader = Buffer.from(`${size}\r\n`);
			const chunkFooter = Buffer.from('\r\n');

			const fullChunk = Buffer.concat([chunkHeader, Buffer.from(chunk), chunkFooter]);

			await new Promise<void>((resolve, reject) => {
				socket.write(fullChunk, error => {
					if (error) reject(error);
					else resolve();
				});
			});
		} else {
			await new Promise<void>((resolve, reject) => {
				socket.write(Buffer.from(chunk), error => {
					if (error) reject(error);
					else resolve();
				});
			});
		}
	}

	private async writeStreamBody(stream: ReadableStream, socket: Socket, useChunkedEncoding: boolean): Promise<void> {
		const reader = stream.getReader();

		try {
			while (true) {
				const {done, value} = await reader.read();

				if (done) {
					break;
				}

				if (value) {
					await this.writeChunk(value, socket, useChunkedEncoding);
				}
			}

			if (useChunkedEncoding) {
				// Write the final chunk for chunked encoding
				await new Promise<void>((resolve, reject) => {
					socket.write('0\r\n\r\n', error => {
						if (error) reject(error);
						else resolve();
					});
				});
			}
		} finally {
			reader.releaseLock();
		}
	}

	private async writeBody(body: BodyInit | null, socket: Socket, useChunkedEncoding: boolean): Promise<void> {
		if (!body) {
			return;
		}

		if (body instanceof ReadableStream) {
			await this.writeStreamBody(body, socket, useChunkedEncoding);
			return;
		}

		let buffer: Buffer;

		if (body instanceof Buffer) {
			buffer = body;
		} else if (body instanceof Uint8Array) {
			buffer = Buffer.from(body);
		} else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
			buffer = Buffer.from(body as ArrayBuffer);
		} else if (typeof body === 'string') {
			buffer = Buffer.from(body);
		} else if (body instanceof URLSearchParams) {
			buffer = Buffer.from(body.toString());
		} else if (body instanceof Blob) {
			buffer = Buffer.from(await body.arrayBuffer());
		} else if (body instanceof FormData) {
			const boundary = '----FormDataBoundary' + Math.random().toString(36).slice(2);
			const chunks: Buffer[] = [];

			for (const [key, value] of body.entries()) {
				chunks.push(Buffer.from(`\r\n--${boundary}\r\n`));

				if (value instanceof Blob) {
					chunks.push(
						Buffer.from(`Content-Disposition: form-data; name="${key}"; filename="${value.name || 'blob'}"\r\n`),
					);
					chunks.push(Buffer.from(`Content-Type: ${value.type || 'application/octet-stream'}\r\n\r\n`));
					chunks.push(Buffer.from(await value.arrayBuffer()));
				} else {
					chunks.push(Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n`));
					chunks.push(Buffer.from(String(value)));
				}
			}

			chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
			buffer = Buffer.concat(chunks);
		} else {
			throw new Error(`Unsupported body type: ${typeof body}`);
		}

		await this.writeChunk(buffer, socket, useChunkedEncoding);
	}

	async writeResponse(response: Response, socket: Socket): Promise<void> {
		const useChunkedEncoding = response.body instanceof ReadableStream && !response.headers.has('Content-Length');

		await this.writeHeaders(response, socket);
		await this.writeBody(response.body, socket, useChunkedEncoding);
	}
}
