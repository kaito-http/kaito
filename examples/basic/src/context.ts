/* eslint-disable arrow-body-style */

import {createUtilities} from '@kaito-http/core';

const serverStarted = Date.now();

export const {getContext, router} = createUtilities(async req => {
	// Just an example...

	// Where possible, I find it nice to avoid
	// using res inside of context. Providing direct access
	// to res in any route allows for developers to
	// accidentally write code that bypasses the router
	// and writes directly to the response.

	// Passing req is OK, but I personally prefer to avoid it.
	// Instead, the logic I would have used req for should be
	// included in this context file, allowing for it to be
	// shared between routes.

	return {
		req,
		uptime: Date.now() - serverStarted,
	};
});
