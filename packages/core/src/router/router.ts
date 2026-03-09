import * as OpenAPI from 'openapi3-ts/oas31';
import type {KaitoConfig} from '../config.ts';
import {KaitoError, WrappedError} from '../error.ts';
import {KaitoHead} from '../head.ts';
import {KaitoRequest} from '../request.ts';
import type {AnyQuery, AnyRoute, OpenAPISpecFor, Route} from '../route.ts';
import {k, KRef, type AnySchemaFor, type BaseSchema, type JSONValue} from '../schema/schema.ts';
import {KaitoSSEResponse, sseEventToString} from '../stream/stream.ts';
import {isNodeLikeDev, type ExtractRouteParams, type KaitoMethod, type MaybePromise} from '../util.ts';

type PrefixRoutesPathInner<R extends AnyRoute, Prefix extends `/${string}`> =
	R extends Route<
		infer ContextFrom,
		infer ContextTo,
		infer RouterInput,
		infer ResultOutput,
		infer Path,
		infer AdditionalParams,
		infer Method,
		infer Query,
		infer BodyInput,
		infer BodyOutput
	>
		? Route<
				ContextFrom,
				ContextTo,
				RouterInput,
				ResultOutput,
				`${Prefix}${Path extends '/' ? '' : Path}`,
				AdditionalParams,
				Method,
				Query,
				BodyInput,
				BodyOutput
			>
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
	through: (context: ContextFrom, params: Record<RequiredParams, string>) => Promise<ContextTo> | ContextTo;
	config: KaitoConfig<ContextFrom, Input>;
};

export class Router<
	ContextFrom,
	ContextTo,
	RequiredParams extends string,
	Routes extends AnyRoute,
	Input extends readonly unknown[],
> {
	readonly #state: RouterState<ContextFrom, ContextTo, RequiredParams, Routes, Input>;

	public static create = <Context = null, Input extends readonly unknown[] = []>(
		config: KaitoConfig<Context, Input> = {},
	): Router<Context, Context, never, never, Input> =>
		new Router({through: context => context, routes: new Set(), config});

	protected constructor(state: RouterState<ContextFrom, ContextTo, RequiredParams, Routes, Input>) {
		this.#state = state;
	}

	public get routes() {
		return this.#state.routes;
	}

	private readonly add = <
		Method extends KaitoMethod,
		Path extends string,
		ResultOutput,
		Query extends AnyQuery,
		BodyInput extends JSONValue,
		BodyOutput,
	>(
		method: Method,
		path: Path,
		route:
			| (Method extends 'GET'
					? Omit<
							Route<ContextFrom, ContextTo, Input, ResultOutput, Path, RequiredParams, Method, Query, BodyInput, BodyOutput>,
							'body' | 'path' | 'method' | 'router' | 'openapi'
						> & {openapi?: OpenAPISpecFor<ResultOutput>}
					: Omit<
							Route<ContextFrom, ContextTo, Input, ResultOutput, Path, RequiredParams, Method, Query, BodyInput, BodyOutput>,
							'path' | 'method' | 'router' | 'openapi'
						> & {openapi?: OpenAPISpecFor<ResultOutput>})
			| Route<ContextFrom, ContextTo, Input, ResultOutput, Path, RequiredParams, Method, Query, BodyInput, BodyOutput>['run'],
	) => {
		const merged: Route<ContextFrom, ContextTo, Input, ResultOutput, Path, RequiredParams, Method, Query, BodyInput, BodyOutput> = {
			...(typeof route === 'object' ? route : {run: route}),
			method,
			path,
			router: this,
		};

		return new Router<
			ContextFrom,
			ContextTo,
			RequiredParams,
			Routes | Route<ContextFrom, ContextTo, Input, ResultOutput, Path, RequiredParams, Method, Query, BodyInput, BodyOutput>,
			Input
		>({
			...this.#state,
			routes: new Set([...this.#state.routes, merged]),
		});
	};

	public readonly params: [RequiredParams] extends [never]
		? <NextParams extends string>() => Router<ContextFrom, ContextTo, NextParams, Routes, Input>
		: () => Router<ContextFrom, ContextTo, RequiredParams, Routes, Input> = (() => this) as never;

	public readonly merge = <
		PathPrefix extends `/${string}`,
		NextRequiredParams extends string,
		OtherRoutes extends AnyRoute,
	>(
		pathPrefix: [NextRequiredParams] extends [ExtractRouteParams<PathPrefix> | RequiredParams]
			? PathPrefix
			: `/:${Exclude<NextRequiredParams, ExtractRouteParams<PathPrefix> | RequiredParams>}`,
		other: Router<ContextFrom, ContextTo, NextRequiredParams, OtherRoutes, Input>,
	): Router<ContextFrom, ContextTo, RequiredParams, Routes | PrefixRoutesPath<PathPrefix, OtherRoutes>, Input> => {
		const newRoutes = [...other.#state.routes].map(route => ({
			...route,
			// handle pathPrefix = / & route.path = / case causing //
			// we intentionally are replacing on the joining path and not the pathPrefix, in case of
			// /named -> merged to -> / causing /named/ not /named
			path: `${pathPrefix}${route.path === '/' ? '' : route.path}`,
		}));

		return new Router({
			...this.#state,
			routes: new Set([...this.#state.routes, ...newRoutes] as (Routes | PrefixRoutesPath<PathPrefix, OtherRoutes>)[]),
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

		for (const route of this.#state.routes) {
			if (!methodToRoutesMap.has(route.method)) {
				methodToRoutesMap.set(route.method, new Map());
			}

			methodToRoutesMap.get(route.method)!.set(route.path, {
				...route,
				fastQuerySchema: route.query ? k.objectFromURLSearchParams(route.query) : undefined,
			});
		}

		const findRoute = Router.getFindRoute(methodToRoutesMap);

		// We don't return this function directly, because we wrap it below with the `.before()` and `.transform()` methods
		const handle = async (req: Request, ...args: Input): Promise<Response> => {
			const url = new URL(req.url);
			const method = req.method as KaitoMethod;

			const {route, params: rawParams} = findRoute(method, url.pathname);

			if (!route) {
				return Response.json({message: `Cannot ${method} ${url.pathname}`}, {status: 404});
			}

			const request = new KaitoRequest(url, req);
			const head = new KaitoHead();

			try {
				const body = route.body ? await route.body.parse(await req.json()) : undefined;
				const query = route.fastQuerySchema ? route.fastQuerySchema.parse(url.searchParams) : {};

				const ctx: unknown = await route.router.#state.through(
					(await this.#state.config.getContext?.(request, head, ...args)) ?? null,
					rawParams,
				);

				const result: unknown = await route.run({
					ctx,
					body,
					query,
					params: rawParams,
				});

				if (result instanceof KaitoSSEResponse) {
					const schema = route.openapi && 'schema' in route.openapi ? route.openapi.schema : undefined;

					const stringStream = result.events.pipeThrough(
						new TransformStream<any, string>({
							transform(event, controller) {
								const serialized = schema
									? {...event, data: event.data !== undefined ? schema.serialize(event.data) : undefined}
									: event;
								controller.enqueue(sseEventToString(serialized) + '\n\n');
							},
						}),
					);

					const sseHeaders = new Headers(head.touched ? head.headers : undefined);
					sseHeaders.set('Content-Type', 'text/event-stream');
					sseHeaders.set('Cache-Control', 'no-cache');
					sseHeaders.set('Connection', 'keep-alive');

					return new Response(stringStream, {
						status: head.status(),
						headers: sseHeaders,
					});
				}

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

				if (route.openapi && 'schema' in route.openapi && route.openapi.schema) {
					const parsed = route.openapi.schema.serialize(result);

					return head.toResponse(parsed);
				}

				if (result === undefined) {
					return head.toResponse(null);
				}

				// @ts-expect-error - TODO(@alii): Should we assert more that this is valid JSON?
				return head.toResponse(result);
			} catch (e) {
				const error = WrappedError.maybe(e);

				if (error instanceof KaitoError) {
					return head.status(error.status).toResponse({
						message: error.message,
					});
				}

				if (!this.#state.config.onError) {
					return head.status(500).toResponse({
						message: 'Internal Server Error',
					});
				}

				try {
					const {status, message} = await this.#state.config.onError(error, request);

					return head.status(status).toResponse({
						message,
					});
				} catch (e) {
					console.error('[Kaito] Failed to handle error inside `.onError()`, returning 500 and Internal Server Error');
					console.error(e);

					return head.status(500).toResponse({
						message: 'Internal Server Error',
					});
				}
			}
		};

		return async (request: Request, ...args: Input): Promise<Response> => {
			if (this.#state.config.before) {
				const result = await this.#state.config.before(request);

				if (result instanceof Response) {
					if (this.#state.config.transform) {
						const transformed = await this.#state.config.transform(request, result);

						if (transformed instanceof Response) {
							return result;
						}
					}

					return result;
				}
			}

			const response = await handle(request, ...args);

			if (this.#state.config.transform) {
				const transformed = await this.#state.config.transform(request, response);

				if (transformed instanceof Response) {
					return transformed;
				}
			}

			return response;
		};
	};

	/**
	 * Create a `/openapi.json` route on this router.
	 *
	 * Any routes defined AFTER this method call will NOT be included in the
	 * file. This is because all methods in Kaito are immutable, so there's no
	 * way for the router to know about routes that were created in the future
	 * on another router.
	 *
	 * @example
	 * ```ts
	 * router.get("/", () => "hey").openapi({
	 * 	info: {
	 * 		title: "My API",
	 * 		version: "1.0.0",
	 * 	},
	 * });
	 * ```
	 *
	 * @param options Options object
	 * @returns
	 */
	public openapi = ({
		info,
		servers,
	}: {
		info: OpenAPI.InfoObject;
		servers?: Partial<Record<(`https://` | `http://`) | ({} & string), string>>;
	}) => {
		const OPENAPI_VERSION: OpenAPI.OpenAPIObject['openapi'] = '3.1.0';

		const componentsSchemas: Record<string, OpenAPI.SchemaObject> = {};

		const addSchemaForRef = (ref: KRef<any, any>) => {
			const name = ref.name;

			const properties = Object.fromEntries(Object.entries(ref.shape).map(([key, value]) => [key, value.toOpenAPI()]));
			const desc = ref.description();
			const schemaObject: OpenAPI.SchemaObject = {
				type: 'object',
				properties,
				required: Object.keys(ref.shape),
				...(desc ? {description: desc} : {}),
			};

			const existing = componentsSchemas[name];
			if (existing) {
				// we could improve this check
				if (JSON.stringify(existing) !== JSON.stringify(schemaObject)) {
					throw new Error(
						`Conflicting KRef definitions detected for "${name}". OpenAPI components require a single schema per name.`,
					);
				}
				return;
			}

			componentsSchemas[name] = schemaObject;
		};

		function visit(schema: BaseSchema<any, any, any>, seen = new Set<any>()): void {
			if (seen.has(schema)) return;
			seen.add(schema);

			if (schema instanceof KRef) addSchemaForRef(schema);

			schema.visit(child => visit(child, seen));
		}

		const paths: OpenAPI.PathsObject = {};

		for (const route of this.#state.routes) {
			if (!route.openapi) {
				continue;
			}

			const pathWithColonParamsReplaceWithCurlyBraces = route.path.replace(/:(\w+)/g, '{$1}');

			if (!paths[pathWithColonParamsReplaceWithCurlyBraces]) {
				paths[pathWithColonParamsReplaceWithCurlyBraces] = {};
			}

			let contentType: string;
			const type = route.openapi.type;
			switch (type) {
				case 'json':
					contentType = 'application/json';
					break;

				case 'sse':
					contentType = 'text/event-stream';
					break;

				case 'response':
					contentType = 'application/octet-stream';
					break;

				default:
					throw new Error(`Unknown output type in route ${route.method} ${route.path}: ${type}`);
			}

			if ('schema' in route.openapi && route.openapi.schema) visit(route.openapi.schema);
			if (route.body) visit(route.body);

			const responseSchema =
				'schema' in route.openapi && route.openapi.schema
					? route.openapi.schema.toOpenAPI()
					: {type: 'string'};

			const item: OpenAPI.OperationObject = {
				...(route.openapi.summary ? {summary: route.openapi.summary} : {}),
				description: route.openapi?.description ?? 'Successful response',
				responses: {
					200: {
						description: route.openapi.description ?? 'Successful response',
						content: {
							[contentType]: {
								schema: responseSchema,
							},
						},
					},
				},
			};

			if (route.body) {
				item.requestBody = {
					content: {
						'application/json': {schema: route.body.toOpenAPI()},
					},
				};
			}

			paths[pathWithColonParamsReplaceWithCurlyBraces][route.method.toLowerCase() as Lowercase<KaitoMethod>] = item;
		}

		const doc: OpenAPI.OpenAPIObject = {
			openapi: OPENAPI_VERSION,
			info,
			paths,
			...(Object.keys(componentsSchemas).length > 0 ? {components: {schemas: componentsSchemas}} : {}),
			servers: Object.entries(servers ?? {}).map(entry => {
				const [url, description] = entry as [string, string];

				return {
					url,
					description,
				};
			}),
		};

		return this.get('/openapi.json', () => Response.json(doc));
	};

	private readonly method = <M extends KaitoMethod>(method: M) => {
		return <Path extends string, ResultOutput = never, Query extends AnyQuery = {}, BodyInput extends JSONValue = never, BodyOutput = never>(
			path: Path,
			route:
				| (M extends 'GET'
						? Omit<
								Route<ContextFrom, ContextTo, Input, ResultOutput, Path, RequiredParams, M, Query, BodyInput, BodyOutput>,
								'body' | 'path' | 'method' | 'router' | 'openapi'
							> & {openapi?: OpenAPISpecFor<ResultOutput>}
						: Omit<
								Route<ContextFrom, ContextTo, Input, ResultOutput, Path, RequiredParams, M, Query, BodyInput, BodyOutput>,
								'path' | 'method' | 'router' | 'openapi'
							> & {openapi?: OpenAPISpecFor<ResultOutput>})
				| Route<ContextFrom, ContextTo, Input, ResultOutput, Path, RequiredParams, M, Query, BodyInput, BodyOutput>['run'],
		) => this.add<M, Path, ResultOutput, Query, BodyInput, BodyOutput>(method, path, route);
	};

	public readonly get = this.method('GET');
	public readonly post = this.method('POST');
	public readonly put = this.method('PUT');
	public readonly patch = this.method('PATCH');
	public readonly delete = this.method('DELETE');
	public readonly head = this.method('HEAD');
	public readonly options = this.method('OPTIONS');

	public through = <NextContext>(
		through: (context: ContextTo, params: Record<RequiredParams, string>) => MaybePromise<NextContext>,
	): Router<ContextFrom, NextContext, RequiredParams, Routes, Input> => {
		return new Router<ContextFrom, NextContext, RequiredParams, Routes, Input>({
			...this.#state,
			through: (context, params) => {
				const next = this.#state.through(context, params);
				if (next instanceof Promise) {
					return next.then(next => through(next, params));
				}
				return through(next, params);
			},
		});
	};
}
