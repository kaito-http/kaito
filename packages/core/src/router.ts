/* eslint-disable @typescript-eslint/member-ordering */
import type {Handler, HTTPMethod} from 'find-my-way';
import fmw from 'find-my-way';
import {KaitoError, WrappedError} from './error.ts';
import {KaitoRequest} from './req.ts';
import {KaitoResponse, type APIResponse} from './res.ts';
import type {AnyQueryDefinition, AnyRoute, Route} from './route.ts';
import type {ServerConfig} from './server.ts';
import type {ExtractRouteParams, KaitoMethod} from './util.ts';
import {getBody} from './util.ts';

type PrefixRoutesPathInner<R extends AnyRoute, Prefix extends `/${string}`> =
	R extends Route<
		infer ContextFrom,
		infer ContextTo,
		infer Result,
		infer Path,
		infer Method,
		infer Query,
		infer BodyOutput
	>
		? Route<ContextFrom, ContextTo, Result, `${Prefix}${Path}`, Method, Query, BodyOutput>
		: never;

type PrefixRoutesPath<Prefix extends `/${string}`, R extends AnyRoute> = R extends R
	? PrefixRoutesPathInner<R, Prefix>
	: never;

const getSend = (res: KaitoResponse) => (status: number, response: APIResponse<unknown>) => {
	if (res.raw.headersSent) {
		return;
	}

	res.status(status).json(response);
};

export type RouterOptions<ContextFrom, ContextTo> = {
	through: (context: ContextFrom) => Promise<ContextTo>;
};

export class Router<ContextFrom, ContextTo, R extends AnyRoute> {
	private readonly routerOptions: RouterOptions<ContextFrom, ContextTo>;
	public readonly routes: Set<R>;

	public static create = <Context>(): Router<Context, Context, never> =>
		new Router<Context, Context, never>([], {
			through: async context => context,
		});

	private static parseQuery<T extends AnyQueryDefinition>(schema: T | undefined, url: URL) {
		if (!schema) {
			return {};
		}

		const result: Record<PropertyKey, unknown> = {};

		for (const [key, value] of url.searchParams.entries()) {
			const parsable = schema[key as keyof typeof schema];

			if (!parsable) {
				continue;
			}

			const parsed = parsable.parse(value);
			result[key] = parsed;
		}

		return result as {
			[Key in keyof T]: ReturnType<T[Key]['parse']>;
		};
	}

	private static async handle<Path extends string, ContextFrom>(
		// Allow for any server to be passed
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		server: ServerConfig<ContextFrom, any>,
		route: AnyRoute,
		options: {
			params: Record<string, string | undefined>;
			req: KaitoRequest;
			res: KaitoResponse;
		},
	) {
		const send = getSend(options.res);

		try {
			const rootCtx = await server.getContext(options.req, options.res);
			const ctx = (await route.through(rootCtx)) as unknown;

			const body = ((await route.body?.parse(await getBody(options.req))) ?? undefined) as unknown;

			const query = Router.parseQuery(route.query, options.req.url);

			const result = (await route.run({
				ctx,
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

	public constructor(routes: Iterable<R>, options: RouterOptions<ContextFrom, ContextTo>) {
		this.routerOptions = options;
		this.routes = new Set(routes);
	}

	/**
	 * Adds a new route to the router
	 * @deprecated Use the method-specific methods instead
	 */
	public add = <
		Result,
		Path extends string,
		Method extends KaitoMethod,
		Query extends AnyQueryDefinition = {},
		BodyOutput = never,
	>(
		method: Method,
		path: Path,
		route:
			| (Method extends 'GET'
					? Omit<
							Route<ContextFrom, ContextTo, Result, Path, Method, Query, BodyOutput>,
							'body' | 'path' | 'method' | 'through'
						>
					: Omit<Route<ContextFrom, ContextTo, Result, Path, Method, Query, BodyOutput>, 'path' | 'method' | 'through'>)
			| Route<ContextFrom, ContextTo, Result, Path, Method, Query, BodyOutput>['run'],
	): Router<ContextFrom, ContextTo, R | Route<ContextFrom, ContextTo, Result, Path, Method, Query, BodyOutput>> => {
		const merged: Route<ContextFrom, ContextTo, Result, Path, Method, Query, BodyOutput> = {
			...(typeof route === 'object' ? route : {run: route}),
			method,
			path,
			through: this.routerOptions.through,
		};

		return new Router([...this.routes, merged], this.routerOptions);
	};

	public readonly merge = <PathPrefix extends `/${string}`, OtherRoutes extends AnyRoute>(
		pathPrefix: PathPrefix,

		// The ContextTo is irrelevant here, because we
		// keep the .through() handler of this existing router
		// which means that ContextTo doesn't actually change.
		// We DO, however, require that the ContextFrom is the same
		other: Router<ContextFrom, unknown, OtherRoutes>,
	): Router<ContextFrom, ContextTo, Extract<R | PrefixRoutesPath<PathPrefix, OtherRoutes>, AnyRoute>> => {
		const newRoutes = [...other.routes].map(route => ({
			...route,
			path: `${pathPrefix}${route.path as string}`,
		}));

		return new Router<ContextFrom, ContextTo, Extract<R | PrefixRoutesPath<PathPrefix, OtherRoutes>, AnyRoute>>(
			[...this.routes, ...newRoutes] as never,
			this.routerOptions,
		);
	};

	// Allow for any server context to be passed
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public freeze = (server: ServerConfig<ContextFrom, any>): fmw.Instance<fmw.HTTPVersion.V1> => {
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

				return Router.handle(server, route, {
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
		<Result, Path extends string, Query extends AnyQueryDefinition = {}, BodyOutput = never>(
			path: Path,
			route:
				| (M extends 'GET'
						? Omit<
								Route<ContextFrom, ContextTo, Result, Path, M, Query, BodyOutput>,
								'body' | 'path' | 'method' | 'through'
							>
						: Omit<Route<ContextFrom, ContextTo, Result, Path, M, Query, BodyOutput>, 'path' | 'method' | 'through'>)
				| Route<ContextFrom, ContextTo, Result, Path, M, Query, BodyOutput>['run'],
		) => {
			return this.add<Result, Path, M, Query, BodyOutput>(method, path, route);
		};

	public get: <Result, Path extends string, Query extends AnyQueryDefinition = {}, BodyOutput = never>(
		path: Path,
		route:
			| ((
					arg: import('./route.ts').RouteArgument<Path, ContextTo, import('./route.ts').InferQuery<Query>, BodyOutput>,
			  ) => Promise<Result>)
			| Omit<
					Route<ContextFrom, ContextTo, Result, Path, 'GET', Query, BodyOutput>,
					'body' | 'path' | 'method' | 'through'
			  >,
	) => Router<ContextFrom, ContextTo, R | Route<ContextFrom, ContextTo, Result, Path, 'GET', Query, BodyOutput>> =
		this.method('GET');

	public post = this.method('POST');
	public put = this.method('PUT');
	public patch = this.method('PATCH');
	public delete = this.method('DELETE');
	public head = this.method('HEAD');
	public options = this.method('OPTIONS');

	public through = <NextContext>(
		transform: (context: ContextTo) => Promise<NextContext>,
	): Router<ContextFrom, NextContext, R> =>
		new Router<ContextFrom, NextContext, R>(this.routes, {
			through: async context => {
				const fromCurrentRouter = await this.routerOptions.through(context);

				return transform(fromCurrentRouter);
			},
		});
}
