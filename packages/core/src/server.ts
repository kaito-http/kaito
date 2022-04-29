import {Router, RoutesInit} from './router';
import * as http from 'http';
import {KaitoRequest} from './req';
import {KaitoResponse} from './res';
import {KaitoError} from './error';
import {GetContext} from './util';

export type Before = (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>;

export interface ServerConfig<Context> {
	router: Router<Context, RoutesInit<Context>>;
	getContext: GetContext<Context>;
	before?: Before[];
	onError(arg: {
		error: Error;
		req: KaitoRequest;
		res: KaitoResponse;
	}): Promise<KaitoError | {status: number; message: string}>;
}

export function createFMWServer<Context>(config: ServerConfig<Context>) {
	const fmw = config.router.toFindMyWay(config);

	const server = http.createServer(async (req, res) => {
		for (const fn of config.before ?? []) {
			// Disabled because we need these to run in order!
			// eslint-disable-next-line no-await-in-loop
			await fn(req, res);
		}

		fmw.lookup(req, res);
	});

	return {server, fmw};
}

export function createServer<Context>(config: ServerConfig<Context>) {
	return createFMWServer(config).server;
}
