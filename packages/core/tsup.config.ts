import {defineConfig} from 'tsup';
import {config} from '../../tsup.config.ts';

export default defineConfig({
	...config,
	entry: [...config.entry, './src/stream/stream.ts', './src/cors/cors.ts', './src/schema/schema.ts'],
});
