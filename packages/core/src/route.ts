/* eslint-disable @typescript-eslint/no-explicit-any */
import type {ExtractRouteParams, KaitoMethod, Parsable} from './util.ts';

export type RouteArgument<Path extends string, Context, QueryOutput, BodyOutput> = {
	ctx: Context;
	body: BodyOutput;
	query: QueryOutput;
	params: ExtractRouteParams<Path>;
};

export type AnyQueryDefinition = Record<string, Parsable<any>>;
export type InferQuery<T extends AnyQueryDefinition> = {
	[Key in keyof T]: InferParsable<T[Key]>;
};
export type InferParsable<T> = T extends Parsable<infer U> ? U : never;

export type RouteRunner<Result, Path extends string, Context, QueryOutput, BodyOutput> = (
	args: RouteArgument<Path, Context, QueryOutput, BodyOutput>,
) => Promise<Result>;

export type Route<
	// Router context
	ContextFrom,
	ContextTo,
	// Route information
	Result,
	Path extends string,
	Method extends KaitoMethod,
	// Schemas
	Query extends AnyQueryDefinition,
	BodyOutput,
> = {
	through: (context: ContextFrom) => Promise<ContextTo>;
	body?: Parsable<BodyOutput>;
	query?: Query;
	path: Path;
	method: Method;
	run(arg: RouteArgument<Path, ContextTo, InferQuery<Query>, BodyOutput>): Promise<Result>;
};

export type AnyRoute<FromContext = any, ToContext = any> = Route<
	FromContext,
	ToContext,
	any,
	any,
	any,
	AnyQueryDefinition,
	any
>;
