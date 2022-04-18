/* eslint-disable @typescript-eslint/member-ordering */

import http from 'http';
import {z, ZodTypeAny} from 'zod';
import {WrappedError} from './error';
import {KaitoRequest} from './req';
import {KaitoResponse} from './res';
import {getInput, Method, NormalizePath, normalizePath} from './util';

export type GetContext<T> = (req: KaitoRequest, res: KaitoResponse) => Promise<T>;

type Never = [never];

export function createGetContext<T>(getContext: GetContext<T>) {
	return getContext;
}

export type InferContext<T> = T extends GetContext<infer Value> ? Value : never;

export type ContextWithInput<Ctx, Input> = {ctx: Ctx; input: Input};
type Values<T> = T[keyof T];

export type Proc<Ctx, Result, Input extends z.ZodTypeAny | Never = Never> = {
	input?: Input;
	run(arg: ContextWithInput<Ctx, Input extends ZodTypeAny ? z.infer<Input> : undefined>): Promise<Result>;
};

export interface RouterProc<Path extends string, M extends Method> {
	method: M;
	path: Path;
	pattern: RegExp;
}

export type AnyProcs<Ctx> = {
	[Path in string]: Proc<Ctx, unknown, z.ZodTypeAny> & RouterProc<Path, Method>;
};

export type AnyRouter<Ctx> = Router<Ctx, AnyProcs<Ctx>>;

export class Router<Ctx, Procs extends AnyProcs<Ctx>> {
	private readonly procs;
	private readonly _procsArray;

	private static patternize(path: string) {
		const normalized = normalizePath(path);
		return new RegExp(`^${normalized}/?$`, 'i');
	}

	constructor(procs: Procs) {
		this.procs = procs;
		this._procsArray = Object.values(procs);
	}

	getProcs() {
		return this.procs;
	}

	find(method: Method, url: string) {
		for (const proc of this._procsArray) {
			if (proc.method !== method) {
				continue;
			}

			if (proc.pattern.test(url)) {
				return proc;
			}
		}

		return null;
	}

	private readonly create =
		<M extends Method>(method: M) =>
		<Path extends string, Result, Input extends z.ZodTypeAny>(
			path: NormalizePath<Path>,
			proc: Proc<Ctx, Result, Input>
		) => {
			type Merged = Procs & Record<NormalizePath<Path>, typeof proc & RouterProc<NormalizePath<Path>, M>>;

			const pattern = Router.patternize(path);

			const merged = {
				...this.procs,
				[path]: {
					...proc,
					method,
					path,
					pattern,
				},
			};

			return new Router<Ctx, Merged>(merged);
		};

	public readonly merge = <Prefix extends string, NewCtx, NewProcs extends AnyProcs<NewCtx>>(
		_prefix: NormalizePath<Prefix>,
		router: Router<NewCtx, NewProcs>
	) => {
		const prefix = normalizePath(_prefix);

		type MergedProcs = Procs & {
			[P in keyof NewProcs as `/${Prefix}${Extract<keyof NewProcs, string>}`]: Omit<NewProcs[P], 'path'> & {
				path: P;
			};
		};

		const newProcs = Object.entries(router.getProcs()).reduce((all, entry) => {
			const [path, proc] = entry;
			const newPath = `${prefix}${normalizePath(path)}`;

			return {
				...all,
				[`${prefix}${path}`]: {
					...proc,
					path: newPath,
					pattern: Router.patternize(newPath),
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
	Path extends Extract<Values<ReturnType<R['getProcs']>>, {method: M}>['path']
> = ReturnType<ReturnType<R['getProcs']>[Path]['run']> extends Promise<infer V> ? V : never;

export function createServer<Ctx, R extends Router<Ctx, AnyProcs<Ctx>>>(config: {
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

	return http.createServer(async (incomingMessage, serverResponse) => {
		const start = Date.now();

		const req = new KaitoRequest(incomingMessage);
		const res = new KaitoResponse(serverResponse);

		try {
			const handler = config.router.find(req.method, req.url.pathname);

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

			const {status, message} = await config.onError({error: WrappedError.maybe(error), req, res}).catch(() => ({
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
}
