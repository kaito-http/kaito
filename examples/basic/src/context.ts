/* eslint-disable arrow-body-style */
import {
	createContextProvider,
	InferContext,
	createRouter as create,
} from '@kaito-http/core';

export const getContext = createContextProvider(async (req, res) => {
	return {
		req,
		res,
		time: new Date(),
	};
});

export type AppContext = InferContext<typeof getContext>;

export function createRouter() {
	return create<AppContext>();
}
