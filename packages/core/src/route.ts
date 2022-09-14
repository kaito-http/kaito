import {z} from 'zod';
import {ExtractRouteParams, KaitoMethod} from './util';

export type RouteArgument<Path extends string, Context, InputOutput> = {
	ctx: Context;
	input: InputOutput;
	params: ExtractRouteParams<Path>;
};

export type Route<
	Context,
	Result,
	Path extends string,
	Method extends KaitoMethod,
	InputOutput = never,
	InputDef extends z.ZodTypeDef = z.ZodTypeDef,
	InputInput = InputOutput
> = {
	input?: z.ZodType<InputOutput, InputDef, InputInput>;
	path: Path;
	method: Method;
	run(args: RouteArgument<Path, Context, InputOutput>): Promise<Result>;
};

export type AnyRoute<Context = any> = Route<Context, any, any, any, any, z.ZodTypeDef, any>;
