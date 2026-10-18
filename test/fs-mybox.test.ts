import type { Binary, Stat } from '@hesprs/sync-engine-sdk';
import { testKit } from '@hesprs/sync-engine-sdk/dev';
import { beforeEach, expect, test } from 'vitest';
import type { MyboxDB } from '@/mybox/fs';
import MyboxFs from '@/mybox/fs';
import FakeMybox from './fake-mybox';
import openMemoryDB from './memory-db';

const { bytes, file, folder, request } = testKit;
const db: MyboxDB = openMemoryDB();

let server: FakeMybox;

function createFs(deletePermanently = false) {
	const harness = request(server.handle);
	return {
		calls: harness.calls,
		fs: new MyboxFs(harness.request, { deletePermanently, naverId: 'account' }, db),
	};
}

function keys(stats: Array<Stat>) {
	return stats.map(({ key }) => key).sort();
}

async function readAll(stream: ReadableStream<Binary>) {
	const chunks: Array<number> = [];
	for await (const chunk of stream) chunks.push(...chunk);
	return new TextDecoder().decode(new Uint8Array(chunks));
}

beforeEach(() => {
	server = new FakeMybox();
	db.clearStores();
	db.setMeta('myboxIdsMarker', undefined);
});

test('write returns the same uid that list reports later', async () => {
	server.seed('vault/');
	const { fs } = createFs();
	const stat = file('vault/note.md', { mtime: 1_700_000_123_456, size: 5 });
	const uid = await fs.write('vault/note.md', bytes('hello'), stat);
	expect(uid).toBe('1700000123000~5');
	const [listed] = await createFs().fs.list('vault/', () => 'advance');
	expect(listed).toMatchObject({ isDir: false, key: 'vault/note.md', size: 5, uid });
	expect(await fs.read('vault/note.md')).toStrictEqual(bytes('hello'));
});

test('write overwrites existing files and keeps the resource id', async () => {
	const existing = server.seed('vault/note.md', 'old');
	const { fs } = createFs();
	await fs.write('vault/note.md', bytes('new content'), file('vault/note.md', { mtime: 1000 }));
	expect(server.find('vault/note.md')?.id).toBe(existing.id);
	expect(new TextDecoder().decode(server.find('vault/note.md')?.content)).toBe('new content');
});

test('falls back to the current time for invalid modification times', async () => {
	server.seed('vault/');
	const { fs } = createFs();
	const before = Math.floor(Date.now() / 1000) * 1000;
	const uid = await fs.write('vault/a.md', bytes('a'), file('vault/a.md', { mtime: Number.NaN }));
	const [mtime] = uid.split('~').map(Number);
	expect(mtime).toBeGreaterThanOrEqual(before);
	expect(mtime).toBeLessThanOrEqual(Date.now());
});

test('encodes names MYBOX rejects and decodes them in listings', async () => {
	const { fs } = createFs();
	await fs.mkdir('.obsidian/', folder('.obsidian/'), true);
	await fs.write('.obsidian/📚 notes.md.', bytes('x'), file('.obsidian/📚 notes.md.'));
	expect(server.find('%2Eobsidian/%F0%9F%93%9A notes.md%2E')).toBeDefined();
	const listed = await createFs().fs.list('/', () => 'advance');
	expect(keys(listed)).toStrictEqual(['.obsidian/', '.obsidian/📚 notes.md.']);
});

test('lists recursively and honors reporter verdicts', async () => {
	server.seed('vault/a.md', 'a');
	server.seed('vault/keep/b.md', 'b');
	server.seed('vault/skip/c.md', 'c');
	server.seed('vault/shallow/d.md', 'd');
	const { fs } = createFs();
	const result = await fs.list('vault/', ({ current }) => {
		if (current === 'vault/skip/') return 'exclude';
		if (current === 'vault/shallow/') return 'include';
		return 'advance';
	});
	expect(keys(result)).toStrictEqual([
		'vault/a.md',
		'vault/keep/',
		'vault/keep/b.md',
		'vault/shallow/',
	]);
});

test('follows pagination cursors', async () => {
	server.pageSize = 2;
	for (const name of ['a', 'b', 'c', 'd', 'e']) server.seed(`vault/${name}.md`, name);
	const { fs } = createFs();
	expect(await fs.list('vault/', () => 'advance')).toHaveLength(5);
});

test('list fails when the base directory is missing', async () => {
	const { fs } = createFs();
	await expect(fs.list('vault/', () => 'advance')).rejects.toMatchObject({ status: 404 });
	expect(await fs.exists('vault/')).toBe(false);
});

test('mkdir creates parents recursively and tolerates existing folders', async () => {
	const { fs } = createFs();
	await fs.mkdir('vault/a/b/', folder('vault/a/b/'), true);
	expect(server.find('vault/a/b')?.type).toBe('folder');
	await createFs().fs.mkdir('vault/a/b/', folder('vault/a/b/'), false);
	expect(server.children(server.find('vault/a')?.id ?? '')).toHaveLength(1);
});

test('resolves uncached ids by listing parents', async () => {
	server.seed('vault/deep/note.md', 'deep');
	const { fs, calls } = createFs();
	expect(await fs.read('vault/deep/note.md')).toStrictEqual(bytes('deep'));
	expect(calls.filter(({ url }) => url.includes('/resources')).length).toBe(3);
});

test('moves files within and across folders', async () => {
	server.seed('vault/a.md', 'a');
	server.seed('vault/b.md', 'b');
	server.seed('vault/dir/');
	const { fs } = createFs();
	await fs.list('vault/', () => 'advance');
	await fs.move('vault/a.md', 'vault/A.md');
	expect(server.find('vault/A.md')).toBeDefined();
	await fs.move('vault/A.md', 'vault/dir/renamed.md');
	expect(server.find('vault/dir/renamed.md')?.content).toStrictEqual(bytes('a'));
	await fs.move('vault/b.md', 'vault/dir/b.md');
	expect(keys(await createFs().fs.list('vault/', () => 'advance'))).toStrictEqual([
		'vault/dir/',
		'vault/dir/b.md',
		'vault/dir/renamed.md',
	]);
});

test('moves folders into the root', async () => {
	server.seed('vault/nested/inner/x.md', 'x');
	server.seed('other.md', 'o');
	const { fs } = createFs();
	await fs.move('vault/nested/inner/', 'inner/');
	expect(server.find('inner/x.md')).toBeDefined();
	expect(await fs.read('inner/x.md')).toStrictEqual(bytes('x'));
});

test('delete moves to the trash and is idempotent', async () => {
	const node = server.seed('vault/a.md', 'a');
	const { fs } = createFs();
	await fs.delete('vault/a.md');
	await fs.delete('vault/a.md');
	expect(server.find('vault/a.md')).toBeUndefined();
	expect(server.trash.has(node.id)).toBe(true);
});

test('delete permanently empties the deleted resource from the trash', async () => {
	const node = server.seed('vault/dir/a.md', 'a');
	const dir = server.find('vault/dir');
	const { fs, calls } = createFs(true);
	await fs.delete('vault/dir/');
	await fs.delete('vault/dir/');
	expect(server.find('vault/dir')).toBeUndefined();
	expect(server.trash.size).toBe(0);
	expect(server.nodes.has(node.id)).toBe(false);
	const trashCalls = calls.filter(({ url }) => url.includes('/drive/trash/'));
	expect(trashCalls).toHaveLength(1);
	expect(trashCalls[0]?.url?.endsWith(`/drive/trash/${dir?.id}`)).toBe(true);
});

test('uses the NAVER ID as the file system uid', () => {
	expect(createFs().fs.getUid()).toBe('mybox~account');
});

test('stat and exists query fresh state', async () => {
	server.seed('vault/a.md', 'abc', 1_600_000_000_000);
	const { fs } = createFs();
	expect(await fs.stat('vault/a.md')).toMatchObject({
		isDir: false,
		mtime: 1_600_000_000_000,
		size: 3,
		uid: '1600000000000~3',
	});
	expect(await fs.stat('vault/')).toMatchObject({ isDir: true, key: 'vault/' });
	await expect(fs.stat('vault/missing.md')).rejects.toMatchObject({ status: 404 });
	const node = server.find('vault/a.md');
	if (node) server.nodes.delete(node.id);
	expect(await fs.exists('vault/a.md')).toBe(false);
});

test('streams ranges with a fresh download url per chunk', async () => {
	server.seed('vault/big.bin', 'abcdefghij');
	const { fs, calls } = createFs();
	const stream = await fs.readStream('vault/big.bin', file('vault/big.bin', { size: 10 }));
	expect(await readAll(stream)).toBe('abcdefghij');
	const ranged = calls.filter(({ headers }) => headers?.Range);
	expect(ranged.length).toBeGreaterThan(0);
	expect(new Set(ranged.map(({ url }) => url)).size).toBe(ranged.length);
});

test('writeStream uploads the collected stream', async () => {
	server.seed('vault/');
	const { fs } = createFs();
	const uid = await fs.writeStream(
		'vault/s.md',
		testKit.stream(['ab', 'cd']),
		file('vault/s.md', { mtime: 2000, size: 4 }),
	);
	expect(uid).toBe('2000~4');
	expect(server.find('vault/s.md')?.content).toStrictEqual(bytes('abcd'));
});
