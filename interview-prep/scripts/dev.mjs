#!/usr/bin/env node
/**
 * Local dev orchestrator: MongoDB + backend API + Next frontend, one command.
 *
 * It exists to remove two traps that make a manual start fail in ways that
 * look unrelated to the cause:
 *   - shells export PORT=0, so the backend binds a random port while
 *     frontend/next.config.js rewrites /api to a fixed http://localhost:3001;
 *   - .env points MONGODB_URI at an Atlas SRV host that does not resolve
 *     locally, so the backend dies at startup with querySrv ECONNREFUSED.
 *
 * Usage:
 *   node scripts/dev.mjs                 all three services
 *   node scripts/dev.mjs backend         just the API
 *   node scripts/dev.mjs frontend db     frontend + database
 *   node scripts/dev.mjs --skip-db       do not start mongod (one is already up)
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));
const BACKEND_PORT = Number(process.env.DEV_BACKEND_PORT || 3001);
const FRONTEND_PORT = Number(process.env.DEV_FRONTEND_PORT || 3000);
const MONGO_PORT = 27017;
const MONGO_URI = process.env.MONGODB_URI || `mongodb://localhost:${MONGO_PORT}/interview-prep-dev`;
const usesManagedLocalDb = /^mongodb:\/\/(localhost|127\.0\.0\.1):27017\//.test(MONGO_URI);

const RESET = '\x1b[0m';
const COLOURS = { db: '\x1b[35m', backend: '\x1b[36m', frontend: '\x1b[32m' };

const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const wants = (name) => requested.length === 0 || requested.includes(name);
const skipDb = requested.length === 0 && process.argv.includes('--skip-db');

const log = (name, message) => console.log(`${COLOURS[name] ?? ''}[${name}]${RESET} ${message}`);
const fail = (name, message) => console.error(`${COLOURS[name] ?? ''}[${name}]${RESET} ${message}`);

/** Prefix each service's output so three streams stay readable in one terminal. */
function forward(name, stream) {
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) log(name, line);
  });
}

/**
 * True when something accepts a connection on the port. Both loopback
 * families are tried: the backend binds `localhost`, which on Windows resolves
 * to ::1 only, so a 127.0.0.1-only probe reports a healthy server as down.
 */
function listening(port) {
  return Promise.all(['127.0.0.1', '::1'].map((host) => new Promise((resolve) => {
    const socket = net.connect({ port, host, family: host.includes(':') ? 6 : 4 });
    const settle = (result) => { socket.destroy(); resolve(result); };
    socket.setTimeout(800);
    socket.once('connect', () => settle(true));
    socket.once('error', () => settle(false));
    socket.once('timeout', () => settle(false));
  }))).then((results) => results.some(Boolean));
}

async function waitForPort(name, port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await listening(port)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  fail(name, `nothing is listening on ${port} after ${timeoutMs / 1000}s; giving up.`);
  return false;
}

function findMongod() {
  const cache = path.join(root, 'backend', 'node_modules', '.cache', 'mongodb-memory-server');
  if (!existsSync(cache)) return null;
  const binary = readdirSync(cache).find(
    (file) => /^mongod(-x64)?/i.test(file) && !/\.(md5|zip|tgz|gz)$/i.test(file),
  );
  return binary ? path.join(cache, binary) : null;
}

const children = [];
function start(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: path.join(root, options.dir ?? '.'),
    env: { ...process.env, ...options.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    // On Windows npm/npx are .cmd shims, so they need a shell; an absolute
    // path (the mongod binary) must not go through one.
    shell: process.platform === 'win32' && !path.isAbsolute(command),
  });
  // A failed spawn emits 'error'; without this listener Node kills the process.
  child.on('error', (error) => {
    fail(name, `could not start: ${error.message}`);
    shutdown(1);
  });
  forward(name, child.stdout);
  forward(name, child.stderr);
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    fail(name, `exited unexpectedly (${signal ?? `code ${code}`}); stopping the stack.`);
    shutdown(code ?? 1);
  });
  children.push({ name, child });
  return child;
}

/** Kill a process and its children. child.kill() misses grandchildren on Windows. */
function kill(entry) {
  if (!entry?.child?.pid || entry.child.killed) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/F', '/T', '/PID', String(entry.child.pid)], { stdio: 'ignore' });
  } else {
    try { process.kill(-entry.child.pid, 'SIGTERM'); } catch { entry.child.kill('SIGTERM'); }
  }
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const entry of children) kill(entry);
  setTimeout(() => process.exit(code), 300);
}

async function main() {
  const started = [];

  if (wants('db') && !skipDb && usesManagedLocalDb) {
    if (await listening(MONGO_PORT)) {
      log('db', `already listening on ${MONGO_PORT}, reusing it`);
    } else {
      const mongod = findMongod();
      if (!mongod) {
        fail('db', 'no mongod binary found in backend/node_modules/.cache/mongodb-memory-server. '
          + 'Run "npm install" in backend/ first, or start MongoDB yourself.');
      } else {
        const dbpath = path.join(os.tmpdir(), 'interview-prep-mongo');
        mkdirSync(dbpath, { recursive: true });
        start('db', mongod, ['--dbpath', dbpath, '--port', String(MONGO_PORT), '--quiet'], { dir: 'backend' });
        if (!(await waitForPort('db', MONGO_PORT, 30000))) return shutdown(1);
        log('db', `ready on ${MONGO_PORT} (dbpath ${dbpath})`);
      }
    }
    started.push('db');
  }

  if (wants('backend')) {
    start('backend', 'npm', ['run', 'start:dev'], {
      dir: 'backend',
      env: { PORT: String(BACKEND_PORT), MONGODB_URI: MONGO_URI,
        FRONTEND_URL: process.env.FRONTEND_URL || `http://localhost:${FRONTEND_PORT}` },
    });
    // ts-node-dev compiles the whole backend on boot, so allow a generous window.
    if (!(await waitForPort('backend', BACKEND_PORT, 150000))) return shutdown(1);
    log('backend', `ready on http://localhost:${BACKEND_PORT}`);
    started.push('backend');
  }

  if (wants('frontend')) {
    start('frontend', 'npx', ['next', 'dev', '-p', String(FRONTEND_PORT)], {
      dir: 'frontend',
      env: { PORT: String(FRONTEND_PORT), BACKEND_API_URL: process.env.BACKEND_API_URL || `http://localhost:${BACKEND_PORT}` },
    });
    if (!(await waitForPort('frontend', FRONTEND_PORT, 120000))) return shutdown(1);
    started.push('frontend');
    log('frontend', `ready on http://localhost:${FRONTEND_PORT}`);
  }

  console.log(`\n  interview-prep is up (${started.join(', ') || 'nothing selected'})`);
  console.log(`  app      http://localhost:${FRONTEND_PORT}`);
  console.log(`  api      http://localhost:${BACKEND_PORT}/api`);
  console.log(`  health   http://localhost:${BACKEND_PORT}/api/health`);
  console.log('  Ctrl+C stops everything.\n');
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => shutdown(0));
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  shutdown(1);
});
