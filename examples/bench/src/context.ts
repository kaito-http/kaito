/* eslint-disable arrow-body-style */

import {createUtilities} from '@kaito-http/core';
import {getSocket} from '@kaito-http/llhttp-wasm';

export const {getContext, router} = createUtilities(async req => ({
	req,
	ip: getSocket().remoteAddress,
}));
