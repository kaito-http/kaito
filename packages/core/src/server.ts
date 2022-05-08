import {Router} from './router';
import * as http from 'http';
import {KaitoRequest} from './req';
import {KaitoResponse} from './res';
import {KaitoError} from './error';
import {GetContext} from './util';

export type Before<BeforeAfterContext> = (
	req: http.IncomingMessage,
	res: http.ServerResponse
) => Promise<BeforeAfterContext>;

export type HandlerResult = {success: true; data: unknown} | {success: false; data: {status: number; message: string}};

export type After<BeforeAfterContext> = (ctx: BeforeAfterContext, result: HandlerResult) => Promise<void>;

export type ServerConfigWithBefore<BeforeAfterContext> =
	| {before: Before<BeforeAfterContext>; after?: After<BeforeAfterContext>}
	| {before?: undefined};

export type ServerConfig<Context, BeforeAfterContext> = ServerConfigWithBefore<BeforeAfterContext> & {
	router: Router<Context, any>;
	getContext: GetContext<Context>;
	onError(arg: {
		error: Error;
		req: KaitoRequest;
		res: KaitoResponse;
	}): Promise<KaitoError | {status: number; message: string}>;
};

export function createFMWServer<Context, BeforeAfterContext = null>(config: ServerConfig<Context, BeforeAfterContext>) {
	const fmw = config.router.toFindMyWay(config);

	const server = http.createServer(async (req, res) => {
		let before: BeforeAfterContext;

		if (config.before) {
			before = await config.before(req, res);
		} else {
			before = null as never;
		}

		// If the user has sent a response (e.g. replying to CORS), we don't want to do anything else.
		if (res.headersSent) {
			return;
		}

		// https://github.com/delvedor/find-my-way/issues/274
		// eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
		const result = await (fmw.lookup(req, res) as unknown as Promise<HandlerResult>);

		if ('after' in config && config.after) {
			await config.after(before, result);
		}
	});

	return {server, fmw} as const;
}

export function createServer<Context, BeforeAfterContext = null>(config: ServerConfig<Context, BeforeAfterContext>) {
	return createFMWServer(config).server;
}
