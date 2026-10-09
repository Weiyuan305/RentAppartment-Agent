// Temporary public preview: detached processes survive the launching terminal.
// Requires an existing production build and the independently verified tool below.
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = resolve(root, '.sites-runtime/share-preview');
const stateFile = resolve(runtime, 'state.json');
const tool = resolve(root, '.sites-runtime/bin/cloudflared-2026.10.0');
// SHA256 of the executable, published in Cloudflare's 2026.10.0 release notes.
const toolHash = '72edfd3eea463aef4d5cb89e2e209cecb048cc756c2b01915de2e0ad7cb39830';
const origin = 'http://127.0.0.1:5175';
const serverArgs = [
  'scripts/run-framework.mjs', 'start', '--hostname', '127.0.0.1', '--port', '5175',
];
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
const readState = () => existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {};
const save = (state) => writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });

function identity(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 1) return '';
  try {
    return execFileSync('/bin/ps', ['-p', String(pid), '-o', 'lstart=', '-o', 'command='], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
}
const running = (entry) => Boolean(entry?.identity && identity(entry.pid) === entry.identity);

async function launch(command, args, logName) {
  const fd = openSync(resolve(runtime, logName), 'w', 0o600);
  const child = spawn(command, args, { cwd: root, detached: true, stdio: ['ignore', fd, fd], env: process.env });
  closeSync(fd);
  await new Promise((done, reject) => { child.once('spawn', done); child.once('error', reject); });
  child.unref();
  const entry = { pid: child.pid, identity: identity(child.pid) };
  if (!entry.identity) throw new Error(`Process failed to start; see ${logName}`);
  return entry;
}

function stop(state) {
  for (const name of ['caffeine', 'tunnel', 'server']) {
    const entry = state[name];
    // Check both command and start time before signalling a process group.
    if (running(entry)) {
      try { process.kill(-entry.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
  }
  state.stoppedAt = new Date().toISOString();
  save(state);
}

function status(state) {
  console.log(JSON.stringify({
    url: state.url ?? null,
    startedAt: state.startedAt ?? null,
    serverRunning: running(state.server),
    tunnelRunning: running(state.tunnel),
    idleSleepPrevented: running(state.caffeine),
    logs: runtime,
  }, null, 2));
}

async function waitForServer(server) {
  for (let i = 0; i < 30 && running(server); i++) {
    try {
      const response = await fetch(origin, { method: 'HEAD', signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
    } catch { /* Wait for the local production server. */ }
    await delay(500);
  }
  throw new Error('Production server did not become ready. See server.log.');
}

async function reload() {
  const state = readState();
  if (!running(state.tunnel)) throw new Error('No running tunnel. Use start instead.');
  if (running(state.server)) {
    process.kill(-state.server.pid, 'SIGTERM');
    for (let i = 0; i < 30 && running(state.server); i++) await delay(200);
    if (running(state.server)) throw new Error('Previous production server is still stopping.');
  }
  await delay(500);
  state.server = await launch(process.execPath, serverArgs, 'server.log');
  save(state);
  await waitForServer(state.server);
  state.refreshedAt = new Date().toISOString();
  save(state);
  status(state);
}

async function start() {
  const previous = readState();
  if (running(previous.server) || running(previous.tunnel)) {
    status(previous);
    if (!running(previous.server) || !running(previous.tunnel)) throw new Error('Partial preview is running. Use stop before starting again.');
    return;
  }
  if (!existsSync(resolve(root, 'dist/server/index.js'))) throw new Error('Run npm run build first.');
  if (!existsSync(tool) || createHash('sha256').update(readFileSync(tool)).digest('hex') !== toolHash) {
    throw new Error('Official cloudflared executable is missing or its checksum does not match.');
  }
  await new Promise((done, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(5175, '127.0.0.1', () => probe.close(done));
  });
  const state = { startedAt: new Date().toISOString() };
  try {
    state.server = await launch(process.execPath, serverArgs, 'server.log');
    save(state);
    await waitForServer(state.server);
    state.tunnel = await launch(tool, [
      'tunnel', '--no-autoupdate', '--url', origin, '--protocol', 'http2', '--loglevel', 'info',
    ], 'tunnel.log');
    save(state);
    if (process.platform === 'darwin') {
      state.caffeine = await launch('/usr/bin/caffeinate', ['-i', '-w', String(state.tunnel.pid)], 'caffeinate.log');
      save(state);
    }
    for (let i = 0; i < 80 && running(state.tunnel); i++) {
      const log = readFileSync(resolve(runtime, 'tunnel.log'), 'utf8');
      state.url = log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
      if (state.url && log.includes('Registered tunnel connection')) {
        save(state);
        status(state);
        return;
      }
      await delay(500);
    }
    throw new Error('Tunnel did not connect. See tunnel.log.');
  } catch (error) {
    stop(state);
    throw error;
  }
}

mkdirSync(runtime, { recursive: true });
try {
  const action = process.argv[2] ?? 'status';
  if (action === 'start') await start();
  else if (action === 'reload') await reload();
  else if (action === 'stop') { const state = readState(); stop(state); status(state); }
  else if (action === 'status') status(readState());
  else throw new Error('Usage: node scripts/share-preview.mjs start|reload|status|stop');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
