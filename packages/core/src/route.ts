/* eslint-disable @typescript-eslint/no-explicit-any */
import type {KaitoMethod} from './router/types.ts';
import type {ExtractRouteParams, InferParsable, Parsable} from './util.ts';

export type RouteArgument<Path extends string, Context, QueryOutput, BodyOutput> = {
	ctx: Context;
	body: BodyOutput;
	query: QueryOutput;
	params: ExtractRouteParams<Path>;
};

export type AnyQueryDefinition = Record<string, Parsable<any, string | undefined>>;

export type Through<From, To> = (context: From) => Promise<To>;

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
	through: Through<ContextFrom, ContextTo>;
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

export type AnyRoute<ContextFrom = any, ContextTo = any> = Route<
	ContextFrom,
	ContextTo,
	any,
	any,
	any,
	AnyQueryDefinition,
	any
>;
