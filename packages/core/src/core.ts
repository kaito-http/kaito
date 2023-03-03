import {z} from 'zod';
import {KaitoHeaders} from './headers.ts';
import {servers} from './servers.ts';
import type {
	AnyKaitoRouteDefinition,
	KaitoGetContext,
	KaitoMethod,
	KaitoOptions,
	KaitoOutputSchemaDefinition,
	KaitoRouteCreator,
	KaitoRouteCreatorArgs,
	KaitoRouteDefinition,
	KaitoRouter,
} from './types.ts';

export class KaitoError extends Error {
	constructor(public readonly status: number, message: string) {
		super(message);
	}
}

export function isKaitoError(error: unknown): error is KaitoError {
	return error instanceof KaitoError;
}

export type InitArguments<Context, Tags extends string> =
	| [getContext?: KaitoGetContext<Context>]
	| [
			options: {
				getContext?: KaitoGetContext<Context>;
				openapi?: {
					tags?: [Tags, ...Tags[]];
				};
			}
	  ];

export function init<T = null, Tags extends string = string>(...[getContextOrOptions]: InitArguments<T, Tags>) {
	const getContext =
		typeof getContextOrOptions === 'function'
			? getContextOrOptions
			: getContextOrOptions?.getContext ?? (() => Promise.resolve<T>(null as T));

	const getRouter = <Routes extends AnyKaitoRouteDefinition<T>[]>(routes: Routes): KaitoRouter<T, Tags, Routes> => {
		const makeRouteCreator =
			<Method extends KaitoMethod>(method: Method): KaitoRouteCreator<T, Tags, Routes, Method> =>
			<
				Path extends string,
				Output extends Record<string, KaitoOutputSchemaDefinition>,
				BodyDef extends z.ZodTypeDef,
				BodyIn,
				BodyOut
			>(
				...[path, ...rest]: KaitoRouteCreatorArgs<T, Tags, Method, Path, Output, BodyDef, BodyIn, BodyOut>
			) => {
				const [schema] = rest;

				const handler = rest.length === 2 ? rest[1] : rest[0].handler;

				const definition: KaitoRouteDefinition<T, Tags, Method, Path, BodyOut, BodyDef, BodyIn, Output> = {
					method,
					path,
					schema,
					handler: handler as KaitoRouteDefinition<T, Tags, Method, Path, BodyOut, BodyDef, BodyIn, Output>['handler'],
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
		router: () => getRouter<[]>([]),
	};
}

export function server<Context, Tags extends string>(options: KaitoOptions<Context, Tags>) {
	return {
		listen: async (port: number) => {
			const serverOrName = options.server ?? servers.node;
			const resolvedServer = typeof serverOrName === 'function' ? serverOrName : servers[serverOrName];

			const instance = await resolvedServer(async request => {
				// TODO: Implement find-my-way

				return {
					body: 'alistair',
					status: 200,
					headers: new KaitoHeaders([['Content-Type', 'application/json']]),
				};
			});

			await instance.listen(port);

			return instance;
		},
	};
}
