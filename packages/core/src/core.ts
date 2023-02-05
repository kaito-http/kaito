import {KaitoHeaders} from './headers';
import {servers} from './servers';
import type {KaitoGetContext, KaitoMethod, KaitoOptions, KaitoRouteCreator, KaitoRouter} from './types';

export class KaitoError extends Error {
	constructor(public readonly status: number, message: string) {
		super(message);
	}
}

export function isKaitoError(error: unknown): error is KaitoError {
	return error instanceof KaitoError;
}

export function init<T = null>(getContext: KaitoGetContext<T> = () => Promise.resolve(null as never)) {
	return {
		getContext,

		router: (): KaitoRouter<T, []> => {
			const makeRouteCreator = <Method extends KaitoMethod>(method: Method): KaitoRouteCreator<T, [], Method> => {
				return (path, ...[specAndMaybeHandler, maybeHandler]) => {
					return null as any;
				};
			};

			return {
				routes: [],
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
		},
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
