// Defined only by the static Pages build. Server hosting and the companion use root paths.
declare const __ROBOTFORGE_PAGES_BASE__: string | undefined;
export const pagesBase = typeof __ROBOTFORGE_PAGES_BASE__ === 'string' ? __ROBOTFORGE_PAGES_BASE__ : null;
export function assetUrl(path: string) { return pagesBase ? pagesBase + path.replace(/^\//, '') : path; }
export function libraryCatalogUrl(force = false) {
  return pagesBase ? assetUrl('/library-catalog.json') : '/api/libraries' + (force ? '?refresh=1' : '');
}
