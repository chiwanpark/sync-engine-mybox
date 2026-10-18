import type { Request } from '@hesprs/sync-engine-sdk';
import { toError } from '@/shared/error';
import { MYBOX_API, parseMyboxError } from './api';

export default async function checkConnection(request: Request): Promise<void | Error> {
	try {
		const response = await request(`${MYBOX_API}/drive/storage`, {
			method: 'GET',
			throw: false,
		});
		if (response.status >= 200 && response.status < 300) return;
		return new Error(parseMyboxError(response) ?? `HTTP ${response.status}`);
	} catch (error) {
		return toError(error);
	}
}
