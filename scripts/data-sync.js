const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npmExecPath = process.env.npm_execpath;

const defaultPaths = [
  'feeds/drivers.json',
  'feeds/drivers.xml',
  'feeds/drivers-delta.json',
  'feeds/trust-metrics.json',
  'feeds/audio-drivers.json',
  'feeds/network-drivers.json'
];

const extraPaths = String(process.env.DATA_SYNC_EXTRA || '')
  .split(path.delimiter)
  .map((item) => item.trim())
  .filter(Boolean);

const monitoredPaths = Array.from(new Set([...defaultPaths, ...extraPaths].map((entry) => path.resolve(rootDir, entry))));

function readHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function takeSnapshot(paths) {
  const snapshot = new Map();
  paths.forEach((filePath) => {
    snapshot.set(filePath, readHash(filePath));
  });
  return snapshot;
}

function runScript(scriptName) {
  const command = npmExecPath ? process.execPath : npmCmd;
  const args = npmExecPath ? [npmExecPath, 'run', scriptName] : ['run', scriptName];
  const result = spawnSync(command, args, { cwd: rootDir, stdio: 'inherit' });

  if (result.error) {
    return {
      ok: false,
      status: 1,
      error: result.error
    };
  }

  const status = typeof result.status === 'number' ? result.status : 1;
  return {
    ok: status === 0,
    status,
    error: null
  };
}

function formatPath(filePath) {
  const rel = path.relative(rootDir, filePath);
  return rel || filePath;
}

function printChangedPaths(before, after) {
  const changed = [];
  monitoredPaths.forEach((filePath) => {
    if (before.get(filePath) !== after.get(filePath)) {
      changed.push(formatPath(filePath));
    }
  });

  if (!changed.length) {
    process.stdout.write('Changed files: none\n');
    return;
  }

  process.stdout.write('Changed files:\n');
  changed.forEach((entry) => process.stdout.write(`- ${entry}\n`));
}

function main() {
  const before = takeSnapshot(monitoredPaths);

  const build = runScript('build:feeds');
  if (!build.ok) {
    if (build.error) {
      process.stderr.write(`${String(build.error.message || build.error)}\n`);
    }
    process.stderr.write('data:sync failed: build:feeds\n');
    process.exit(build.status);
  }

  const test = runScript('test:data');
  const after = takeSnapshot(monitoredPaths);
  printChangedPaths(before, after);

  if (!test.ok) {
    if (test.error) {
      process.stderr.write(`${String(test.error.message || test.error)}\n`);
    }
    process.stderr.write('data:sync failed: test:data\n');
    process.exit(test.status);
  }

  process.stdout.write('data:sync passed: build + validation complete\n');
}

main();
