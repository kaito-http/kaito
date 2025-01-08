import {type Options} from 'tsup';

export const config = {
	entry: ['./src/index.ts'],
	dts: true,
	format: ['esm', 'cjs'],
} satisfies Options;
