import { SEASON, vendorRegistry, vendorIds, validateManifest, compareVersions, isSeasonVersion, validateLibraryLock, type LibraryCatalog, type VendorId } from './libraries';
import { bundledLock } from './library-project';

type Fetcher = typeof fetch;
const INDEX = 'https://api.github.com/repos/wpilibsuite/vendor-json-repo/contents/2026';
const RAW = 'https://raw.githubusercontent.com/wpilibsuite/vendor-json-repo/main/2026/';
const TTL = 60 * 60 * 1000;
let cache: { time: number; value: LibraryCatalog }|undefined;
let pending: Promise<LibraryCatalog>|undefined;
// Only fixed publisher endpoints are fetched. No URL is accepted from the browser.
async function json(url: string, fetcher: Fetcher): Promise<unknown> {
  // Workers supports manual redirects; reject all non-2xx responses below.
  const response = await fetcher(url, { headers: { Accept: 'application/json', 'User-Agent': 'RobotForge-Library-Updates/1.1' }, redirect: 'manual', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw Error(`Publisher returned HTTP ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) throw Error('Publisher returned an empty response');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 4_000_000) { await reader.cancel(); throw Error('Publisher response exceeds the size limit'); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function latestPython(data: unknown, short = false) {
  const source = data as { releases?: Record<string, { yanked?: boolean }[]> };
  const candidates = Object.entries(source.releases || {}).filter(([v, files]) => isSeasonVersion(v, short) && Array.isArray(files) && files.some(f => !f.yanked)).map(([v]) => v);
  candidates.sort(compareVersions); if (!candidates.length) throw Error('No stable release for this season'); return candidates.at(-1)!;
}
export function registryFile(index: unknown, id: VendorId) {
  if (!Array.isArray(index)) throw Error('Invalid WPILib vendor index');
  const prefix = vendorRegistry[id].prefix;
  const names = index.map(f => f.name).filter((name: unknown): name is string => typeof name === 'string' && name.startsWith(prefix) && name.endsWith('.json') && isSeasonVersion(name.slice(prefix.length, -5), id === 'ctre'));
  names.sort((a, b) => compareVersions(a.slice(prefix.length, -5), b.slice(prefix.length, -5)));
  if (!names.length) throw Error('No stable vendor release for this season'); return names.at(-1)!;
}
export async function refreshLibraryCatalog(fetcher: Fetcher = fetch): Promise<LibraryCatalog> {
  const checkedAt = new Date().toISOString();
  const result: LibraryCatalog = { lock: structuredClone(bundledLock), errors: [], checkedAt, sources: {} };
  // Attach rejection immediately because index and independent publisher calls overlap.
  const index = json(INDEX, fetcher).then(value => ({ value }), error => ({ error }));
  const task = async (key: string, action: () => Promise<void>) => { try { await action(); result.sources[key] = 'live'; } catch (error) { result.sources[key] = 'bundled'; result.errors.push(`${key}: ${error instanceof Error ? error.message : 'Update check failed'}. Keeping the saved version.`); } };
  await Promise.all([
    task('WPILib', async () => {
      const releases = await json('https://api.github.com/repos/wpilibsuite/allwpilib/releases?per_page=100', fetcher) as { tag_name: string; prerelease: boolean; draft: boolean }[];
      const stable = releases.filter(r => !r.prerelease && !r.draft && isSeasonVersion(r.tag_name)).map(r => r.tag_name.replace(/^v/, '')).sort(compareVersions);
      if (!stable.length) throw Error(`No stable ${SEASON} release`); result.lock.wpilib = stable.at(-1)!;
    }),
    task('RobotPy', async () => { result.lock.robotpy = latestPython(await json('https://pypi.org/pypi/robotpy/json', fetcher)); }),
    ...vendorIds.flatMap(id => [
      task(vendorRegistry[id].name, async () => {
        let data: unknown;
        if (vendorRegistry[id].feed) {
          try { data = validateManifest(id, await json(vendorRegistry[id].feed, fetcher)); } catch { /* A latest feed may have moved to a new season. Use WPILib's season archive. */ }
        }
        if (!data) { const listing = await index; if ('error' in listing) throw listing.error; data = await json(RAW + registryFile(listing.value, id), fetcher); }
        result.lock.vendors[id].manifest = validateManifest(id, data);
      }),
      task(vendorRegistry[id].python, async () => { result.lock.vendors[id].python = latestPython(await json(`https://pypi.org/pypi/${vendorRegistry[id].python}/json`, fetcher), id === 'ctre'); }),
    ]),
  ]);
  result.lock.checkedAt = checkedAt;
  validateLibraryLock(result.lock);
  return result;
}
export function getLibraryCatalog(force = false): Promise<LibraryCatalog> {
  // Retry incomplete checks sooner; explicit checks may bypass the normal hourly cache.
  const maxAge = force || cache?.value.errors.length ? 60_000 : TTL;
  if (cache && Date.now() - cache.time < maxAge) return Promise.resolve(cache.value);
  if (!pending) pending = refreshLibraryCatalog().then(value => { cache = { time: Date.now(), value }; return value; }).finally(() => { pending = undefined; });
  return pending;
}
