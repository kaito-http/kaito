export class KaitoStreamResponse<T> extends Response {
	constructor(body: ReadableStream<T>) {
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

export class KaitoSSEResponse extends KaitoStreamResponse<string> {}

export function stream<T = string>(body: UnderlyingDefaultSource<T>): KaitoStreamResponse<T> {
	return new KaitoStreamResponse<T>(new ReadableStream<T>(body));
}

export type SSEEvent = (
	| {
			data: string;
			event: string;
	  }
	| {
			data: string;
			event?: string | undefined;
	  }
	| {
			data?: string | undefined;
			event: string;
	  }
) & {
	retry?: number;
	id?: string;
};

export function sseEventToString(event: SSEEvent): string {
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

	if (event.data) {
		result += `data:${event.data}`;
	}

	return result;
}

export class SSEController {
	private readonly controller: ReadableStreamDefaultController<string>;

	public constructor(controller: ReadableStreamDefaultController<string>) {
		this.controller = controller;
	}

	public enqueue(event: SSEEvent): void {
		this.controller.enqueue(sseEventToString(event) + '\n\n');
	}

	public close(): void {
		this.controller.close();
	}
}

export interface SSESource {
	cancel?: UnderlyingSourceCancelCallback;
	start?(controller: SSEController): Promise<void>;
	pull?(controller: SSEController): Promise<void>;
}

export function sse(source: SSESource) {
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

	return new KaitoSSEResponse(readable);
}
