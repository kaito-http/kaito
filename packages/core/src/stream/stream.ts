import type {JSONValue} from '../schema/schema.ts';

export class KaitoSSEResponse<_T> extends Response {
	public constructor(body: ReadableStream<string>, init?: ResponseInit) {
		const headers = new Headers(init?.headers);

		headers.set('Content-Type', 'text/event-stream');
		headers.set('Cache-Control', 'no-cache');
		headers.set('Connection', 'keep-alive');

		super(body, {
			...init,
			headers,
		});
	}

	public get [Symbol.toStringTag](): string {
		return 'KaitoSSEResponse';
	}
}

export type SSEEvent<T, E extends string> = (
	| {
			data: T;
			event?: E | undefined;
	  }
	| {
			data?: T | undefined;
			event: E;
	  }
) & {
	retry?: number;
	id?: string;
};

/**
 * Converts an SSE Event into a string, ready for sending to the client
 * @param event The SSE Event
 * @returns A stringified version
 */
export function sseEventToString(event: SSEEvent<JSONValue, string>): string {
	const lines: string[] = [];

	if (event.event) {
		lines.push(`event:${event.event}`);
	}

	if (event.id) {
		lines.push(`id:${event.id}`);
	}

	if (event.retry) {
		lines.push(`retry:${event.retry}`);
	}

	if (event.data !== undefined) {
		lines.push(`data:${JSON.stringify(event.data)}`);
	}

	return lines.join('\n');
}

export class SSEController<U extends JSONValue, E extends string, T extends SSEEvent<U, E>> implements Disposable {
	private readonly controller: ReadableStreamDefaultController<string>;

	public constructor(controller: ReadableStreamDefaultController<string>) {
		this.controller = controller;
	}

	public enqueue(event: T): void {
		this.controller.enqueue(sseEventToString(event) + '\n\n');
	}

	public close(): void {
		this.controller.close();
	}

	[Symbol.dispose](): void {
		this.close();
	}
}

export interface SSESource<U extends JSONValue, E extends string, T extends SSEEvent<U, E>> {
	cancel?: UnderlyingSourceCancelCallback;
	start?(controller: SSEController<U, E, T>): Promise<void>;
	pull?(controller: SSEController<U, E, T>): Promise<void>;
}

function sseFromSource<U extends JSONValue, E extends string, T extends SSEEvent<U, E>>(source: SSESource<U, E, T>) {
	const start = source.start;
	const pull = source.pull;
	const cancel = source.cancel;

	const readable = new ReadableStream<string>({
		...(cancel ? {cancel} : {}),

		...(start
			? {
					start: async controller => {
						await start(new SSEController<U, E, T>(controller));
					},
				}
			: {}),

		...(pull
			? {
					pull: async controller => {
						await pull(new SSEController<U, E, T>(controller));
					},
				}
			: {}),
	});

	return new KaitoSSEResponse<SSEEvent<U, E>>(readable);
}

export function sse<U extends JSONValue, E extends string, T extends SSEEvent<U, E>>(
	source: SSESource<U, E, T> | AsyncGenerator<T, unknown, unknown> | (() => AsyncGenerator<T, unknown, unknown>),
): KaitoSSEResponse<T> {
	const evaluated = typeof source === 'function' ? source() : source;

	if ('next' in evaluated) {
		const generator = evaluated;
		return sseFromSource<U, E, T>({
			async start(controller) {
				// TODO: use `using` once Node.js supports it
				// // ensures close is called on controller when we're done
				// using c = controller;
				try {
					for await (const event of generator) {
						controller.enqueue(event);
					}
				} finally {
					controller.close();
				}
			},
		});
	} else {
		// if the SSESource interface is used only strings are permitted.
		// serialization / deserialization for objects is left to the user
		return sseFromSource<U, E, T>(evaluated);
	}
}

export function sseFromAnyReadable<R, U extends JSONValue, E extends string>(
	stream: ReadableStream<R>,
	transform: (chunk: R) => SSEEvent<U, E>,
): KaitoSSEResponse<SSEEvent<U, E>> {
	const transformer = new TransformStream<R, SSEEvent<U, E>>({
		transform: (chunk, controller) => {
			controller.enqueue(transform(chunk));
		},
	});

	return sse(stream.pipeThrough(transformer));
}
