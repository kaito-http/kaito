import {z} from 'zod';
import {KaitoHeaders} from './headers';

export type KaitoSendablePayload = {
	status: number;
	body: unknown;
	headers: KaitoHeaders;
};

export type KaitoServer = (resolve: (request: KaitoRequest) => Promise<KaitoSendablePayload>) => Promise<{
	listen: (port: number) => Promise<void>;
}>;

export type ExtractRouteParams<T extends string> = string extends T
	? string
	: T extends `${string}:${infer Param}/${infer Rest}`
	? Param | ExtractRouteParams<Rest>
	: T extends `${string}:${infer Param}`
	? Param
	: never;

export type KaitoResponseSerializer = (
	status: number,
	body: unknown
) => {
	body: string | Buffer | null;
	headers: KaitoHeaders;
};

export type KaitoMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'CONNECT' | 'TRACE';

export interface KaitoRequest {
	method: KaitoMethod;
	path: string;
	body: unknown;
	headers: KaitoHeaders;
}

export type KaitoHandler = (request: KaitoRequest) => Promise<{
	status: number;
	body: unknown;
}>;

export const servers = {
	node: async resolve => {
		const http = await import('node:http');

		const server = http.createServer(async (req, res) => {
			const {status, body, headers} = await resolve({
				path: req.url ?? '/',
				method: req.method as KaitoMethod,
				headers: new KaitoHeaders(Object.entries(req.headers) as Array<[string, string | string[]]>),
				body: req,
			});

			res.statusCode = status;

			for (const [key, value] of headers) {
				res.setHeader(key, value);
			}

			res.end(body);
		});

		return {
			listen: async port => {
				return new Promise(resolve => {
					server.listen(port, resolve);
				});
			},
		};
	},
} satisfies Record<string, KaitoServer>;

export interface KaitoOptions<Context> {
	getContext: KaitoGetContext<Context>;
	router: KaitoRouter<Context, AnyKaitoRouteDefinition<Context>[]>;
	server?: keyof typeof servers | KaitoServer;
}

// export type ResponseCodeIsh<Start extends number> = `${Start}${number}` extends `${infer Code extends number}`
// 	? Code | `${Code}`
// 	: never;

// export type ResponseCodeIsh<Start extends number> = `${Start}${number}`;

// export type KaitoResponseSchemaTodoNameThis = {
// 	[Success in ResponseCodeIsh<2>]?: z.ZodTypeAny;
// } & {
// 	[Error in ResponseCodeIsh<4> | ResponseCodeIsh<5>]?: string;
// };

export type KaitoRouteSchema<
	M extends KaitoMethod,
	BodyOut,
	BodyDef extends z.ZodTypeDef,
	BodyIn,
	Output extends Record<string, z.ZodTypeAny>
> = {
	description?: string;
	tags?: string[];
	response: Output;
	body?: M extends 'GET' ? never : z.Schema<BodyOut, BodyDef, BodyIn>;
};

export type KaitoRouteDefinition<
	Context,
	M extends KaitoMethod,
	Path extends string,
	BodyOut,
	BodyDef extends z.ZodTypeDef,
	BodyIn,
	Output extends Record<string, z.ZodTypeAny>
> = {
	method: M;
	path: Path;
	schema: KaitoRouteSchema<M, BodyOut, BodyDef, BodyIn, Output>;
	handler: KaitoRouteHandler<Context, Path, Body, Output>;
};

export type AnyKaitoRouteDefinition<Context> = KaitoRouteDefinition<Context, any, any, any, any, any, any>;

export class KaitoError extends Error {
	constructor(public readonly status: number, message: string) {
		super(message);
	}
}

export function isKaitoError(error: unknown): error is KaitoError {
	return error instanceof KaitoError;
}

export type KaitoReply<Output extends Record<string, z.ZodTypeAny>> = {
	<Code extends keyof Output>(code: Code, body: Output[Code]['_input']): {
		status: Code;
		body: Output[Code]['_input'];
	};
};

export type KaitoRouteCreator<
	Context,
	ExistingRoutes extends AnyKaitoRouteDefinition<Context>[],
	M extends KaitoMethod
> = <
	Path extends string,
	Output extends Record<string, z.ZodTypeAny>,
	BodyDef extends z.ZodTypeDef,
	BodyIn,
	BodyOut = undefined
>(
	path: Path,
	...args:
		| [
				spec: KaitoRouteSchema<M, BodyOut, BodyDef, BodyIn, Output>,
				handler: KaitoRouteHandler<Context, Path, BodyOut, Output>
		  ]
		| [
				handler: KaitoRouteSchema<M, BodyOut, BodyDef, BodyIn, Output> & {
					handler: KaitoRouteHandler<Context, Path, BodyOut, Output>;
				}
		  ]
) => KaitoRouter<
	Context,
	[...ExistingRoutes, KaitoRouteDefinition<Context, M, Path, BodyOut, BodyDef, BodyIn, Output>]
>;

export type OutputToUnion<Output extends Record<string, z.ZodTypeAny>> = {
	[Code in keyof Output]: {
		status: Code;
		body: Output[Code]['_input'];
	};
}[keyof Output];

export type KaitoHandlerArgument<Context, Path extends string, Body, Output extends Record<string, z.ZodTypeAny>> = {
	ctx: Context;
	params: Record<ExtractRouteParams<Path>, string>;
	body: Body;
	reply: KaitoReply<Output>;
};

export type KaitoRouteHandler<Context, Path extends string, BodyOut, Output extends Record<string, z.ZodTypeAny>> = (
	arg: KaitoHandlerArgument<Context, Path, BodyOut, Output>
) => Promise<OutputToUnion<Output>>;

export interface KaitoRouter<Context, Routes extends AnyKaitoRouteDefinition<Context>[]> {
	routes: Routes;
	get: KaitoRouteCreator<Context, Routes, 'GET'>;
	post: KaitoRouteCreator<Context, Routes, 'POST'>;
	put: KaitoRouteCreator<Context, Routes, 'PUT'>;
	patch: KaitoRouteCreator<Context, Routes, 'PATCH'>;
	delete: KaitoRouteCreator<Context, Routes, 'DELETE'>;
	head: KaitoRouteCreator<Context, Routes, 'HEAD'>;
	options: KaitoRouteCreator<Context, Routes, 'OPTIONS'>;
	connect: KaitoRouteCreator<Context, Routes, 'CONNECT'>;
	trace: KaitoRouteCreator<Context, Routes, 'TRACE'>;
}

export type KaitoGetContext<Context> = (request: KaitoRequest) => Promise<Context>;

export function init<T = null>(getContext: KaitoGetContext<T> = () => Promise.resolve(null as never)) {
	return {
		getContext,

		router: (): KaitoRouter<T, []> => {
			return {
				routes: [],
				get: (path, ...[specAndMaybeHandler, maybeHandler]) => null as any,
				post: (path, ...[specAndMaybeHandler, maybeHandler]) => null as any,
				put: (path, ...[specAndMaybeHandler, maybeHandler]) => null as any,
				patch: (path, ...[specAndMaybeHandler, maybeHandler]) => null as any,
				delete: (path, ...[specAndMaybeHandler, maybeHandler]) => null as any,
				head: (path, ...[specAndMaybeHandler, maybeHandler]) => null as any,
				options: (path, ...[specAndMaybeHandler, maybeHandler]) => null as any,
				connect: (path, ...[specAndMaybeHandler, maybeHandler]) => null as any,
				trace: (path, ...[specAndMaybeHandler, maybeHandler]) => null as any,
			};
		},
	};
}

export function server<Context>(options: KaitoOptions<Context>) {
	return {
		listen: async (port: number) => {
			const serverOrName = options.server ?? servers.node;
			const resolvedServer = typeof serverOrName === 'function' ? serverOrName : servers[serverOrName];

			const instance = await resolvedServer(async request => {
				// TODO: Implement find-my-way

				return {
					body: 'alistair',
					status: 200,
					headers: new KaitoHeaders([['content-type', 'application/json']]),
				};
			});

			await instance.listen(port);

			return instance;
		},
	};
}
