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

export function sseEventToString<T>(event: SSEEvent<T, string>): string {
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

export class SSEController implements Disposable {
	private readonly controller: ReadableStreamDefaultController<string>;

	public constructor(controller: ReadableStreamDefaultController<string>) {
		this.controller = controller;
	}

	public enqueue<T>(event: SSEEvent<T, string>): void {
		this.controller.enqueue(sseEventToString(event) + '\n\n');
	}

	public close(): void {
		this.controller.close();
	}

	[Symbol.dispose](): void {
		this.close();
	}
}

export interface SSESource {
	cancel?: UnderlyingSourceCancelCallback;
	start?(controller: SSEController): Promise<void>;
	pull?(controller: SSEController): Promise<void>;
}

function sseFromSource<T>(source: SSESource) {
	const start = source.start;
	const pull = source.pull;
	const cancel = source.cancel;

	const readable = new ReadableStream<string>({
		...(cancel ? {cancel} : {}),

		...(start
			? {
					start: async controller => {
						await start(new SSEController(controller));
					},
				}
			: {}),

		...(pull
			? {
					pull: async controller => {
						await pull(new SSEController(controller));
					},
				}
			: {}),
	});

	return new KaitoSSEResponse<T>(readable);
}

export type ExtractEvents<U> = U extends SSEEvent<infer T, infer E> ? SSEEvent<T, E> : never;

export function sse<U, E extends string, T extends SSEEvent<U, E>>(
	source: SSESource | AsyncGenerator<T, unknown, unknown> | (() => AsyncGenerator<T, unknown, unknown>),
) {
	const evaluated = typeof source === 'function' ? source() : source;

	if ('next' in evaluated) {
		const generator = evaluated;
		return sseFromSource<T>({
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
		return sseFromSource<string>(evaluated);
	}
}
