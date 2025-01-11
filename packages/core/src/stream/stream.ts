export class KaitoStreamResponse<R> extends Response {
	constructor(body: ReadableStream<R>) {
		super(body, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			},
		});
	}

	async *[Symbol.asyncIterator]() {
		for await (const chunk of this.body!) {
			yield chunk;
		}
	}
}

export class KaitoSSEResponse<_ClientType> extends KaitoStreamResponse<string> {}

export function stream<R>(body: UnderlyingDefaultSource<R>): KaitoStreamResponse<R> {
	return new KaitoStreamResponse<R>(new ReadableStream(body));
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
export function sseEventToString(event: SSEEvent<unknown, string>): string {
	let result = '';

	if (event.event) {
		result += `event:${event.event}\n`;
	}

	if (event.id) {
		result += `id:${event.id}\n`;
	}

	if (event.retry) {
		result += `retry:${event.retry}\n`;
	}

	if (event.data !== undefined) {
		result += `data:${JSON.stringify(event.data)}`;
	}

	return result;
}

export class SSEController<U, E extends string> implements Disposable {
	private readonly controller: ReadableStreamDefaultController<string>;

	public constructor(controller: ReadableStreamDefaultController<string>) {
		this.controller = controller;
	}

	public enqueue(event: SSEEvent<U, E>): void {
		this.controller.enqueue(sseEventToString(event) + '\n\n');
	}

	public close(): void {
		this.controller.close();
	}

	[Symbol.dispose](): void {
		this.close();
	}
}

export interface SSESource<U, E extends string> {
	cancel?: UnderlyingSourceCancelCallback;
	start?(controller: SSEController<U, E>): Promise<void>;
	pull?(controller: SSEController<U, E>): Promise<void>;
}

function sseFromSource<U, E extends string>(source: SSESource<U, E>) {
	const start = source.start;
	const pull = source.pull;
	const cancel = source.cancel;

	const readable = new ReadableStream<string>({
		...(cancel ? {cancel} : {}),

		...(start
			? {
					start: async controller => {
						await start(new SSEController<U, E>(controller));
					},
				}
			: {}),

		...(pull
			? {
					pull: async controller => {
						await pull(new SSEController<U, E>(controller));
					},
				}
			: {}),
	});

	return new KaitoSSEResponse<SSEEvent<U, E>>(readable);
}

export function sse<U, E extends string, T extends SSEEvent<U, E>>(
	source: SSESource<U, E> | AsyncGenerator<T, unknown, unknown> | (() => AsyncGenerator<T, unknown, unknown>),
): KaitoSSEResponse<T> {
	const evaluated = typeof source === 'function' ? source() : source;

	if ('next' in evaluated) {
		const generator = evaluated;
		return sseFromSource<U, E>({
			async start(controller) {
				// ensures close is called on controller when we're done
				using c = controller;

				for await (const event of generator) {
					c.enqueue(event);
				}
			},
		});
	} else {
		// if the SSESource interface is used only strings are permitted.
		// serialization / deserialization for objects is left to the user
		return sseFromSource<U, E>(evaluated);
	}
}

export function sseFromAnyReadable<R, U, E extends string>(
	stream: ReadableStream<R>,
	transform: (chunk: R) => SSEEvent<U, E>,
) {
	const transformer = new TransformStream({
		transform: (chunk, controller) => {
			controller.enqueue(transform(chunk));
		},
	});

	return sse(stream.pipeThrough(transformer));
}
