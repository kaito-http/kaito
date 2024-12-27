import {createServer, Server, Socket} from 'node:net';
import {HTTPRequestParser, type ParseOptions} from './parser/request.ts';
import {HTTPResponseWriter} from './writer/response.ts';

export interface KaitoServerOptions {
	onRequest: (request: Request, socket: Socket) => Promise<Response>;
	onError: (error: Error) => void;
}

type SocketState = {
	isProcessing: boolean;
	handlers: {
		onData: (data: Buffer) => Promise<void>;
		onClose: () => void;
		onError: (error: Error) => void;
	};
};

export class KaitoServer {
	private readonly server: Server;
	private readonly writer = new HTTPResponseWriter();
	private readonly socketStates = new WeakMap<Socket, SocketState>();
	private readonly connections = new Set<Socket>();

	private isClosing = false;
	private parseOptions: ParseOptions | null = null;

	constructor(private readonly options: KaitoServerOptions) {
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

		// Create handlers once per socket and store state
		const state: SocketState = {
			isProcessing: false,
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
	};

	private readonly createDataHandler = (socket: Socket) => {
		return async (data: Buffer): Promise<void> => {
			if (!this.parseOptions) return;
			const state = this.socketStates.get(socket);
			if (!state || state.isProcessing) return;

			try {
				state.isProcessing = true;
				const request = await HTTPRequestParser.parse(data, this.parseOptions);

				if (!socket.destroyed) {
					const response = await this.options.onRequest(request, socket);
					await this.writer.writeResponse(response, socket);
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
		this.options.onError(error);
	};

	private cleanupSocket(socket: Socket): void {
		const state = this.socketStates.get(socket);
		if (!state) return;

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
