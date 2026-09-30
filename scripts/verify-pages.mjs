import { rolldown } from 'rolldown';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const bundle = await rolldown({ input: 'scripts/pages-test-entry.mjs', platform: 'node', external: [/^node:/] });
const output = await bundle.generate({ format: 'esm' }); await bundle.close();
const moduleCode = output.output[0].code;
const load = prefix => import('data:text/javascript;base64,' + Buffer.from(prefix + moduleCode).toString('base64'));
const pages = await load('const __ROBOTFORGE_PAGES_BASE__ = "/robotforge/";\n');
const serverHost = await load('');
assert.equal(serverHost.assetUrl('/templates/gradlew'), '/templates/gradlew');
assert.equal(serverHost.libraryCatalogUrl(true), '/api/libraries?refresh=1');
assert.equal(pages.libraryCatalogUrl(true), '/robotforge/library-catalog.json');
const html = await fs.readFile('dist-pages/index.html', 'utf8');
assert.match(html, /\/robotforge\/assets\/[^" ]+\.js/);
assert.ok(!html.includes('/@vite/') && !html.includes('/main.tsx'));
const catalog = pages.validateLibraryCatalog(JSON.parse(await fs.readFile('dist-pages/library-catalog.json', 'utf8')));
assert.ok(Number.isFinite(Date.parse(catalog.checkedAt)));
assert.throws(() => pages.validateLibraryCatalog({ ...catalog, checkedAt: 'not-a-date' }));
assert.throws(() => pages.validateLibraryCatalog({ ...catalog, errors: 'wrong shape' }));
assert.throws(() => pages.validateLibraryCatalog({ ...catalog, lock: { ...catalog.lock, wpilib: '2027.1.1' } }));

// Serve only real static files under the same project prefix Pages uses; no API or SPA fallback.
const root = path.resolve('dist-pages');
const staticServer = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (!pathname.startsWith('/robotforge/')) { res.writeHead(404).end(); return; }
  const file = path.resolve(root, pathname.slice('/robotforge/'.length) || 'index.html');
  if (!file.startsWith(root + path.sep)) { res.writeHead(404).end(); return; }
  try { res.end(await fs.readFile(file)); } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => staticServer.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${staticServer.address().port}`;
try {
  for (const language of ['Java', 'C++', 'Python']) {
    const files = await pages.assembleProject({ ...structuredClone(pages.initialProject), team: 9999, language }, async asset => {
      const response = await fetch(origin + pages.assetUrl(asset));
      assert.equal(response.status, 200, `Static template missing: ${asset}`);
      return new Uint8Array(await response.arrayBuffer());
    });
    assert.ok(Object.keys(files).length > 8);
    assert.ok(files['robotforge-project.json']);
  }
  const companion = await fetch(origin + pages.assetUrl('/companion/RobotForge-Companion.zip'));
  assert.equal(companion.status, 200);
  assert.equal(Buffer.from(await companion.arrayBuffer()).subarray(0, 2).toString(), 'PK');
  assert.equal((await fetch(origin + '/api/libraries')).status, 404);
} finally { await new Promise(resolve => staticServer.close(resolve)); }

const companion = pages.createCompanion({ assets: {}, port: 0, run: async () => { throw Error('No robot tools may run in this test'); } });
await companion.start();
const url = `http://127.0.0.1:${companion.server.address().port}`;
try {
  for (const origin of [pages.SITE, 'https://seedpaul.github.io']) {
    const response = await fetch(url + '/status', { headers: { Origin: origin, Authorization: `Bearer ${companion.token}` } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.equal((await response.json()).version, '1.5.0');
  }
  assert.equal((await fetch(url + '/status', { headers: { Origin: 'https://seedpaul.github.io' } })).status, 401);
  for (const origin of ['https://someone-else.github.io', 'https://seedpaul.github.io.evil.example']) {
    assert.equal((await fetch(url + '/status', { headers: { Origin: origin, Authorization: `Bearer ${companion.token}` } })).status, 403);
  }
} finally { await companion.stop(); }
console.log('PASS: static project paths, three-language exports using hosted templates, companion download, catalog validation, existing server paths, and exact-origin/token checks. No robot tools ran.');
