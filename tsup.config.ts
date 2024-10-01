import {defineConfig} from 'tsup';

export const config = defineConfig({
	entry: ['./src/index.ts'],
	dts: true,
	format: 'esm',
});
