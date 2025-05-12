import type {KaitoConfig} from '../config.ts';
import {KaitoError, WrappedError} from '../error.ts';
import {KaitoHead} from '../head.ts';
import {KaitoRequest} from '../request.ts';
import type {AnyQuery, AnyRoute, Route} from '../route.ts';
import {k, type AnySchemaFor, type JSONValue} from '../schema/schema.ts';
import {
	isNodeLikeDev,
	type ErroredAPIResponse,
	type ExtractRouteParams,
	type KaitoMethod,
	type MaybePromise,
} from '../util.ts';

type PrefixRoutesPathInner<R extends AnyRoute, Prefix extends `/${string}`> =
	R extends Route<
		infer ContextTo,
		infer Result,
		infer Path,
		infer AdditionalParams,
		infer Method,
		infer Query,
		infer BodyOutput
	>
		? Route<ContextTo, Result, `${Prefix}${Path extends '/' ? '' : Path}`, AdditionalParams, Method, Query, BodyOutput>
		: never;

type PrefixRoutesPath<Prefix extends `/${string}`, R extends AnyRoute> = R extends R
	? PrefixRoutesPathInner<R, Prefix>
	: never;

export type RouterState<
	ContextFrom,
	ContextTo,
	RequiredParams extends string,
	Routes extends AnyRoute,
	Input extends readonly unknown[],
> = {
	routes: Set<Routes>;
	through: (context: unknown, params: RequiredParams) => Promise<ContextTo>;
	config: KaitoConfig<ContextFrom, Input>;
};

export class Router<
	ContextFrom,
	ContextTo,
	RequiredParams extends string,
	R extends AnyRoute,
	Input extends readonly unknown[],
> {
	private readonly state: RouterState<ContextFrom, ContextTo, RequiredParams, R, Input>;

	public static create = <Context = null, Input extends readonly unknown[] = []>(
		config: KaitoConfig<Context, Input> = {},
	): Router<Context, Context, never, never, Input> => {
		return new Router({
			through: async context => context as Context,
			routes: new Set(),
			config,
		});
	};

	protected constructor(state: RouterState<ContextFrom, ContextTo, RequiredParams, R, Input>) {
		this.state = state;
	}

	public get routes() {
		return this.state.routes;
	}

	private readonly add = <
		Result extends JSONValue,
		Path extends string,
		Method extends KaitoMethod,
		Query extends AnyQuery,
		Body extends JSONValue,
	>(
		method: Method,
		path: Path,
		route:
			| (Method extends 'GET'
					? Omit<
							Route<ContextTo, Result, Path, RequiredParams, Method, Query, Body>,
							'body' | 'path' | 'method' | 'router'
						>
					: Omit<Route<ContextTo, Result, Path, RequiredParams, Method, Query, Body>, 'path' | 'method' | 'router'>)
			| Route<ContextTo, Result, Path, RequiredParams, Method, Query, Body>['run'],
	): Router<
		ContextFrom,
		ContextTo,
		RequiredParams,
		R | Route<ContextTo, Result, Path, RequiredParams, Method, Query, Body>,
		Input
	> => {
		const merged: Route<ContextTo, Result, Path, RequiredParams, Method, Query, Body> = {
			...((typeof route === 'object' ? route : {run: route}) as {run: never}),
			method,
			path,
			router: this,
		};

		return new Router({
			...this.state,
			routes: new Set([...this.state.routes, merged]),
		});
	};

	public readonly params: [R] extends [never]
		? <NextParams extends string>() => Router<ContextFrom, ContextTo, NextParams, R, Input>
		: 'router.params() can only be called before any routes are attached' = (() => this) as never;

	public readonly merge = <
		PathPrefix extends `/${string}`,
		NextRequiredParams extends string,
		OtherRoutes extends AnyRoute,
	>(
		pathPrefix: [NextRequiredParams] extends [ExtractRouteParams<PathPrefix> | RequiredParams]
			? PathPrefix
			: `Missing ${Exclude<NextRequiredParams, ExtractRouteParams<PathPrefix> | RequiredParams>}`,
		other: Router<ContextFrom, unknown, NextRequiredParams, OtherRoutes, Input>,
	): Router<
		ContextFrom,
		ContextTo,
		RequiredParams,
		Extract<R | PrefixRoutesPath<PathPrefix, Extract<OtherRoutes, AnyRoute>>, AnyRoute>,
		Input
	> => {
		const newRoutes = [...other.state.routes].map(route => ({
			...route,
			// handle pathPrefix = / & route.path = / case causing //
			// we intentionally are replacing on the joining path and not the pathPrefix, in case of
			// /named -> merged to -> / causing /named/ not /named
			path: `${pathPrefix}${route.path === '/' ? '' : route.path}`,
		}));

		return new Router({
			...this.state,
			routes: new Set([...this.state.routes, ...newRoutes] as never),
		});
	};

	protected static getFindRoute =
		<R>(routes: Map<KaitoMethod, Map<string, R>>) =>
		(method: KaitoMethod, path: string) => {
			const params: Record<string, string> = {};
			const pathParts = path.split('/').filter(Boolean);

			const methodRoutes = routes.get(method);
			if (!methodRoutes) return {};

			for (const [routePath, route] of methodRoutes) {
				const routeParts = routePath.split('/').filter(Boolean);

				if (routeParts.length !== pathParts.length) {
					continue;
				}

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

				if (matches) return {route, params};
			}

			return {};
		};

	public serve = () => {
		const methodToRoutesMap = new Map<
			KaitoMethod,
			Map<
				string,
				AnyRoute & {
					fastQuerySchema: AnySchemaFor<AnyQuery> | undefined;
				}
			>
		>();

		for (const route of this.state.routes) {
			if (!methodToRoutesMap.has(route.method)) {
				methodToRoutesMap.set(route.method, new Map());
			}

			methodToRoutesMap.get(route.method)!.set(route.path, {
				...route,
				fastQuerySchema: route.query ? k.object(route.query) : undefined,
			});
		}

		const findRoute = Router.getFindRoute(methodToRoutesMap);

		// We don't return this function directly, because we wrap it below with the `.before()` and `.transform()` methods
		const handle = async (req: Request, ...args: Input): Promise<Response> => {
			const url = new URL(req.url);
			const method = req.method as KaitoMethod;

			const {route, params: rawParams} = findRoute(method, url.pathname);

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
				const query = route.fastQuerySchema ? route.fastQuerySchema.parse(url.searchParams) : {};

				const ctx = await route.router.state.through(
					(await this.state.config.getContext?.(request, head, ...args)) ?? null,
					rawParams,
				);

				const result = await route.run({
					ctx,
					body,
					query,
					params: rawParams,
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

		return async (request: Request, ...args: Input): Promise<Response> => {
			if (this.state.config.before) {
				const result = await this.state.config.before(request);

				if (result instanceof Response) {
					if (this.state.config.transform) {
						const transformed = await this.state.config.transform(request, result);

						if (transformed instanceof Response) {
							return result;
						}
					}

					return result;
				}
			}

			const response = await handle(request, ...args);

			if (this.state.config.transform) {
				const transformed = await this.state.config.transform(request, response);

				if (transformed instanceof Response) {
					return transformed;
				}
			}

			return response;
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
		return this;
		/*

		const OPENAPI_VERSION = '3.0.0';

		const paths: ZodOpenApiPathsObject = {};

		for (const route of this.state.routes) {
			const path = route.path;

			if (!route.openapi) {
				continue;
			}

			const pathWithColonParamsReplaceWithCurlyBraces = path.replace(/:(\w+)/g, '{$1}');

			if (!paths[pathWithColonParamsReplaceWithCurlyBraces]) {
				paths[pathWithColonParamsReplaceWithCurlyBraces] = {};
			}

			const content: ZodOpenApiContentObject =
				route.openapi.body.type === 'json'
					? {
							'application/json': {
								schema: z.object({
									success: z.literal(true).openapi({
										type: 'boolean',
										enum: [true], // Need this as zod-openapi doesn't properly work with literals
									}),
									data: route.openapi.body.schema,
								}),
							},
						}
					: {
							'text/event-stream': {
								schema: route.openapi.body.schema,
							},
						};

			const item: ZodOpenApiOperationObject = {
				description: route.openapi?.description ?? 'Successful response',
				responses: {
					200: {
						description: route.openapi?.description ?? 'Successful response',
						content,
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

		return this.get('/openapi.json', () => Response.json(doc));
	
	*/
	};

	private readonly method = <M extends KaitoMethod>(method: M) => {
		return <Result extends JSONValue, Path extends string, Query extends AnyQuery = {}, Body extends JSONValue = never>(
			path: Path,
			route:
				| (M extends 'GET'
						? Omit<
								Route<ContextTo, Result, Path, RequiredParams, M, Query, Body>,
								'body' | 'path' | 'method' | 'router'
							>
						: Omit<Route<ContextTo, Result, Path, RequiredParams, M, Query, Body>, 'path' | 'method' | 'router'>)
				| Route<ContextTo, Result, Path, RequiredParams, M, Query, Body>['run'],
		) => this.add<Result, Path, M, Query, Body>(method, path, route);
	};

	public get = this.method('GET');
	public post = this.method('POST');
	public put = this.method('PUT');
	public patch = this.method('PATCH');
	public delete = this.method('DELETE');
	public head = this.method('HEAD');
	public options = this.method('OPTIONS');

	public through = <NextContext>(
		through: (context: ContextTo, params: RequiredParams) => MaybePromise<NextContext>,
	): Router<ContextFrom, NextContext, RequiredParams, R, Input> => {
		return new Router<ContextFrom, NextContext, RequiredParams, R, Input>({
			...this.state,
			through: async (context, params) => await through(await this.state.through(context, params), params),
		});
	};
}
