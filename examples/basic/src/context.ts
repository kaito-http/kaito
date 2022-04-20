import {Router, InferContext, createGetContext} from '@kaito-http/core';

const serverStarted = Date.now();

export const getContext = createGetContext(async (req, res) => ({
	req,
	res,
	uptime: Date.now() - serverStarted,
}));

export type AppContext = InferContext<typeof getContext>;

export function createRouter() {
	return Router.create<AppContext>();
}
