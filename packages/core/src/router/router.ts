import {KaitoError, WrappedError} from '../error.ts';
import type {HandlerConfig} from '../handler.ts';
import {KaitoHead} from '../head.ts';
import {KaitoRequest} from '../request.ts';
import type {AnyQueryDefinition, AnyRoute, Route} from '../route.ts';
import type {ErroredAPIResponse, Parsable} from '../util.ts';
import type {KaitoMethod} from './types.ts';

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

export type RouterState<Routes extends AnyRoute, ContextFrom, ContextTo> = {
	routes: Set<Routes>;
	through: (context: ContextFrom) => Promise<ContextTo>;
};

export type InferRoutes<R extends Router<any, any, any>> = R extends Router<any, any, infer R> ? R : never;

export class Router<ContextFrom, ContextTo, R extends AnyRoute> {
	private readonly state: RouterState<R, ContextFrom, ContextTo>;

	public static create = <Context>(): Router<Context, Context, never> =>
		new Router<Context, Context, never>({
			through: async context => context,
			routes: new Set(),
		});

	private static parseQuery<T extends AnyQueryDefinition>(schema: T | undefined, url: URL) {
		if (!schema) {
			return {};
		}

		const result: Record<PropertyKey, unknown> = {};
		for (const key in schema) {
			if (!schema.hasOwnProperty(key)) continue;
			const value = url.searchParams.get(key);
			result[key] = (schema[key] as Parsable).parse(value);
		}

		return result as {
			[Key in keyof T]: ReturnType<T[Key]['parse']>;
		};
	}

	public constructor(options: RouterState<R, ContextFrom, ContextTo>) {
		this.state = options;
	}

	public get routes() {
		return this.state.routes;
	}

	public add = <
		Result,
		Path extends string,
		Method extends KaitoMethod,
		Query extends AnyQueryDefinition = {},
		Body extends Parsable = never,
	>(
		method: Method,
		path: Path,
		route:
			| (Method extends 'GET'
					? Omit<
							Route<ContextFrom, ContextTo, Result, Path, Method, Query, Body>,
							'body' | 'path' | 'method' | 'through'
						>
					: Omit<Route<ContextFrom, ContextTo, Result, Path, Method, Query, Body>, 'path' | 'method' | 'through'>)
			| Route<ContextFrom, ContextTo, Result, Path, Method, Query, Body>['run'],
	): Router<ContextFrom, ContextTo, R | Route<ContextFrom, ContextTo, Result, Path, Method, Query, Body>> => {
		const merged: Route<ContextFrom, ContextTo, Result, Path, Method, Query, Body> = {
			// TODO: Ideally fix the typing here, but this will be replaced in Kaito v4 where all routes must return a Response (which we can type)
			...((typeof route === 'object' ? route : {run: route}) as {run: never}),
			method,
			path,
			through: this.state.through,
		};

		return new Router({
			...this.state,
			routes: new Set([...this.state.routes, merged]),
		});
	};

	public readonly merge = <PathPrefix extends `/${string}`, OtherRoutes extends AnyRoute>(
		pathPrefix: PathPrefix,
		other: Router<ContextFrom, unknown, OtherRoutes>,
	): Router<ContextFrom, ContextTo, Extract<R | PrefixRoutesPath<PathPrefix, OtherRoutes>, AnyRoute>> => {
		const newRoutes = [...other.state.routes].map(route => ({
			...route,
			path: `${pathPrefix}${route.path as string}`,
		}));

		return new Router<ContextFrom, ContextTo, Extract<R | PrefixRoutesPath<PathPrefix, OtherRoutes>, AnyRoute>>({
			...this.state,
			routes: new Set([...this.state.routes, ...newRoutes] as never),
		});
	};

	public freeze = (server: Omit<HandlerConfig<ContextFrom>, 'router'>) => {
		const routes = new Map<string, Map<KaitoMethod, AnyRoute>>();

		for (const route of this.state.routes) {
			if (!routes.has(route.path)) {
				routes.set(route.path, new Map());
			}

			routes.get(route.path)!.set(route.method, route);
		}

		const findRoute = (method: KaitoMethod, path: string): {route?: AnyRoute; params: Record<string, string>} => {
			const params: Record<string, string> = {};
			const pathParts = path.split('/').filter(Boolean);

			for (const [routePath, methodHandlers] of routes) {
				const routeParts = routePath.split('/').filter(Boolean);

				if (routeParts.length !== pathParts.length) continue;

				let matches = true;
				for (let i = 0; i < routeParts.length; i++) {
					const routePart = routeParts[i];
					const pathPart = pathParts[i];

					if (routePart && pathPart && routePart.startsWith(':')) {
						params[routePart.slice(1)] = pathPart;
					} else if (routePart !== pathPart) {
						matches = false;
						break;
					}
				}

				if (matches) {
					const route = methodHandlers.get(method);
					if (route) return {route, params};
				}
			}

			return {params};
		};

		return async (req: Request): Promise<Response> => {
			const url = new URL(req.url);
			const method = req.method as KaitoMethod;

			const {route, params} = findRoute(method, url.pathname);

			if (!route) {
				const body: ErroredAPIResponse = {
					success: false,
					data: null,
					message: `Cannot ${method} ${url.pathname}`,
				};

				return Response.json(body, {status: 404});
			}

			const request = new KaitoRequest(url, req);
			const head = new KaitoHead();

			try {
				const body = route.body ? await route.body.parse(await req.json()) : undefined;
				const query = Router.parseQuery(route.query, url);

				const rootCtx = await server.getContext(request, head);
				const ctx = await route.through(rootCtx);

				const result = await route.run({
					ctx,
					body,
					query,
					params,
				});

				if (result instanceof Response) {
					return result;
				}

				return head.toResponse({
					success: true,
					data: result,
					message: 'OK',
				});
			} catch (e) {
				const error = WrappedError.maybe(e);

				if (error instanceof KaitoError) {
					return head.status(error.status).toResponse({
						success: false,
						data: null,
						message: error.message,
					});
				}

				const {status, message} = await server
					.onError({error, req: request})
					.catch(() => ({status: 500, message: 'Internal Server Error'}));

				return head.status(status).toResponse({
					success: false,
					data: null,
					message,
				});
			}
		};
	};

	private readonly method =
		<M extends KaitoMethod>(method: M) =>
		<Result, Path extends string, Query extends AnyQueryDefinition = {}, Body extends Parsable = never>(
			path: Path,
			route:
				| (M extends 'GET'
						? Omit<Route<ContextFrom, ContextTo, Result, Path, M, Query, Body>, 'body' | 'path' | 'method' | 'through'>
						: Omit<Route<ContextFrom, ContextTo, Result, Path, M, Query, Body>, 'path' | 'method' | 'through'>)
				| Route<ContextFrom, ContextTo, Result, Path, M, Query, Body>['run'],
		) => {
			return this.add<Result, Path, M, Query, Body>(method, path, route);
		};

	public get = this.method('GET');
	public post = this.method('POST');
	public put = this.method('PUT');
	public patch = this.method('PATCH');
	public delete = this.method('DELETE');
	public head = this.method('HEAD');
	public options = this.method('OPTIONS');

	public through = <NextContext>(
		through: (context: ContextTo) => Promise<NextContext>,
	): Router<ContextFrom, NextContext, R> => {
		return new Router<ContextFrom, NextContext, R>({
			...this.state,
			through: async context => through(await this.state.through(context)),
		});
	};
}
