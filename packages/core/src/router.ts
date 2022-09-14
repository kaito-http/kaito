import fmw, {Handler, HTTPMethod} from 'find-my-way';
import {z} from 'zod';
import {KaitoError, WrappedError} from './error';
import {KaitoRequest} from './req';
import {KaitoResponse} from './res';
import {AnyRoute, Route} from './route';
import {ServerConfig} from './server';
import {ExtractRouteParams, getInput, KaitoMethod} from './util';

type Routes = readonly AnyRoute[];

type RemapRoutePrefix<R extends AnyRoute, Prefix extends `/${string}`> = R extends Route<
	infer Context,
	infer Result,
	infer Path,
	infer Method,
	infer InputOutput,
	infer InputDef,
	infer InputInput
>
	? Route<Context, Result, `${Prefix}${Path}`, Method, InputOutput, InputDef, InputInput>
	: never;

type PrefixRoutesPath<Prefix extends `/${string}`, R extends Routes> = R extends [infer First, ...infer Rest]
	? [
			RemapRoutePrefix<Extract<First, AnyRoute<any>>, Prefix>,
			...PrefixRoutesPath<Prefix, Extract<Rest, readonly AnyRoute<any>[]>>
	  ]
	: [];

export class Router<Context, R extends Routes> {
	public readonly routes: R;

	constructor(routes: R) {
		this.routes = routes;
	}

	private static async handle<
		Result,
		Path extends string,
		Method extends KaitoMethod,
		Context,
		Input extends z.ZodSchema = never
	>(
		server: ServerConfig<Context, any>,
		route: Route<Context, Result, Path, Method, Input>,
		options: {
			params: Record<string, string | undefined>;
			req: KaitoRequest;
			res: KaitoResponse;
		}
	) {
		try {
			const ctx = await server.getContext(options.req, options.res);

			const body = await getInput(options.req);
			const input = route.input?.parse(body) ?? (undefined as never);

			const result = await route.run({
				ctx,
				input,
				params: options.params as ExtractRouteParams<Path>,
			});

			options.res.status(200).json({
				success: true as const,
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

			return {
				success: false as const,
				data: {status, message},
			};
		}
	}

	public static create = <Context>() => new Router<Context, []>([]);

	public add = <
		Result,
		Path extends string,
		Method extends KaitoMethod,
		InputOutput = never,
		InputDef extends z.ZodTypeDef = z.ZodTypeDef,
		InputInput = InputOutput
	>(
		route: Route<Context, Result, Path, Method, InputOutput, InputDef, InputInput>
	): Router<Context, [...R, Route<Context, Result, Path, Method, InputOutput, InputDef, InputInput>]> =>
		new Router([...this.routes, route]);

	public merge = <PathPrefix extends `/${string}`, OtherRoutes extends Routes>(
		pathPrefix: PathPrefix,
		other: Router<Context, OtherRoutes>
	) => {
		const newRoutes = other.routes.map(route => ({
			...route,
			path: `${pathPrefix}${route.path}` as `${PathPrefix}${string}`,
		}));

		type Result = [...R, ...PrefixRoutesPath<PathPrefix, OtherRoutes>];

		return new Router<Context, Result>([...this.routes, ...newRoutes] as Result);
	};

	public toFindMyWay = (server: ServerConfig<Context, any>) => {
		const instance = fmw({
			ignoreTrailingSlash: true,
			async defaultRoute(req, serverResponse) {
				const res = new KaitoResponse(serverResponse);
				const message = `Cannot ${req.method as HTTPMethod} ${req.url ?? '/'}`;

				res.status(404).json({
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

				return Router.handle(server, route, {params, req, res});
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
