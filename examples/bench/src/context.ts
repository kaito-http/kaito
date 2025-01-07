import {createUtilities} from '@kaito-http/core';

const start = performance.now();

export const {getContext, router} = createUtilities(async req => {
	return {
		req,
		uptime: performance.now() - start,
	};
});
