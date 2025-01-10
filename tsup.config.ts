import {type Options} from 'tsup';

export const config = {
	entry: ['./src/index.ts'],
	format: ['esm', 'cjs'],
	dts: {
		compilerOptions: {
			composite: false,
		},
	},
} satisfies Options;
