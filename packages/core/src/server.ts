/* eslint-disable @typescript-eslint/member-ordering */

import fastify, {FastifyReply, FastifyRequest} from 'fastify';
import {z, ZodTypeAny} from 'zod';

export enum Method {
	GET = 'GET',
	POST = 'POST',
	PATCH = 'PATCH',
	DELETE = 'DELETE',
}

export type GetContext<T> = (
	req: FastifyRequest,
	res: FastifyReply
) => Promise<T>;

type Never = [never];

export function createContextProvider<Ctx>(provider: GetContext<Ctx>) {
	return provider;
}

export type InferContext<T> = T extends GetContext<infer Value> ? Value : never;

export type ContextWithInput<Ctx, Input> = {ctx: Ctx; input: Input};
type Values<T> = T[keyof T];

type Proc<Ctx, Result, Input extends z.ZodTypeAny | Never = Never> = Readonly<{
	input: Input;
	run(
		arg: ContextWithInput<
			Ctx,
			Input extends ZodTypeAny ? z.infer<Input> : undefined
		>
	): Promise<Result>;
}>;

type ProcsInit<Ctx> = {
	[Key in string]: Proc<Ctx, unknown, z.ZodTypeAny> & {
		method: Method;
		name: Key;
	};
};

type AnyRouter<Ctx> = Router<Ctx, ProcsInit<Ctx>>;

export class Router<Ctx, Procs extends ProcsInit<Ctx>> {
	private readonly procs: Procs;

	constructor(procs: Procs) {
		this.procs = procs;
	}

	getProcs() {
		return this.procs;
	}

	private readonly create =
		<M extends Method>(method: M) =>
		<Name extends string, Result, Input extends z.ZodTypeAny>(
			name: Name,
			proc: Proc<Ctx, Result, Input>
		) => {
			type Merged = Procs & Record<Name, typeof proc & {method: M; name: Name}>;

			return new Router<Ctx, Merged>({
				...this.procs,
				[name]: {...proc, method, name},
			} as Merged);
		};

	public readonly get = this.create(Method.GET);
	public readonly post = this.create(Method.POST);
	public readonly patch = this.create(Method.PATCH);
	public readonly delete = this.create(Method.DELETE);

	// This method causes an type too big for TypeScript to handle, for some reason. I'd really like to figure out why tho
	// public tree() {
	// 	const procs = Object.values(this.procs);

	// 	const keys = Object.keys(Method) as Method[];

	// 	return keys
	// 		.map(method => {
	// 			const matchingProcs = procs.filter(proc => proc.method === method);
	// 			return {matchingProcs, method};
	// 		})
	// 		.reduce<{}>((all, item) => {
	// 			const {matchingProcs, method} = item;

	// 			return {
	// 				...all,
	// 				[method]: Object.fromEntries(
	// 					matchingProcs.map(proc => [proc.name, proc] as const)
	// 				),
	// 			};
	// 		}, {}) as {
	// 		[M in Method]: {
	// 			[ProcName in Extract<Values<Procs>, {method: M}>['name']]: Omit<
	// 				Procs[ProcName],
	// 				'name'
	// 			>;
	// 		};
	// 	};
	// }
}

export class KaitoError extends Error {
	constructor(
		public readonly code: number,
		message: string,
		public readonly cause?: unknown
	) {
		super(message);
	}
}

export function createRouter<Ctx>() {
	return new Router<Ctx, {}>({});
}

export type InferApiResponseType<
	R extends AnyRouter<unknown>,
	M extends Method,
	Path extends Extract<Values<ReturnType<R['getProcs']>>, {method: M}>['name']
> = ReturnType<ReturnType<R['getProcs']>[Path]['run']> extends Promise<infer V>
	? V
	: never;

export function createServer<
	Ctx,
	R extends Router<Ctx, ProcsInit<Ctx>>
>(config: {getContext: GetContext<Ctx>; router: R}) {
	const tree = config.router.getProcs();

	const app = fastify();

	app.setErrorHandler<Error>((error, req, res) => {
		if (error instanceof KaitoError) {
			res.status(error.code).send({
				success: false,
				data: null,
				message: error.message,
			});
		} else {
			console.warn(error);

			res.status(500).send({
				success: false,
				data: null,
				message: 'Something has gone wrong.',
			});
		}
	});

	app.all('*', async (req, res) => {
		console.log(req.hostname, req.method, req.routerPath);

		const url = new URL(`http://${req.hostname}${req.url}`);

		const handler = tree[url.pathname];

		if (!handler) {
			throw new KaitoError(404, `Cannot ${req.method} this route.`);
		}

		const context = await config.getContext(req, res);

		const input = handler.input.parse(
			req.method === 'GET' ? req.query : req.body
		);

		let result;

		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			result = await handler.run({ctx: context, input});
		} catch (e: unknown) {
			await res.send({
				success: false,
				data: null,
				message:
					e instanceof KaitoError ? e.message : 'Something went wrong...',
			});

			return;
		}

		await res.send({
			success: true,
			data: result,
			message: 'OK',
		});
	});

	return app;
}
