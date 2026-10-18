import type { RequestResponse, Stat } from '@hesprs/sync-engine-sdk';

export const MYBOX_API = 'https://open-api.mybox.naver.com/v1';
export const PAGE_SIZE = 1000;

export type MyboxResource = {
	resourceId: string;
	parentId: string;
	name: string;
	type: 'file' | 'folder';
	size: number;
	modifiedAt: string;
};

export type MyboxResourceList = {
	resources?: Array<MyboxResource>;
	responseMetaData?: { nextCursor?: string };
};

type MyboxError = { code?: string; message?: string };

export function isApiUrl(url: string): boolean {
	return url.startsWith(`${MYBOX_API}/`);
}

export function parseMyboxError(response: RequestResponse): string | undefined {
	let error: MyboxError;
	try {
		error = response.json<MyboxError>();
	} catch {
		return;
	}
	if (error.code || error.message)
		return `MYBOX ${response.status} ${error.code ?? ''}: ${error.message ?? ''}`;
}

export function toUid(mtime: number, size: number): string {
	return `${mtime}~${size}`;
}

export function toStat(key: string, { type, size, modifiedAt }: MyboxResource): Stat {
	const meta = () => ({});
	if (type === 'folder') return { isDir: true, key, meta };
	const mtime = Date.parse(modifiedAt);
	return { isDir: false, key, meta, mtime, size, uid: toUid(mtime, size) };
}

const EDGE_RUN = /^(?<lead>[ .]*)(?<body>.*?)(?<trail>[ .]*)$/su;
const UNSAFE_IN_BODY =
	/%(?=[0-9a-f]{2})|[\p{Cc}\p{Extended_Pictographic}\\:*?"<>|\u{10000}-\u{10FFFF}]|\u200D|\u20E3|\uFE0E|\uFE0F/giu;
const ESCAPE_RUN = /(?:%[0-9a-f]{2})+/giu;
const encoder = new TextEncoder();

function escapeChars(chars: string): string {
	return [...encoder.encode(chars)]
		.map((byte) => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`)
		.join('');
}

export function encodeName(name: string): string {
	const { lead = '', body = '', trail = '' } = EDGE_RUN.exec(name)?.groups ?? {};
	return escapeChars(lead) + body.replaceAll(UNSAFE_IN_BODY, escapeChars) + escapeChars(trail);
}

export function decodeName(name: string): string {
	const decoded = name.replaceAll(ESCAPE_RUN, (run) => {
		try {
			return decodeURIComponent(run);
		} catch {
			return run;
		}
	});
	return (encodeName(decoded) === name ? decoded : name).normalize('NFC');
}
