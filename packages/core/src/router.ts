// Safe to enable this rule here
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import fmw, {HTTPMethod, Instance} from 'find-my-way';
import {z} from 'zod';
import {KaitoError, WrappedError} from './error';
import {KaitoRequest} from './req';
import {KaitoResponse} from './res';
import {Route} from './route';
import {ServerConfig} from './server';
import {ExtractRouteParams, getInput, NormalizePath} from './util';

export type RoutesInit<Context, Paths extends string = string> = {
	[Path in Paths]: Route<unknown, Path, HTTPMethod, Context, z.ZodSchema>;
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

			const body = await getInput(options.req);
			const input = options.route.input?.parse(body) ?? (undefined as never);

			const result = await options.route.run({
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

	public readonly routes: Routes;

	public readonly get = this.make('GET');
	public readonly post = this.make('POST');
	public readonly head = this.make('HEAD');
	public readonly put = this.make('PUT');
	public readonly patch = this.make('PATCH');

	private constructor(routes: Routes) {
		this.routes = routes;
	}

	merge<Prefix extends string, NewRoutes extends RoutesInit<Context>>(
		prefix: NormalizePath<Prefix>,
		router: Router<Context, NewRoutes>
	) {
		type Merged = Routes & {
			[Path in Extract<keyof NewRoutes, string> as `/${Prefix}${Path}`]: NewRoutes[Path] extends Route<
				infer Result,
				infer Path,
				infer Method,
				infer Context,
				infer Input
			>
				? Route<Result, `/${Prefix}${Path}`, Method, Context, Input>
				: never;
		};

		const newRoutes = Object.fromEntries(Object.entries(router.routes).map(([k, v]) => [`${prefix}${k}`, v]));

		return new Router<Context, Merged>({
			...this.routes,
			...newRoutes,
		} as Merged);
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

	private make<Method extends HTTPMethod>(method: Method) {
		return <Result, Path extends string, Input extends z.ZodSchema = never>(
			path: NormalizePath<Path>,
			route: Omit<Route<Result, NormalizePath<Path>, Method, Context, Input>, 'method'>
		) => {
			const mergedRoute = {
				...route,
				method,
			};

			type Merged = Routes & {
				[P in Path as NormalizePath<P>]: Route<Result, NormalizePath<P>, Method, Context, Input>;
			};

			return new Router<Context, Merged>({
				...this.routes,
				[path]: mergedRoute,
			} as Merged);
		};
	}
}

/**
 * @deprecated Please use Router#create instead
 */
export const createRouter = Router.create;
