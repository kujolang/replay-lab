import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { canvas, operations, scenarioOrder } from '../scenarios.mjs';

const args = process.argv.slice(2);
const names = args.length === 0 || args[0] === '--write' ? scenarioOrder : args;
if (names.some((name) => !scenarioOrder.includes(name))) {
  throw new Error('Use replay, evaluate, execute, or --write to refresh the published snapshot.');
}
const scenarios = {};
for (const name of names) scenarios[name] = await operations[name]();
const snapshot = { preparedAt: new Date().toISOString(), scenarios };
const json = JSON.stringify(snapshot, null, 2) + '\n';
if (args[0] === '--write') {
  const publicDir = join(canvas, 'public');
  const staging = await mkdtemp(join(canvas, '.snapshot-'));
  try {
    const file = join(staging, 'snapshot.json');
    await writeFile(file, json, { flag: 'wx' });
    await rename(file, join(publicDir, 'snapshot.json'));
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
} else {
  process.stdout.write(json);
}
