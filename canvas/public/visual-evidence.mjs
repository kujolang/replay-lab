import { scene } from './choreography.mjs';

const tone = (value) => {
  if (/mismatch|fail|error/i.test(value)) return 3;
  if (/recorded|running|pending/i.test(value)) return 4;
  if (/replayed/i.test(value)) return 1;
  if (/pass|match/i.test(value)) return 0;
  if (/complete/i.test(value)) return 2;
  return 5;
};

const cardDescriptions = {
  baseline: ['MODEL REPLAY', 'Original decision', (r) => `Priority ${r.metric} · ${r.note.replaceAll('_', ' ')}`],
  winner: ['MODEL REPLAY', 'Revised decision', (r) => `Priority ${r.metric} · ${r.note.replaceAll('_', ' ')}`],
  cassette: ['SAVED RESPONSE', 'Model response', (r) => `${r.metric} · Stored for reuse`],
  compare: ['COMPARISON', 'Decision changes', (r) => r.evidence.comparison.sameCassette ? 'Two policies · Same response' : 'Response changed'],
  eval: ['EVALUATION', 'Release checks', (r) => r.metric],
  'check-0': ['ASSERTION', 'Original priority', (r) => `Observed ${r.metric}`],
  'check-1': ['ASSERTION', 'Escalation priority', (r) => `Observed ${r.metric}`],
  'check-2': ['ASSERTION', 'Human review', (r) => r.metric === 'true' ? 'Review required' : 'Review not required'],
  workflow: ['WORKFLOW', 'Routed review', (r) => r.metric],
  'step-plan': ['WORKFLOW STEP', 'Plan the review', () => 'Planner agent'],
  'step-finalize': ['WORKFLOW STEP', 'Write the report', () => 'Final output'],
  receipt: ['EXECUTION RECEIPT', 'Study record', () => 'RunLedger audit trail'],
};

export function evidenceFor(snapshot) {
  const groups = snapshot.scenarios;
  const records = ['replay', 'evaluate', 'execute'].flatMap((group) => groups[group] || []);
  const byId = new Map(records.map((record) => [record.id, record]));
  const cards = Object.entries(cardDescriptions).map(([id, [kind, title, result]]) => {
    const record = byId.get(id);
    if (!record) return null;
    return { kind, title, result: result(record), state: record.state, tone: tone(record.state) };
  });
  const comparison = byId.get('compare')?.evidence.comparison;
  const evaluation = byId.get('eval')?.evidence.output.data;
  const dispatch = byId.get('workflow')?.evidence.state;
  const completed = dispatch?.steps?.filter(({ status }) => status === 'completed').length ?? 0;
  const labels = [];
  if (comparison) {
    const matched = comparison.baselineMatches && comparison.sameCassette;
    labels.push([scene.replay, 'Rerun without another model call', matched
      ? 'A saved model response reproduced the original decision.'
      : 'The saved run and the replay differed. Kujo shows where.']);
  }
  if (evaluation) labels.push([scene.evaluation, 'Check policy changes before release',
    evaluation.passed === evaluation.total
      ? 'The revised rules escalated the issue and requested human review.'
      : 'Kujo shows which checks failed so you can inspect the change.']);
  if (dispatch) labels.push([scene.workflow, 'See what happened at each step',
    completed === dispatch.steps?.length && completed > 0
      ? 'The workflow records the review plan and the report it produced.'
      : 'The workflow trace shows which steps finished and where work stopped.']);
  return { cards, labels };
}

export async function loadEvidence() {
  const request = await fetch('/api/state').catch(() => null);
  const response = request?.ok ? request : await fetch('/snapshot.json');
  if (!response.ok) throw new Error('Execution evidence unavailable');
  return evidenceFor(await response.json());
}
