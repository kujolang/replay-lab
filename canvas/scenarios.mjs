import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { performance } from 'node:perf_hooks';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const canvas = join(root, 'canvas');
const sibling = (env, name) => resolve(process.env[env] || join(root, '..', name));
const runtime = process.env.KUJO_BIN || 'kujo';
const evalRoot = sibling('EVAL_ROOT', 'eval');
const dispatchRoot = sibling('DISPATCH_ROOT', 'dispatch');
const run = promisify(execFile);
export const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const local = (path) => readJson(join(root, path));
const triageUrl = 'https://github.com/kujolang/replay-lab/blob/757e25f/';
const dispatchUrl = 'https://github.com/kujolang/dispatch/blob/18b5c73/';
const evalUrl = 'https://github.com/kujolang/eval/blob/c1b263a/';

async function command(program, args, cwd, extra = {}) {
  const start = performance.now();
  const { stdout } = await run(program, args, {
    cwd, timeout: 25_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true,
    env: { PATH: process.env.PATH, LANG: 'C.UTF-8', KUJO_BIN: runtime, ...extra },
  });
  return { stdout, ms: Math.round(performance.now() - start) };
}

async function temporary(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'kujo-canvas-'));
  try { return await fn(dir); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

export function compareDecisions(original, baseline, winner) {
  const changed = Object.keys({ ...baseline.decision, ...winner.decision })
    .filter((field) => !isDeepStrictEqual(baseline.decision[field], winner.decision[field]))
    .map((field) => ({ field, baseline: baseline.decision[field], winner: winner.decision[field] }));
  return {
    baselineMatches: isDeepStrictEqual(original, baseline),
    sameCassette: original.request_hash === baseline.request_hash && baseline.request_hash === winner.request_hash,
    changed,
  };
}

async function replayOutput() {
  const issue = 'scenarios/example.json';
  const policy = 'results/winner-policy.json';
  const inputs = await local(issue);
  const original = await local('video/visual-data/baseline-terminal.json');
  const baselineRun = await command(join(root, 'tools/lab'), ['triage', issue], root);
  const winnerRun = await command(join(root, 'tools/lab'), ['triage', issue, policy], root);
  const baseline = JSON.parse(baselineRun.stdout);
  const winner = JSON.parse(winnerRun.stdout);
  if (![baseline, winner].every(({ request_hash: hash, replay_error: error }) =>
    /^[a-f0-9]{64}$/.test(hash) && error === null)) throw new Error('Native replay did not return valid evidence.');
  return { inputs, original, baseline, winner, baselineMs: baselineRun.ms, winnerMs: winnerRun.ms };
}

export async function replay() {
  const { inputs, original, baseline, winner, baselineMs, winnerMs } = await replayOutput();
  const cassettePath = `cassettes/${baseline.request_hash}.json`;
  const cassette = await local(cassettePath);
  const comparison = compareDecisions(original, baseline, winner);
  const cards = [
    { id: 'baseline', type: 'Replay', title: 'Baseline policy', state: 'Replayed', metric: baseline.decision.priority, note: baseline.decision.action, duration: baselineMs,
      reference: 'src/main.kujo', url: triageUrl + 'src/main.kujo',
      evidence: { input: inputs, output: baseline, provenance: 'Fresh strict replay with the baseline policy. Duration is subprocess wall time.' } },
    { id: 'winner', type: 'Replay', title: 'Winning policy', state: 'Replayed', metric: winner.decision.priority, note: winner.decision.action, duration: winnerMs,
      reference: 'results/winner-policy.json', url: triageUrl + 'results/winner-policy.json',
      evidence: { input: inputs, policy: await local('results/winner-policy.json'), output: winner, provenance: 'Fresh strict replay with the winning policy.' } },
    { id: 'cassette', type: 'Cassette', title: 'Classifier response', state: 'Recorded', metric: 'HTTP ' + cassette.response.status, note: cassette.request_meta.model,
      reference: cassettePath, url: triageUrl + cassettePath,
      evidence: { ...cassette, provenance: 'Recorded native HTTP envelope from the scripted loopback classifier. The response body contains the model reply.' } },
    { id: 'compare', type: 'Compare', title: 'Decision delta', state: comparison.baselineMatches && comparison.sameCassette ? 'Matched' : 'Mismatch',
      metric: comparison.changed.length + ' changed', note: comparison.sameCassette ? 'Same cassette' : 'Cassette changed',
      reference: 'video/visual-data/baseline-terminal.json', url: triageUrl + 'video/visual-data/baseline-terminal.json',
      evidence: { comparison, original, baseline, winner, provenance: 'The published baseline was also produced by strict replay. Identical response, two different policies.' } },
  ];
  return cards;
}

export async function evaluate() {
  const { baseline, winner } = await replayOutput();
  return temporary(async (dir) => {
    await Promise.all([
      writeFile(join(dir, 'baseline.json'), JSON.stringify(baseline)),
      writeFile(join(dir, 'winner.json'), JSON.stringify(winner)),
    ]);
    const result = await command(runtime, ['run', join(evalRoot, 'main.kujo'), 'run', join(canvas, 'replay.eval.json'),
      '--output-dir', join(dir, 'eval_results'), '--json'], dir).catch((error) => {
      // Eval exits nonzero for failed assertions and still emits the native envelope.
      if (error.code === 1 && error.stdout) return { stdout: error.stdout };
      throw error;
    });
    const report = JSON.parse(result.stdout);
    const data = report.data;
    if (!data || !Array.isArray(data.test_results)) throw new Error(report.error || 'No Eval results.');
    const url = evalUrl + 'main.kujo';
    return [
      { id: 'eval', type: 'Eval', title: 'Policy checks', state: data.failed ? 'Failed' : 'Passed',
        metric: `${data.passed}/${data.total} pass`, note: 'Replay output checks', duration: data.duration_ms,
        reference: 'canvas/replay.eval.json', url,
        evidence: { suite: await readJson(join(canvas, 'replay.eval.json')), inputs: { baseline, winner }, output: report } },
      ...data.test_results.map((check, index) => ({
        id: 'check-' + index, type: 'Check', title: check.name, state: check.skipped ? 'Skipped' : check.passed ? 'Passed' : 'Failed',
        metric: check.details?.actual ?? '—', note: check.details?.json_path || check.check,
        reference: 'Eval test_results[' + index + ']', url, evidence: check,
      })),
    ];
  });
}

async function findDispatchRun(dir) {
  const outputs = join(dir, 'outputs');
  const names = await readdir(outputs);
  const name = names.find((entry) => /^run-[\d-]+$/.test(entry));
  return name ? join(outputs, name) : null;
}

export async function execute(progress = () => {}) {
  return temporary(async (dir) => {
    const topic = 'Review an offline evidence package';
    let polling = false;
    const timer = setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const runPath = await findDispatchRun(dir);
        if (!runPath) return;
        const trace = await readJson(join(runPath, 'trace.json'));
        progress(trace.events.at(-1));
      } catch (error) {
        if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) console.error(error.message);
      } finally { polling = false; }
    }, 120);
    timer.unref();
    let operation;
    try {
      operation = await command(runtime, [
        'run', join(dispatchRoot, 'dispatch.kujo'), 'demo', topic,
        '--workflow-file', join(dispatchRoot, 'examples/workflows/routed-review.json'), '--yes', '--non-interactive',
      ], dir, { DISPATCH_OFFLINE_FIXTURE: 'true', DISPATCH_ROOT: dispatchRoot }).catch((error) => {
        // Preserve native failure evidence if the runner persisted a run before exiting.
        if (typeof error.code === 'number' && !error.killed) return { failure: error.code };
        throw error;
      });
    } finally { clearInterval(timer); }
    const runPath = await findDispatchRun(dir);
    if (!runPath) throw new Error('Dispatch produced no run evidence.');
    const [state, trace, report, definition, receipt] = await Promise.all([
      ...['state', 'trace', 'report'].map((name) => readJson(join(runPath, name + '.json'))),
      readJson(join(dispatchRoot, 'examples/workflows/routed-review.json')),
      local('results/runledger-receipt.json'),
    ]);
    const url = dispatchUrl + 'examples/workflows/routed-review.json';
    const cards = [
      { id: 'workflow', type: 'Dispatch', title: definition.name, state: state.status, nativeId: state.run_id,
        metric: state.budget_usage.steps + ' steps', note: state.budget_usage.total_tokens + ' fixture tokens',
        duration: state.budget_usage.elapsed_ms, reference: state.run_id + '/state.json', url,
        evidence: { input: { topic }, state, trace, report, provenance: 'Live Dispatch execution with offline model fixtures. Token and cost fields come from budget_usage and are fixture accounting.', processExitCode: operation.failure ?? 0 } },
    ];
    for (const step of definition.steps) {
      const events = trace.events.filter((event) => event.step_id === step.id);
      const result = state.step_results?.[step.id];
      const terminal = events.findLast((event) => /^step_(completed|failed|skipped)$/.test(event.type));
      cards.push({
        id: 'step-' + step.id, type: 'Step', title: step.name, state: result?.status || terminal?.type.slice(5) || (events.length ? 'Started' : 'Pending'),
        metric: step.type, note: step.agent_id || step.output_key,
        reference: state.run_id + '/trace.json', url,
        evidence: { run_id: state.run_id, step, events, result, output: state.data[step.output_key] },
      });
    }
    cards.push({ id: 'receipt', type: 'RunLedger', title: 'Study receipt', state: receipt.status, nativeId: receipt.id,
      metric: receipt.provider, note: receipt.model,
      reference: 'results/runledger-receipt.json', url: triageUrl + 'results/runledger-receipt.json',
      evidence: { receipt, provenance: 'Published receipt from the earlier 200-candidate study. Separate from Dispatch and browser operations.' } });
    return cards;
  });
}

export const operations = { execute, replay, evaluate };
export const scenarioOrder = ['replay', 'evaluate', 'execute'];
