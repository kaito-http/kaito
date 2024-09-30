import type {z} from 'zod';
import type {ExtractRouteParams, KaitoMethod} from './util.ts';

export type RouteArgument<Path extends string, Context, QueryOutput, BodyOutput> = {
	ctx: Context;
	body: BodyOutput;
	query: QueryOutput;
	params: ExtractRouteParams<Path>;
};

export type AnyQueryDefinition = Record<string, z.ZodTypeAny>;

export type Route<
	// Router context
	ContextFrom,
	ContextTo,
	// Route information
	Result,
	Path extends string,
	Method extends KaitoMethod,
	// Query params
	Query extends AnyQueryDefinition,
	// Body
	BodyOutput,
	BodyDef extends z.ZodTypeDef,
	BodyInput,
> = {
	through: (context: ContextFrom) => Promise<ContextTo>;
	body?: z.ZodType<BodyOutput, BodyDef, BodyInput>;
	query?: Query;
	path: Path;
	method: Method;
	run(args: RouteArgument<Path, ContextTo, z.infer<z.ZodObject<Query>>, BodyOutput>): Promise<Result>;
};

// biome-ignore lint/suspicious/noExplicitAny: Allow any in this case
export type AnyRoute<FromContext = any, ToContext = any> = Route<
	FromContext,
	ToContext,
	// biome-ignore lint/suspicious/noExplicitAny: Allow any in this case
	any,
	// biome-ignore lint/suspicious/noExplicitAny: Allow any in this case
	any,
	// biome-ignore lint/suspicious/noExplicitAny: Allow any in this case
	any,
	AnyQueryDefinition,
	// biome-ignore lint/suspicious/noExplicitAny: Allow any in this case
	any,
	// biome-ignore lint/suspicious/noExplicitAny: Allow any in this case
	any,
	// biome-ignore lint/suspicious/noExplicitAny: Allow any in this case
	any
>;
