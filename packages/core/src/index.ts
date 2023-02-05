import {z} from 'zod';

export interface KaitoServer {
	listen: (port: number) => Promise<void>;
	attachHandler: (handler: KaitoHandler) => void;
}

export type ExtractRouteParams<T extends string> = string extends T
	? string
	: T extends `${string}:${infer Param}/${infer Rest}`
	? Param | ExtractRouteParams<Rest>
	: T extends `${string}:${infer Param}`
	? Param
	: never;

export type KaitoMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'CONNECT' | 'TRACE';

export interface KaitoRequest {
	//
}

export interface KaitoResponse {
	//
}

export type KaitoHandler = (request: KaitoRequest) => Promise<KaitoResponse>;

export const servers = {
	node: async (): Promise<KaitoServer> => {
		const http = await import('node:http');

		const server = http.createServer();

		return {
			listen: async port => {
				return new Promise(resolve => {
					server.listen(port, resolve);
				});
			},

			attachHandler: handler => {
				//
			},
		};
	},
};

export interface KaitoOptions<Context> {
	getContext: KaitoGetContext<Context>;
	router: KaitoRouter<Context, AnyKaitoRouteDefinition<Context>[]>;
	server?: KaitoServer | (() => Promise<KaitoServer> | KaitoServer);
}

export type KaitoRouteSchema<
	M extends KaitoMethod,
	BodyOut,
	BodyDef extends z.ZodTypeDef,
	BodyIn,
	Output extends Record<number, z.ZodTypeAny>
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
	Output extends Record<number, z.ZodTypeAny>
> = {
	method: M;
	path: Path;
	schema: KaitoRouteSchema<M, BodyOut, BodyDef, BodyIn, Output>;
	handler: KaitoRouteHandler<Context, M, Path, Body, Output>;
};

export type AnyKaitoRouteDefinition<Context> = KaitoRouteDefinition<
	Context,
	any,
	any,
	any,
	z.ZodTypeDef,
	any,
	Record<number, z.ZodTypeAny>
>;

export type KaitoRouteCreator<
	Context,
	ExistingRoutes extends AnyKaitoRouteDefinition<Context>[],
	M extends KaitoMethod
> = <
	Path extends string,
	Output extends Record<number, z.ZodTypeAny>,
	BodyDef extends z.ZodTypeDef,
	BodyIn,
	BodyOut = undefined
>(
	path: Path,
	spec: KaitoRouteSchema<M, BodyOut, BodyDef, BodyIn, Output>,
	handler: KaitoRouteHandler<Context, M, Path, BodyOut, Output>
) => KaitoRouter<
	Context,
	[
		...ExistingRoutes,
		Extract<KaitoRouteDefinition<Context, M, Path, BodyOut, BodyDef, BodyIn, Output>, AnyKaitoRouteDefinition<Context>>
	]
>;

export type KaitoHandlerArgument<Context, Path extends string, Body> = {
	ctx: Context;
	params: Record<ExtractRouteParams<Path>, string>;
	body: Body;
};

export type KaitoRouteHandler<
	Context,
	Method extends KaitoMethod,
	Path extends string,
	BodyOut,
	Output extends Record<number, z.ZodTypeAny>
> = (arg: KaitoHandlerArgument<Context, Path, BodyOut>) => null;

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
				get: (path, spec, handler) => null as any,
				post: (path, spec, handler) => null as any,
				put: (path, spec, handler) => null as any,
				patch: (path, spec, handler) => null as any,
				delete: (path, spec, handler) => null as any,
				head: (path, spec, handler) => null as any,
				options: (path, spec, handler) => null as any,
				connect: (path, spec, handler) => null as any,
				trace: (path, spec, handler) => null as any,
			};
		},
	};
}

export function server<Context>(options: KaitoOptions<Context>) {
	return {
		listen: async (port: number) => {
			const server = await Promise.resolve(
				options?.server === undefined
					? servers.node()
					: options.server instanceof Function
					? options.server()
					: options.server
			);

			await server.listen(port);

			return server;
		},
	};
}
