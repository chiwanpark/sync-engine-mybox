import { testKit } from '@hesprs/sync-engine-sdk/dev';
import { expect, test } from 'vitest';
import { MYBOX_API } from '@/mybox/api';
import myboxMiddleware from '@/mybox/middleware';
import RateLimiter from '@/mybox/rate-limiter';

const { flush, request } = testKit;

test('limits requests per window and releases them as the window slides', async () => {
	const limiter = new RateLimiter(() => 2, 60);
	const started: Array<number> = [];
	const run = async (index: number) => {
		await limiter.acquire();
		started.push(index);
	};
	const all = Promise.all([0, 1, 2, 3, 4].map(run));
	await flush();
	expect(started).toStrictEqual([0, 1]);
	await all;
	expect(started).toStrictEqual([0, 1, 2, 3, 4]);
	limiter.dispose();
});

test('picks up limit changes', async () => {
	let limit = 1;
	const limiter = new RateLimiter(() => limit, 1000);
	const started: Array<number> = [];
	void limiter.acquire().then(() => started.push(0));
	void limiter.acquire().then(() => started.push(1));
	await flush();
	expect(started).toStrictEqual([0]);
	limit = 2;
	void limiter.acquire().then(() => started.push(2));
	await flush();
	expect(started).toStrictEqual([0, 1]);
	limiter.dispose();
	await flush();
	expect(started).toStrictEqual([0, 1, 2]);
});

test('authorizes and limits only MYBOX API requests', async () => {
	const limiter = new RateLimiter(() => 1, 60_000);
	const harness = request(() => ({ status: 200 }));
	const wrapped = myboxMiddleware(harness.request, { limiter, token: 'pat' });
	await wrapped(`${MYBOX_API}/drive/storage`, { method: 'GET' });
	await wrapped('https://open-api-fs.mybox.naver.com/v1/storage/download?atoken=x');
	const pending = wrapped(`${MYBOX_API}/drive/resources`);
	await flush();
	expect(harness.calls).toHaveLength(2);
	expect(harness.calls[0]?.headers).toStrictEqual({ Authorization: 'Bearer pat' });
	expect(harness.calls[1]?.headers).toBeUndefined();
	limiter.dispose();
	await pending;
	expect(harness.calls).toHaveLength(3);
});
