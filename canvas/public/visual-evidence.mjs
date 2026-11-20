import { scene } from './choreography.mjs';

const tone = (value) => {
  if (/mismatch|fail|error/i.test(value)) return 3;
  if (/recorded|running|pending/i.test(value)) return 4;
  if (/replayed/i.test(value)) return 1;
  if (/pass|match/i.test(value)) return 0;
  if (/complete/i.test(value)) return 2;
  return 5;
};

export function evidenceFor(snapshot) {
  const groups = snapshot.scenarios;
  const records = ['replay', 'evaluate', 'execute'].flatMap((group) => groups[group] || []);
  const signals = new Float32Array(24);
  for (const [index, record] of records.slice(0, 12).entries()) {
    signals[index * 2] = tone(record.state);
    signals[index * 2 + 1] = 1;
  }
  const comparison = records.find(({ id }) => id === 'compare')?.evidence.comparison;
  const evalResult = records.find(({ id }) => id === 'eval')?.evidence.output.data;
  const dispatch = records.find(({ id }) => id === 'workflow')?.evidence.state;
  const completed = dispatch?.steps?.filter(({ status }) => status === 'completed').length;
  const labels = [];
  if (comparison) labels.push([scene.replay, 'REPLAY', comparison.baselineMatches ?
    (comparison.sameCassette ? 'Baseline matched · Same cassette' : 'Baseline matched · Cassette changed') : 'Baseline diverged']);
  if (evalResult) labels.push([scene.evaluation, 'EVALUATE', `${evalResult.passed}/${evalResult.total} checks passed`]);
  if (dispatch) labels.push([scene.workflow, 'DISPATCH', `${completed ?? 0}/${dispatch.steps?.length ?? 0} steps completed`]);
  return { signals, labels, count: records.length };
}

export async function loadEvidence() {
  const request = await fetch('/api/state').catch(() => null);
  const response = request?.ok ? request : await fetch('/snapshot.json');
  if (!response.ok) throw new Error('Execution evidence unavailable');
  return evidenceFor(await response.json());
}
