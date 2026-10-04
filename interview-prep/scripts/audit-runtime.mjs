// Isolated compiled-server health smoke. --live adds read-only configured DB and minimal provider probes.
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireBackend = createRequire(path.join(root, 'backend', 'package.json'));
const mongoose = requireBackend('mongoose');
const { MongoMemoryServer } = requireBackend('mongodb-memory-server');
const config = requireBackend('./dist/config').default;
requireBackend('./dist/config/logger').default.silent = true;

if (process.argv.includes('--live')) {
  try {
    await mongoose.connect(config.database.uri, { serverSelectionTimeoutMS: 10000, autoIndex: false, autoCreate: false });
    await mongoose.connection.db.command({ ping: 1 });
    console.log(JSON.stringify({ configuredDatabase: 'connected', hostedUri: !/localhost|127\.0\.0\.1/.test(config.database.uri) }));
  } catch (error) {
    // URI/credentials may occur in driver error messages; never print them.
    console.log(JSON.stringify({ configuredDatabase: 'unverified', errorName: error.name, errorCode: error.code || null }));
  } finally { await mongoose.disconnect(); }
  const provider = requireBackend('./dist/common/services/ai-provider');
  const { extractJsonObject } = requireBackend('./dist/common/services/structured-ai');
  if (!provider.hasAI()) console.log(JSON.stringify({ configuredAI: 'not_configured' }));
  else {
    try {
      const result = await provider.withAIFallback(async (client, candidate) => {
        const response = await client.chat.completions.create({ model: candidate.model, max_tokens: 256,
          response_format: { type: 'json_object' }, messages: [{ role: 'user', content: 'Return only the JSON object {"audit":true}.' }] });
        const content = response.choices[0]?.message?.content || '';
        if (extractJsonObject(content).audit !== true) throw new Error('Unexpected audit response');
        return { value: true, provider: candidate.name, model: candidate.model };
      });
      console.log(JSON.stringify({ configuredAI: 'verified_minimal_json_response', provider: result.provider, model: result.model }));
    } catch (error) { console.log(JSON.stringify({ configuredAI: 'unverified', errorName: error.name, status: error.status || null,
      reason: /JSON|audit response/i.test(error.message) ? 'unusable_json_response' : 'provider_request_failed' })); }
  }
}
if (process.argv.includes('--live-only')) process.exit(0);

const probe = net.createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const db = await MongoMemoryServer.create();
const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['start'], {
  cwd: path.join(root, 'backend'), shell: process.platform === 'win32', windowsHide: true,
  stdio: 'ignore', env: { ...process.env, NODE_ENV: 'test', PORT: String(port), MONGODB_URI: db.getUri(),
    GOOGLE_CLIENT_ID: 'fixture-client', GOOGLE_CLIENT_SECRET: 'fixture-secret',
    AI_API_KEY: '', AI_MODEL: '', AI_FALLBACK_API_KEY: '', AI_FALLBACK_MODEL: '', TRUST_PROXY_HOPS: '0' },
});
let childError;
child.on('error', error => { childError = error; });
try {
  let response;
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (childError || child.exitCode !== null) throw new Error('Compiled server failed to start');
    try {
      const res = await fetch(`http://localhost:${port}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) { response = await res.json(); break; }
    } catch { /* wait for owned child */ }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  if (response?.database !== 'connected') throw new Error('Compiled-server database health was not ready');
  const auth = await fetch(`http://localhost:${port}/api/auth/me`);
  if (auth.status !== 401) throw new Error('Authentication boundary failed');
  const csrf = await fetch(`http://localhost:${port}/api/topics/practice`, { method: 'POST', headers: { Origin: 'https://untrusted.example' } });
  if (csrf.status !== 403) throw new Error('Origin boundary failed');
  console.log(JSON.stringify({ compiledNpmStart: 'passed', isolatedDatabase: 'connected', health: 200, unauthenticated: 401, untrustedOrigin: 403 }));
} finally {
  // Only the child created above is eligible for shutdown.
  if (child.pid && child.exitCode === null) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/F', '/T', '/PID', String(child.pid)], { windowsHide: true, stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  await db.stop();
}
