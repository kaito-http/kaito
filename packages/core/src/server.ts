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

export type After<BeforeAfterContext> = (ctx: BeforeAfterContext) => Promise<void>;

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

		fmw.lookup(req, res);

		if ('after' in config && config.after) {
			await config.after(before);
		}
	});

	return {server, fmw} as const;
}

export function createServer<Context, BeforeAfterContext = null>(config: ServerConfig<Context, BeforeAfterContext>) {
	return createFMWServer(config).server;
}
