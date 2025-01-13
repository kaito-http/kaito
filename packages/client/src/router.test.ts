import type {Route, Router} from '@kaito-http/core';
import type {KaitoSSEResponse, SSEEvent} from '@kaito-http/core/stream';
import type {z} from 'zod';

interface Ctx {}

export type App = Router<
	Ctx,
	Ctx,
	| Route<
			Ctx,
			Ctx,
			{
				id: number;
				name: string;
			}[],
			'/users',
			'GET',
			{
				limit: z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>;
			},
			never
	  >
	| Route<
			Ctx,
			Ctx,
			{
				id: number;
				name: string;
			},
			'/users',
			'POST',
			{},
			z.ZodObject<
				{
					name: z.ZodString;
				},
				'strip',
				z.ZodTypeAny,
				{
					name: string;
				},
				{
					name: string;
				}
			>
	  >
	| Route<
			Ctx,
			Ctx,
			{
				id: number;
				name: string;
			},
			'/users/:id',
			'GET',
			{},
			never
	  >
	| Route<Ctx, Ctx, KaitoSSEResponse<SSEEvent<unknown, string>>, '/stream', 'GET', {}, never>
>;
