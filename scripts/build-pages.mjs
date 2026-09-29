import { rolldown } from 'rolldown';
import fs from 'node:fs/promises';
import { build } from 'vite';

const bundle = await rolldown({ input: 'scripts/pages-catalog-entry.mjs', platform: 'node' });
const result = await bundle.generate({ format: 'esm' });
await bundle.close();
const { refreshLibraryCatalog, bundledLock, validateLibraryLock } = await import('data:text/javascript;base64,' + Buffer.from(result.output[0].code).toString('base64'));
const offline = process.argv.includes('--offline');
const catalog = offline
  ? { lock: bundledLock, checkedAt: bundledLock.checkedAt, sources: {}, errors: ['Live update checks were skipped for this local build. Using bundled versions.'] }
  : await refreshLibraryCatalog();
validateLibraryLock(catalog.lock);
if (!offline && !Object.values(catalog.sources).includes('live')) throw Error('No official library feed was reachable. The current Pages deployment must be kept.');
await fs.mkdir('.pages-runtime', { recursive: true });
await fs.writeFile('.pages-runtime/library-catalog.json', JSON.stringify(catalog));
for (const error of catalog.errors) console.warn(error);
await build({ configFile: 'vite.pages.config.ts' });
console.log('Static RobotForge build ready in dist-pages. Library catalog checked: ' + catalog.checkedAt);
