import fmw, {HTTPMethod, Instance} from 'find-my-way';
import {z} from 'zod';
import {KaitoError, WrappedError} from './error';
import {KaitoRequest} from './req';
import {KaitoResponse} from './res';
import {Route} from './route';
import {ServerConfig} from './server';

export type RoutesInit<Context> = {
	[key in string]: Route<unknown, key, HTTPMethod, Context, z.ZodSchema>;
};

export class Router<Context, Routes extends RoutesInit<Context>> {
	public static create<Context>() {
		return new Router<Context, {}>({});
	}

	private static async handle<
		Result,
		Path extends string,
		Method extends HTTPMethod,
		Context,
		Input extends z.ZodSchema = never
	>(
		server: ServerConfig<Context>,
		options: {
			route: Route<Result, Path, Method, Context, Input>;
			params: Record<string, string | undefined>;
			req: KaitoRequest;
			res: KaitoResponse;
		}
	) {
		try {
			const context = await server.getContext(options.req, options.res);
		} catch (e: unknown) {
			const error = WrappedError.maybe(e);
		}
	}

	public readonly routes: Routes;

	private constructor(routes: Routes) {
		this.routes = routes;
	}

	toFindMyWay(server: ServerConfig<Context>): Instance<fmw.HTTPVersion.V1> {
		const instance = fmw({
			onBadUrl(path, incomingMessage, serverResponse) {
				const req = new KaitoRequest(incomingMessage);
				const res = new KaitoResponse(serverResponse);

				res.json({
					success: false,
					data: null,
					message: `Cannot ${req.method} ${req.raw.url ?? '/'}`,
				});
			},
		});

		// eslint-disable-next-line guard-for-in
		for (const path in this.routes) {
			const route = this.routes[path];

			instance.on(route.method, path, async (incomingMessage, serverResponse, params) => {
				const req = new KaitoRequest(incomingMessage);
				const res = new KaitoResponse(serverResponse);

				await Router.handle(server, {route, params, req, res});
			});
		}

		return instance;
	}
}

/**
 * @deprecated Please use Router#create instead
 */
export const createRouter = Router.create;
