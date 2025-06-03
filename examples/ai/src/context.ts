import {createUtilities} from '@kaito-http/core';

const serverStarted = Date.now();

export const {getContext, router} = createUtilities(async (req, _res) => {
	// Passing req is OK, but I personally prefer to avoid it.
	// Instead, the logic I would have used req for should be
	// included in this context file, allowing for it to be
	// shared between routes.

	return {
		req,
		uptime: Date.now() - serverStarted,
	};
});
