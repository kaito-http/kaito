import type {Route, Router} from '@kaito-http/core';
import type {KaitoSSEResponse, SSEEvent} from '@kaito-http/core/stream';

interface Ctx {}

export type App = Router<
	Ctx,
	Ctx,
	never,
	| Route<Ctx, Ctx, [], {id: number; name: string}[], '/users', never, 'GET', {limit: string}, never>
	| Route<Ctx, Ctx, [], {id: number; name: string}, '/users', never, 'POST', {}, {name: string}>
	| Route<Ctx, Ctx, [], {id: number; name: string}, '/users/:id', never, 'GET', {}, never>
	| Route<Ctx, Ctx, [], KaitoSSEResponse<SSEEvent<unknown, string>>, '/stream', never, 'GET', {}, never>,
	[]
>;
