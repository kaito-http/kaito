import {createGetContext, KaitoRequest, KaitoResponse, Router} from '@kaito-http/core';

const serverStarted = Date.now();

export interface AppContext {
	req: KaitoRequest;
	res: KaitoResponse;
	uptime: number;
}

export const getContext = createGetContext<AppContext>(async (req, res) => ({
	req,
	res,
	uptime: Date.now() - serverStarted,
}));

export function createRouter() {
	return Router.create<AppContext>();
}
