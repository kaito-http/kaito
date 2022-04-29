// Safe to enable this rule here
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import fmw, {HTTPMethod, Instance} from 'find-my-way';
import {z} from 'zod';
import {KaitoError, WrappedError} from './error';
import {KaitoRequest} from './req';
import {KaitoResponse} from './res';
import {Route} from './route';
import {ServerConfig} from './server';
import {ExtractRouteParams, getInput, NoEmpty, NormalizePath, Values} from './util';

export type RoutesInit<Context> = {
	[Path in string]: Route<any, Path, HTTPMethod, Context, z.ZodSchema>;
};

export class Router<Context, Routes extends RoutesInit<Context>> {
	public static create<Context = null>() {
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

	public readonly 'routes': Routes;

	public readonly 'acl' = this.make('ACL');
	public readonly 'bind' = this.make('BIND');
	public readonly 'checkout' = this.make('CHECKOUT');
	public readonly 'connect' = this.make('CONNECT');
	public readonly 'copy' = this.make('COPY');
	public readonly 'delete' = this.make('DELETE');
	public readonly 'get' = this.make('GET');
	public readonly 'head' = this.make('HEAD');
	public readonly 'link' = this.make('LINK');
	public readonly 'lock' = this.make('LOCK');
	public readonly 'm_search' = this.make('M-SEARCH');
	public readonly 'mkactivity' = this.make('MKACTIVITY');
	public readonly 'mkcalendar' = this.make('MKCALENDAR');
	public readonly 'mkcol' = this.make('MKCOL');
	public readonly 'move' = this.make('MOVE');
	public readonly 'notify' = this.make('NOTIFY');
	public readonly 'patch' = this.make('PATCH');
	public readonly 'post' = this.make('POST');
	public readonly 'propfind' = this.make('PROPFIND');
	public readonly 'proppatch' = this.make('PROPPATCH');
	public readonly 'purge' = this.make('PURGE');
	public readonly 'put' = this.make('PUT');
	public readonly 'rebind' = this.make('REBIND');
	public readonly 'report' = this.make('REPORT');
	public readonly 'search' = this.make('SEARCH');
	public readonly 'source' = this.make('SOURCE');
	public readonly 'subscribe' = this.make('SUBSCRIBE');
	public readonly 'trace' = this.make('TRACE');
	public readonly 'unbind' = this.make('UNBIND');
	public readonly 'unlink' = this.make('UNLINK');
	public readonly 'unlock' = this.make('UNLOCK');
	public readonly 'unsubscribe' = this.make('UNSUBSCRIBE');

	private constructor(routes: Routes) {
		this.routes = routes;
	}

	merge<Prefix extends string, NewRoutes extends RoutesInit<Context>>(
		prefix: NormalizePath<Prefix>,
		router: Router<Context, NewRoutes>
	) {
		const newRoutes = Object.fromEntries(Object.entries(router.routes).map(([k, v]) => [`${prefix}${k}`, v]));

		const merged = {
			...this.routes,
			...newRoutes,
		};

		return this._copy(
			merged as Routes & {
				[Path in Extract<keyof NewRoutes, string> as `/${Prefix}${Path}`]: Values<{
					// [M in NewRoutes[Path]['method']]: Route<NewRoutes[Path]>
					[M in NewRoutes[Path]['method']]: Omit<Extract<NewRoutes[Path], {method: M}>, 'path' | 'method'> & {
						path: `/${Prefix}${Path}`;
						method: M;
					};
				}>;
			}
		);
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

		const paths = Object.keys(this.routes) as HTTPMethod[];

		for (const path of paths) {
			const route = this.routes[path];

			instance.on(route.method, path, async (incomingMessage, serverResponse, params) => {
				const req = new KaitoRequest(incomingMessage);
				const res = new KaitoResponse(serverResponse);

				await Router.handle(server, {route, params, req, res});
			});
		}

		return instance;
	}

	_copy<NewRoutes extends RoutesInit<Context>>(routes: NewRoutes) {
		return new Router<Context, NewRoutes>(routes);
	}

	private make<Method extends HTTPMethod>(method: Method) {
		return <Result, Path extends NormalizePath<string>, Input extends z.ZodSchema = never>(
			path: Path,
			route: Omit<Route<Result, Path, Method, Context, Input>, 'method'>
		) => {
			const addedRoute: Route<Result, Path, Method, Context, Input> = {
				...route,
				method,
			};

			// `as unknown` is required because otherwise
			// this type just gets massive and too slow,
			// so we have to write it out specifically
			const merged = {
				...this.routes,
				[path]: addedRoute,
			} as unknown as Path extends keyof Routes
				?
						| NoEmpty<Pick<Routes, Path>>
						| {
								[key in Path]: Route<Result, Path, Method, Context, Input>;
						  }
				: Routes & {
						[key in Path]: Route<Result, Path, Method, Context, Input>;
				  };

			return this._copy(merged);
		};
	}
}

/**
 * @deprecated Please use Router#create instead
 */
export const createRouter = Router.create;
