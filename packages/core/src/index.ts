import {parse as parseContentType} from 'content-type';
import findMyWay from 'find-my-way';
import type {IncomingMessage, ServerResponse} from 'node:http';
import * as http from 'node:http';
import {Readable} from 'node:stream';
import {json} from 'node:stream/consumers';

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

export type RunFn<Result, Context, Path extends string, Body> = (arg: {
	ctx: Context;
	params: {
		[Key in ExtractRouteParams<Path>]: string;
	};
	body: [Body] extends [never] ? undefined : Body;
}) => Promise<Result>;

export type RunObject<Result, Context, Path extends string, Body> = {
	run: RunFn<Result, Context, Path, Body>;
	body?: Parsable<Body>;
};

export type RunFunctionOrDefinition<Result, Context, Path extends string, Body> =
	| RunFn<Result, Context, Path, Body>
	| RunObject<Result, Context, Path, Body>;

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export class KaitoRequest {
	public static async getBody(req: IncomingMessage) {
		if (!req.headers['content-type']) {
			return null;
		}

		const {type} = parseContentType(req.headers['content-type']);

		switch (type) {
			case 'application/json': {
				return json(Readable.from(req));
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
	xPoweredBy?: string | null;
	router: Router<Context, readonly AnyRouteDefinition[]>;
	onError: (error: Error) => Promise<{
		message: string;
		status: number;
	}>;
};

export type RouteDefinition<Result, Context, M extends HTTPMethod, Path extends string, Body> = {
	path: Path;
	method: M;
	run: RunObject<Result, Context, Path, Body>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRouteDefinition = RouteDefinition<any, any, HTTPMethod, any, any>;

export type RouterMethodFunction<Context, Routes extends readonly AnyRouteDefinition[], M extends HTTPMethod> = <
	Result,
	Path extends string,
	Body = undefined,
>(
	path: Path,
	run: RunFunctionOrDefinition<Result, Context, Path, Body>,
) => Router<Context, readonly [...Routes, RouteDefinition<Result, Context, M, Path, Body>]>;

export type AppendPrefixToRoutes<Prefix extends `/${string}`, Routes extends readonly AnyRouteDefinition[]> = {
	[Key in keyof Routes]: Routes[Key] extends RouteDefinition<
		infer Result,
		infer Context,
		infer Method,
		infer Path,
		infer Body
	>
		? RouteDefinition<Result, Context, Method, `${Prefix}${Path}`, Body>
		: never;
};

export type Router<Context, Routes extends readonly AnyRouteDefinition[]> = {
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

	merge: <Prefix extends `/${string}`, NextRoutes extends readonly AnyRouteDefinition[]>(
		prefix: Prefix,
		other: Router<Context, NextRoutes>,
	) => Router<Context, readonly [...Routes, ...AppendPrefixToRoutes<Prefix, NextRoutes>]>;
};

export class KaitoNotFoundError extends Error {
	public constructor() {
		super('Not found');
	}
}

export type APIResponse<T> =
	| {success: true; status: number; data: T}
	| {success: false; status: number; message: string};

export function getCreateRouter<Context>(getContext: (req: KaitoRequest, res: KaitoResponse) => Promise<Context>) {
	function createRouter<Routes extends readonly AnyRouteDefinition[]>(routes: Routes): Router<Context, Routes> {
		const method =
			<M extends HTTPMethod>(method: M): RouterMethodFunction<Context, Routes, M> =>
			(path, run) =>
				createRouter([...routes, {path, method, run: run instanceof Function ? {run} : run}]);

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
						throw new KaitoNotFoundError();
					},
				});

				for (const route of routes) {
					fmw.on(route.method, route.path as string, async (req, res, params) => {
						const ctx = await getContext(new KaitoRequest(req), new KaitoResponse(res));
						const body = await KaitoRequest.getBody(req);

						return (await route.run.run({
							ctx,
							params,
							body: (route.run.body?.parse(body) ?? undefined) as unknown,
						})) as unknown;
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
						if (e instanceof KaitoNotFoundError) {
							return {
								success: false,
								status: 404,
								message: 'Not found',
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
