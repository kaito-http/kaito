import type {z} from 'zod';
import type {ExtractRouteParams, KaitoMethod} from './util';

export type RouteArgument<Path extends string, Context, QueryOutput, BodyOutput> = {
	ctx: Context;
	body: BodyOutput;
	query: QueryOutput;
	params: ExtractRouteParams<Path>;
};

export type AnyQueryDefinition = Record<string, z.ZodTypeAny>;

export type Route<
	// Router context
	Context,
	// Route information
	Result,
	Path extends string,
	Method extends KaitoMethod,
	// Query params
	Query extends AnyQueryDefinition,
	// Body
	BodyOutput,
	BodyDef extends z.ZodTypeDef,
	BodyInput
> = {
	body?: z.ZodType<BodyOutput, BodyDef, BodyInput>;
	query?: Query;
	path: Path;
	method: Method;
	run(args: RouteArgument<Path, Context, z.infer<z.ZodObject<Query>>, BodyOutput>): Promise<Result>;
};

// This must be any here, because we can't use the generic type in the type definition
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRoute<Context = any> = Route<Context, any, any, any, AnyQueryDefinition, any, any, any>;
