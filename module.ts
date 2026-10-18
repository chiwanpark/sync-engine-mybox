import pkg from './package.json' with { type: 'json' };

const pagesUrl = 'https://chiwanpark.github.io/sync-engine-mybox';

const meta = {
	description: '[Alpha] NAVER MYBOX backend support.',
	icon: 'server',
	id: 'mybox',
	main: `${pagesUrl}/mybox.js`,
	minPluginVersion: '3.3.0',
	name: 'NAVER MYBOX',
	readme: 'https://github.com/chiwanpark/sync-engine-mybox#readme',
	source: `${pagesUrl}/modules.json`,
	version: pkg.version,
};

export default meta;
