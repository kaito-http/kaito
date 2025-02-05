import {z} from 'zod';
import {createDocument, type ZodOpenApiOperationObject, type ZodOpenApiPathsObject} from 'zod-openapi';
import type {KaitoConfig} from '../create.ts';
import {KaitoError, WrappedError} from '../error.ts';
import {KaitoHead} from '../head.ts';
import {KaitoRequest} from '../request.ts';
import type {AnyQuery, AnyRoute, Route} from '../route.ts';
import {isNodeLikeDev, type ErroredAPIResponse, type MaybePromise} from '../util.ts';
import type {KaitoMethod} from './types.ts';

type PrefixRoutesPathInner<R extends AnyRoute, Prefix extends `/${string}`> =
	R extends Route<infer ContextTo, infer Result, infer Path, infer Method, infer Query, infer BodyOutput>
		? Route<ContextTo, Result, `${Prefix}${Path}`, Method, Query, BodyOutput>
		: never;

type PrefixRoutesPath<Prefix extends `/${string}`, R extends AnyRoute> = R extends R
	? PrefixRoutesPathInner<R, Prefix>
	: never;

export type RouterState<ContextFrom, ContextTo, Routes extends AnyRoute> = {
	routes: Set<Routes>;
	through: (context: unknown) => Promise<ContextTo>;
	config: KaitoConfig<ContextFrom>;
};

export type InferRoutes<R extends Router<any, any, any>> = R extends Router<any, any, infer R> ? R : never;

export class Router<ContextFrom, ContextTo, R extends AnyRoute> {
	private readonly state: RouterState<ContextFrom, ContextTo, R>;

	public static create = <Context>(config: KaitoConfig<Context>): Router<Context, Context, never> =>
		new Router<Context, Context, never>({
			through: async context => context as Context,
			routes: new Set(),
			config,
		});

	public constructor(options: RouterState<ContextFrom, ContextTo, R>) {
		this.state = options;
	}

	public get routes() {
		return this.state.routes;
	}

	private add = <Result, Path extends string, Method extends KaitoMethod, Query extends AnyQuery, Body>(
		method: Method,
		path: Path,
		route:
			| (Method extends 'GET'
					? Omit<Route<ContextTo, Result, Path, Method, Query, Body>, 'body' | 'path' | 'method' | 'through'>
					: Omit<Route<ContextTo, Result, Path, Method, Query, Body>, 'path' | 'method' | 'through'>)
			| Route<ContextTo, Result, Path, Method, Query, Body>['run'],
	): Router<ContextFrom, ContextTo, R | Route<ContextTo, Result, Path, Method, Query, Body>> => {
		const merged: Route<ContextTo, Result, Path, Method, Query, Body> = {
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
	): Router<
		ContextFrom,
		ContextTo,
		Extract<R | PrefixRoutesPath<PathPrefix, Extract<OtherRoutes, AnyRoute>>, AnyRoute>
	> => {
		const newRoutes = [...other.state.routes].map(route => ({
			...route,
			path: `${pathPrefix}${route.path as string}`,
		}));

		return new Router({
			...this.state,
			routes: new Set([...this.state.routes, ...newRoutes] as never),
		});
	};

	protected static getFindRoute =
		<R>(routes: Map<string, Map<KaitoMethod, R>>) =>
		(method: KaitoMethod, path: string) => {
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

			return {};
		};

	public serve = () => {
		const routes = new Map<string, Map<KaitoMethod, AnyRoute>>();

		for (const route of this.state.routes) {
			if (!routes.has(route.path)) {
				routes.set(route.path, new Map());
			}

			routes.get(route.path)!.set(route.method, route);
		}

		const findRoute = Router.getFindRoute(routes);

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
				const body = route.body ? await route.body.parseAsync(await req.json()) : undefined;
				const query = route.query ? await z.object(route.query).parseAsync(url.searchParams) : {};

				const ctx = await route.through((await this.state.config.getContext?.(request, head)) ?? null);

				const result = await route.run({
					ctx,
					body,
					query,
					params,
				});

				if (result instanceof Response) {
					if (isNodeLikeDev) {
						if (head.touched) {
							const msg = [
								'Kaito detected that you used the KaitoHead object to modify the headers or status, but then returned a Response in the route',
								'This is usually a mistake, as your Response object will override any changes you made to the headers or status code.',
								'',
								'This warning was shown because `process.env.NODE_ENV=development`',
							].join('\n');

							console.warn(msg);
						}
					}

					return result;
				}

				return head.toResponse({
					success: true,
					data: result,
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

				if (!this.state.config.onError) {
					return head.status(500).toResponse({
						success: false,
						data: null,
						message: 'Internal Server Error',
					});
				}

				try {
					const {status, message} = await this.state.config.onError(error, request);

					return head.status(status).toResponse({
						success: false,
						data: null,
						message,
					});
				} catch (e) {
					console.error('KAITO - Failed to handle error inside `.onError()`, returning 500 and Internal Server Error');
					console.error(e);

					return head.status(500).toResponse({
						success: false,
						data: null,
						message: 'Internal Server Error',
					});
				}
			}
		};
	};

	public openapi = (highLevelSpec: {
		info: {
			version: string;
			title: string;
			description?: string;
		};
		servers?: Partial<Record<(`https://` | `http://`) | ({} & string), string>>;
	}) => {
		const OPENAPI_VERSION = '3.0.0';

		const paths: ZodOpenApiPathsObject = {};

		for (const route of this.state.routes) {
			const path = route.path;

			const pathWithColonParamsReplaceWithCurlyBraces = path.replace(/:(\w+)/g, '{$1}');

			if (!paths[pathWithColonParamsReplaceWithCurlyBraces]) {
				paths[pathWithColonParamsReplaceWithCurlyBraces] = {};
			}

			const item: ZodOpenApiOperationObject = {
				description: route.openapi?.description ?? 'Successful response',
				responses: {
					200: {
						description: route.openapi?.description ?? 'Successful response',

						...(route.openapi
							? {
									content: {
										[{
											json: 'application/json',
											sse: 'text/event-stream',
										}[route.openapi.body.type]]: {schema: route.openapi?.body.schema},
									},
								}
							: {}),
					},
				},
			};

			if (route.body) {
				item.requestBody = {
					content: {
						'application/json': {schema: route.body},
					},
				};
			}

			const params: NonNullable<ZodOpenApiOperationObject['requestParams']> = {};

			if (route.query) {
				params.query = z.object(route.query);
			}

			const urlParams = path.match(/:(\w+)/g);

			if (urlParams) {
				const pathParams = {} as Record<string, z.ZodType>;

				for (const param of urlParams) {
					pathParams[param.slice(1)] = z.string();
				}

				params.path = z.object(pathParams);
			}

			item.requestParams = params;

			paths[pathWithColonParamsReplaceWithCurlyBraces][route.method.toLowerCase() as Lowercase<KaitoMethod>] = item;
		}

		const doc = createDocument({
			openapi: OPENAPI_VERSION,
			paths,
			...highLevelSpec,
			servers: Object.entries(highLevelSpec.servers ?? {}).map(entry => {
				const [url, description] = entry as [string, string];

				return {
					url,
					description,
				};
			}),
		});

		return this.add('GET', '/openapi.json', async () => Response.json(doc));
	};

	private readonly method =
		<M extends KaitoMethod>(method: M) =>
		<Result, Path extends string, Query extends AnyQuery = {}, Body = never>(
			path: Path,
			route:
				| (M extends 'GET'
						? Omit<Route<ContextTo, Result, Path, M, Query, Body>, 'body' | 'path' | 'method' | 'through'>
						: Omit<Route<ContextTo, Result, Path, M, Query, Body>, 'path' | 'method' | 'through'>)
				| Route<ContextTo, Result, Path, M, Query, Body>['run'],
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
		through: (context: ContextTo) => MaybePromise<NextContext>,
	): Router<ContextFrom, NextContext, R> => {
		return new Router<ContextFrom, NextContext, R>({
			...this.state,
			through: async context => await through(await this.state.through(context)),
		});
	};
}
