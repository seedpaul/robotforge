import { rolldown } from 'rolldown';
import fs from 'node:fs/promises';
import path from 'node:path';

const bundle = await rolldown({ input: 'companion/main.mjs', platform: 'node', external: [/^node:/] });
const output = await bundle.generate({ format: 'esm' });
await bundle.close();
const zipper = await rolldown({ input: 'lib/zip.ts', platform: 'node' });
const zipped = await zipper.generate({ format: 'esm' });
await zipper.close();
const { zip } = await import('data:text/javascript;base64,' + Buffer.from(zipped.output[0].code).toString('base64'));
const assets = {};
async function collect(dir) { for (const item of await fs.readdir('public/' + dir, { withFileTypes: true })) { const name = dir + '/' + item.name; if (item.isDirectory()) await collect(name); else assets['/' + name] = (await fs.readFile('public/' + name)).toString('base64'); } }
await collect('templates'); await collect('vendor');
const files = {
  'companion.mjs': output.output[0].code,
  'assets.json': JSON.stringify(assets),
  'Start RobotForge.cmd': '@echo off\r\ncd /d "%~dp0"\r\nnode companion.mjs\r\npause\r\n',
  'README.md': await fs.readFile('companion/README.md', 'utf8'),
  'THIRD_PARTY_NOTICES.md': await fs.readFile('THIRD_PARTY_NOTICES.md', 'utf8'),
  'LICENSE-zod.txt': await fs.readFile('node_modules/zod/LICENSE', 'utf8'),
};
await fs.mkdir('public/companion', { recursive: true });
await fs.writeFile('public/companion/RobotForge-Companion.zip', zip(files));
// Extractable verification copy. Never contains pairing credentials.
await fs.mkdir('.verification/companion', { recursive: true });
for (const [name, value] of Object.entries(files)) await fs.writeFile(path.join('.verification/companion', name), value);
console.log('Packaged standalone RobotForge Companion for Windows, macOS, and Linux.');
