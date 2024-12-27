import {type Options} from 'tsup';

export const config: Options = {
	entry: ['./src/index.ts'],
	dts: true,
	format: ['esm', 'cjs'],
};
