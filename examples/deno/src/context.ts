import {createUtilities, KaitoRequest} from '@kaito-http/core';

const start = performance.now();

export interface AppContext {
	req: KaitoRequest;
	uptime: number;
}

export const {getContext, router} = createUtilities<AppContext>(async req => {
	return {
		req,
		uptime: performance.now() - start,
	};
});
