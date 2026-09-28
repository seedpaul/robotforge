import fs from 'node:fs/promises';
import { createCompanion, SITE, PORT } from './server.mjs';
const assets = JSON.parse(await fs.readFile(new URL('./assets.json', import.meta.url), 'utf8'));
const origins = [SITE];
// Local development is opt-in on the laptop, never controlled by a website.
if (process.env.ROBOTFORGE_DEV_ORIGIN) {
  const url = new URL(process.env.ROBOTFORGE_DEV_ORIGIN);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) throw Error('Development origin must be a loopback HTTP URL.');
  origins.push(url.origin);
}
const companion = createCompanion({ assets, origins });
try { await companion.start(); }
catch (error) { console.error(`Cannot start RobotForge Companion: ${error.message}. Close another running companion and retry.`); process.exit(1); }
console.log(`\nRobotForge Companion 1.2.0\nListening on this computer only: 127.0.0.1:${PORT}\n\nOpen ${SITE}\nCode & export > Deploy to robot\n\nPairing code: ${companion.token}\n\nKeep this window open. The pairing code changes every time you restart.\nBuilds are saved in your home folder under .robotforge/builds.\nDo not close this window while deploying. Press Ctrl+C when finished.\n`);
