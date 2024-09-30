import {createUtilities} from 'core/src/util.ts';

export const {router} = createUtilities(async (req, res) => {
	return {req, res, foo: 1};
});
