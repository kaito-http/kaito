import {HTTPMethod} from 'find-my-way';
import {z} from 'zod';
import {ExtractRouteParams} from './util';

export type RouteArgument<Path extends string, Context, Input extends z.ZodSchema> = {
	ctx: Context;
	input: z.infer<Input>;
	params: ExtractRouteParams<Path>;
};

export interface Route<
	Result,
	Path extends string,
	Method extends HTTPMethod,
	Context,
	Input extends z.ZodSchema = never
> {
	input?: Input;
	method: Method;
	run(arg: RouteArgument<Path, Context, Input>): Promise<Result>;
}
