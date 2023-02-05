import {KaitoHeaders} from './headers';
import {servers} from './servers';
import type {KaitoGetContext, KaitoOptions, KaitoRouter} from './types';

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
			return {
				routes: [],
				get: (path, ...[specAndMaybeHandler, maybeHandler]) => null as any,
				post: (path, ...[specAndMaybeHandler, maybeHandler]) => null as any,
				put: (path, ...[specAndMaybeHandler, maybeHandler]) => null as any,
				patch: (path, ...[specAndMaybeHandler, maybeHandler]) => null as any,
				delete: (path, ...[specAndMaybeHandler, maybeHandler]) => null as any,
				head: (path, ...[specAndMaybeHandler, maybeHandler]) => null as any,
				options: (path, ...[specAndMaybeHandler, maybeHandler]) => null as any,
				connect: (path, ...[specAndMaybeHandler, maybeHandler]) => null as any,
				trace: (path, ...[specAndMaybeHandler, maybeHandler]) => null as any,
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
