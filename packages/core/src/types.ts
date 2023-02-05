import {z} from 'zod';
import {KaitoHeaders} from '.';
import {servers} from './servers';

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

export type KaitoRouteCreatorArgs<
	Context,
	M extends KaitoMethod,
	Path extends string,
	Output extends Record<string, z.ZodTypeAny>,
	BodyDef extends z.ZodTypeDef,
	BodyIn,
	BodyOut = undefined
> =
	| [
			path: Path,
			schema: KaitoRouteSchema<M, BodyOut, BodyDef, BodyIn, Output>,
			handler: KaitoRouteHandler<Context, Path, BodyOut, Output>
	  ]
	| [
			path: Path,
			handlerAndSchema: KaitoRouteSchema<M, BodyOut, BodyDef, BodyIn, Output> & {
				handler: KaitoRouteHandler<Context, Path, BodyOut, Output>;
			}
	  ];

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
	...args: KaitoRouteCreatorArgs<Context, M, Path, Output, BodyDef, BodyIn, BodyOut>
) => KaitoRouter<
	Context,
	[...ExistingRoutes, KaitoRouteDefinition<Context, M, Path, BodyOut, BodyDef, BodyIn, Output>]
>;

export interface KaitoOptions<Context> {
	getContext: KaitoGetContext<Context>;
	router: KaitoRouter<Context, AnyKaitoRouteDefinition<Context>[]>;
	server?: keyof typeof servers | KaitoServer;
}

export type OutputToUnion<Output extends Record<string, z.ZodTypeAny>> = {
	[Code in keyof Output]: {
		status: Code;
		body: Output[Code]['_input'];
	};
}[keyof Output];

export type KaitoReply<Output extends Record<string, z.ZodTypeAny>> = {
	<Code extends keyof Output>(code: Code, body: Output[Code]['_input']): {
		status: Code;
		body: Output[Code]['_input'];
	};
};

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
