/* eslint-disable @typescript-eslint/member-ordering */

import http from 'http';
import {z, ZodTypeAny} from 'zod';
import {WrappedError} from './error';
import {KaitoRequest} from './req';
import {KaitoResponse} from './res';
import {getInput, Method} from './util';

export type GetContext<T> = (req: KaitoRequest, res: KaitoResponse) => Promise<T>;

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

	public readonly get = this.create('GET');
	public readonly post = this.create('POST');
	public readonly put = this.create('PUT');
	public readonly patch = this.create('PATCH');
	public readonly delete = this.create('DELETE');
	public readonly head = this.create('HEAD');
	public readonly options = this.create('OPTIONS');
	public readonly connect = this.create('CONNECT');
	public readonly trace = this.create('TRACE');
	public readonly acl = this.create('ACL');
	public readonly bind = this.create('BIND');
}

export class KaitoError extends Error {
	constructor(public readonly status: number, message: string, public readonly cause?: Error | undefined) {
		super(message);
	}
}

export function createRouter<Ctx>() {
	return new Router<Ctx, {}>({});
}

export type InferAPIResponseType<
	R extends AnyRouter<unknown>,
	M extends Method,
	Path extends Extract<Values<ReturnType<R['getProcs']>>, {method: M}>['name']
> = ReturnType<ReturnType<R['getProcs']>[Path]['run']> extends Promise<infer V> ? V : never;

export function createServer<Ctx, R extends Router<Ctx, ProcsInit<Ctx>>>(config: {
	getContext: GetContext<Ctx>;
	router: R;
	onError(error: {error: Error; req: KaitoRequest; res: KaitoResponse}): Promise<{status: number; message: string}>;
	log?: ((message: string) => unknown) | false;
}) {
	const log = (message: string) => {
		if (config.log === undefined) {
			console.log(message);
		} else if (config.log) {
			config.log(message);
		}
	};

	const tree = config.router.getProcs();

	const server = http.createServer(async (incomingMessage, serverResponse) => {
		const start = Date.now();

		const req = new KaitoRequest(incomingMessage);
		const res = new KaitoResponse(serverResponse);

		try {
			const handler = tree[req.url.pathname];

			if (!handler) {
				throw new KaitoError(404, `Cannot ${req.method} this route.`);
			}

			const input = handler.input?.parse((await getInput(req)) ?? undefined) as unknown;

			const context = await config.getContext(req, res);
			const data = await handler.run({ctx: context, input});

			res.json({
				success: true,
				data,
				message: 'OK',
			});
		} catch (error: unknown) {
			if (error instanceof KaitoError) {
				res.status(error.status).json({
					success: false,
					data: null,
					message: error.message,
				});

				return;
			}

			const {status, message} = await config.onError({error: WrappedError.from(error), req, res}).catch(() => ({
				status: 500,
				message: 'Something went wrong',
			}));

			res.status(status).json({
				success: false,
				data: null,
				message,
			});
		} finally {
			const finish = Date.now();
			log(`${req.method} ${req.fullURL} ${res.raw.statusCode} ${finish - start}ms`);
		}
	});

	return server;
}
