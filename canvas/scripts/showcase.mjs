import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, open, rm, stat, writeFile } from 'node:fs/promises';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { createLabServer } from '../server.mjs';
import { scene, worldAt } from '../public/choreography.mjs';

const mode = process.argv[2];
const artifacts = resolve(process.env.ARTIFACT_DIR || './artifacts/immersive');
const size = { width: 1280, height: 720 };
const headed = process.env.HEADED === '1' || (mode === 'export' && process.env.HEADED !== '0');
const cli = promisify(execFile);
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const server = await createLabServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const url = 'http://127.0.0.1:' + server.address().port;
const channel = process.env.CHROME_CHANNEL === 'bundled' ? undefined : process.env.CHROME_CHANNEL || 'chrome';
let browser;

async function setup(viewport = size, options = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, ...options });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(url + '/?render');
  await page.waitForFunction(() => window.kujoShowcase || !document.querySelector('#failure').hidden);
  if (await page.locator('#failure').isVisible()) throw new Error(errors.join('\n') || 'The renderer could not start.');
  return { context, page, errors };
}
const state = (page) => page.evaluate(() => kujoShowcase.info());
const seek = (page, time) => page.evaluate((value) => kujoShowcase.seek(value), time);
const near = (a,b,tol = .001) => assert.ok(Math.abs(a-b) < tol, `${a} versus ${b}`);

async function test() {
  const { context, page, errors } = await setup();
  const first = await state(page);
  const bounds = await page.locator('#field').boundingBox();
  assert.deepEqual(bounds, { x: 0, y: 0, ...size });
  assert.equal(await page.locator('#tools').isVisible(), false);
  assert.equal(await page.locator('nav, header').count(), 0);
  assert.ok(first.count <= 60);
  const bitmap = async (at) => page.evaluate(async (t) => {
    const frame = kujoShowcase.compose(t);
    const pixels = frame.getContext('2d').getImageData(0, 0, frame.width, frame.height).data;
    let checksum = 1;
    for (let i = 0; i < pixels.length; i += 13) checksum = Math.imul(checksum, 31) + pixels[i] | 0;
    return checksum;
  }, at);
  const opening = await bitmap(.02);
  const openingCamera = (await state(page)).camera;
  assert.notEqual(opening, await bitmap(.14));
  assert.deepEqual((await state(page)).camera, openingCamera);
  const denseTime = 13.4;
  const a = await bitmap(denseTime);
  const b = await bitmap(denseTime + .25);
  assert.notEqual(a, b);
  assert.equal(a, await bitmap(denseTime));
  assert.ok((await state(page)).count > 140000);
  assert.notEqual(await bitmap(23), await bitmap(29.7));
  const finalA = await bitmap(29.65);
  const finalCamera = (await state(page)).camera;
  assert.notEqual(finalA, await bitmap(29.98));
  assert.deepEqual((await state(page)).camera, finalCamera);
  assert.equal((await state(page)).labels.length, 3);

  await seek(page, 5.8);
  const before = await state(page);
  await page.mouse.move(562, 330);
  await page.mouse.wheel(0, -190);
  await page.waitForFunction((pitch) => kujoShowcase.info().camera.pitch > pitch, before.camera.pitch);
  const during = await state(page);
  const anchor = worldAt(before.camera, 562, 330, size.width, size.height);
  const anchored = worldAt(during.camera, 562, 330, size.width, size.height);
  near(anchor.x, anchored.x);
  near(anchor.y, anchored.y);
  await page.mouse.wheel(0, 190);
  await page.waitForFunction((pitch) => Math.abs(kujoShowcase.info().camera.pitch - pitch) < .001, before.camera.pitch);
  const reversed = await state(page);
  near(reversed.camera.x, before.camera.x);
  near(reversed.camera.y, before.camera.y);
  await page.mouse.move(340, 310);
  await page.mouse.down();
  await page.mouse.move(401, 355, { steps: 4 });
  await page.mouse.up();
  assert.ok((await state(page)).camera.x < before.camera.x);
  await page.mouse.click(560, 380);
  await page.mouse.click(630, 450);
  assert.equal((await state(page)).waves, 2);
  await page.keyboard.press('i');
  assert.equal(await page.locator('#tools').isVisible(), true);
  assert.ok(await page.getByRole('link', { name: 'Run scenarios and inspect evidence' }).isVisible());
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#tools').isVisible(), false);
  assert.deepEqual(errors, []);
  await context.close();

  const mobile = await setup({ width: 390, height: 844 }, { hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  assert.equal((await state(mobile.page)).playing, false);
  await mobile.page.touchscreen.tap(194, 482);
  assert.equal((await state(mobile.page)).waves, 1);
  const initial = await state(mobile.page);
  const cdp = await mobile.context.newCDPSession(mobile.page);
  const fingers = (gap) => [{ x: 183 - gap, y: 399, id: 1 }, { x: 183 + gap, y: 399, id: 2 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(25) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(59) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.ok((await state(mobile.page)).camera.pitch > initial.camera.pitch * 1.9);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 501, id: 1 }] });
  await mobile.page.locator('#tools').waitFor({ state: 'visible' });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mobile.page.getByRole('button', { name: 'Close', exact: true }).tap();
  assert.equal(await mobile.page.locator('#tools').isVisible(), false);
  assert.deepEqual(mobile.errors, []);
  await mobile.context.close();
  console.log('Immersive canvas interactions, deterministic frames, provenance, and touch passed.');
}

async function capture() {
  const { context, page, errors } = await setup();
  const frames = [
    ['A-opening', .43], ['B-expansion', 4.92], ['C-extreme-scale', 13.68],
    ['D-overlapping-waves', 16.22], ['F-kujo-finale', 29.65],
  ];
  const record = {};
  for (const [name, at] of frames) {
    await seek(page, at);
    await page.screenshot({ path: join(artifacts, name + '.png') });
    record[name] = await state(page);
  }
  await seek(page, 6.68);
  const before = await state(page);
  await page.mouse.move(640, 360);
  for (let index = 0; index < 5; index++) await page.mouse.wheel(0, -160);
  await page.waitForFunction((pitch) => kujoShowcase.info().camera.pitch > pitch * 8, before.camera.pitch);
  await sleep(900);
  await page.screenshot({ path: join(artifacts, 'E-reverse-zoom.png') });
  record['E-reverse-zoom'] = { before: before.camera, ...await state(page) };
  assert.deepEqual(errors, []);
  await writeFile(join(artifacts, 'acceptance.json'), JSON.stringify(record, null, 2) + '\n');
  await context.close();
}

function statistics(values) {
  if (!values.length) return null;
  const ordered = [...values].sort((a,b) => a-b);
  const percentile = (p) => ordered[Math.floor((ordered.length - 1) * p)];
  return { samples: values.length, mean: values.reduce((a,b) => a+b, 0) / values.length,
    p50: percentile(.5), p95: percentile(.95), max: ordered.at(-1) };
}
async function processes(cdp) {
  const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
  const result = await cli('ps', ['-o','pid=,rss=', '-p', processInfo.map(({ id }) => id).join(',')]).catch(() => ({ stdout: '' }));
  const rss = new Map(result.stdout.trim().split('\n').map((line) => line.trim().split(/\s+/).map(Number)));
  return processInfo.map((item) => ({ ...item, rssMiB: rss.has(item.id) ? rss.get(item.id) / 1024 : null }));
}
async function sharedGPU() {
  if (platform() !== 'darwin') return null;
  const { stdout } = await cli('ioreg', ['-r','-c','IOAccelerator','-l'], { maxBuffer: 8 * 1024 * 1024 }).catch(() => ({ stdout: '' }));
  return [...stdout.matchAll(/"Device Utilization %"=(\d+)/g)].map(([, value]) => Number(value));
}

async function benchmark() {
  const { context, page, errors } = await setup();
  const system = await browser.newBrowserCDPSession();
  const cdp = await context.newCDPSession(page);
  const hardware = (await state(page)).gpu;
  const limits = [
    ['activation',0,3], ['expansion',3,8], ['massive-scale',8,14], ['replay-waves',14,21],
    ['logo-formation',21,27], ['brand-hold',27,30],
  ];
  const profile = async ({ name, from, duration, quality }) => {
    await seek(page, from);
    await sleep(900);
    const prior = await processes(system);
    const wall = performance.now();
    await page.evaluate(({ from, quality }) => kujoShowcase.start(from, quality), { from, quality });
    const counters = [sleep(duration * 250).then(sharedGPU), sleep(duration * 500).then(sharedGPU), sleep(duration * 750).then(sharedGPU)];
    await page.waitForFunction((until) => kujoShowcase.info().time >= until, from + duration, { timeout: (duration + 18) * 1000 });
    const result = await page.evaluate(() => kujoShowcase.stop());
    const runtime = (performance.now() - wall) / 1000;
    const after = await processes(system);
    const usage = (items) => ({
      cpuCorePercent: 100 * items.reduce((sum, item) => sum + Math.max(0, item.cpuTime - (prior.find(({ id }) => id === item.id)?.cpuTime ?? item.cpuTime)), 0) / runtime,
      rssMiB: items.reduce((sum, item) => sum + (item.rssMiB || 0), 0),
    });
    const heap = await cdp.send('Runtime.getHeapUsage');
    const cadence = (frames, gpu) => {
      const dt = statistics(frames.map(({ dt }) => dt));
      if (!dt) return null;
      const fps = 1000 / dt.mean;
      return { fps, frameMs: dt, mainThreadDrawMs: statistics(frames.map(({ cpu }) => cpu)),
        gpuDrawMs: statistics(gpu.map(({ ms }) => ms)), slowFramesOver20ms: frames.filter((entry) => entry.dt > 20).length,
        population: [Math.min(...frames.map(({ count }) => count)), Math.max(...frames.map(({ count }) => count))] };
    };
    const phases = Object.fromEntries(limits.map(([label, low, high]) => [label, cadence(
      result.frames.filter(({ time }) => time >= low && time < high),
      result.gpu.filter(({ time }) => time >= low && time < high),
    )]));
    return { name, quality, from, duration, ...cadence(result.frames, result.gpu), phases,
      browser: usage(after), renderer: usage(after.filter(({ type }) => type === 'renderer')),
      gpuProcess: usage(after.filter(({ type }) => type === 'GPU')), sharedGPUPercent: await Promise.all(counters),
      jsHeapMiB: heap.usedSize / 1048576 };
  };
  const profiles = [await profile({ name: 'Full showcase', from: 0, duration: 30, quality: 1 })];
  if (process.env.QUICK !== '1') profiles.push(await profile({ name: 'Reduced raster, dense waves and reveal', from: 12, duration: 15, quality: .75 }));
  const memory = [];
  for (let cycle = 0; cycle <= 12; cycle++) {
    await seek(page, cycle % 2 ? 4.8 : 22.7);
    if (cycle % 4 === 0) {
      await cdp.send('HeapProfiler.collectGarbage');
      const heap = await cdp.send('Runtime.getHeapUsage');
      memory.push({ cycle, heapMiB: heap.usedSize / 1048576, ...(await cdp.send('Memory.getDOMCounters')) });
    }
  }
  const result = {
    measuredAt: new Date().toISOString(), headed, viewport: size, browser: browser.version(), hardware,
    host: { platform: platform(), kernel: release(), arch: arch(), cpu: cpus()[0].model, threads: cpus().length, ramGiB: Math.round(totalmem() / 2 ** 30) },
    profiles, memory,
  };
  await writeFile(join(artifacts, 'performance.json'), JSON.stringify(result, null, 2) + '\n');
  for (const { name, fps, frameMs, gpuDrawMs, population, phases } of profiles) {
    console.log(name, { fps, p95: frameMs.p95, gpuMs: gpuDrawMs?.mean, population });
    console.table(Object.entries(phases).filter(([, data]) => data).map(([phase, data]) =>
      ({ phase, fps: data.fps.toFixed(1), p95: data.frameMs.p95.toFixed(1), gpuMean: data.gpuDrawMs?.mean.toFixed(1) })));
  }
  assert.deepEqual(errors, []);
  await context.close();
}

async function exportVideo() {
  const { context, page, errors } = await setup();
  const fps = 60;
  const count = Math.round(scene.duration * fps);
  const paths = { stream: join(artifacts, '.showcase.h264'), mp4: join(artifacts, 'kujo-infinite-canvas.mp4') };
  const codec = await page.evaluate(async ({ size, fps }) => {
    const config = { codec: 'avc1.640033', ...size, framerate: fps, bitrate: 14_000_000,
      avc: { format: 'annexb' }, latencyMode: 'quality', hardwareAcceleration: 'prefer-hardware' };
    if (!(await VideoEncoder.isConfigSupported(config)).supported) throw new Error('WebCodecs H.264 encoding is unavailable in this browser.');
    const stream = [];
    let failure;
    const encoder = new VideoEncoder({
      output(chunk) {
        const bytes = new Uint8Array(chunk.byteLength);
        chunk.copyTo(bytes);
        stream.push({ bytes, timestamp: chunk.timestamp });
      },
      error(error) { failure = error; },
    });
    encoder.configure(config);
    window.encodeSequence = async (start, end) => {
      for (let index = start; index < end; index++) {
        if (failure) throw failure;
        if (encoder.encodeQueueSize >= 12) await new Promise((resolve) => encoder.addEventListener('dequeue', resolve, { once: true }));
        const canvas = kujoShowcase.compose(index / fps);
        const timestamp = Math.round(index * 1e6 / fps);
        const frame = new VideoFrame(canvas, { timestamp, duration: Math.round((index + 1) * 1e6 / fps) - timestamp });
        encoder.encode(frame, { keyFrame: index % fps === 0 });
        frame.close();
      }
      await encoder.flush();
      if (failure) throw failure;
      const timestamps = stream.map(({ timestamp }) => timestamp);
      const bytes = new Uint8Array(stream.reduce((sum, chunk) => sum + chunk.bytes.length, 0));
      let offset = 0;
      for (const chunk of stream) { bytes.set(chunk.bytes, offset); offset += chunk.bytes.length; }
      stream.length = 0;
      return { base64: bytes.toBase64(), timestamps };
    };
    window.closeEncoder = () => encoder.close();
    return config.codec;
  }, { size, fps });
  const start = performance.now();
  const stream = await open(paths.stream, 'w');
  let encoded = 0;
  try {
    for (let i = 0; i < count; i += 60) {
      const end = Math.min(i + 60, count);
      const chunk = await page.evaluate(({ start, end }) => window.encodeSequence(start, end), { start: i, end });
      assert.deepEqual(chunk.timestamps,
        Array.from({ length: end - i }, (_, index) => Math.round((i + index) * 1e6 / fps)),
        `Encoder omitted or reordered frames in batch starting at ${i}`);
      encoded += chunk.timestamps.length;
      await stream.writeFile(Buffer.from(chunk.base64, 'base64'));
      if ((i + 60) % 300 === 0) console.log(`Encoded ${encoded}/${count} frames`);
    }
  } finally { await stream.close(); }
  await page.evaluate(() => window.closeEncoder());
  assert.equal(encoded, count);
  const videoCodec = (await stat(paths.stream)).size > 45 * 2 ** 20
    ? ['-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p'] : ['-c:v','copy'];
  await cli('ffmpeg', ['-y','-v','error','-fflags','+genpts','-r',String(fps),'-f','h264','-i',paths.stream,
    ...videoCodec,'-movflags','+faststart',paths.mp4]);
  const { stdout } = await cli('ffprobe', ['-v','error','-count_frames','-select_streams','v:0','-show_entries',
    'stream=nb_read_frames,avg_frame_rate,width,height,duration','-of','json',paths.mp4]);
  const video = JSON.parse(stdout).streams[0];
  assert.equal(Number(video.nb_read_frames), count);
  assert.equal(video.avg_frame_rate, '60/1');
  assert.ok(Math.abs(Number(video.duration) - scene.duration) < .02);
  await writeFile(join(artifacts, 'export.json'), JSON.stringify({ codec, video, renderedFrames: encoded,
    wallSeconds: (performance.now() - start) / 1000, browser: browser.version() }, null, 2) + '\n');
  await rm(paths.stream);
  assert.deepEqual(errors, []);
  await context.close();
}

try {
  if (mode !== 'test') await mkdir(artifacts, { recursive: true });
  browser = await chromium.launch({ channel, headless: !headed, args: mode === 'export' ? ['--enable-gpu','--disable-frame-rate-limit'] : ['--enable-gpu'] });
  if (mode === 'test') await test();
  else if (mode === 'capture') await capture();
  else if (mode === 'benchmark') await benchmark();
  else if (mode === 'export') await exportVideo();
  else throw new Error('Use test, capture, benchmark, or export.');
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
}
