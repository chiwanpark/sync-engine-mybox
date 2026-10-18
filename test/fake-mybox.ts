import type { Binary, RequestParam } from '@hesprs/sync-engine-sdk';
import { MYBOX_API } from '@/mybox/api';

type Node = {
	id: string;
	parentId: string;
	name: string;
	type: 'file' | 'folder';
	content: Binary;
	modifiedAt: number;
};

type Reply = {
	status: number;
	json: () => unknown;
	bytes: () => Binary;
	text: () => string;
};

const STORAGE = 'https://open-api-fs.mybox.naver.com/v1/storage';
const ROOT = 'root-folder-id';
const INVALID_NAME = /^[ .]|[ .]$|[\\/:*?"<>|\p{Cc}\p{Extended_Pictographic}\u{10000}-\u{10FFFF}]/u;

function reply(status: number, value: unknown = {}, raw?: Binary): Reply {
	const body = raw ?? new TextEncoder().encode(JSON.stringify(value));
	return {
		bytes: () => body,
		json: () => value,
		status,
		text: () => new TextDecoder().decode(body),
	};
}

function error(status: number) {
	return reply(status, { code: `PLAT-${status}`, message: 'ERROR' });
}

function iso(ms: number) {
	return new Date(ms).toISOString().replace('.000Z', '+00:00');
}

function resource(node: Node) {
	return {
		modifiedAt: iso(node.modifiedAt),
		name: node.name,
		parentId: node.parentId,
		resourceId: node.id,
		size: node.content.byteLength,
		type: node.type,
	};
}

function extractFiledata(body: Binary): Binary {
	const text = new TextDecoder('latin1').decode(body);
	const start = text.indexOf('\r\n\r\n') + 4;
	const end = text.lastIndexOf('\r\n--');
	return body.slice(start, end);
}

export default class FakeMybox {
	readonly nodes = new Map<string, Node>();
	readonly trash = new Map<string, Node>();
	readonly apiCalls: Array<string> = [];
	pageSize = 1000;
	private counter = 0;
	private readonly uploads = new Map<
		string,
		{ parentId: string; name: string; modifiedAt: number }
	>();
	private readonly downloads = new Map<string, string>();

	children(parentId: string) {
		return [...this.nodes.values()].filter((node) => node.parentId === parentId);
	}

	find(path: string): Node | undefined {
		let parentId = ROOT;
		let node: Node | undefined;
		for (const name of path.split('/').filter(Boolean)) {
			node = this.children(parentId).find((child) => child.name === name);
			if (!node) return;
			parentId = node.id;
		}
		return node;
	}

	seed(path: string, content?: string, modifiedAt = 1_700_000_000_000): Node {
		const segments = path.split('/').filter(Boolean);
		let parentId = ROOT;
		let node: Node | undefined;
		for (const [index, name] of segments.entries()) {
			const isFile = content !== undefined && index === segments.length - 1;
			node = this.children(parentId).find(
				(child) => child.name === name && child.type === (isFile ? 'file' : 'folder'),
			);
			node ??= this.create(parentId, name, isFile ? 'file' : 'folder', modifiedAt);
			if (isFile) node.content = new TextEncoder().encode(content);
			parentId = node.id;
		}
		if (!node) throw new Error('empty path');
		return node;
	}

	private create(parentId: string, name: string, type: Node['type'], modifiedAt: number) {
		const node: Node = {
			content: new Uint8Array(0),
			id: `id-${++this.counter}`,
			modifiedAt,
			name,
			parentId,
			type,
		};
		this.nodes.set(node.id, node);
		return node;
	}

	private conflict(parentId: string, name: string, type: Node['type'], except?: string) {
		return this.children(parentId).find(
			(child) =>
				child.id !== except &&
				child.type === type &&
				child.name.toLowerCase() === name.toLowerCase(),
		);
	}

	private listing(parentId: string, url: URL) {
		const children = this.children(parentId).sort((a, b) => a.id.localeCompare(b.id));
		const count = Math.min(Number(url.searchParams.get('count') ?? 100), this.pageSize);
		const start = Number(url.searchParams.get('cursor') ?? 0);
		const page = children.slice(start, start + count);
		const next = start + count < children.length ? String(start + count) : undefined;
		return reply(200, {
			resources: page.map(resource),
			responseMetaData: next ? { nextCursor: next } : {},
		});
	}

	handle = (rawUrl: string, params: RequestParam): Reply => {
		const url = new URL(rawUrl);
		const method = params.method ?? 'GET';
		const body =
			typeof params.body === 'string'
				? (JSON.parse(params.body) as Record<string, unknown>)
				: {};
		if (rawUrl.startsWith(STORAGE)) return this.storage(url, method, params);
		const path = rawUrl.slice(MYBOX_API.length).split('?')[0] ?? '';
		this.apiCalls.push(`${method} ${path}`);
		const segments = path.split('/').filter(Boolean).map(decodeURIComponent);
		const [area, kind, id, action] = segments;
		if (area !== 'drive') return error(404);
		if (method === 'GET' && kind === 'resources' && !id) return this.listing(ROOT, url);
		if (method === 'GET' && kind === 'storage') return reply(200, { maxFileBytes: 1 });
		const node = id ? this.nodes.get(id) : undefined;
		if (method === 'GET' && kind === 'folders' && action === 'resources')
			return node?.type === 'folder' ? this.listing(node.id, url) : error(404);
		if (method === 'POST' && kind === 'folders' && !id) {
			const parentId = (body.parentId as string | undefined) ?? ROOT;
			const name = body.folderName as string;
			if (INVALID_NAME.test(name)) return error(400);
			if (this.conflict(parentId, name, 'folder')) return error(409);
			const created = this.create(parentId, name, 'folder', Date.now());
			return reply(201, { name, resourceId: created.id });
		}
		if (method === 'POST' && kind === 'files' && !id) {
			const parentId = (body.parentId as string | undefined) ?? ROOT;
			const name = body.fileName as string;
			if (INVALID_NAME.test(name)) return error(400);
			if (!body.isOverwrite && this.conflict(parentId, name, 'file')) return error(409);
			const token = `upload-${++this.counter}`;
			const modifiedAt = Math.floor(Date.parse(body.modifiedTime as string) / 1000) * 1000;
			this.uploads.set(token, { modifiedAt, name, parentId });
			return reply(201, { offset: 0, uploadUrl: `${STORAGE}/upload?stoken=${token}` });
		}
		if (method === 'GET' && kind === 'files' && action === 'download') {
			if (node?.type !== 'file') return error(404);
			const token = `download-${++this.counter}`;
			this.downloads.set(token, node.id);
			return reply(200, {
				downloadUrl: `${STORAGE}/download?atoken=${token}`,
				expiresIn: 600,
			});
		}
		if (method === 'DELETE' && kind === 'trash' && id)
			return this.trash.delete(id) ? reply(204) : error(404);
		if (!node) return error(404);
		if (method === 'DELETE' && kind === 'resources') {
			const remove = (target: Node) => {
				this.children(target.id).forEach(remove);
				this.nodes.delete(target.id);
			};
			remove(node);
			this.trash.set(node.id, node);
			return reply(204);
		}
		if (method === 'POST' && action === 'rename') {
			const name = body.name as string;
			if (INVALID_NAME.test(name)) return error(400);
			if (this.conflict(node.parentId, name, node.type, node.id)) return error(409);
			node.name = name;
			return reply(200, { name });
		}
		if (method === 'POST' && action === 'move') {
			const parentId = body.parentId as string;
			if (parentId !== ROOT && this.nodes.get(parentId)?.type !== 'folder') return error(404);
			if (this.conflict(parentId, node.name, node.type, node.id)) return error(409);
			node.parentId = parentId;
			return reply(200);
		}
		return error(404);
	};

	private storage(url: URL, method: string, params: RequestParam): Reply {
		if (method === 'POST' && url.pathname.endsWith('/upload')) {
			const token = url.searchParams.get('stoken') ?? '';
			const upload = this.uploads.get(token);
			if (!upload) return reply(403, { message: 'Auth Fail' });
			this.uploads.delete(token);
			const content = extractFiledata(params.body as Binary);
			let node = this.conflict(upload.parentId, upload.name, 'file');
			node ??= this.create(upload.parentId, upload.name, 'file', upload.modifiedAt);
			node.content = content;
			node.modifiedAt = upload.modifiedAt;
			return reply(200, {
				fileSize: content.byteLength,
				name: node.name,
				resourceId: node.id,
			});
		}
		const token = url.searchParams.get('atoken') ?? '';
		const id = this.downloads.get(token);
		this.downloads.delete(token);
		const node = id ? this.nodes.get(id) : undefined;
		if (!node) return reply(403, { message: 'Auth Fail' });
		const range = /bytes=(?<start>\d+)-(?<end>\d+)/u.exec(params.headers?.Range ?? '')?.groups;
		if (!range) return reply(200, {}, node.content);
		return reply(206, {}, node.content.slice(Number(range.start), Number(range.end) + 1));
	}
}
