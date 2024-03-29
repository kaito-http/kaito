import findMyWay from 'find-my-way';
import {IncomingMessage, ServerResponse, createServer} from 'node:http';

export class KaitoError extends Error {
	public constructor(
		public readonly status: number,
		public readonly message: string,
	) {
		super(message);
	}
}

export type RunFn<Result, Context, Errors> = (arg: {ctx: Context}) => Promise<Result | Errors>;

export type RunObject<Result, Context, Errors> = {
	fn: RunFn<Result, Context, Errors>;
};

export type RunFunctionOrDefinition<Result, Context, Errors> =
	| RunFn<Result, Context, Errors>
	| RunObject<Result, Context, Errors>;

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export class KaitoRequest {
	public readonly method: HTTPMethod;
	public readonly path: string;

	public constructor(request: IncomingMessage) {
		if (!request.method) {
			throw new Error('Request method is missing');
		}

		this.method = request.method as HTTPMethod;
		this.path = request.url ?? '/';
	}
}

export class KaitoResponse {
	//
}

export type RouteDefinition<Result, Context, Errors, M extends HTTPMethod, Path extends string> = {
	path: Path;
	method: M;
	run: RunObject<Result, Context, Errors>;
};

export type AnyRouteDefinition = RouteDefinition<any, any, any, HTTPMethod, string>;

export function getCreateRouter<Context>(getContext: (req: KaitoRequest, res: KaitoResponse) => Promise<Context>) {
	function getRouter<Routes extends readonly AnyRouteDefinition[]>(routes: Routes) {
		const method =
			<M extends HTTPMethod>(method: M) =>
			<Result, Errors, Path extends string>(path: Path, run: RunFunctionOrDefinition<Result, Context, Errors>) => {
				const next: RouteDefinition<Result, Context, Errors, M, Path> = {
					path,
					method,
					run: run instanceof Function ? {fn: run} : run,
				};

				return getRouter<[...Routes, RouteDefinition<Result, Context, Errors, M, Path>]>([...routes, next]);
			};

		return {
			get: method('GET'),
			post: method('POST'),
			put: method('PUT'),
			delete: method('DELETE'),
			patch: method('PATCH'),
			routes,

			/**
			 * Freezes the router and converts it into something that can be used to handle requests.
			 * Internally this creates a find-my-way instance and registers all the routes.
			 */
			freeze() {
				const fmw = findMyWay({
					defaultRoute: (req, res) => {
						res.statusCode = 404;
						res.end('Not found');
					},
				});

				for (const route of routes) {
					fmw.on(route.method, route.path, async (req, res) => {
						const ctx = await getContext(new KaitoRequest(req), new KaitoResponse());

						const result = (await route.run.fn({
							ctx,
						})) as unknown;

						res.setHeader('Content-Type', 'application/json');
						res.end(JSON.stringify(result));

						return result;
					});
				}

				return async (req: IncomingMessage, res: ServerResponse) => {
					const result = await fmw.lookup(req, res);

					console.log({result});
				};
			},
		};
	}

	const result = () => getRouter<[]>([]);

	return result;
}

const createRouter = getCreateRouter(async () => Promise.resolve({}));

const x = createRouter()
	.get('/', {
		fn: async () => 2 as const,
	})
	.get('/dsads', async () => 'lol' as const)
	.post('/testing', {
		//
	});

const r = x.freeze();

const server = createServer(async (req, res) => {
	await r(req, res);
});

server.listen(8080);
