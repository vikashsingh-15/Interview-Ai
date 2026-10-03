#!/usr/bin/env node
/**
 * Free the local dev ports (mongod, backend, frontend).
 *
 * Child processes are included: killing the Next dev server or ts-node-dev
 * listener leaves the supervising parent alive, which respawns it on the next
 * file save and makes the port look permanently occupied.
 */
import { spawnSync } from 'node:child_process';

const PORTS = [
  { port: 27017, name: 'mongod' },
  { port: 3001, name: 'backend' },
  { port: 3000, name: 'frontend' },
];

function pidsOnPort(port) {
  if (process.platform !== 'win32') return [];
  // Plain `netstat -ano`: adding `-p TCP` returns empty output on some Windows
  // hosts, which silently reported every port as free.
  const result = spawnSync('netstat', ['-ano'], { encoding: 'utf8' });
  if (result.status !== 0) return [];
  const pids = new Set();
  for (const line of (result.stdout ?? '').split('\n')) {
    const columns = line.trim().split(/\s+/);
    const [protocol, local, , state, pid] = columns;
    if (protocol?.toUpperCase() !== 'TCP' || state?.toUpperCase() !== 'LISTENING') continue;
    // Local address is [::1]:3001 or 0.0.0.0:3000.
    if (!local?.endsWith(`:${port}`)) continue;
    if (pid && pid !== '0') pids.add(pid);
  }
  return [...pids];
}

function stop(pid) {
  const [command, args] = process.platform === 'win32'
    ? ['taskkill', ['/F', '/T', '/PID', pid]]
    : ['kill', ['-TERM', `-${pid}`]];
  return spawnSync(command, args, { stdio: 'ignore' }).status === 0;
}

let stopped = 0;
for (const { port, name } of PORTS) {
  const pids = pidsOnPort(port);
  if (!pids.length) {
    console.log(`[${name}] ${port} is free`);
    continue;
  }
  for (const pid of pids) {
    if (stop(pid)) {
      stopped += 1;
      console.log(`[${name}] stopped pid ${pid} on ${port}`);
    } else {
      console.error(`[${name}] could not stop pid ${pid} on ${port}`);
      process.exitCode = 1;
    }
  }
}
console.log(stopped ? '\nAll dev servers stopped.' : '\nNothing was running.');