import {bigrouter} from './big-router.ts';
import {router} from './router.ts';

export const biggerRouter = router().merge('/bigrouter', bigrouter);

console.log(biggerRouter.routes.size);

type g = (typeof biggerRouter)['routes'] extends Set<infer R> ? R : never;
type R = g['path'];

declare const r: R;
