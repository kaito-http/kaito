import type {Route, Router} from '@kaito-http/core';
import type {KaitoSSEResponse, SSEEvent} from '@kaito-http/core/stream';

interface Ctx {}

export type App = Router<
	Ctx,
	Ctx,
	{},
	| Route<Ctx, {id: number; name: string}[], '/users', {}, 'GET', {limit: string}, never>
	| Route<Ctx, {id: number; name: string}, '/users', {}, 'POST', {}, {name: string}>
	| Route<Ctx, {id: number; name: string}, '/users/:id', {}, 'GET', {}, never>
	| Route<Ctx, KaitoSSEResponse<SSEEvent<unknown, string>>, '/stream', {}, 'GET', {}, never>
>;
