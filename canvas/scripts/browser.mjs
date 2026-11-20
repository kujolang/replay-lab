import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { createLabServer } from '../server.mjs';
import { point } from '../public/camera.mjs';

const mode = process.argv[2];
const artifactDir = resolve(process.env.ARTIFACT_DIR || 'artifacts');
const cli = promisify(execFile);
const clock = (ms) => new Promise((ok) => setTimeout(ok, ms));
const desktop = { width: 1440, height: 1024 };
const channel = process.env.CHROME_CHANNEL === 'bundled' ? undefined : process.env.CHROME_CHANNEL || 'chrome';
const server = await createLabServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const url = 'http://127.0.0.1:' + server.address().port;
let browser;

async function setup(context, query = 'benchmark') {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url + '/?' + query);
  await page.waitForFunction(() => document.querySelectorAll('.field-card').length === 12 && labBenchmark.state().count === 12);
  await page.evaluate(() => document.fonts.ready);
  return { page, errors };
}
const state = (page) => page.evaluate(() => window.labBenchmark.state());
const controls = (page) => page.locator('#stage');
const status = (page, message) => page.waitForFunction((text) =>
  document.querySelector('#operation-text').textContent.includes(text), message);
const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const operate = async (page, action, expected) => {
  await page.locator(`[data-operation="${action}"]`).click();
  await status(page, expected);
};

async function zoomContinuously(page, direction) {
  const box = await controls(page).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let frame = 0; frame < 16; frame++) {
    await page.mouse.wheel(0, direction * 195);
    await clock(26);
  }
}

async function browserTest() {
  const context = await browser.newContext({ viewport: desktop });
  const { page, errors } = await setup(context);
  const first = await state(page);
  const count = () => page.locator('#object-count').textContent();
  assert.equal(await count(), '12');
  const ids = await page.locator('.field-card').evaluateAll((nodes) => nodes.map((node) => node.dataset.card));
  const box = await controls(page).boundingBox();
  const anchor = { x: box.width * .37, y: box.height * .41 };
  await page.mouse.move(box.x + anchor.x, box.y + anchor.y);
  await page.mouse.wheel(0, -214);
  await page.waitForFunction((z) => labBenchmark.state().camera.z > z, first.camera.z);
  const zoomed = await state(page);
  const expected = point(first.camera, anchor.x, anchor.y);
  const actual = point(zoomed.camera, anchor.x, anchor.y);
  near(actual.x, expected.x, 1); near(actual.y, expected.y, 1);
  await page.mouse.wheel(0, 214);
  await page.waitForFunction((z) => Math.abs(labBenchmark.state().camera.z - z) < 1e-6, first.camera.z);
  await page.mouse.move(box.x + 4, box.y + 4);
  await page.mouse.down();
  await page.mouse.move(box.x + 104, box.y + 64, { steps: 6 });
  await page.mouse.up();
  const panned = await state(page);
  near(panned.camera.x - first.camera.x, 100, 1);
  near(panned.camera.y - first.camera.y, 60, 1);
  await controls(page).press('Home');
  await controls(page).press('ArrowLeft');
  near((await state(page)).camera.x, first.camera.x + 48);
  await controls(page).press('+');
  assert.ok((await state(page)).camera.z > first.camera.z);
  await controls(page).press('Home');
  assert.deepEqual(await page.locator('.field-card').evaluateAll((nodes) => nodes.map((node) => node.dataset.card)), ids);
  await page.mouse.click(box.x + 3, box.y + 3);
  await page.waitForFunction(() => labBenchmark.state().ripples > 0);
  assert.equal(await page.locator('#operation-text').textContent(), 'Prepared fixture evidence');
  await page.locator('[data-card="cassette"]').click();
  await page.locator('#inspector summary', { hasText: 'Full evidence' }).click();
  assert.match(await page.locator('#inspector pre').textContent(), /"_cassette_version": 1/);
  await operate(page, 'replay', 'Winning policy · Replayed');
  await page.locator('#compare').click();
  assert.match(await page.locator('#inspector').innerText(), /Both policies use the same cassette/);
  await operate(page, 'evaluate', 'Policy checks · Passed');
  assert.match(await page.locator('#inspector').innerText(), /3\/3 pass/);
  await operate(page, 'execute', 'Routed Review · Completed');
  await page.selectOption('#card-pick', 'step-plan');
  await page.locator('#inspector summary', { hasText: 'Recorded event sequence' }).click();
  assert.match(await page.locator('.trace-list').innerText(), /Step started: Plan Review/);

  await page.selectOption('#mode', 'synthetic');
  await page.evaluate(() => labBenchmark.maximumDensity());
  await page.waitForFunction(() => labBenchmark.state().count > 7000);
  const synthetic = await state(page);
  assert.match(await page.locator('#field-title').textContent(), /Synthetic/);
  assert.equal(await page.locator('.field-card:visible').count(), 0);
  if (synthetic.capabilities.mode === 'WebGL2') assert.ok(synthetic.count > 245000);
  const pixels = async () => (await page.locator('#synthetic-canvas').screenshot()).toString('base64');
  const before = await pixels();
  await clock(300);
  assert.notEqual(await pixels(), before);
  await page.locator('#motion').click();
  await page.waitForFunction(() => document.querySelector('#fps').textContent === 'Paused');
  const frozen = await pixels();
  await clock(300);
  assert.equal(await pixels(), frozen);
  const canLoseContext = await page.evaluate(() => {
    const gl = document.querySelector('#synthetic-canvas').getContext('webgl2');
    const extension = gl?.getExtension('WEBGL_lose_context');
    extension?.loseContext();
    return Boolean(extension);
  });
  if (canLoseContext) {
    await page.waitForFunction(() => labBenchmark.state().capabilities.mode === 'Canvas 2D');
    await page.waitForFunction(() => labBenchmark.state().count <= 8192);
  }
  await page.selectOption('#mode', 'evidence');
  await page.waitForFunction(() => labBenchmark.state().count === 12);
  await context.close();
  assert.deepEqual(errors, []);

  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const { page: mobile, errors: mobileErrors } = await setup(touch, 'benchmark&canvas2d');
  const mobileStage = await controls(mobile).boundingBox();
  const cdp = await touch.newCDPSession(mobile);
  const origin = { x: mobileStage.x + 185, y: mobileStage.y + 100 };
  const initialZoom = (await state(mobile)).camera.z;
  const inputs = (distance) => [-1, 1].map((side, id) => ({ x: origin.x + side * distance, y: origin.y, id }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: inputs(26) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: inputs(69) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.ok((await state(mobile)).camera.z > initialZoom * 1.9);
  await mobile.selectOption('#mode', 'synthetic');
  await mobile.evaluate(() => labBenchmark.maximumDensity());
  await mobile.waitForFunction(() => labBenchmark.state().count > 7000);
  assert.equal((await state(mobile)).capabilities.mode, 'Canvas 2D');
  await mobile.selectOption('#density', '1024');
  await mobile.waitForFunction(() => labBenchmark.state().count <= 1024);
  await touch.close();
  assert.deepEqual(mobileErrors, []);
  console.log('Browser interactions, native operations, touch, motion, and fallback passed.');
}

function distribution(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const p = (fraction) => sorted[Math.floor(fraction * (sorted.length - 1))];
  return { samples: sorted.length, mean: values.reduce((a, b) => a + b, 0) / values.length, p50: p(.5), p95: p(.95), max: sorted.at(-1) };
}

async function processes(cdp) {
  const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
  const { stdout } = await cli('ps', ['-o', 'pid=,rss=', '-p', processInfo.map((item) => item.id).join(',')]).catch(() => ({ stdout: '' }));
  const rss = new Map(stdout.trim().split('\n').map((line) => line.trim().split(/\s+/).map(Number)));
  return processInfo.map((item) => ({ ...item, rssKiB: rss.get(item.id) ?? null }));
}

async function osGPU() {
  if (platform() !== 'darwin') return null;
  const { stdout } = await cli('ioreg', ['-r', '-c', 'IOAccelerator', '-l'], { maxBuffer: 8 * 1024 * 1024 }).catch(() => ({ stdout: '' }));
  return Object.fromEntries([...stdout.matchAll(/"(Device Utilization %|Renderer Utilization %|vramUsedBytes)"=(\d+)/g)]
    .map(([, key, value]) => [key, Number(value)]));
}

async function benchmark() {
  const context = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1 });
  const { page, errors } = await setup(context);
  const system = await browser.newBrowserCDPSession();
  const cdp = await context.newCDPSession(page);
  const duration = Number(process.env.BENCHMARK_MS || 5000);
  const samples = [];
  async function sample(current, label, limit, throttling, currentCdp = cdp) {
    await currentCdp.send('Emulation.setCPUThrottlingRate', { rate: throttling });
    await current.evaluate(({ limit }) => {
      labBenchmark.mode(Boolean(limit));
      if (limit) {
        labBenchmark.limit(limit);
        labBenchmark.maximumDensity();
      }
    }, { limit });
    await clock(850);
    const prior = await processes(system);
    const start = performance.now();
    await current.evaluate(() => labBenchmark.start());
    const gpuRead = clock(duration / 2).then(osGPU);
    await clock(duration);
    const result = await current.evaluate(() => labBenchmark.stop());
    const seconds = (performance.now() - start) / 1000;
    const next = await processes(system);
    const summarise = (filter) => {
      const after = next.filter(filter);
      return {
        cpuPercentOfOneCore: 100 * after.reduce((sum, entry) =>
          sum + Math.max(0, entry.cpuTime - (prior.find(({ id }) => id === entry.id)?.cpuTime ?? entry.cpuTime)), 0) / seconds,
        rssMiB: after.reduce((sum, entry) => sum + (entry.rssKiB ?? 0) / 1024, 0),
      };
    };
    const { usedSize, totalSize } = await currentCdp.send('Runtime.getHeapUsage');
    const cadence = distribution(result.frames.map((item) => item.frame));
    const field = await state(current);
    samples.push({
      profile: label, cpuThrottling: throttling, field: { width: field.width, height: field.height, count: field.count, capabilities: field.capabilities },
      requestedMs: duration, cadenceMs: cadence, meanFps: 1000 / cadence.mean,
      cpuRenderMs: distribution(result.frames.map((item) => item.cpu)),
      gpuDrawMs: distribution(result.gpu),
      browser: summarise(() => true), renderer: summarise(({ type }) => type === 'renderer'),
      gpuProcess: summarise(({ type }) => type === 'GPU'), sharedOsGPU: await gpuRead,
      jsHeapMiB: { used: usedSize / 1048576, reserved: totalSize / 1048576 },
    });
  }
  await sample(page, 'Evidence', 0, 1);
  await sample(page, 'WebGL2 16K', 16384, 1);
  await sample(page, 'WebGL2 65K', 65536, 1);
  await sample(page, 'WebGL2 262K', 262144, 1);
  await sample(page, '262K, throttled renderer', 262144, 4);

  // Reclaim young-generation garbage before sampling, and count renderer objects over repeated mode switches.
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const memory = [];
  for (let cycle = 0; cycle <= 15; cycle++) {
    await page.evaluate(() => {
      labBenchmark.mode(false);
      labBenchmark.mode(true);
      labBenchmark.maximumDensity();
    });
    if (cycle % 5 === 0) {
      await cdp.send('HeapProfiler.collectGarbage');
      const { usedSize } = await cdp.send('Runtime.getHeapUsage');
      const counters = await cdp.send('Memory.getDOMCounters');
      memory.push({ cycle, usedMiB: usedSize / 1048576, ...counters });
    }
  }
  await context.close();
  assert.deepEqual(errors, []);

  const fallback = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mobile = await setup(fallback, 'benchmark&canvas2d');
  const mobileCdp = await fallback.newCDPSession(mobile.page);
  await sample(mobile.page, 'Mobile layout, Canvas 2D fallback', 8192, 1, mobileCdp);
  await sample(mobile.page, 'Mobile layout, Canvas 2D 1K', 1024, 1, mobileCdp);
  await fallback.close();
  assert.deepEqual(mobile.errors, []);
  const machine = { os: platform(), kernel: release(), arch: arch(), cpu: cpus()[0].model, logicalCores: cpus().length, ramGiB: Math.round(totalmem() / 1073741824) };
  await mkdir(artifactDir, { recursive: true });
  const output = { measuredAt: new Date().toISOString(), machine, browserVersion: browser.version(), headed: process.env.HEADED === '1', samples, memory };
  await writeFile(join(artifactDir, 'benchmark.json'), JSON.stringify(output, null, 2) + '\n');
  console.table(samples.map((item) => ({ profile: item.profile, count: item.field.count, fps: item.meanFps.toFixed(1),
    p95ms: item.cadenceMs.p95.toFixed(1), gpuMs: item.gpuDrawMs?.mean.toFixed(2) })));
}

async function tour(page, snapshot) {
  await snapshot('01-execution-field');
  await operate(page, 'execute', 'Routed Review · Completed');
  await page.selectOption('#card-pick', 'step-plan');
  await page.locator('#inspector summary', { hasText: 'Recorded event sequence' }).click();
  await clock(900);
  await operate(page, 'replay', 'Winning policy · Replayed');
  await page.locator('#compare').click();
  await snapshot('02-cassette-comparison');
  await clock(1300);
  await operate(page, 'evaluate', 'Policy checks · Passed');
  await page.selectOption('#card-pick', 'check-1');
  await page.locator('#inspector summary', { hasText: 'Full evidence' }).click();
  await clock(850);
  await controls(page).press('Home');
  await zoomContinuously(page, -1);
  await zoomContinuously(page, 1);
  await page.selectOption('#mode', 'synthetic');
  await zoomContinuously(page, 1);
  await page.waitForFunction(() => labBenchmark.state().count > 245000 ||
    labBenchmark.state().capabilities.mode === 'Canvas 2D' && labBenchmark.state().count > 7000);
  await snapshot('03-synthetic-field');
  await clock(1000);
  await zoomContinuously(page, -1);
  await page.selectOption('#mode', 'evidence');
  await controls(page).press('Home');
  await clock(750);
}

async function capture() {
  await mkdir(artifactDir, { recursive: true });
  const context = await browser.newContext({ viewport: desktop, deviceScaleFactor: 1 });
  const { page, errors } = await setup(context);
  const screenshot = (name) => page.screenshot({ path: join(artifactDir, name + '.png'), fullPage: true });
  await clock(1100);
  await tour(page, screenshot);
  await context.close();
  assert.deepEqual(errors, []);
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const { page: phone } = await setup(mobile);
  await phone.screenshot({ path: join(artifactDir, '04-touch-layout.png'), fullPage: true });
  await mobile.close();

  const recording = join(artifactDir, '.recording');
  const videoContext = await browser.newContext({
    viewport: { width: 1280, height: 940 }, deviceScaleFactor: 1,
    recordVideo: { dir: recording, size: { width: 960, height: 704 } },
  });
  const videoPage = await setup(videoContext);
  await tour(videoPage.page, () => {});
  await videoContext.close();
  assert.deepEqual(videoPage.errors, []);
  const video = await videoPage.page.video().path();
  await rename(video, join(artifactDir, 'replay-lab-demo.webm'));
  await rm(recording, { recursive: true, force: true });
}

try {
  browser = await chromium.launch({ channel, headless: process.env.HEADED !== '1', args: ['--enable-gpu'] });
  if (mode === 'test') await browserTest();
  else if (mode === 'benchmark') await benchmark();
  else if (mode === 'capture') await capture();
  else throw new Error('Use test, benchmark, or capture.');
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
