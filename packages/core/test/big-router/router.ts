import {createUtilities} from '../../src/index.ts';

export const {router} = createUtilities(async (req, res) => {
	return {req, res, foo: 1};
});
