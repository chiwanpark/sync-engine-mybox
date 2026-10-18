import syncEngineModule from '@hesprs/sync-engine-sdk/tsdown-plugin';
import { defineConfig } from 'tsdown';

export default defineConfig({
	clean: process.env.MODE !== 'dev',
	dts: false,
	entry: { mybox: 'src/index.ts' },
	minify: true,
	outExtensions: () => ({ js: '.js' }),
	outputOptions: { codeSplitting: false },
	plugins: [
		syncEngineModule({
			description: '[Alpha] NAVER MYBOX backend support.',
			icon: 'server',
			name: 'NAVER MYBOX',
			readme: 'https://github.com/chiwanpark/sync-engine-mybox#readme',
			source: 'https://github.com/chiwanpark/sync-engine-mybox/releases/latest/download/modules.json',
			version: '0.0.1',
		}),
	],
});
