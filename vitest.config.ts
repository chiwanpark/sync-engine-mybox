import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: { tsconfigPaths: true },
	test: {
		include: ['test/**/*.test.ts'],
		server: { deps: { inline: ['@hesprs/sync-engine-sdk'] } },
		setupFiles: ['./test/mocks.ts'],
	},
});
