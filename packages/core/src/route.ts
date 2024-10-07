/* eslint-disable @typescript-eslint/no-explicit-any */
import type {ExtractRouteParams, InferParsable, KaitoMethod, Parsable} from './util.ts';

export type RouteArgument<Path extends string, Context, QueryOutput, BodyOutput> = {
	ctx: Context;
	body: BodyOutput;
	query: QueryOutput;
	params: ExtractRouteParams<Path>;
};

export type AnyQueryDefinition = Record<string, Parsable<any, string | undefined>>;

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
	Body extends Parsable,
> = {
	through: (context: ContextFrom) => Promise<ContextTo>;
	body?: Body;
	query?: Query;
	path: Path;
	method: Method;
	run(
		arg: RouteArgument<
			Path,
			ContextTo,
			{
				[Key in keyof Query]: InferParsable<Query[Key]>['output'];
			},
			InferParsable<Body>['output']
		>,
	): Promise<Result>;
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
