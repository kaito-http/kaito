import {create} from '../../src/index.ts';

export const router = create({
	getContext: req => ({req, foo: 1}),
});
