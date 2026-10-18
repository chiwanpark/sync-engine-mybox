import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import meta from '../module.ts';

const outDir = new URL('../pages/', import.meta.url);
const fileName = `${meta.id}.js`;
const content = await readFile(new URL(`../dist/${fileName}`, import.meta.url), 'utf8');
const integrity = createHash('sha256').update(content, 'utf8').digest('hex');
const { source: _source, ...entry } = meta;

await rm(outDir, { force: true, recursive: true });
await mkdir(outDir, { recursive: true });
await writeFile(new URL(fileName, outDir), content);
await writeFile(
	new URL('modules.json', outDir),
	`${JSON.stringify([{ ...entry, integrity }], undefined, '\t')}\n`,
);
process.stdout.write(`Built pages for ${meta.id}@${meta.version} (integrity: ${integrity})\n`);
