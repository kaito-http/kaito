import {parse as parseContentType} from 'content-type';
import findMyWay from 'find-my-way';
import type {IncomingMessage, ServerResponse} from 'node:http';
import * as http from 'node:http';
import {Readable} from 'node:stream';
import {json} from 'node:stream/consumers';
import getBody from 'raw-body';

export type ExtractRouteParams<T extends string> = string extends T
	? never
	: T extends `${string}:${infer Param}/${infer Rest}`
		? Param | ExtractRouteParams<Rest>
		: T extends `${string}:${infer Param}`
			? Param
			: never;

/**
 * Parsable represents any zod-like schema. Using this over zod directly
 * means consumers can bring their own schema library, and also reduces
 * the footprint of Kaito itself.
 */
export type Parsable<out Out> = {
	parse: (value: unknown) => Out;
};

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export class KaitoRequest {
	public static async getBody(req: IncomingMessage) {
		if (!req.headers['content-type']) {
			return null;
		}

		const {type} = parseContentType(req.headers['content-type']);

		switch (type) {
			case 'application/json': {
				return json(Readable.from(await getBody(req)));
			}

			default: {
				if (process.env.NODE_ENV === 'development') {
					console.warn('[kaito] Unsupported content type:', type);
					console.warn('[kaito] Currently only application/json is supported.');
					console.warn('[kaito] This message is only shown in development mode.');
				}

				return null;
			}
		}
	}

	public readonly raw;
	public readonly method;
	public readonly path;
	public readonly headers;

	public constructor(request: IncomingMessage) {
		if (!request.method) {
			throw new Error('Request method is missing');
		}

		this.raw = request;
		this.method = request.method as HTTPMethod;
		this.path = request.url ?? '/';
		this.headers = request.headers;
	}
}

export class KaitoResponse {
	public readonly raw;

	public constructor(serverResponse: ServerResponse) {
		this.raw = serverResponse;
	}

	setHeader(key: string, value: string) {
		this.raw.setHeader(key, value);
	}

	end(data: string) {
		this.raw.end(data);
	}

	write(data: string) {
		this.raw.write(data);
	}

	json(data: unknown) {
		this.setHeader('Content-Type', 'application/json');
		this.end(JSON.stringify(data));
	}
}

export type ServerOptions<Context> = {
	router: Router<Context, readonly AnyRoute[]>;
	onError: (error: Error) => Promise<{
		message: string;
		status: number;
	}>;
};

export type Route<Result, Context, M extends HTTPMethod, Path extends string, Body> = {
	path: Path;
	method: M;
	body?: Parsable<Body>;
	run(arg: {
		ctx: Context;
		params: {
			[Key in ExtractRouteParams<Path>]: string;
		};
		body: [Body] extends [never] ? undefined : Body;
	}): Promise<Result>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRoute = Route<any, any, HTTPMethod, any, any>;

export type RouterMethodFunction<Context, Routes extends readonly AnyRoute[], M extends HTTPMethod> = <
	Result,
	Path extends string,
	Body = undefined,
>(
	path: Path,
	run: Omit<Route<Result, Context, M, Path, Body>, 'method' | 'path'> | Route<Result, Context, M, Path, Body>['run'],
) => Router<Context, readonly [...Routes, Route<Result, Context, M, Path, Body>]>;

export type AppendPrefixToRoutes<Prefix extends `/${string}`, Routes extends readonly AnyRoute[]> = {
	[Key in keyof Routes]: Routes[Key] extends Route<infer Result, infer Context, infer Method, infer Path, infer Body>
		? Route<Result, Context, Method, `${Prefix}${Path}`, Body>
		: never;
};

export type Router<Context, Routes extends readonly AnyRoute[]> = {
	routes: Routes;

	get: RouterMethodFunction<Context, Routes, 'GET'>;
	post: RouterMethodFunction<Context, Routes, 'POST'>;
	put: RouterMethodFunction<Context, Routes, 'PUT'>;
	patch: RouterMethodFunction<Context, Routes, 'PATCH'>;
	delete: RouterMethodFunction<Context, Routes, 'DELETE'>;

	/**
	 * Freezes the router and converts it into something that can be used to handle requests.
	 * Internally this creates a find-my-way instance and registers all the routes.
	 */
	freeze: () => {
		routes: Routes;
		handle: (options: ServerOptions<Context>, req: IncomingMessage, res: ServerResponse) => Promise<void>;
	};

	merge: <Prefix extends `/${string}`, NextRoutes extends readonly AnyRoute[]>(
		prefix: Prefix,
		other: Router<Context, NextRoutes>,
	) => Router<Context, readonly [...Routes, ...AppendPrefixToRoutes<Prefix, NextRoutes>]>;
};

export class KaitoError extends Error {
	public readonly status: number;
	public readonly message: string;

	public constructor(status: number, message: string) {
		super(message);

		this.status = status;
		this.message = message;
	}
}

export type APIResponse<T> =
	| {success: true; status: number; data: T}
	| {success: false; status: number; message: string};

export function getCreateRouter<Context>(getContext: (req: KaitoRequest, res: KaitoResponse) => Promise<Context>) {
	function createRouter<Routes extends readonly AnyRoute[]>(routes: Routes): Router<Context, Routes> {
		const method =
			<M extends HTTPMethod>(method: M): RouterMethodFunction<Context, Routes, M> =>
			(path, run) =>
				createRouter([
					...routes,
					{
						...(run instanceof Function ? {run} : run),
						path,
						method,
					},
				]);

		return {
			routes,

			get: method('GET'),
			post: method('POST'),
			put: method('PUT'),
			delete: method('DELETE'),
			patch: method('PATCH'),

			merge(prefix, other) {
				return createRouter([
					...routes,
					...other.routes.map(route => ({
						...route,
						path: `${prefix}${route.path}`,
					})),
				] as never);
			},

			freeze() {
				const fmw = findMyWay({
					ignoreTrailingSlash: true,
					defaultRoute() {
						throw new KaitoError(404, 'Not found');
					},
				});

				for (const route of routes) {
					// eslint-disable-next-line max-params
					fmw.on(route.method, route.path as string, async (req, res, params, store, query) => {
						const ctx = await getContext(new KaitoRequest(req), new KaitoResponse(res));
						const body = await KaitoRequest.getBody(req);

						console.log({query});

						return route.run({
							ctx,
							params,
							body: (route.body?.parse(body) ?? undefined) as unknown,
						});
					});
				}

				const execute = async (
					options: ServerOptions<Context>,
					req: IncomingMessage,
					res: ServerResponse,
				): Promise<APIResponse<unknown>> => {
					try {
						const result = (await fmw.lookup(req, res)) as unknown;

						return {
							success: true,
							status: 200,
							data: result,
						};
					} catch (e) {
						if (e instanceof KaitoError) {
							return {
								success: false,
								status: e.status,
								message: e.message,
							};
						}

						if (e instanceof Error) {
							const {status, message} = await options.onError(e);

							return {
								success: false,
								status,
								message,
							};
						}

						return {
							success: false,
							status: 500,
							message: 'Internal server error',
						};
					}
				};

				return {
					routes,
					async handle(options, req, res) {
						const result = await execute(options, req, res);

						res.statusCode = result.status;

						res.setHeader('Content-Type', 'application/json');
						res.end(JSON.stringify(result));
					},
				};
			},
		};
	}

	return () => createRouter<[]>([]);
}

export function createServer<Context>(options: ServerOptions<Context>) {
	const frozen = options.router.freeze();

	const server = http.createServer(async (req, res) => {
		await frozen.handle(options, req, res);
	});

	return server;
}

const createRouter = getCreateRouter(async () => ({
	time: Date.now(),
}));

class ShownError extends Error {
	public constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
	}
}

const x = createRouter()
	.get('/', async () => 2 as const)
	.post('/dsads', {
		run: async () => 'lol' as const,
	})
	.get('/testing/:test', {
		async run({params, ctx}) {
			if (Math.random() > 0.5) {
				throw new ShownError(200, 'Lol');
			}

			return `Param: ${params.test}. Time: ${ctx.time}`;
		},
	})
	.post('/users/:id', {
		async run({body}) {
			return body;
		},
	});

const y = createRouter().get('/lol', async () => 'lol');

const root = createRouter().merge('/x', x).merge('/y', y);

const server = createServer({
	router: root,
	async onError(e) {
		if (e instanceof ShownError) {
			return {
				message: e.message,
				status: e.status,
			};
		}

		return {message: e.message, status: 500};
	},
});

server.listen(8080);
