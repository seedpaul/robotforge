import http from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { projectSchema, validate } from '../lib/robot-model.ts';
import { assembleProject } from '../lib/generator.ts';
import { librarySettings,projectLibraryLock } from '../lib/library-project.ts';
import { getLibraryCatalog } from '../lib/library-service.ts';
import { mergeNewer, pythonRequirements, selectedVendors, vendorRegistry } from '../lib/libraries.ts';

export const PORT = 5819;
export const PROTOCOL = 7;
export const VERSION = '1.5.1';
export const SITE = 'https://robot-forge-frc.paul-seed121071.chatgpt.site';
export const PAGES_SITE = 'https://seedpaul.github.io/robotforge/';
const digest = value => createHash('sha256').update(value).digest('hex');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export const targetFor = (team, connection) => connection === 'usb' ? '172.22.11.2' : `roborio-${team}-FRC.local`;

// No shell, caller-supplied commands, arbitrary archives, or remote executable paths.
export function runProcess(command, args, { cwd, log, signal }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PYTHONUNBUFFERED: '1', PIP_DISABLE_PIP_VERSION_CHECK: '1' } });
    let stopped = false;
    const stop = () => {
      stopped = true;
      if (!child.pid) return;
      if (process.platform === 'win32') spawn('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
    };
    signal?.addEventListener('abort', stop, { once: true });
    if (signal?.aborted) stop();
    child.stdout.on('data', data => log(data.toString()));
    child.stderr.on('data', data => log(data.toString()));
    child.once('error', error => { signal?.removeEventListener('abort', stop); reject(new Error(`Could not start ${path.basename(command)}. Check the companion setup guide. ${error.message}`)); });
    child.once('close', code => {
      signal?.removeEventListener('abort', stop);
      if (stopped) reject(new Error('Build cancelled.'));
      else if (code === 0) resolve();
      else reject(new Error(`${path.basename(command)} exited with code ${code}. Read the build log above.`));
    });
  });
}

export async function findJava() {
  const roots = [process.env.ROBOTFORGE_JAVA_HOME, process.env.WPILIB_JAVA_HOME, path.join(process.env.PUBLIC || 'C:/Users/Public', 'wpilib/2026/jdk'), path.join(os.homedir(), 'wpilib/2026/jdk'), process.env.JAVA_HOME];
  for (const root of roots.filter(Boolean)) {
    const file = path.join(root, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
    try { await fs.access(file); return file; } catch {}
  }
  return 'java';
}

export function createCompanion({ assets, root = path.join(os.homedir(), '.robotforge'), run = runProcess, catalog = getLibraryCatalog, token = randomBytes(24).toString('hex'), origins = [new URL(SITE).origin, new URL(PAGES_SITE).origin], port = PORT }) {
  const allowed = new Set(origins);
  let job = null, busy = false, lastStart = 0;
  const log = value => { if (job) job.log = (job.log + value.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')).slice(-80000); };
  const publicJob = () => job ? { id: job.id, state: job.state, team: job.project.team, language: job.project.language, target: job.target, connection: job.connection, offline: job.offline, fingerprint: job.fingerprint, startedAt: job.startedAt, log: job.log, libraries: job.librarySummary || null, error: job.error || null } : null;
  const fingerprint = (project, connection, offline) => digest(JSON.stringify({ project, connection, offline }));
  async function execute(stage) {
    const current = job;
    const controller = new AbortController(); current.controller = controller;
    const timer = setTimeout(() => controller.abort(), 20 * 60 * 1000);
    const invoke = async (command, args, cwd = current.directory) => {
      if (controller.signal.aborted) throw Error('Build cancelled or timed out.');
      log(`\n> ${path.basename(command)} ${args.join(' ')}\n`);
      await run(command, args, { cwd, log, signal: controller.signal });
    };
    try {
      if (stage === 'build') {
        const settings = librarySettings(current.project);
        let lock = settings.lock;
        if (settings.mode === 'automatic' && !current.offline) {
          log('Checking stable 2026 library releases…\n');
          const available = await catalog();
          lock = projectLibraryLock(current.project,mergeNewer(lock, available.lock));
          for (const warning of available.errors) log(`Update check: ${warning}\n`);
        }
        current.settings = { ...settings, lock };
        current.buildProject = { ...current.project, libraries: { ...current.settings, mode: 'frozen' } };
        current.librarySummary = [`WPILib ${lock.wpilib}`, `RobotPy ${lock.robotpy}`, ...selectedVendors(settings).map(id => `${vendorRegistry[id].name} ${current.project.language === 'Python' ? lock.vendors[id].python : lock.vendors[id].manifest.version}`)].join(' · ');
        log(`Build library snapshot: ${current.librarySummary}\n`);
        await fs.mkdir(current.directory, { recursive: true });
        const files = await assembleProject(current.buildProject, async name => {
          if (!(name in assets)) throw Error(`Missing bundled template ${name}`);
          return Buffer.from(assets[name], 'base64');
        });
        if (files['build.gradle']) files['build.gradle'] += `\n// Deploy only to the address reviewed in RobotForge.\ndeploy.targets.roborio.locations.clear()\ndeploy.targets.roborio.addAddress('${current.target}')\n${current.project.language === 'Java' ? "tasks.register('robotForgePrepare') { doLast { configurations.roborioRelease.resolve() } }" : ''}\n`;
        current.manifest = {};
        for (const [name, contents] of Object.entries(files)) {
          const dest = path.join(current.directory, name);
          await fs.mkdir(path.dirname(dest), { recursive: true });
          await fs.writeFile(dest, contents);
          current.manifest[name] = digest(contents);
        }
      } else {
        // Generated source and build instructions must be identical to the reviewed build.
        for (const [name, hash] of Object.entries(current.manifest)) {
          if (digest(await fs.readFile(path.join(current.directory, name))) !== hash) throw Error('Generated project changed on disk. Build again before deploying.');
        }
      }
      if (current.project.language === 'Python') {
        const requirements = pythonRequirements(current.settings.lock, current.settings.extras);
        const venv = path.join(root, `python-${digest(JSON.stringify(requirements)).slice(0,16)}`);
        const python = path.join(venv, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
        if (stage === 'build') {
          if (!current.offline) {
            const launcher = process.env.ROBOTFORGE_PYTHON || (process.platform === 'win32' ? 'py' : 'python3.12');
            const prefix = process.platform === 'win32' && !process.env.ROBOTFORGE_PYTHON ? ['-3.12'] : [];
            await invoke(launcher, [...prefix, '-m', 'venv', venv]);
            await invoke(python, ['-m', 'pip', 'install', ...requirements]);
            // --no-install avoids RobotPy spawning an interactive installer window on Windows.
            await invoke(python, ['-m', 'robotpy', 'sync', '--no-install', '--no-upgrade-project']);
          }
          await invoke(python, ['-m', 'compileall', '-q', '.']);
          await invoke(python, ['-m', 'robotpy', 'test', '--builtin']);
        } else await invoke(python, ['-m', 'robotpy', 'deploy', '--builtin', '--robot', current.target]);
      } else {
        const java = await findJava();
        const tasks = stage === 'deploy' ? ['deploy'] : current.project.language === 'C++' ? ['frcUserProgramLinuxathenaReleaseExecutable'] : ['build', 'robotForgePrepare'];
        const args = ['-classpath', 'gradle/wrapper/gradle-wrapper.jar', 'org.gradle.wrapper.GradleWrapperMain', ...tasks, '--console=plain', '--no-daemon', '-Ptoolchain-optional-desktop'];
        if (current.offline || stage === 'deploy') args.push('--offline');
        await invoke(java, args);
      }
      if (controller.signal.aborted) throw Error('Operation timed out or was cancelled.');
      current.state = stage === 'build' ? 'ready' : 'deployed';
      log(stage === 'build' ? '\nBuild passed. Nothing has been sent to the robot. Review and confirm deployment in the app.\n' : '\nDeployment tool reported success. Check Driver Station and robot logs before enabling.\n');
    } catch (error) {
      current.state = controller.signal.aborted ? 'cancelled' : 'failed';
      current.error = error.message; log(`\n${error.message}\n`);
    } finally { clearTimeout(timer); busy = false; }
  }
  async function body(req) {
    if (!req.headers['content-type']?.startsWith('application/json')) fail('JSON required.', 415);
    let text = '';
    for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 200000) fail('Request too large.', 413); }
    try { return JSON.parse(text); } catch { fail('Invalid JSON.'); }
  }
  const server = http.createServer(async (req, res) => {
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); };
    try {
      if (req.headers.host !== `127.0.0.1:${server.address().port}`) fail('Invalid host.', 403);
      const origin = req.headers.origin;
      if (!allowed.has(origin)) fail('This site is not paired with this companion.', 403);
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
        res.writeHead(204); res.end(); return;
      }
      const supplied = Buffer.from(req.headers.authorization || '');
      const expected = Buffer.from(`Bearer ${token}`);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) fail('Pairing code is incorrect. Copy the code shown by your companion.', 401);
      if (req.method === 'GET' && req.url === '/status') return send(200, { protocol: PROTOCOL, version: VERSION, job: publicJob() });
      if (req.method !== 'POST') fail('Not found.', 404);
      const data = await body(req);
      if (req.url === '/build') {
        if (busy) fail('Another operation is still running.', 409);
        if (Date.now() - lastStart < 1000) fail('Please wait a moment before starting another build.', 429);
        const parsed = projectSchema.safeParse(data.project);
        if (!parsed.success) fail('Invalid robot configuration. Resolve the project errors first.');
        const project = parsed.data;
        const errors = validate(project).filter(issue => issue.level === 'error');
        if (errors.length) fail(errors.map(issue => issue.message).join(' '));
        if (!['network', 'usb'].includes(data.connection) || typeof data.offline !== 'boolean') fail('Choose a valid connection and build mode.');
        const id = randomBytes(12).toString('hex');
        job = { id, project, connection: data.connection, offline: data.offline, target: targetFor(project.team, data.connection), fingerprint: fingerprint(project, data.connection, data.offline), state: 'building', log: '', startedAt: new Date().toISOString(), directory: path.join(root, 'builds', id) };
        busy = true; lastStart = Date.now(); void execute('build'); return send(202, { job: publicJob() });
      }
      if (!job || data.id !== job.id) fail('This build is no longer available. Build again.', 409);
      if (req.url === '/cancel') {
        if (job.state !== 'building') fail('Only a build can be cancelled. Do not interrupt a robot upload.', 409);
        job.controller.abort(); return send(202, { job: publicJob() });
      }
      if (req.url === '/deploy') {
        if (busy || job.state !== 'ready') fail('A successful build is required before deployment.', 409);
        const parsed = projectSchema.safeParse(data.project);
        if (!parsed.success || fingerprint(parsed.data, data.connection, data.offline) !== job.fingerprint) fail('Configuration changed. Build again before deploying.', 409);
        if (data.confirmTeam !== String(job.project.team) || data.disabled !== true) fail('Confirm the team number and that the robot is disabled.');
        job.state = 'deploying'; busy = true; void execute('deploy'); return send(202, { job: publicJob() });
      }
      fail('Not found.', 404);
    } catch (error) { if (!res.headersSent) send(error.status || 500, { error: error.status ? error.message : 'Companion error. Check its terminal and try again.' }); }
  });
  server.requestTimeout = 10000; server.headersTimeout = 10000;
  return { server, token, start: () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }), stop: () => new Promise(resolve => { if (job?.state === 'building') job.controller.abort(); server.close(resolve); server.closeIdleConnections(); }) };
}
