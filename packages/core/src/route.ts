import {z} from 'zod';
import {ExtractRouteParams, KaitoMethod} from './util';

export type RouteArgument<Path extends string, Context, Input extends z.ZodSchema> = {
	ctx: Context;
	input: z.infer<Input>;
	params: ExtractRouteParams<Path>;
};

export type Route<Context, Result, Path extends string, Method extends KaitoMethod, Input extends z.ZodSchema> = {
	input?: Input;
	path: Path;
	method: Method;
	run(args: RouteArgument<Path, Context, Input>): Promise<Result>;
};
