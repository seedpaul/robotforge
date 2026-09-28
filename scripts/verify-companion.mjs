import { rolldown } from 'rolldown';
const build = await rolldown({ input: 'companion/verify.mjs', platform: 'node', external: [/^node:/] });
await build.write({ file: '.verification/verify-companion.mjs', format: 'esm' });
await build.close();
await import('../.verification/verify-companion.mjs');
