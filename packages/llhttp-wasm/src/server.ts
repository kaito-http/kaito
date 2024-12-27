import {createServer, Socket} from 'node:net';
import {HTTPRequestParser, type ParseOptions} from './parser/request.ts';
import {HTTPResponseWriter} from './writer/response.ts';

export interface KaitoServerOptions {
	onRequest: (request: Request, socket: Socket) => Promise<Response>;
	onError: (error: Error) => void;
}

type SocketHandlers = {
	onData: (data: Buffer) => Promise<void>;
	onClose: () => void;
	onError: (error: Error) => void;
};

export class KaitoServer {
	private readonly writer = new HTTPResponseWriter();
	private readonly server;

	private readonly connections: Set<Socket>;
	private socketHandlers: WeakMap<Socket, SocketHandlers>;
	private boundServerError: (error: Error) => void;
	private boundConnection: (socket: Socket) => void;
	private isClosing: boolean = false;
	private processingBuffers: WeakMap<Socket, boolean>;
	private options: KaitoServerOptions;

	private _parseOptions: ParseOptions | null = null;
	private get parseOptions(): ParseOptions {
		if (this._parseOptions) {
			return this._parseOptions;
		}

		return {
			secure: false,
			host: this.address,
		};
	}

	constructor(options: KaitoServerOptions) {
		this.server = createServer();
		this.connections = new Set();
		this.socketHandlers = new WeakMap();
		this.processingBuffers = new WeakMap();
		this.options = options;

		this.boundServerError = this.handleError.bind(this);
		this.boundConnection = this.handleConnection.bind(this);

		this.server.on('error', this.boundServerError);
		this.server.on('connection', this.boundConnection);
	}

	private createSocketHandlers(socket: Socket): SocketHandlers {
		const handlers: SocketHandlers = {
			onData: this.handleData.bind(this, socket),
			onClose: () => this.handleClose(socket),
			onError: (error: Error) => this.handleSocketError(socket, error),
		};

		this.socketHandlers.set(socket, handlers);
		return handlers;
	}

	private handleConnection(socket: Socket): void {
		if (this.isClosing) {
			socket.destroy();
			return;
		}

		this.connections.add(socket);
		this.processingBuffers.set(socket, false);

		const handlers = this.createSocketHandlers(socket);
		socket.on('data', handlers.onData);
		socket.on('close', handlers.onClose);
		socket.on('error', handlers.onError);
	}

	private async handleData(socket: Socket, data: Buffer): Promise<void> {
		const isProcessing = this.processingBuffers.get(socket);

		if (isProcessing) {
			return;
		}

		try {
			this.processingBuffers.set(socket, true);

			const request = await HTTPRequestParser.parse(data, this.parseOptions);

			if (!socket.destroyed) {
				const res = await this.options.onRequest(request, socket);
				await this.writer.writeResponse(res, socket);
			}
		} catch (error) {
			this.handleError(error instanceof Error ? error : new Error(String(error)));
			this.cleanupSocket(socket);
			socket.destroy();
		} finally {
			if (this.processingBuffers.has(socket)) {
				this.processingBuffers.set(socket, false);
			}
		}
	}

	private cleanupSocket(socket: Socket): void {
		const handlers = this.socketHandlers.get(socket);
		if (handlers) {
			socket.removeListener('data', handlers.onData);
			socket.removeListener('close', handlers.onClose);
			socket.removeListener('error', handlers.onError);
			this.socketHandlers.delete(socket);
		}

		this.connections.delete(socket);
		this.processingBuffers.delete(socket);
	}

	private handleClose(socket: Socket): void {
		this.cleanupSocket(socket);
	}

	private handleSocketError(socket: Socket, error: Error): void {
		this.handleError(error);
		this.cleanupSocket(socket);
		socket.destroy();
	}

	private handleError(error: Error): void {
		this.options.onError(error);
	}

	private cleanupServer(): void {
		this.server.removeListener('error', this.boundServerError);
		this.server.removeListener('connection', this.boundConnection);
	}

	public listen(port: number, hostname?: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const errorHandler = (error: Error) => {
				this.server.removeListener('error', errorHandler);
				reject(error);
			};

			this.server.once('error', errorHandler);
			this.server.listen(port, hostname, () => {
				this.server.removeListener('error', errorHandler);
				resolve();
			});
		});
	}

	public async close(): Promise<void> {
		this.isClosing = true;

		for (const socket of this.connections) {
			this.cleanupSocket(socket);
			socket.destroy();
		}

		this.cleanupServer();

		return new Promise((resolve, reject) => {
			this.server.close(error => {
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			});
		});
	}

	/**
	 * Asynchronously get the number of concurrent connections on the server. Works
	 * when sockets were sent to forks.
	 * @returns A promise resolving with the number of connections
	 */
	public getConnections(): Promise<number> {
		return new Promise((resolve, reject) => {
			this.server.getConnections((error, count) => {
				if (error) {
					reject(error);
				} else {
					resolve(count);
				}
			});
		});
	}

	public get address(): string {
		const addr = this.server.address();

		if (addr === null) {
			throw new Error('Cannot read HTTPServer address, beacuse it has not started listening or it has been closed');
		}

		if (typeof addr === 'string') {
			return addr;
		} else {
			return `${addr.address}:${addr.port}`;
		}
	}
}
