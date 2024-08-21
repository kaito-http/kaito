/* eslint-disable @typescript-eslint/member-ordering */
import type {Handler, HTTPMethod} from 'find-my-way';
import fmw from 'find-my-way';
import {z} from 'zod';
import {KaitoError, WrappedError} from './error';
import {KaitoRequest} from './req';
import {KaitoResponse, type APIResponse} from './res';
import type {AnyQueryDefinition, AnyRoute, Route} from './route';
import type {ServerConfig} from './server';
import type {ExtractRouteParams, KaitoMethod} from './util';
import {getBody} from './util';

type Routes = readonly AnyRoute[];

type RemapRoutePrefix<R extends AnyRoute, Prefix extends `/${string}`> = R extends Route<
	infer Context,
	infer Result,
	infer Path,
	infer Method,
	infer Query,
	infer BodyOutput,
	infer BodyDef,
	infer BodyInput
>
	? Route<Context, Result, `${Prefix}${Path}`, Method, Query, BodyOutput, BodyDef, BodyInput>
	: never;

type PrefixRoutesPath<Prefix extends `/${string}`, R extends Routes> = R extends [infer First, ...infer Rest]
	? [
			RemapRoutePrefix<Extract<First, AnyRoute>, Prefix>,
			...PrefixRoutesPath<Prefix, Extract<Rest, readonly AnyRoute[]>>
	  ]
	: [];

const getSend = (res: KaitoResponse) => (status: number, response: APIResponse<unknown>) => {
	if (res.raw.headersSent) {
		return;
	}

	res.status(status).json(response);
};

export type RouterOptions<ContextFrom, ContextTo> = {
	through: (context: ContextFrom) => Promise<ContextTo>;
};

export class Router<ContextFrom, ContextTo, R extends Routes> {
	private readonly routerOptions: RouterOptions<ContextFrom, ContextTo>;
	public readonly routes: R;

	public static create = <Context>() =>
		new Router<Context, Context, []>([], {
			through: async context => context,
		});

	private static async handle<Path extends string, ContextFrom, ContextTo>(
		// Allow for any server to be passed
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		server: ServerConfig<ContextFrom, any>,
		routerOptions: RouterOptions<ContextFrom, ContextTo>,
		route: AnyRoute,
		options: {
			params: Record<string, string | undefined>;
			req: KaitoRequest;
			res: KaitoResponse;
		}
	) {
		const send = getSend(options.res);

		try {
			const rootCtx = await server.getContext(options.req, options.res);
			const through = await routerOptions.through(rootCtx);

			const body = ((await route.body?.parse(await getBody(options.req))) ?? undefined) as unknown;

			const query = (
				route.query ? z.object(route.query).parse(Object.fromEntries(options.req.url.searchParams.entries())) : {}
			) as z.ZodObject<AnyQueryDefinition>['_type'];

			const result = (await route.run({
				ctx: through,
				body,
				query,
				params: options.params as ExtractRouteParams<Path>,
			})) as unknown;

			if (options.res.raw.headersSent) {
				return {
					success: true as const,
					data: result,
				};
			}

			send(200, {
				success: true,
				data: result,
				message: 'OK',
			});

			return {
				success: true as const,
				data: result,
			};
		} catch (e: unknown) {
			const error = WrappedError.maybe(e);

			if (error instanceof KaitoError) {
				send(error.status, {
					success: false,
					data: null,
					message: error.message,
				});

				return;
			}

			const {status, message} = await server
				.onError({error, req: options.req, res: options.res})
				.catch(() => ({status: 500, message: 'Internal Server Error'}));

			send(status, {
				success: false,
				data: null,
				message,
			});

			return {
				success: false as const,
				data: {status, message},
			};
		}
	}

	public constructor(routes: R, options: RouterOptions<ContextFrom, ContextTo>) {
		this.routerOptions = options;
		this.routes = routes;
	}

	/**
	 * Adds a new route to the router
	 * @param method The HTTP method to add a route for
	 * @param path The path to add a route for
	 * @param route The route specification to add to this router
	 * @returns A new router with this route added
	 */
	public add = <
		Result,
		Path extends string,
		Method extends KaitoMethod,
		Query extends AnyQueryDefinition = {},
		BodyOutput = never,
		BodyDef extends z.ZodTypeDef = z.ZodTypeDef,
		BodyInput = BodyOutput
	>(
		method: Method,
		path: Path,
		route:
			| (Method extends 'GET'
					? Omit<
							Route<ContextTo, Result, Path, Method, Query, BodyOutput, BodyDef, BodyInput>,
							'body' | 'path' | 'method'
					  >
					: Omit<Route<ContextTo, Result, Path, Method, Query, BodyOutput, BodyDef, BodyInput>, 'path' | 'method'>)
			| Route<ContextTo, Result, Path, Method, Query, BodyOutput, BodyDef, BodyInput>['run']
	): Router<
		ContextFrom,
		ContextTo,
		[...R, Route<ContextTo, Result, Path, Method, Query, BodyOutput, BodyDef, BodyInput>]
	> => {
		const merged: Route<ContextTo, Result, Path, Method, Query, BodyOutput, BodyDef, BodyInput> = {
			...(typeof route === 'object' ? route : {run: route}),
			method,
			path,
		};

		return new Router([...this.routes, merged], this.routerOptions);
	};

	public readonly merge = <PathPrefix extends `/${string}`, OtherRoutes extends Routes>(
		pathPrefix: PathPrefix,
		other: Router<ContextTo, ContextTo, OtherRoutes>
	) => {
		const newRoutes = other.routes.map(route => ({
			...route,
			path: `${pathPrefix}${route.path as string}`,
		}));

		type Result = [...R, ...PrefixRoutesPath<PathPrefix, OtherRoutes>];

		return new Router<ContextFrom, ContextTo, Result>([...this.routes, ...newRoutes] as Result, this.routerOptions);
	};

	// Allow for any server context to be passed
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public freeze = (server: ServerConfig<ContextFrom, any>) => {
		const instance = fmw({
			ignoreTrailingSlash: true,
			async defaultRoute(req, serverResponse) {
				const res = new KaitoResponse(serverResponse);
				const message = `Cannot ${req.method as HTTPMethod} ${req.url ?? '/'}`;

				getSend(res)(404, {
					success: false,
					data: null,
					message,
				});

				return {
					success: false as const,
					data: {status: 404, message},
				};
			},
		});

		for (const route of this.routes) {
			const handler: Handler<fmw.HTTPVersion.V1> = async (incomingMessage, serverResponse, params) => {
				const req = new KaitoRequest(incomingMessage);
				const res = new KaitoResponse(serverResponse);

				return Router.handle(server, this.routerOptions, route, {
					params,
					req,
					res,
				});
			};

			if (route.method === '*') {
				instance.all(route.path, handler);
				continue;
			}

			instance.on(route.method, route.path, handler);
		}

		return instance;
	};

	private readonly method =
		<M extends KaitoMethod>(method: M) =>
		<
			Result,
			Path extends string,
			Query extends AnyQueryDefinition = {},
			BodyOutput = never,
			BodyDef extends z.ZodTypeDef = z.ZodTypeDef,
			BodyInput = BodyOutput
		>(
			path: Path,
			route:
				| (M extends 'GET'
						? Omit<Route<ContextTo, Result, Path, M, Query, BodyOutput, BodyDef, BodyInput>, 'body' | 'path' | 'method'>
						: Omit<Route<ContextTo, Result, Path, M, Query, BodyOutput, BodyDef, BodyInput>, 'path' | 'method'>)
				| Route<ContextTo, Result, Path, M, Query, BodyOutput, BodyDef, BodyInput>['run']
		) =>
			this.add<Result, Path, M, Query, BodyOutput, BodyDef, BodyInput>(method, path, route);

	public get = this.method('GET');
	public post = this.method('POST');
	public put = this.method('PUT');
	public patch = this.method('PATCH');
	public delete = this.method('DELETE');
	public head = this.method('HEAD');
	public options = this.method('OPTIONS');

	public through = <NextContext>(transform: (context: ContextTo) => Promise<NextContext>) =>
		new Router<ContextFrom, NextContext, R>(this.routes, {
			through: async context => {
				const fromCurrentRouter = await this.routerOptions.through(context);

				return transform(fromCurrentRouter);
			},
		});
}
