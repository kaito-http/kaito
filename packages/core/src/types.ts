import {z} from 'zod';
import {KaitoHeaders} from './headers.ts';
import {servers} from './servers.ts';

export type KaitoSendablePayload = {
	status: number;
	body: unknown;
	headers: KaitoHeaders;
};

export type KaitoServer = (resolve: (request: KaitoRequest) => Promise<KaitoSendablePayload>) => Promise<{
	listen: (port: number) => Promise<void>;
}>;

export type KaitoOutputSchemaDefinition = z.ZodTypeAny | undefined;

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
	Tags extends string,
	M extends KaitoMethod,
	BodyOut,
	BodyDef extends z.ZodTypeDef,
	BodyIn,
	Output extends Record<number, KaitoOutputSchemaDefinition>
> = {
	description?: string;
	tags?: Tags[];
	response: Output;
	body?: M extends 'GET' ? never : z.Schema<BodyOut, BodyDef, BodyIn>;
};

export type KaitoRouteDefinition<
	Context,
	Tags extends string,
	M extends KaitoMethod,
	Path extends string,
	BodyOut,
	BodyDef extends z.ZodTypeDef,
	BodyIn,
	Output extends Record<string, KaitoOutputSchemaDefinition>
> = {
	method: M;
	path: Path;
	schema: KaitoRouteSchema<Tags, M, BodyOut, BodyDef, BodyIn, Output>;
	handler: KaitoRouteHandler<Context, Path, Body, Output>;
};

export type AnyKaitoRouteDefinition<Context> = KaitoRouteDefinition<Context, string, any, any, any, any, any, any>;

export type KaitoRouteCreatorArgs<
	Context,
	Tags extends string,
	M extends KaitoMethod,
	Path extends string,
	Output extends Record<string, KaitoOutputSchemaDefinition>,
	BodyDef extends z.ZodTypeDef,
	BodyIn,
	BodyOut = undefined
> =
	| [
			path: Path,
			schema: KaitoRouteSchema<Tags, M, BodyOut, BodyDef, BodyIn, Output>,
			handler: KaitoRouteHandler<Context, Path, BodyOut, Output>
	  ]
	| [
			path: Path,
			handlerAndSchema: KaitoRouteSchema<Tags, M, BodyOut, BodyDef, BodyIn, Output> & {
				handler: KaitoRouteHandler<Context, Path, BodyOut, Output>;
			}
	  ];

export type KaitoRouteCreator<
	Context,
	Tags extends string,
	ExistingRoutes extends AnyKaitoRouteDefinition<Context>[],
	M extends KaitoMethod
> = <
	Path extends string,
	Output extends Record<string, KaitoOutputSchemaDefinition>,
	BodyDef extends z.ZodTypeDef,
	BodyIn,
	BodyOut = undefined
>(
	...args: KaitoRouteCreatorArgs<Context, Tags, M, Path, Output, BodyDef, BodyIn, BodyOut>
) => KaitoRouter<
	Context,
	Tags,
	[...ExistingRoutes, KaitoRouteDefinition<Context, Tags, M, Path, BodyOut, BodyDef, BodyIn, Output>]
>;

export interface KaitoOptions<Context, Tags extends string> {
	getContext: KaitoGetContext<Context>;
	router: KaitoRouter<Context, Tags, AnyKaitoRouteDefinition<Context>[]>;
	server?: keyof typeof servers | KaitoServer;
}

export type OutputToUnion<Output extends Record<string, KaitoOutputSchemaDefinition>> = {
	[Code in keyof Output]: {
		status: Code;
		body: NonNullable<Output[Code]>['_input'];
	};
}[keyof Output];

export type IfNever<T, A> = [T] extends [never] ? A : T;

export type KaitoReply<Output extends Record<string, KaitoOutputSchemaDefinition>> = {
	<Code extends keyof Output>(code: Code, body: IfNever<NonNullable<Output[Code]>['_input'], undefined>): {
		status: Code;
		body: NonNullable<Output[Code]>['_input'];
	};
};

export type KaitoHandlerArgument<
	Context,
	Path extends string,
	Body,
	Output extends Record<string, KaitoOutputSchemaDefinition>
> = {
	ctx: Context;
	params: Record<ExtractRouteParams<Path>, string>;
	body: Body;
	reply: KaitoReply<Output>;
};

export type KaitoRouteHandler<
	Context,
	Path extends string,
	BodyOut,
	Output extends Record<string, KaitoOutputSchemaDefinition>
> = (arg: KaitoHandlerArgument<Context, Path, BodyOut, Output>) => Promise<OutputToUnion<Output>>;

export interface KaitoRouter<Context, Tags extends string, Routes extends AnyKaitoRouteDefinition<Context>[]> {
	routes: Routes;
	get: KaitoRouteCreator<Context, Tags, Routes, 'GET'>;
	post: KaitoRouteCreator<Context, Tags, Routes, 'POST'>;
	put: KaitoRouteCreator<Context, Tags, Routes, 'PUT'>;
	patch: KaitoRouteCreator<Context, Tags, Routes, 'PATCH'>;
	delete: KaitoRouteCreator<Context, Tags, Routes, 'DELETE'>;
	head: KaitoRouteCreator<Context, Tags, Routes, 'HEAD'>;
	options: KaitoRouteCreator<Context, Tags, Routes, 'OPTIONS'>;
	connect: KaitoRouteCreator<Context, Tags, Routes, 'CONNECT'>;
	trace: KaitoRouteCreator<Context, Tags, Routes, 'TRACE'>;
}

export type KaitoGetContext<Context> = (request: KaitoRequest) => Promise<Context>;
