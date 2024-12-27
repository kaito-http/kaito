import {createServer, type Server, type Socket} from 'node:net';

import {HTTPRequestParser, type ParseOptions} from './protocol/parser.ts';
import {HTTPResponseWriter} from './protocol/writer.ts';

/**
 * Options for configuring the Kaito server.
 */
export interface KaitoServerOptions {
	/**
	 * Callback function that is called when a request is received.
	 * @param request - The incoming request object.
	 * @param socket - The socket associated with the request.
	 * @returns A promise that resolves to a response object.
	 */
	onRequest: (request: Request, socket: Socket) => Promise<Response>;

	/**
	 * Optional callback function that is called when an error occurs.
	 * @param error - The error object.
	 */
	onError?: (error: Error) => void;

	/**
	 * Optional keep-alive settings.
	 */
	keepAlive?: {
		/**
		 * Idle timeout in milliseconds. Default is 5000.
		 */
		timeout?: number;

		/**
		 * Maximum number of requests per connection. Default is 1000.
		 */
		maxRequests?: number;
	};
}

interface SocketState {
	isProcessing: boolean;
	requestCount: number;
	keepAlive: boolean;
	idleTimeout: NodeJS.Timeout | null;
	handlers: {
		onData: (data: Buffer) => Promise<void>;
		onClose: () => void;
		onError: (error: Error) => void;
	};
}

export class KaitoServer {
	private readonly server: Server;
	private readonly writer: HTTPResponseWriter;
	private readonly socketStates = new WeakMap<Socket, SocketState>();
	private readonly connections = new Set<Socket>();
	private readonly keepAliveTimeout: number;
	private readonly maxRequestsPerConnection: number;
	private readonly options: KaitoServerOptions;

	private isClosing = false;
	private parseOptions: ParseOptions | null = null;

	public constructor(options: KaitoServerOptions) {
		this.options = options;

		this.keepAliveTimeout = options.keepAlive?.timeout ?? 5000;
		this.maxRequestsPerConnection = options.keepAlive?.maxRequests ?? 1000;
		this.writer = new HTTPResponseWriter();

		this.server = createServer()
			.on('error', this.handleError)
			.on('connection', this.handleConnection)
			.once('listening', () => {
				this.parseOptions = {
					secure: false,
					host: this.address,
				};
			});
	}

	private readonly handleConnection = (socket: Socket): void => {
		if (this.isClosing) {
			socket.destroy();
			return;
		}

		this.connections.add(socket);

		const state: SocketState = {
			isProcessing: false,
			requestCount: 0,
			keepAlive: true, // Default to true for HTTP/1.1
			idleTimeout: null,
			handlers: {
				onData: this.createDataHandler(socket),
				onClose: () => this.cleanupSocket(socket),
				onError: (error: Error) => {
					this.handleError(error);
					this.cleanupSocket(socket);
					socket.destroy();
				},
			},
		};

		this.socketStates.set(socket, state);

		socket.on('data', state.handlers.onData).on('close', state.handlers.onClose).on('error', state.handlers.onError);

		// Set initial idle timeout
		this.resetIdleTimeout(socket, state);
	};

	private resetIdleTimeout(socket: Socket, state: SocketState): void {
		if (state.idleTimeout) {
			clearTimeout(state.idleTimeout);
		}

		if (state.keepAlive && !socket.destroyed) {
			state.idleTimeout = setTimeout(() => {
				this.cleanupSocket(socket);
				socket.destroy();
			}, this.keepAliveTimeout);
		}
	}

	private readonly createDataHandler = (socket: Socket) => {
		return async (data: Buffer): Promise<void> => {
			if (!this.parseOptions) return;

			const state = this.socketStates.get(socket);
			if (!state || state.isProcessing) return;

			try {
				state.isProcessing = true;
				const {request, metadata} = await HTTPRequestParser.parse(data, this.parseOptions);

				state.keepAlive = metadata.shouldKeepAlive;

				// Check if we've exceeded max requests per connection
				state.requestCount++;
				if (state.requestCount >= this.maxRequestsPerConnection) {
					state.keepAlive = false;
				}

				if (!socket.destroyed) {
					const response = await this.options.onRequest(request, socket);

					// Set appropriate Connection header in response
					if (!state.keepAlive) {
						response.headers.set('Connection', 'close');
					} else if (metadata.shouldKeepAlive) {
						response.headers.set('Connection', 'keep-alive');
					}

					await this.writer.writeResponse(response, socket);

					// Close connection if keep-alive is disabled
					if (!state.keepAlive) {
						this.cleanupSocket(socket);
						socket.destroy();
					} else {
						// Reset idle timeout for keep-alive connections
						this.resetIdleTimeout(socket, state);
					}
				}
			} catch (error) {
				this.handleError(error instanceof Error ? error : new Error(String(error)));
				this.cleanupSocket(socket);
				socket.destroy();
			} finally {
				if (state) state.isProcessing = false;
			}
		};
	};

	private readonly handleError = (error: Error): void => {
		this.options.onError?.(error);
	};

	private cleanupSocket(socket: Socket): void {
		const state = this.socketStates.get(socket);
		if (!state) return;

		if (state.idleTimeout) {
			clearTimeout(state.idleTimeout);
		}

		socket
			.removeListener('data', state.handlers.onData)
			.removeListener('close', state.handlers.onClose)
			.removeListener('error', state.handlers.onError);

		this.socketStates.delete(socket);
		this.connections.delete(socket);
	}

	public listen(port: number, hostname: string = '0.0.0.0'): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const onError = (error: Error) => {
				this.server.off('error', onError);
				reject(error);
			};

			this.server.once('error', onError).listen(port, hostname, () => {
				this.server.off('error', onError);
				resolve();
			});
		});
	}

	public async close(): Promise<void> {
		this.isClosing = true;

		// Cleanup and destroy all sockets
		for (const socket of this.connections) {
			this.cleanupSocket(socket);
			socket.destroy();
		}

		// Remove server listeners
		this.server.removeAllListeners('error').removeAllListeners('connection');

		return new Promise<void>((resolve, reject) => {
			this.server.close((error?: Error) => {
				if (error) reject(error);
				else resolve();
			});
		});
	}

	public getConnections(): Promise<number> {
		return new Promise<number>((resolve, reject) => {
			this.server.getConnections((error, count) => {
				if (error) reject(error);
				else resolve(count);
			});
		});
	}

	public get address(): string {
		const addr = this.server.address();

		if (!addr) {
			throw new Error('Server address unavailable: not listening or closed');
		}

		return typeof addr === 'string' ? addr : `${addr.address}:${addr.port}`;
	}
}
