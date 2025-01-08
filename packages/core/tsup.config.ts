import {defineConfig} from 'tsup';
import {config} from '../../tsup.config.ts';

export default defineConfig({
	...config,
	entry: [...config.entry, './src/stream/stream.ts'],
});
