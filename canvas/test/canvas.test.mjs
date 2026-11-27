import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { cardPosition, fit, minimumScale, pinch, point, visibleGrid, zoomAt } from '../public/camera.mjs';
import { compareDecisions, evaluate, execute, replay } from '../scenarios.mjs';
import { createLabServer } from '../server.mjs';

const almost = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const closePoints = (actual, expected) => {
  almost(actual.x, expected.x);
  almost(actual.y, expected.y);
};

test('wheel zoom reverses at a pointer anchor and preserves its world coordinates', () => {
  const origin = fit(900, 500);
  const target = zoomAt(origin, 219, 372, origin.z * 2, .01, 3.4);
  closePoints(point(target, 219, 372), point(origin, 219, 372));
  const back = zoomAt(target, 219, 372, origin.z, .01, 3.4);
  closePoints(back, origin);
  almost(back.z, origin.z);
});

test('pinch keeps the world anchor under the moving gesture midpoint', () => {
  const origin = fit(390, 422, 2);
  const from = { x: 240, y: 105, distance: 60 };
  const to = { x: 201, y: 152, distance: 85 };
  const result = pinch(origin, from, to, .01, 3.4);
  closePoints(point(result, to.x, to.y), point(origin, from.x, from.y));
  almost(result.z, origin.z * 85 / 60);
  assert.equal(new Set(Array.from({ length: 12 }, (_, index) => JSON.stringify(cardPosition(index, 2)))).size, 12);
});

test('grid includes the viewport edges and respects density at different origins and sizes', () => {
  for (const [width, height] of [[390, 420], [1110, 450], [3456, 2234]]) {
    for (const limit of [8192, 16384, 65536, 262144]) {
      const z = minimumScale(width, height, limit);
      for (const x of [0, .5, 10000.123, -542.45]) {
        const grid = visibleGrid({ x, y: -x / 3, z }, width, height);
        assert.ok(grid.count <= limit && grid.count > limit * .85);
      }
    }
  }
});

test('decision delta identifies drift without fabricating a changed cassette', () => {
  const first = { decision: { priority: 'P3', human_review: false }, request_hash: 'one', replay_error: null };
  const second = { decision: { priority: 'P1', human_review: true }, request_hash: 'one', replay_error: null };
  const result = compareDecisions(first, first, second);
  assert.equal(result.baselineMatches, true);
  assert.equal(result.sameCassette, true);
  assert.deepEqual(result.changed.map((entry) => entry.field), ['priority', 'human_review']);
  assert.equal(compareDecisions(first, second, { ...second, request_hash: 'two' }).sameCassette, false);
});

test('loopback API serializes operations, rejects foreign origins, and recovers from runner failures', async () => {
  let resume;
  const wait = new Promise((resolve) => { resume = resolve; });
  const server = await createLabServer({ actions: {
    replay: () => wait,
    evaluate: async () => { throw new Error('Expected test failure'); },
  } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = 'http://127.0.0.1:' + server.address().port;
  const get = async () => (await fetch(url + '/api/state')).json();
  const post = (route, origin = url, body) => fetch(url + '/api/' + route,
    { method: 'POST', body, headers: { Origin: origin, 'X-Replay-Lab': '1' } });
  const progress = async () => (await fetch(url + '/api/progress')).json();
  try {
    assert.equal((await post('replay', 'https://elsewhere.example')).status, 403);
    assert.equal((await post('replay', url, 'unexpected')).status, 400);
    assert.equal((await fetch(url + '/api/replay')).status, 404);
    assert.equal((await fetch(url + '/%2e%2e%2fscenarios.mjs')).status, 404);
    const font = await fetch(url + '/vendor/fonts/DepartureMono-Regular.woff', { method: 'HEAD' });
    assert.equal(font.status, 200);
    assert.equal(font.headers.get('content-type'), 'font/woff');
    assert.deepEqual(await progress(), { active: null });
    const initial = await get();
    assert.equal(Object.values(initial.scenarios).flat().length, 12);
    const pending = post('replay');
    let active;
    for (let attempt = 0; attempt < 100 && !active; attempt++) {
      const update = await progress();
      assert.deepEqual(Object.keys(update), ['active']);
      active = update.active;
      if (!active) await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(active?.action, 'replay');
    assert.equal((await post('evaluate')).status, 409);
    resume(initial.scenarios.replay);
    assert.equal((await pending).status, 200);
    assert.equal((await post('evaluate')).status, 422);
    const final = await get();
    assert.equal(final.active, null);
    assert.deepEqual(await progress(), { active: null });
    assert.deepEqual(final.scenarios.evaluate, initial.scenarios.evaluate);
    assert.ok(final.updated.replay);
  } finally {
    resume();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('native cassette, Eval, and Dispatch artifacts agree with their cards', { skip: !process.env.TEST_NATIVE }, async () => {
  const [baseline, winner, cassette, comparison] = await replay();
  assert.equal(baseline.evidence.output.request_hash, cassette.evidence.request_meta.hash);
  assert.equal(winner.evidence.output.request_hash, cassette.evidence.request_meta.hash);
  assert.equal(comparison.evidence.comparison.baselineMatches, true);
  assert.equal(JSON.parse(JSON.parse(cassette.evidence.response.body).choices[0].message.content).confidence, 91);
  const [suite, ...checks] = await evaluate();
  assert.equal(suite.evidence.output.data.passed, 3);
  assert.ok(checks.every((card) => card.evidence.passed));
  const [workflow, plan, finalize, receipt] = await execute();
  assert.equal(workflow.evidence.state.status, 'completed');
  assert.equal(plan.evidence.result.status, 'completed');
  assert.ok(plan.duration >= 0);
  assert.ok(plan.evidence.events.some((event) => event.type === 'model_call_completed'));
  assert.ok(finalize.evidence.events.some((event) => event.type === 'step_completed'));
  assert.notEqual(receipt.nativeId, workflow.nativeId);
});
