// Runtime proof that each failure class produces a readable, correlated log
// line on the compiled server. Builds the backend, starts it against an
// isolated in-memory MongoDB, triggers an API 404, an auth 401, a body-parse
// 400, an invalid resume upload and a database outage, then asserts on the
// captured stdout exactly as Render would show it.
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.join(root, 'backend');
const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';
const requireBackend = createRequire(path.join(backend, 'package.json'));

// ---- 1. Compile the current source so this run reflects it -----------------
const build = spawnSync(npm, ['run', 'build'], { cwd: backend, shell: isWindows, encoding: 'utf8' });
if (build.status !== 0) {
  console.error('Backend build failed; cannot verify the runtime logs.');
  console.error(build.stdout || '', build.stderr || '');
  process.exit(1);
}

const mongoose = requireBackend('mongoose');
const { MongoMemoryServer } = requireBackend('mongodb-memory-server');
const config = requireBackend('./dist/config').default;

// ---- 2. Isolated database plus one authenticated session -------------------
const probe = net.createServer();
await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));

const db = await MongoMemoryServer.create();
const uri = db.getUri();
await mongoose.connect(uri);
const User = requireBackend('./dist/modules/auth/user.model').default;
const { createSession } = requireBackend('./dist/common/middleware/auth');
const user = await User.create({ email: `logging-verify-${Date.now()}@example.test`, name: 'Log Verify' });
const token = await createSession(String(user._id), 'verify-logging');
await mongoose.disconnect();

// ---- 3. Start the compiled server, capturing stdout/stderr -----------------
const child = spawn(npm, ['start'], {
  cwd: backend, shell: isWindows, windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(port),
    MONGODB_URI: uri,
    FRONTEND_URL: 'http://localhost:3000',
    TRUST_PROXY_HOPS: '0',
    AI_API_KEY: '',
    AI_MODEL: '',
    AI_FALLBACK_API_KEY: '',
    AI_FALLBACK_MODEL: '',
    SERPAPI_KEY: '',
  },
});
let logs = '';
child.stdout.on('data', (chunk) => { logs += String(chunk); });
child.stderr.on('data', (chunk) => { logs += String(chunk); });
let childError;
child.on('error', (error) => { childError = error; });

const base = `http://localhost:${port}`;
const cookie = `${config.auth.cookieName}=${token}`;
const verified = [];
const fail = (message) => {
  console.error(`\nVIOLATION: ${message}`);
  console.error('\n--- captured server logs ---\n' + logs);
  throw new Error(message);
};
const requireLog = (pattern, label) => {
  if (!pattern.test(logs)) fail(`missing log line: ${label}`);
  verified.push(label);
};
const waitForLog = async (pattern, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pattern.test(logs)) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
};

const started = Date.now();
try {
  // ---- 4. Wait until the server is up ------------------------------------
  let healthy = false;
  const startupDeadline = Date.now() + 60000;
  while (Date.now() < startupDeadline) {
    if (childError || child.exitCode !== null) fail('compiled server exited before becoming healthy');
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) { healthy = true; break; }
    } catch { /* the owned child may still be booting */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (!healthy) fail('compiled server never became healthy');

  // Startup lifecycle: database connection (without credentials) and seed jobs.
  const dbConnect = /\[INFO\] \[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \[db\] \[-\] MongoDB connected host=(\S+)/.exec(logs);
  if (!dbConnect) fail('missing MongoDB connection log');
  if (dbConnect[1].includes('@')) fail('MongoDB connection log leaked connection credentials');
  verified.push('database connection logged without credentials');
  requireLog(/\[INFO\].*seed|\[INFO\].*Curated .* bank initialized/, 'startup seeding logged');

  // ---- 5. API route failure: 404 -----------------------------------------
  const notFound = await fetch(`${base}/api/definitely-not-a-route`, {
    headers: { 'X-Request-ID': 'verify-404' },
  });
  if (notFound.status !== 404) fail(`expected 404 for an unknown route, received ${notFound.status}`);
  requireLog(/\[WARN\] .* \[http\] \[GET \/api\/definitely-not-a-route\] Route not found .*requestId=verify-404/,
    'unknown route logged as WARN with request id');

  // ---- 6. Authentication failure: 401 ------------------------------------
  const unauthorized = await fetch(`${base}/api/resume/list`, {
    headers: { 'X-Request-ID': 'verify-401' },
  });
  if (unauthorized.status !== 401) fail(`expected 401 without a session, received ${unauthorized.status}`);
  requireLog(/\[WARN\] .* \[http\] \[GET \/api\/resume\/list\] Client error .*code=UNAUTHORIZED .*requestId=verify-401/,
    'unauthenticated request logged as WARN with request id');

  // ---- 7. Invalid request body: 400 --------------------------------------
  const badBody = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Request-ID': 'verify-400' },
    body: '{"broken"',
  });
  if (badBody.status !== 400) fail(`expected 400 for malformed JSON, received ${badBody.status}`);
  requireLog(/\[WARN\] .* \[http\] \[POST \/api\/auth\/login\] Client error .*code=INVALID_JSON .*requestId=verify-400/,
    'malformed JSON logged as WARN with request id');

  // ---- 8. Invalid resume upload: 400 -------------------------------------
  const form = new FormData();
  form.append('file', new Blob([Buffer.from('%PDF-1.4 not a real resume')], { type: 'application/pdf' }), 'resume.exe');
  const badResume = await fetch(`${base}/api/resume/upload`, {
    method: 'POST', headers: { cookie, 'X-Request-ID': 'verify-resume' }, body: form,
  });
  if (badResume.status !== 400) fail(`expected 400 for an unsupported resume file, received ${badResume.status}`);
  requireLog(/\[WARN\] .* \[http\] \[POST \/api\/resume\/upload\] Client error .*code=BAD_REQUEST .*requestId=verify-resume/,
    'invalid resume logged as WARN with request id');

  // Healthy authenticated database read, so the outage below is the only change.
  const listWhileHealthy = await fetch(`${base}/api/resume/list`, { headers: { cookie } });
  if (listWhileHealthy.status !== 200) fail(`expected 200 for an authenticated resume list, received ${listWhileHealthy.status}`);

  // ---- 9. Database outage: disconnect log, 503 health, 500 request -------
  await db.stop();
  if (!await waitForLog(/\[WARN\] .* \[db\] \[-\] MongoDB disconnected/, 20000)) {
    fail('missing MongoDB disconnected log after the database stopped');
  }
  verified.push('database disconnect logged as WARN');

  const degradedHealth = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(15000) }).catch(() => null);
  if (degradedHealth && degradedHealth.status !== 503) {
    fail(`expected 503 health while the database is down, received ${degradedHealth.status}`);
  }
  if (!await waitForLog(/\[ERROR\] .* \[http\] \[GET \/api\/health\] GET \/api\/health 503/, 15000)) {
    fail('missing ERROR log line for the 503 health response while the database is down');
  }
  verified.push('5xx request completion logged as ERROR');

  const dbFailure = await fetch(`${base}/api/resume/list`, {
    headers: { cookie, 'X-Request-ID': 'verify-db' }, signal: AbortSignal.timeout(30000),
  }).catch(() => null);
  if (dbFailure && dbFailure.status < 500) fail(`expected a 5xx database failure, received ${dbFailure.status}`);
  if (dbFailure) {
    // The failure response must hand the request id back so the frontend error
    // can be matched to this exact log line. Production stack suppression is
    // asserted in tests/unit/logging.test.ts: the production config guard
    // refuses a loopback MONGODB_URI, so it cannot run against this database.
    const body = await dbFailure.clone().json().catch(() => ({}));
    if (body.requestId !== 'verify-db') {
      fail(`database failure response did not echo the request id: ${JSON.stringify(body.requestId)}`);
    }
    verified.push('failure response echoes the request id for frontend correlation');
  }
  if (!await waitForLog(/\[ERROR\] .* \[http\] \[GET \/api\/resume\/list\] Server error .*db=true/, 30000)) {
    fail('missing ERROR log for the database operation failure');
  }
  verified.push('database operation failure logged as ERROR with db=true');

  // ---- 10. Every structured line uses the documented readable format -----
  const structured = logs.split(/\r?\n/).filter((line) => /^\[(DEBUG|INFO|WARN|ERROR)\] /.test(line));
  const canonical = /^\[(DEBUG|INFO|WARN|ERROR)\] \[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \[[a-z_-]+\] \[[^\]]*\] .+/;
  const malformed = structured.find((line) => !canonical.test(line));
  if (malformed) fail(`log line does not follow [LEVEL] [timestamp] [module] [route] message: ${malformed}`);
  verified.push(`${structured.length} structured lines follow the readable format`);

  console.log(JSON.stringify({
    runtimeLoggingVerification: 'passed',
    durationMs: Date.now() - started,
    verified,
  }, null, 2));
} finally {
  // Only the child created by this script is eligible for shutdown.
  if (child.pid && child.exitCode === null) {
    if (isWindows) spawnSync('taskkill', ['/F', '/T', '/PID', String(child.pid)], { windowsHide: true, stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  await db.stop().catch(() => {});
}
