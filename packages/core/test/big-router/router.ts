import {createUtilities} from '../../src/index.ts';

export const {router} = createUtilities(async req => {
	return {req, foo: 1};
});
