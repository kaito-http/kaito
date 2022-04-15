import {createGetContext, InferContext, createRouter as create} from '@kaito-http/core';

export const getContext = createGetContext(async (req, res) => ({req, res, time: new Date()}));

export type AppContext = InferContext<typeof getContext>;

export function createRouter() {
	return create<AppContext>();
}
