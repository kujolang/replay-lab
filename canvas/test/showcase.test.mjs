import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { cameraAt, logoAt, project, scene, waveField, worldAt, zoomAt } from '../public/choreography.mjs';
import { evidenceFor } from '../public/visual-evidence.mjs';

const w = 1280, h = 720;
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} versus ${b}`);

test('showcase projection scales continuously through the act boundaries', () => {
  for (const cue of [scene.activation, scene.expansion, scene.scale, scene.formation, scene.hold]) {
    const before = cameraAt(cue - 1e-6, w, h);
    const after = cameraAt(cue + 1e-6, w, h);
    near(before.pitch, after.pitch, .001);
    near(before.x, after.x, .001);
    near(before.y, after.y, .001);
  }
  const counts = [0, 4.8, 9.2, 13.4].map((t) => project(cameraAt(t, w, h), w, h).count);
  assert.ok(counts[0] < 60 && counts[1] > 250 && counts[2] > 10000 && counts[3] > 140000);
  assert.equal(logoAt(scene.formation, w, h).amount, 0);
  assert.equal(logoAt(scene.hold + .1, w, h).amount, 1);
});

test('a cell projects to the same anchor through zoom and reverse', () => {
  const start = cameraAt(11, w, h);
  const anchor = worldAt(start, 485, 317, w, h);
  const zoomed = zoomAt(start, 485, 317, start.pitch * 2.9, w, h);
  const projected = worldAt(zoomed, 485, 317, w, h);
  near(projected.x, anchor.x);
  near(projected.y, anchor.y);
  const reversed = zoomAt(zoomed, 485, 317, start.pitch, w, h);
  near(reversed.x, start.x);
  near(reversed.y, start.y);
});

test('showcase swells stay sparse and have fixed world origins', () => {
  const first = waveField(15.9, w, h);
  assert.equal(first.length, 1);
  assert.deepEqual(first, waveField(16.1, w, h));
  assert.ok(first.every((wave) => wave.velocity > 0));
  for (let t = 8; t <= 23; t += .05) assert.ok(waveField(t, w, h).length <= 1);
  assert.equal(waveField(23, w, h).length, 0);
});

test('cards and plain-language captions reflect the saved results', () => {
  const fixture = JSON.parse(readFileSync(new URL('../public/snapshot.json', import.meta.url)));
  const evidence = evidenceFor(fixture);
  assert.equal(evidence.cards.length, 12);
  assert.equal(evidence.cards[0].title, 'Original decision');
  assert.match(evidence.cards[0].result, /P3/);
  assert.match(evidence.cards[1].result, /P1/);
  assert.equal(evidence.cards[7].result, 'Review required');
  assert.equal(evidence.labels.length, 3);
  assert.match(evidence.labels[0][2], /reproduced the original decision/);
  assert.match(evidence.labels[1][2], /human review/);
  assert.match(evidence.labels[2][2], /review plan and the report/);
  fixture.scenarios.replay[3].evidence.comparison.baselineMatches = false;
  fixture.scenarios.replay[3].state = 'Mismatch';
  fixture.scenarios.evaluate[0].evidence.output.data.passed = 2;
  fixture.scenarios.evaluate[0].state = 'Failed';
  fixture.scenarios.execute[0].evidence.state.steps[1].status = 'failed';
  const changed = evidenceFor(fixture);
  assert.equal(changed.cards[3].state, 'Mismatch');
  assert.equal(changed.cards[4].tone, 3);
  assert.match(changed.labels[0][2], /differed/);
  assert.match(changed.labels[1][2], /shows which checks failed/);
  assert.match(changed.labels[2][2], /where work stopped/);
});
