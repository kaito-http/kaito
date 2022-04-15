/* eslint-disable @typescript-eslint/member-ordering */

import fastify, {FastifyReply, FastifyRequest} from 'fastify';
import {z, ZodTypeAny} from 'zod';

export enum Method {
	GET = 'GET',
	POST = 'POST',
	PATCH = 'PATCH',
	DELETE = 'DELETE',
}

export type GetContext<T> = (req: FastifyRequest, res: FastifyReply) => Promise<T>;

type Never = [never];

export function createGetContext<T>(getContext: GetContext<T>) {
	return getContext;
}

export type InferContext<T> = T extends GetContext<infer Value> ? Value : never;

export type ContextWithInput<Ctx, Input> = {ctx: Ctx; input: Input};
type Values<T> = T[keyof T];

type Proc<Ctx, Result, Input extends z.ZodTypeAny | Never = Never> = Readonly<{
	input?: Input;
	run(arg: ContextWithInput<Ctx, Input extends ZodTypeAny ? z.infer<Input> : undefined>): Promise<Result>;
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
		<Name extends string, Result, Input extends z.ZodTypeAny>(name: Name, proc: Proc<Ctx, Result, Input>) => {
			type Merged = Procs & Record<Name, typeof proc & {method: M; name: Name}>;

			return new Router<Ctx, Merged>({
				...this.procs,
				[name]: {...proc, method, name},
			} as Merged);
		};

	public readonly merge = <Prefix extends string, NewCtx, NewProcs extends ProcsInit<NewCtx>>(
		prefix: Prefix,
		router: Router<NewCtx, NewProcs>
	) => {
		type MergedProcs = Procs & {
			[Key in `${Prefix}${Extract<keyof NewProcs, string>}`]: Omit<
				NewProcs[Key extends `${Prefix}${infer Rest}` ? Rest : never],
				'name'
			> & {
				name: Key;
			};
		};

		const newProcs = Object.entries(router.getProcs()).reduce((all, entry) => {
			const [name, proc] = entry;

			return {
				...all,
				[`${prefix}${name}`]: {
					...proc,
					name: `${prefix}${name}`,
				},
			};
		}, {}) as MergedProcs;

		const mergedProcs = {
			...this.procs,
			...newProcs,
		};

		return new Router<NewCtx & Ctx, MergedProcs>(mergedProcs);
	};

	public readonly get = this.create(Method.GET);
	public readonly post = this.create(Method.POST);
	public readonly patch = this.create(Method.PATCH);
	public readonly delete = this.create(Method.DELETE);
}

export class KaitoError extends Error {
	constructor(public readonly code: number, message: string, public readonly cause?: Error | undefined) {
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
> = ReturnType<ReturnType<R['getProcs']>[Path]['run']> extends Promise<infer V> ? V : never;

export function createServer<Ctx, R extends Router<Ctx, ProcsInit<Ctx>>>(config: {
	getContext: GetContext<Ctx>;
	router: R;
	onError(error: {error: Error; req: FastifyRequest; res: FastifyReply}): Promise<{code: number; message: string}>;
	log?: (message: string) => unknown | false;
}) {
	const tree = config.router.getProcs();
	const app = fastify();

	app.setErrorHandler<Error>(async (error, req, res) => {
		if (error instanceof KaitoError) {
			await res.status(error.code).send({
				success: false,
				data: null,
				message: error.message,
			});

			return;
		}

		const {code, message} = await config.onError({error, req, res}).catch(() => ({
			code: 500,
			message: 'Something went wrong',
		}));

		await res.status(code).send({
			success: false,
			data: null,
			message,
		});
	});

	app.all('*', async (req, res) => {
		const logMessage = `${req.hostname} ${req.method} ${req.routerPath}`;

		if (config.log === undefined) {
			console.log(logMessage);
		} else if (config.log) {
			config.log(logMessage);
		}

		const url = new URL(`${req.protocol}://${req.hostname}${req.url}`);
		const handler = tree[url.pathname];

		if (!handler) {
			throw new KaitoError(404, `Cannot ${req.method} this route.`);
		}

		const context = await config.getContext(req, res);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const input = handler.input?.parse(req.method === 'GET' ? req.query : req.body) ?? null;

		await res.send({
			success: true, // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			data: await handler.run({ctx: context, input}),
			message: 'OK',
		});
	});

	return app;
}
