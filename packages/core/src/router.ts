// Safe to enable this rule here
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import fmw, {Handler, HTTPMethod, Instance} from 'find-my-way';
import {z} from 'zod';
import {KaitoError, WrappedError} from './error';
import {KaitoRequest} from './req';
import {KaitoResponse} from './res';
import {Route} from './route';
import {ServerConfig} from './server';
import {ExtractRouteParams, getInput, KaitoMethod} from './util';

export type RoutesInit<Context> = Array<Route<Context, unknown, string, KaitoMethod, z.ZodSchema>>;

export type MergePaths<Routes extends RoutesInit<unknown>, Prefix extends string> = Routes extends [
	infer R,
	...infer Rest
]
	? R extends Route<infer Context, infer Result, infer Path, infer Method, infer Input>
		? [
				Route<Context, Result, `${Prefix}${Path}`, Method, Input>,
				...MergePaths<Extract<Rest, RoutesInit<unknown>>, Prefix>
		  ]
		: never
	: [];

export class Router<Context, Routes extends RoutesInit<Context>> {
	public static create<Context = null>() {
		return new Router<Context, []>([]);
	}

	private static async handle<
		Result,
		Path extends string,
		Method extends KaitoMethod,
		Context,
		Input extends z.ZodSchema = never
	>(
		server: ServerConfig<Context>,
		route: Route<Context, Result, Path, Method, Input>,
		options: {
			params: Record<string, string | undefined>;
			req: KaitoRequest;
			res: KaitoResponse;
		}
	) {
		try {
			const context = await server.getContext(options.req, options.res);

			const body = await getInput(options.req);
			const input = route.input?.parse(body) ?? (undefined as never);

			const result = await route.run({
				ctx: context,
				input,
				params: options.params as ExtractRouteParams<Path>,
			});

			options.res.status(200).json({
				success: true,
				data: result,
				message: 'OK',
			});
		} catch (e: unknown) {
			const error = WrappedError.maybe(e);

			if (error instanceof KaitoError) {
				options.res.status(error.status).json({
					success: false,
					data: null,
					message: error.message,
				});

				return;
			}

			const {status, message} = await server
				.onError({error, req: options.req, res: options.res})
				.catch(() => ({status: 500, message: 'Internal Server Error'}));

			options.res.status(status).json({
				success: false,
				data: null,
				message,
			});
		}
	}

	public readonly 'routes': Routes;

	private constructor(routes: Routes) {
		this.routes = routes;
	}

	toFindMyWay(server: ServerConfig<Context>): Instance<fmw.HTTPVersion.V1> {
		const instance = fmw({
			ignoreTrailingSlash: true,
			defaultRoute(req, serverResponse) {
				const res = new KaitoResponse(serverResponse);

				res.status(404).json({
					success: false,
					data: null,
					message: `Cannot ${req.method as HTTPMethod} ${req.url ?? '/'}`,
				});
			},
		});

		for (const route of this.routes) {
			const handler: Handler<fmw.HTTPVersion.V1> = async (incomingMessage, serverResponse, params) => {
				const req = new KaitoRequest(incomingMessage);
				const res = new KaitoResponse(serverResponse);

				await Router.handle(server, route, {params, req, res});
			};

			if (route.method === '*') {
				instance.all(route.path, handler);
				continue;
			}

			instance.on(route.method, route.path, handler);
		}

		return instance;
	}

	add<Method extends HTTPMethod, Path extends string, Result, Input extends z.ZodSchema>(
		route: Route<Context, Result, Path, Method, Input>
	) {
		return new Router<Context, [...Routes, Route<Context, Result, Path, Method, Input>]>([...this.routes, route]);
	}

	map() {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		const result = {} as {
			[Method in Routes[number]['method']]: {
				[R in Extract<Routes[number], {method: Method}> as R['path']]: R;
			};
		};

		for (const route of this.routes) {
			const method = route.method as Routes[number]['method'];

			result[method] = {
				...(result[method] ?? {}),
				[route.path]: route,
			};
		}

		return result;
	}

	merge<Prefix extends string, NewRoutes extends RoutesInit<Context>>(
		prefix: Prefix,
		router: Router<Context, NewRoutes>
	) {
		return this.copyContext([
			...this.routes,
			...(router.routes.map(route => ({
				...route,
				path: prefix + route.path,
			})) as MergePaths<NewRoutes, Prefix>),
		]);
	}

	private copyContext<NewRoutes extends RoutesInit<Context>>(routes: NewRoutes) {
		return new Router<Context, NewRoutes>(routes);
	}
}

/**
 * @deprecated Please use Router#create instead
 */
export const createRouter = Router.create;
