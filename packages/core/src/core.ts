import {z} from 'zod';
import {KaitoHeaders} from './headers';
import {servers} from './servers';
import type {
	AnyKaitoRouteDefinition,
	KaitoGetContext,
	KaitoMethod,
	KaitoOptions,
	KaitoRouteCreator,
	KaitoRouteCreatorArgs,
	KaitoRouteDefinition,
	KaitoRouter,
} from './types';

export class KaitoError extends Error {
	constructor(public readonly status: number, message: string) {
		super(message);
	}
}

export function isKaitoError(error: unknown): error is KaitoError {
	return error instanceof KaitoError;
}

export function init<T = null>(getContext: KaitoGetContext<T> = () => Promise.resolve(null as never)) {
	const getRouter = <Routes extends AnyKaitoRouteDefinition<T>[]>(routes: Routes): KaitoRouter<T, Routes> => {
		const makeRouteCreator =
			<Method extends KaitoMethod>(method: Method): KaitoRouteCreator<T, Routes, Method> =>
			<Path extends string, Output extends Record<string, z.ZodTypeAny>, BodyDef extends z.ZodTypeDef, BodyIn, BodyOut>(
				...[path, ...rest]: KaitoRouteCreatorArgs<T, Method, Path, Output, BodyDef, BodyIn, BodyOut>
			) => {
				const [schema] = rest;

				const handler = rest.length === 2 ? rest[1] : rest[0].handler;

				const definition: KaitoRouteDefinition<T, Method, Path, BodyOut, BodyDef, BodyIn, Output> = {
					method,
					path,
					schema,
					handler: handler as KaitoRouteDefinition<T, Method, Path, BodyOut, BodyDef, BodyIn, Output>['handler'],
				};

				return getRouter([...routes, definition]);
			};

		return {
			routes,
			get: makeRouteCreator('GET'),
			post: makeRouteCreator('POST'),
			put: makeRouteCreator('PUT'),
			patch: makeRouteCreator('PATCH'),
			delete: makeRouteCreator('DELETE'),
			head: makeRouteCreator('HEAD'),
			options: makeRouteCreator('OPTIONS'),
			connect: makeRouteCreator('CONNECT'),
			trace: makeRouteCreator('TRACE'),
		};
	};

	return {
		getContext,
		router: () => getRouter([]),
	};
}

export function server<Context>(options: KaitoOptions<Context>) {
	return {
		listen: async (port: number) => {
			const serverOrName = options.server ?? servers.node;
			const resolvedServer = typeof serverOrName === 'function' ? serverOrName : servers[serverOrName];

			const instance = await resolvedServer(async request => {
				// TODO: Implement find-my-way

				return {
					body: 'alistair',
					status: 200,
					headers: new KaitoHeaders([['content-type', 'application/json']]),
				};
			});

			await instance.listen(port);

			return instance;
		},
	};
}
