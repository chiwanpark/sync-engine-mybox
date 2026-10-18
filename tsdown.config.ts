import syncEngineModule from '@hesprs/sync-engine-sdk/tsdown-plugin';
import { defineConfig } from 'tsdown';
import meta from './module.ts';

export default defineConfig({
	clean: process.env.MODE !== 'dev',
	dts: false,
	entry: { [meta.id]: 'src/index.ts' },
	minify: true,
	outExtensions: () => ({ js: '.js' }),
	outputOptions: { codeSplitting: false },
	plugins: [syncEngineModule(meta)],
});
