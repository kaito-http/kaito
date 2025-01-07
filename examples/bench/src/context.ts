/* eslint-disable arrow-body-style */

import {createUtilities} from '@kaito-http/core';

export const {getContext, router} = createUtilities(async req => ({
	req,
}));
