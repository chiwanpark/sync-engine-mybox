import { expect, test } from 'vitest';
import { decodeName, encodeName } from '@/mybox/api';

test('keeps ordinary names unchanged', () => {
	for (const name of ['note.md', '한글 파일.md', '00000z9E{m~a-folder', '100% done.md', 'a.b c'])
		expect(encodeName(name)).toBe(name);
});

test('escapes characters MYBOX rejects', () => {
	expect(encodeName('.obsidian')).toBe('%2Eobsidian');
	expect(encodeName(' lead and trail. ')).toBe('%20lead and trail%2E%20');
	expect(encodeName('...')).toBe('%2E%2E%2E');
	expect(encodeName('📚 books.md')).toBe('%F0%9F%93%9A books.md');
	expect(encodeName('❤️.md')).toBe('%E2%9D%A4%EF%B8%8F.md');
	expect(encodeName('a:b|c.md')).toBe('a%3Ab%7Cc.md');
	expect(encodeName('%41.md')).toBe('%2541.md');
});

test('round-trips names through encoding', () => {
	for (const name of [
		'.obsidian',
		' x ',
		'%2E',
		'%%41',
		'📚%F0.md',
		'1\u20E3 keycap',
		'tab\there',
		'mixed .📚. ',
		'𠀀',
	])
		expect(decodeName(encodeName(name))).toBe(name);
});

test('keeps remote names that do not come from encoding verbatim', () => {
	expect(decodeName('%41.md')).toBe('%41.md');
	expect(decodeName('a%2Fb')).toBe('a%2Fb');
	expect(decodeName('%E0%A4%A.md')).toBe('%E0%A4%A.md');
});
