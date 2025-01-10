import {type Options} from 'tsup';

export const config = {
	entry: ['./src/index.ts'],
	dts: {
		compilerOptions: {
			composite: false,
		},
	},
	format: ['esm', 'cjs'],
} satisfies Options;
