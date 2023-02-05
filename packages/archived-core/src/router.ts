import type {Handler, HTTPMethod} from 'find-my-way';
import fmw from 'find-my-way';
import {z} from 'zod';
import {KaitoError, WrappedError} from './error';
import {KaitoRequest} from './req';
import {KaitoResponse} from './res';
import type {AnyQueryDefinition, AnyRoute, Route} from './route';
import {defaultJSONSerializer, type HandlerResult, type ServerConfig} from './server';
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

type WithLeadingSlash<T extends string> = T extends `/${string}` ? T : `/${T}`;

export class Router<Context, R extends Routes> {
	public static create = <Context>() => new Router<Context, []>([]);

	private static async handle<Path extends string, Context>(
		req: KaitoRequest,
		res: KaitoResponse,
		params: ExtractRouteParams<Path>,
		meta: {
			server: ServerConfig<Context, unknown>;
			route: AnyRoute;
		}
	): Promise<HandlerResult> {
		try {
			const ctx = await meta.server.getContext(req, res);

			const body = ((await meta.route.body?.parse(await getBody(req))) ?? undefined) as unknown;

			const query = (
				meta.route.query ? z.object(meta.route.query).parse(Object.fromEntries(req.url.searchParams.entries())) : {}
			) as z.ZodObject<AnyQueryDefinition>['_type'];

			const result = (await meta.route.run({
				ctx,
				body,
				query,
				params,
			})) as unknown;

			return {
				success: true,
				data: result,
			};
		} catch (e: unknown) {
			const error = WrappedError.maybe(e);

			if (error instanceof KaitoError) {
				return {
					success: false as const,
					data: {status: error.status, message: error.message},
				};
			}

			const {status, message} = await meta.server
				.onError({error, req, res})
				.catch(() => ({status: 500, message: 'Internal Server Error'}));

			return {
				success: false as const,
				data: {status, message},
			};
		}
	}

	private static async sendResponse<T, BAC>(
		res: KaitoResponse,
		server: ServerConfig<T, BAC>,
		handlerResult: HandlerResult
	): Promise<HandlerResult> {
		const serialized = await (server.serializer ?? defaultJSONSerializer)(handlerResult);

		res
			.status(handlerResult.success ? res.raw.statusCode : handlerResult.data.status)
			.header('Content-Type', 'application/json')
			.raw.end(serialized);

		return handlerResult;
	}

	constructor(public readonly routes: R) {}

	/**
	 * Adds a new route to the router
	 * @param route The route specification to add to this router
	 * @returns A new router with this route added
	 * @deprecated Use `Router#add` instead
	 */
	public old_add = <
		Result,
		Path extends string,
		Method extends KaitoMethod,
		Query extends AnyQueryDefinition = {},
		BodyOutput = never,
		BodyDef extends z.ZodTypeDef = z.ZodTypeDef,
		BodyInput = BodyOutput
	>(
		route: Method extends 'GET'
			? Omit<Route<Context, Result, Path, Method, Query, BodyOutput, BodyDef, BodyInput>, 'body'>
			: Route<Context, Result, Path, Method, Query, BodyOutput, BodyDef, BodyInput>
	): Router<Context, [...R, Route<Context, Result, Path, Method, Query, BodyOutput, BodyDef, BodyInput>]> =>
		new Router([...this.routes, route]);

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
		BodyInput = BodyOutput,
		RealPath extends `/${string}` = Extract<Path, `/${string}`>
	>(
		method: Method,
		path: WithLeadingSlash<Path>,
		route:
			| (Method extends 'GET'
					? Omit<
							Route<Context, Result, RealPath, Method, Query, BodyOutput, BodyDef, BodyInput>,
							'body' | 'path' | 'method'
					  >
					: Omit<Route<Context, Result, RealPath, Method, Query, BodyOutput, BodyDef, BodyInput>, 'path' | 'method'>)
			| Route<Context, Result, RealPath, Method, Query, BodyOutput, BodyDef, BodyInput>['run']
	): Router<Context, [...R, Route<Context, Result, RealPath, Method, Query, BodyOutput, BodyDef, BodyInput>]> => {
		const merged: Route<Context, Result, RealPath, Method, Query, BodyOutput, BodyDef, BodyInput> = {
			...(typeof route === 'object' ? route : {run: route}),
			method,
			// Sry for the cast..
			path: path as unknown as RealPath,
		};

		return new Router([...this.routes, merged]);
	};

	public merge = <PathPrefix extends `/${string}`, OtherRoutes extends Routes>(
		pathPrefix: PathPrefix,
		other: Router<Context, OtherRoutes>
	) => {
		const newRoutes = other.routes.map(route => ({
			...route,
			path: `${pathPrefix}${route.path as string}`,
		}));

		type Result = [...R, ...PrefixRoutesPath<PathPrefix, OtherRoutes>];

		return new Router<Context, Result>([...this.routes, ...newRoutes] as Result);
	};

	// Allow for any server context to be passed
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public toFindMyWay = (server: ServerConfig<Context, any>) => {
		const instance = fmw({
			ignoreTrailingSlash: true,
			async defaultRoute(req, serverResponse) {
				return Router.sendResponse(new KaitoResponse(serverResponse), server, {
					success: false,
					data: {
						status: 404,
						message: `Cannot ${req.method as HTTPMethod} ${req.url ?? '/'}`,
					},
				});
			},
		});

		for (const route of this.routes) {
			const handler: Handler<fmw.HTTPVersion.V1> = async (incomingMessage, serverResponse, params) => {
				const req = new KaitoRequest(incomingMessage);
				const res = new KaitoResponse(serverResponse);

				const result = await Router.handle(req, res, params as Record<string, string>, {
					server,
					route,
				});

				return Router.sendResponse(res, server, result);
			};

			if (route.method === '*') {
				instance.all(route.path, handler);
				continue;
			}

			instance.on(route.method, route.path, handler);
		}

		return instance;
	};
}
