/* eslint-disable @typescript-eslint/member-ordering */

import fastify, {FastifyReply, FastifyRequest} from 'fastify';
import {z} from 'zod';

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

export type ContextWithInput<Ctx, Input> = {ctx: Ctx; input: Input};
type Values<T> = T[keyof T];

type Proc<Ctx, Result, Input extends z.ZodTypeAny> = Readonly<{
	input: Input;
	run(arg: ContextWithInput<Ctx, z.infer<Input>>): Promise<Result>;
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

	public tree() {
		const procs = Object.values(this.procs);

		const keys = Object.keys(Method) as Method[];

		return keys
			.map(method => {
				const matchingProcs = procs.filter(proc => proc.method === method);
				return {matchingProcs, method};
			})
			.reduce<{}>((all, item) => {
				const {matchingProcs, method} = item;

				return {
					...all,
					[method]: Object.fromEntries(
						matchingProcs.map(proc => [proc.name, proc] as const)
					),
				};
			}, {}) as {
			[M in Method]: {
				[ProcName in Extract<Values<Procs>, {method: M}>['name']]: Omit<
					Procs[ProcName],
					'name'
				>;
			};
		};
	}
}

export class KaitoError extends Error {
	constructor(public readonly code: number, message: string) {
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
> = ReturnType<R['getProcs']>[Path];

export function createServer<
	Ctx,
	R extends Router<Ctx, ProcsInit<Ctx>>
>(config: {getContext: GetContext<Ctx>; router: R}) {
	const tree = config.router.tree();

	const app = fastify();

	app.all('*', async (req, res) => {
		const handler = tree[req.method as Method] as
			| Proc<Ctx, unknown, z.ZodUnknown>
			| undefined;

		if (!handler) {
			await res.status(404).send({
				success: false,
				data: null,
				message: `Cannot ${req.method} this route.`,
			});

			return;
		}

		const context = await config.getContext(req, res);
		const input = handler.input.safeParse(req.body);

		if (!input.success) {
			await res.status(400).send({
				success: false,
				data: null,
				message: 'Invalid data',
			});

			return;
		}

		let result;

		try {
			result = await handler.run({ctx: context, input: input.data});
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
