import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

const root = fileURLToPath(new URL('.', import.meta.url));
const base = process.env.ROBOTFORGE_PAGES_BASE || '/robotforge/';
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) throw Error('Pages base must be / or a slash-delimited repository path.');

export default defineConfig({
  root: root + 'static-app',
  base,
  publicDir: root + 'public',
  resolve: { alias: { '@': root } },
  define: { __ROBOTFORGE_PAGES_BASE__: JSON.stringify(base) },
  plugins: [react(), {
    name: 'robotforge-pages-catalog',
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'library-catalog.json', source: await fs.readFile(root + '.pages-runtime/library-catalog.json', 'utf8') });
      this.emitFile({ type: 'asset', fileName: '.nojekyll', source: '' });
    },
  }],
  build: { outDir: root + 'dist-pages', emptyOutDir: true },
});
