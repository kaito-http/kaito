import type {KaitoError} from './error.ts';
import type {KaitoRequest} from './request.ts';
import type {Router} from './router/router.ts';
import type {GetContext} from './util.ts';

export type Before<BeforeAfterContext> = (req: Request) => Promise<BeforeAfterContext | Response>;
export type After<BeforeAfterContext> = (ctx: BeforeAfterContext, response: Response) => Promise<void>;

export type ServerConfigWithBefore<BeforeAfterContext> =
	| {before: Before<BeforeAfterContext>; after?: After<BeforeAfterContext>}
	| {before?: undefined};

export type ServerConfig<ContextFrom, BeforeAfterContext> = ServerConfigWithBefore<BeforeAfterContext> & {
	// We really want to accept any here.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	router: Router<ContextFrom, unknown, any>;
	getContext: GetContext<ContextFrom>;

	onError(arg: {error: Error; req: KaitoRequest}): Promise<KaitoError | {status: number; message: string}>;
};

export function createKaitoHandler<Context, BeforeAfterContext = null>(
	config: ServerConfig<Context, BeforeAfterContext>,
) {
	const match = config.router.freeze(config);

	return async (request: Request): Promise<Response> => {
		let before: BeforeAfterContext = undefined as never;

		if (config.before) {
			const result = await config.before(request);

			if (result instanceof Response) {
				return result;
			}

			before = result;
		}

		const response = await match(request);

		if ('after' in config && config.after) {
			await config.after(before, response);
		}

		return response;
	};
}
