import type { Request } from '@hesprs/sync-engine-sdk';
import type RateLimiter from './rate-limiter';
import { isApiUrl } from './api';

export default function myboxMiddleware(
	request: Request,
	{ token, limiter }: { token: string; limiter: RateLimiter },
): Request {
	const Authorization = `Bearer ${token}`;
	return async (url, params) => {
		if (!isApiUrl(url)) return request(url, params);
		await limiter.acquire();
		return request(url, { ...params, headers: { ...params?.headers, Authorization } });
	};
}
