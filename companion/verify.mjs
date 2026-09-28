import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createCompanion, targetFor } from './server.mjs';
import { initialProject } from '../lib/robot-model.ts';
import { bundledLock } from '../lib/library-project.ts';
const assets = JSON.parse(await fs.readFile('.verification/companion/assets.json', 'utf8'));
const origin = 'http://127.0.0.1:3107';
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'robotforge-test-'));
let mode = 'pass';
let catalogChecks = 0;
const calls = [];
const run = async (command, args, { signal, log }) => {
  calls.push({ command, args }); log('Simulated tool output; no robot is contacted.\n');
  if (mode === 'fail') throw Error('Intentional compiler failure');
  if (mode === 'wait') await new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Error('Cancelled')), { once: true }));
};
const bridge = createCompanion({ assets, root, port: 0, origins: [origin], run, catalog: async()=>{catalogChecks++;return {lock:bundledLock,errors:[]};} });
await bridge.start();
const url = `http://127.0.0.1:${bridge.server.address().port}`;
const headers = { Origin: origin, Authorization: `Bearer ${bridge.token}`, 'Content-Type': 'application/json' };
async function api(endpoint, body, overrides) {
  const response = await fetch(url + endpoint, { method: body ? 'POST' : 'GET', headers: { ...headers, ...overrides }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, ...await response.json() };
}
async function finish() {
  for (let i = 0; i < 400; i++) { const { job } = await api('/status'); if (!['building','deploying'].includes(job.state)) return job; await new Promise(r=>setTimeout(r, 10)); }
  throw Error('Job did not finish');
}
const project = { ...structuredClone(initialProject), team: 9999 };
const input = { project, connection: 'network', offline: false };
const next = () => new Promise(r=>setTimeout(r, 1050));
try {
  assert.equal((await api('/status', null, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await api('/status', null, { Authorization: 'Bearer wrong' })).status, 401);
  const badHostStatus = await new Promise(resolve => { http.get(url + '/status', { headers: { ...headers, Host: 'rebind.example' } }, response => { response.resume(); resolve(response.statusCode); }); });
  assert.equal(badHostStatus, 403);
  const preflight = await fetch(url + '/build', { method: 'OPTIONS', headers: { Origin: origin } });
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  assert.equal((await api('/build', { ...input, project: { ...project, team: 0 } })).status, 400);
  assert.equal((await api('/build', { ...input, connection: "usb';exec('malicious')" })).status, 400);
  assert.equal((await api('/build', { ...input, project: { ...project, command: 'not allowed' } })).status, 400);
  for (const language of ['Java', 'C++', 'Python']) {
    await next(); calls.length = 0;
    const config = { ...input, project: { ...project, language } };
    assert.equal((await api('/build', config)).status, 202);
    let job = await finish(); assert.equal(job.state, 'ready');
    assert.ok(!calls.some(c=>c.args.includes('deploy')), 'Build must never upload');
    assert.equal((await api('/deploy', { ...config, id: job.id, confirmTeam: '1', disabled: true })).status, 400);
    assert.equal((await api('/deploy', { ...config, id: job.id, confirmTeam: '9999', disabled: false })).status, 400);
    assert.equal((await api('/deploy', { ...config, connection: 'usb', id: job.id, confirmTeam: '9999', disabled: true })).status, 409);
    assert.equal((await api('/deploy', { ...config, project: { ...config.project, name: 'Changed' }, id: job.id, confirmTeam: '9999', disabled: true })).status, 409);
    assert.equal((await api('/deploy', { ...config, id: job.id, confirmTeam: '9999', disabled: true })).status, 202);
    job = await finish(); assert.equal(job.state, 'deployed');
    const deploy = calls.find(c=>c.args.includes('deploy')); assert.ok(deploy);
    if (language === 'Python') { assert.ok(deploy.args.includes('--builtin')); assert.ok(deploy.args.includes('roborio-9999-FRC.local')); assert.ok(calls.some(c=>c.args.includes('--no-install'))); }
    else assert.ok(deploy.args.includes('--offline'));
    assert.equal((await api('/deploy', { ...config, id: job.id, confirmTeam: '9999', disabled: true })).status, 409);
  }
  await next(); mode = 'fail'; calls.length = 0;
  await api('/build', input); let job = await finish(); assert.equal(job.state, 'failed');
  assert.equal((await api('/deploy', { ...input, id: job.id, confirmTeam: '9999', disabled: true })).status, 409);
  assert.ok(!calls.some(c=>c.args.includes('deploy')));
  await next(); mode = 'wait'; const started = await api('/build', input);
  assert.equal((await api('/build', input)).status, 409);
  await new Promise(r=>setTimeout(r, 80));
  assert.equal((await api('/cancel', { id: started.job.id })).status, 202);
  assert.equal((await finish()).state, 'cancelled');
  await next(); mode = 'pass'; await api('/build', input); job = await finish();
  await fs.appendFile(path.join(root, 'builds', job.id, 'build.gradle'), '\n// tampered');
  await api('/deploy', { ...input, id: job.id, confirmTeam: '9999', disabled: true });
  assert.equal((await finish()).state, 'failed');
  assert.equal(targetFor(9999, 'usb'), '172.22.11.2');
  for(const offline of [false,true]) {
    await next(); const before = catalogChecks;
    const pinned = {...input,offline,project:{...project,libraries:{mode:'frozen',extras:['pwf'],lock:bundledLock}}};
    await api('/build',pinned); const result = await finish(); assert.equal(result.state,'ready');
    assert.equal(catalogChecks,before,'Frozen builds must never resolve new releases');
    assert.ok(result.libraries.includes('Playing With Fusion'));
  }
  assert.ok(catalogChecks>=3,'Automatic builds should check releases');
  console.log('PASS: origin/host/token checks, strict configuration, three language workflows, build-before-deploy, typed team confirmation, disabled acknowledgement, stale configuration, tool failure, concurrent jobs, cancellation, and file integrity. No physical robot contacted.');
} finally { await bridge.stop(); }
