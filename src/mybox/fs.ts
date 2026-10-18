import type {
	Binary,
	DatabaseSync,
	FileStat,
	FolderStat,
	ListReporter,
	Request,
	RequestParam,
	RequestResponse,
	RootFs,
	Stat,
	StoreSync,
} from '@hesprs/sync-engine-sdk';
import { chunkSize, concurrency } from '@hesprs/sync-engine-sdk';
import { concatBinary, textToUint8Array } from '@/shared/binary';
import { getStatus } from '@/shared/error';
import { basename, dirname, isFolder, isSub } from '@/shared/path';
import createRangeReadStream from '@/shared/read-stream';
import type { MyboxResource, MyboxResourceList } from './api';
import {
	MYBOX_API,
	PAGE_SIZE,
	decodeName,
	encodeName,
	parseMyboxError,
	toStat,
	toUid,
} from './api';

export type MyboxFsOptions = {
	naverId: string;
	deletePermanently: boolean;
};

export type MyboxDB = DatabaseSync<{ myboxIds: string }, { myboxIdsMarker?: string }>;

const ROOT_KEY = '/';
const ROOT_ID = 'root';
const DAY = 24 * 60 * 60 * 1000;

function notFoundError(key: string): Error {
	const error = new Error(`MYBOX: ${key} does not exist.`);
	(error as { status?: number }).status = 404;
	return error;
}

function childKey(parentKey: string, { name, type }: MyboxResource): string {
	const prefix = parentKey === ROOT_KEY ? '' : parentKey;
	return `${prefix}${decodeName(name)}${type === 'folder' ? '/' : ''}`;
}

function uploadTime(mtime: number): number {
	const now = Date.now();
	const time = Number.isFinite(mtime) && mtime >= 0 && mtime <= now + DAY ? mtime : now;
	return Math.floor(time / 1000) * 1000;
}

function parentParam(parentId: string): { parentId?: string } {
	return parentId === ROOT_ID ? {} : { parentId };
}

async function collectStream(source: ReadableStream<Binary>): Promise<Binary> {
	const chunks: Array<Binary> = [];
	const reader = source.getReader();
	try {
		for (let read = await reader.read(); !read.done; read = await reader.read())
			chunks.push(read.value);
	} finally {
		reader.releaseLock();
	}
	return concatBinary(...chunks);
}

function multipartBody(value: Binary): { body: Binary; contentType: string } {
	const boundary = `sync-engine-${crypto.randomUUID()}`;
	return {
		body: concatBinary(
			textToUint8Array(
				`--${boundary}\r\nContent-Disposition: form-data; name="Filedata"; filename="file"\r\nContent-Type: application/octet-stream\r\n\r\n`,
			),
			value,
			textToUint8Array(`\r\n--${boundary}--\r\n`),
		),
		contentType: `multipart/form-data; boundary=${boundary}`,
	};
}

export default class MyboxFs implements RootFs {
	private readonly ids: StoreSync<string>;
	private rootResourceId: string | undefined;

	constructor(
		private readonly request: Request,
		private readonly options: MyboxFsOptions,
		memoryDB: MyboxDB,
	) {
		this.ids = memoryDB.getStore('myboxIds');
		if (memoryDB.getMeta('myboxIdsMarker') !== this.getUid()) {
			this.ids.clear();
			memoryDB.setMeta('myboxIdsMarker', this.getUid());
		}
	}

	getUid(): string {
		return `mybox~${this.options.naverId}`;
	}

	private async requestOrThrow(url: string, params: RequestParam = {}): Promise<RequestResponse> {
		const response = await this.request(url, { ...params, throw: false });
		if (response.status >= 200 && response.status < 300) return response;
		const error = new Error(
			parseMyboxError(response) ??
				`MYBOX request failed: ${response.status} ${params.method ?? 'GET'} ${url}`,
		);
		(error as { status?: number }).status = response.status;
		throw error;
	}

	private postJson(path: string, body: object): Promise<RequestResponse> {
		return this.requestOrThrow(`${MYBOX_API}${path}`, {
			body: JSON.stringify(body),
			contentType: 'application/json',
			method: 'POST',
		});
	}

	private async listChildren(folderId: string): Promise<Array<MyboxResource>> {
		const base =
			folderId === ROOT_ID
				? `${MYBOX_API}/drive/resources`
				: `${MYBOX_API}/drive/folders/${encodeURIComponent(folderId)}/resources`;
		const all: Array<MyboxResource> = [];
		let cursor: string | undefined;
		do {
			const url = new URL(base);
			url.searchParams.set('count', String(PAGE_SIZE));
			if (cursor) url.searchParams.set('cursor', cursor);
			const parsed = (
				await this.requestOrThrow(url.toString(), { method: 'GET' })
			).json<MyboxResourceList>();
			all.push(...(parsed.resources ?? []));
			cursor = parsed.responseMetaData?.nextCursor;
		} while (cursor);
		if (folderId === ROOT_ID && all[0]) this.rootResourceId = all[0].parentId;
		return all;
	}

	private async refreshChildren(parentKey: string, parentId: string) {
		const items = await this.listChildren(parentId);
		for (const item of items) this.ids.set(childKey(parentKey, item), item.resourceId);
		return items;
	}

	private async resolveId(key: string): Promise<string | undefined> {
		if (key === ROOT_KEY) return ROOT_ID;
		const cached = this.ids.get(key);
		if (cached) return cached;
		const parentKey = dirname(key);
		const parentId = await this.resolveId(parentKey);
		if (!parentId) return;
		await this.refreshChildren(parentKey, parentId);
		return this.ids.get(key);
	}

	private async findFresh(key: string): Promise<MyboxResource | undefined> {
		const parentKey = dirname(key);
		const parentId =
			parentKey === ROOT_KEY ? ROOT_ID : (await this.findFresh(parentKey))?.resourceId;
		if (!parentId) return;
		const items = await this.refreshChildren(parentKey, parentId);
		return items.find((item) => childKey(parentKey, item) === key);
	}

	private async resolveRootResourceId(): Promise<string> {
		if (!this.rootResourceId) {
			const url = new URL(`${MYBOX_API}/drive/resources`);
			url.searchParams.set('count', '1');
			const response = await this.requestOrThrow(url.toString(), { method: 'GET' });
			this.rootResourceId = response.json<MyboxResourceList>().resources?.[0]?.parentId;
		}
		if (!this.rootResourceId) throw new Error('MYBOX: cannot resolve the root folder.');
		return this.rootResourceId;
	}

	private dropCache(key: string): void {
		this.ids.delete(key);
		if (!isFolder(key)) return;
		for (const cachedKey of this.ids.keys())
			if (isSub(key, cachedKey)) this.ids.delete(cachedKey);
	}

	private async requireId(key: string): Promise<string> {
		const id = await this.resolveId(key);
		if (!id) throw notFoundError(key);
		return id;
	}

	private async downloadUrl(id: string): Promise<string> {
		const response = await this.requestOrThrow(
			`${MYBOX_API}/drive/files/${encodeURIComponent(id)}/download`,
			{ method: 'GET' },
		);
		return response.json<{ downloadUrl: string }>().downloadUrl;
	}

	private rename(id: string, name: string) {
		return this.postJson(`/drive/resources/${encodeURIComponent(id)}/rename`, {
			name: encodeName(name),
		});
	}

	private async moveInto(id: string, parentId: string) {
		const target = parentId === ROOT_ID ? await this.resolveRootResourceId() : parentId;
		return this.postJson(`/drive/resources/${encodeURIComponent(id)}/move`, {
			parentId: target,
		});
	}

	async read(key: string): Promise<Binary> {
		const url = await this.downloadUrl(await this.requireId(key));
		return (await this.requestOrThrow(url, { method: 'GET' })).bytes();
	}

	async readStream(key: string, { size }: FileStat): Promise<ReadableStream<Binary>> {
		const id = await this.requireId(key);
		return createRangeReadStream({
			chunkSize,
			concurrency,
			requestRange: async (start, endInclusive) => {
				const response = await this.requestOrThrow(await this.downloadUrl(id), {
					headers: {
						'Accept-Encoding': 'identity',
						Range: `bytes=${start}-${endInclusive}`,
					},
					method: 'GET',
				});
				return response.bytes();
			},
			size,
		});
	}

	async write(key: string, value: Binary, stat: FileStat): Promise<string> {
		const parentId = await this.requireId(dirname(key));
		const mtime = uploadTime(stat.mtime);
		const init = await this.postJson('/drive/files', {
			fileName: encodeName(basename(key)),
			fileSize: value.byteLength,
			isOverwrite: true,
			modifiedTime: new Date(mtime).toISOString(),
			...parentParam(parentId),
		});
		const { uploadUrl } = init.json<{ uploadUrl: string }>();
		const response = await this.requestOrThrow(uploadUrl, {
			...multipartBody(value),
			method: 'POST',
		});
		const { resourceId } = response.json<{ resourceId?: string }>();
		if (resourceId) this.ids.set(key, resourceId);
		return toUid(mtime, value.byteLength);
	}

	async writeStream(key: string, value: ReadableStream<Binary>, stat: FileStat): Promise<string> {
		return this.write(key, await collectStream(value), stat);
	}

	private async deleteIfExists(path: string): Promise<boolean> {
		try {
			await this.requestOrThrow(`${MYBOX_API}${path}`, { method: 'DELETE' });
			return true;
		} catch (error) {
			if (getStatus(error) === 404) return false;
			throw error;
		}
	}

	async delete(key: string): Promise<void> {
		const id = await this.resolveId(key);
		if (!id) return;
		const encodedId = encodeURIComponent(id);
		const trashed = await this.deleteIfExists(`/drive/resources/${encodedId}`);
		this.dropCache(key);
		if (trashed && this.options.deletePermanently)
			await this.deleteIfExists(`/drive/trash/${encodedId}`);
	}

	async move(oldKey: string, newKey: string): Promise<void> {
		if (oldKey === newKey) return;
		const id = await this.requireId(oldKey);
		const oldName = basename(oldKey);
		const newName = basename(newKey);
		if (dirname(oldKey) === dirname(newKey)) {
			if (encodeName(oldName).toLowerCase() === encodeName(newName).toLowerCase())
				await this.rename(id, `sync-engine-${crypto.randomUUID()}`);
			await this.rename(id, newName);
		} else {
			const parentId = await this.requireId(dirname(newKey));
			if (oldName === newName) await this.moveInto(id, parentId);
			else {
				await this.rename(id, `sync-engine-${crypto.randomUUID()}`);
				await this.moveInto(id, parentId);
				await this.rename(id, newName);
			}
		}
		this.dropCache(oldKey);
		this.ids.set(newKey, id);
	}

	async mkdir(key: string, _stat: FolderStat, recursive?: boolean): Promise<void> {
		if (key === ROOT_KEY) return;
		const parentKey = dirname(key);
		if (recursive && !(await this.resolveId(parentKey)))
			await this.mkdir(parentKey, { isDir: true, key: parentKey, meta: () => ({}) }, true);
		const parentId = await this.requireId(parentKey);
		try {
			const response = await this.postJson('/drive/folders', {
				folderName: encodeName(basename(key)),
				...parentParam(parentId),
			});
			this.ids.set(key, response.json<{ resourceId: string }>().resourceId);
		} catch (error) {
			if (getStatus(error) !== 409 || !(await this.findFresh(key))) throw error;
		}
	}

	async stat(key: string): Promise<Stat> {
		if (key === ROOT_KEY) return { isDir: true, key, meta: () => ({}) };
		const item = await this.findFresh(key);
		if (!item) throw notFoundError(key);
		return toStat(key, item);
	}

	async exists(key: string): Promise<boolean> {
		if (key === ROOT_KEY) return true;
		return (await this.findFresh(key)) !== undefined;
	}

	async list(key: string, reporter: ListReporter): Promise<Array<Stat>> {
		const startId = key === ROOT_KEY ? ROOT_ID : (await this.findFresh(key))?.resourceId;
		if (!startId) throw notFoundError(key);
		for (const cachedKey of this.ids.keys())
			if (isSub(key, cachedKey)) this.ids.delete(cachedKey);
		if (key !== ROOT_KEY) this.ids.set(key, startId);
		const results: Array<Stat> = [];
		let completed = 0;
		let total = 0;
		const visit = async (folderKey: string, folderId: string): Promise<void> => {
			const items = await this.refreshChildren(folderKey, folderId);
			total += items.length;
			await Promise.all(
				items.map(async (item) => {
					const itemKey = childKey(folderKey, item);
					completed++;
					const verdict = await reporter({ completed, current: itemKey, total });
					if (verdict === 'exclude') return;
					results.push(toStat(itemKey, item));
					if (verdict === 'advance' && item.type === 'folder')
						await visit(itemKey, item.resourceId);
				}),
			);
		};
		await visit(key, startId);
		return results;
	}
}
