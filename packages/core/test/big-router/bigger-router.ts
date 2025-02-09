import {bigrouter} from './big-router.ts';
import {router} from './router.ts';

export const biggerRouter = router.merge('/bigrouter', bigrouter)
	.merge('/bigrouter2', bigrouter)
	.merge('/bigrouter3', bigrouter)
	.merge('/bigrouter4', bigrouter)
	.merge('/bigrouter5', bigrouter)
	.merge('/bigrouter6', bigrouter)
	.merge('/bigrouter7', bigrouter)
	.merge('/bigrouter8', bigrouter)
	.merge('/bigrouter9', bigrouter)
	.merge('/bigrouter10', bigrouter);

console.log(biggerRouter.routes.size);

type g = (typeof biggerRouter)['routes'] extends Set<infer R> ? R : never;
type R = g['path'];

declare const r: R;
