import {Router, RoutesInit} from './router';
import * as http from 'http';
import {KaitoRequest} from './req';
import {KaitoResponse} from './res';
import {KaitoError} from './error';
import {GetContext} from './util';

export interface ServerConfig<Context> {
	router: Router<Context, RoutesInit<Context>>;
	getContext: GetContext<Context>;
	onError(arg: {
		error: Error;
		req: KaitoRequest;
		res: KaitoResponse;
	}): Promise<KaitoError | {status: number; message: string}>;
}

export function createServer<Context>(config: ServerConfig<Context>) {
	const fmw = config.router.toFindMyWay(config);

	return http.createServer((req, res) => {
		fmw.lookup(req, res);
	});
}
