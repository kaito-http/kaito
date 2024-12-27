/* eslint-disable arrow-body-style */

import {createUtilities} from '@kaito-http/core';
import {serialize, type SerializeOptions} from 'cookie';

const serverStarted = Date.now();

export const {getContext, router} = createUtilities(async (req, res) => {
	// Passing req is OK, but I personally prefer to avoid it.
	// Instead, the logic I would have used req for should be
	// included in this context file, allowing for it to be
	// shared between routes.

	return {
		req,

		cookie(name: string, value: string, options: SerializeOptions = {}) {
			res.headers.set('Set-Cookie', serialize(name, value, options));
		},

		uptime: Date.now() - serverStarted,
	};
});
