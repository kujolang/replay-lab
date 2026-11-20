import { aspect, cameraAt, clamp, logoAt, project, scene, smooth, waveField, worldAt, zoomAt } from './choreography.mjs';
import { createField, loadMask } from './field-gpu.mjs';
import { loadEvidence } from './visual-evidence.mjs';

const element = (id) => document.getElementById(id);
const canvas = element('field');
const caption = element('caption');
const text = caption.getContext('2d');
const panel = element('tools');
const media = matchMedia('(prefers-reduced-motion: reduce)');
const testMode = new URLSearchParams(location.search).has('render');
const pointer = new Map();
const manualWaves = [];
const measurements = [];
let gpu;
let evidence;
let width;
let height;
let ratio;
let camera;
let count = 0;
let manual = false;
let manualStarted = 0;
let blendStart = -Infinity;
let playing = !media.matches && !testMode;
let time = 0;
let previous = 0;
let raf;
let tracking = false;
let dragged = false;
let pressTimer;
let dirty = true;
let lastCaption;
let captionRect;
let captionOpacity = 0;
let resolution = 1;
let disposed = false;
const minPitch = (w, h) => Math.sqrt(w * h / (aspect * 168000));
const maxPitch = (w, h) => Math.max(w, h) * .51;

function resize() {
  const nextWidth = canvas.clientWidth;
  const nextHeight = canvas.clientHeight;
  if (!nextWidth || !nextHeight) return;
  if (manual && height) {
    camera = { ...camera, pitch: clamp(camera.pitch * nextHeight / height, minPitch(nextWidth, nextHeight), maxPitch(nextWidth, nextHeight)) };
  }
  width = nextWidth;
  height = nextHeight;
  ratio = Math.min(devicePixelRatio, 2, 1920 / width, 1080 / height) * resolution;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  lastCaption = null;
  dirty = true;
}

function currentCamera() {
  return manual ? camera : cameraAt(Math.min(time, scene.duration), width, height);
}

function drawCaption() {
  const normalized = Math.max(.64, Math.min(width / 1280, height / 650));
  const wordmark = smooth(time, scene.hold + .28, scene.hold + 1.45);
  const introduction = time < scene.activation + 1.1
    ? smooth(time, .10, .40) * (1 - smooth(time, scene.activation, scene.activation + 1.1)) : 0;
  const label = evidence.labels.find(([at]) => time >= at && time < at + 1.9);
  const opacity = label ? smooth(time, label[0], label[0] + .26) * (1 - smooth(time, label[0] + 1.52, label[0] + 1.9)) : 0;
  const alpha = manual ? 0 : wordmark || opacity || introduction;
  if (captionOpacity !== alpha) {
    captionOpacity = alpha;
    caption.style.opacity = alpha;
  }
  if (!alpha) return;
  const [title, explanation] = wordmark ? ['kujolang.ai'] : label ? label.slice(1)
    : ['Make AI decisions reproducible', 'The opening cards show saved results from an AI triage run.'];
  const key = [title, explanation, width, height, ratio].join('/');
  if (key === lastCaption) return;
  lastCaption = key;

  const fontSize = wordmark ? Math.max(19, Math.round(height * .037)) : Math.round(20 * normalized);
  const font = `${fontSize}px "Departure Mono"`;
  const small = `${Math.round(13 * normalized)}px "Departure Mono"`;
  const pad = Math.round(12 * normalized);
  const margin = Math.round(25 * normalized);
  const maxLine = width - 2 * (margin + pad);
  text.font = font;
  const headingWidth = Math.min(maxLine, text.measureText(title).width);
  text.font = small;
  const lines = [];
  for (const word of (explanation || '').split(' ').filter(Boolean)) {
    const last = lines.at(-1);
    if (last && text.measureText(last + ' ' + word).width <= maxLine) lines[lines.length - 1] += ' ' + word;
    else lines.push(word);
  }
  const lineHeight = Math.round(19 * normalized);
  const boxWidth = Math.ceil(Math.max(headingWidth, ...lines.map((line) => text.measureText(line).width)) + pad * 2);
  const boxHeight = wordmark ? fontSize * 2 : 2 * pad + fontSize + lines.length * lineHeight;
  captionRect = {
    x: wordmark ? (width - boxWidth) / 2 : margin,
    y: wordmark ? height * .895 - boxHeight / 2 : height - margin - boxHeight,
    width: boxWidth, height: boxHeight,
  };
  caption.width = Math.ceil(boxWidth * ratio);
  caption.height = Math.ceil(boxHeight * ratio);
  for (const [property, value] of [['left',captionRect.x],['top',captionRect.y],['width',boxWidth],['height',boxHeight]]) {
    caption.style[property] = value + 'px';
  }
  text.setTransform(caption.width / boxWidth, 0, 0, caption.height / boxHeight, 0, 0);
  if (!wordmark) {
    text.fillStyle = '#fff';
    text.fillRect(0, 0, boxWidth, boxHeight);
    text.fillStyle = '#171717';
    text.fillRect(0, 0, 2, boxHeight);
  }
  text.font = font;
  text.textAlign = 'left';
  text.textBaseline = 'middle';
  text.fillStyle = '#111';
  text.fillText(title, pad, wordmark ? boxHeight / 2 : pad + fontSize / 2, maxLine);
  text.font = small;
  text.fillStyle = '#333';
  lines.forEach((line, i) => text.fillText(line, pad, pad + fontSize + lineHeight * (i + .52)));

}

function draw(sample) {
  if (!gpu || !width || !height) return;
  const active = waveField(time, width, height).filter((wave) => !manual || wave.start <= manualStarted);
  while (manualWaves.length && time - manualWaves[0].start > manualWaves[0].lifetime) manualWaves.shift();
  const current = currentCamera();
  const change = manual ? smooth(performance.now(), blendStart, blendStart + 850) : 0;
  const logo = logoAt(manual ? manualStarted : time, width, height);
  logo.amount *= 1 - change;
  count = gpu.draw({
    width, height, camera: current, time, waves: [...active, ...manualWaves], logo, sample,
    opening: (smooth(time, .26, scene.activation) + change * 2) * (5 + .17 * Math.max(width, height) / current.pitch),
  });
  drawCaption();
  dirty = false;
}

function frame(now) {
  if (disposed) return;
  const dt = previous ? now - previous : 0;
  previous = now;
  if (playing && !document.hidden) time += dt / 1000;
  if (playing || dirty || tracking || manual && performance.now() < blendStart + 880) {
    const start = performance.now();
    draw(tracking);
    if (tracking && dt > 0) measurements.push({ time, dt, cpu: performance.now() - start, count, pitch: currentCamera().pitch });
  }
  raf = requestAnimationFrame(frame);
}

function takeControl() {
  if (manual) return;
  camera = currentCamera();
  manual = true;
  manualStarted = time;
  blendStart = performance.now();
  dirty = true;
}
function scaleAt(x, y, target) {
  takeControl();
  camera = zoomAt(camera, x, y, clamp(target, minPitch(width, height), maxPitch(width, height)), width, height);
  dirty = true;
}

function coords(event) {
  return { x: event.clientX, y: event.clientY };
}
function fingers() {
  const [a, b] = pointer.values();
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
}
function tap(x, y) {
  const c = currentCamera();
  const origin = worldAt(c, x, y, width, height);
  manualWaves.push({ ...origin, start: time, velocity: Math.hypot(width, height) / c.pitch * .41,
    direction: Math.atan2(y - height * .5, x - width * .5), lifetime: 2.7 });
  if (manualWaves.length > 6) manualWaves.shift();
  dirty = true;
}

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const mode = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
  scaleAt(event.clientX, event.clientY, currentCamera().pitch * Math.exp(-clamp(event.deltaY * mode, -500, 500) * .0028));
}, { passive: false });
canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || pointer.size >= 2) return;
  if (!pointer.size) dragged = false;
  const p = coords(event);
  pointer.set(event.pointerId, { ...p, start: p });
  canvas.setPointerCapture(event.pointerId);
  if (pointer.size === 2) {
    clearTimeout(pressTimer);
    dragged = true;
  } else if (event.pointerType === 'touch') {
    pressTimer = setTimeout(() => {
      if (!gpu) return;
      dragged = true;
      showPanel(panel.hidden);
    }, 620);
  }
});
canvas.addEventListener('pointermove', (event) => {
  const old = pointer.get(event.pointerId);
  if (!old) return;
  const p = coords(event);
  if (pointer.size === 2) {
    const before = fingers();
    pointer.set(event.pointerId, { ...p, start: old.start });
    const after = fingers();
    scaleAt(before.x, before.y, currentCamera().pitch * after.distance / before.distance);
    camera.x -= (after.x - before.x) / (camera.pitch * aspect);
    camera.y -= (after.y - before.y) / camera.pitch;
  } else {
    pointer.set(event.pointerId, { ...p, start: old.start });
    if (!dragged && Math.hypot(p.x - old.start.x, p.y - old.start.y) <= 4) return;
    clearTimeout(pressTimer);
    takeControl();
    const from = dragged ? old : old.start;
    camera.x -= (p.x - from.x) / (camera.pitch * aspect);
    camera.y -= (p.y - from.y) / camera.pitch;
    dragged = true;
    canvas.dataset.drag = '';
  }
  dirty = true;
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(type, (event) => {
    if (!pointer.delete(event.pointerId)) return;
    clearTimeout(pressTimer);
    if (type === 'pointerup' && !dragged) tap(event.clientX, event.clientY);
    if (!pointer.size) delete canvas.dataset.drag;
  });
}

function showPanel(show) {
  panel.hidden = !show;
  if (show) {
    element('debug').textContent = project(currentCamera(), width, height).count.toLocaleString() + ' projected field cells';
    element('pause').focus({ preventScroll: true });
  } else canvas.focus({ preventScroll: true });
}
function pause(value = !playing) {
  playing = value;
  element('pause').textContent = playing ? 'Pause' : 'Play';
  previous = 0;
  dirty = true;
}
function restart() {
  manualWaves.length = 0;
  time = 0;
  manual = false;
  lastCaption = null;
  pause(true);
}

element('restart').onclick = () => { showPanel(false); restart(); };
element('close').onclick = () => showPanel(false);
element('pause').onclick = () => pause();
element('quality').onchange = (event) => {
  resolution = Number(event.target.value);
  lastCaption = null;
  resize();
};
window.addEventListener('contextmenu', (event) => {
  if (event.target === canvas && gpu) {
    event.preventDefault();
    if (event.pointerType !== 'touch') showPanel(panel.hidden);
  }
});
window.addEventListener('keydown', (event) => {
  if (!gpu || event.altKey || event.metaKey || event.ctrlKey) return;
  const key = event.key.toLowerCase();
  if (key === 'i' || key === '?' || key === 'escape') showPanel(panel.hidden);
  else if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement) return;
  else if (key === ' ') pause();
  else if (key === 'home') restart();
  else if (key === '+' || key === '=' || key === '-') scaleAt(width / 2, height / 2, currentCamera().pitch * (key === '-' ? 1 / 1.35 : 1.35));
  else if (key === 'enter') tap(width / 2, height / 2);
  else if (key.startsWith('arrow')) {
    takeControl();
    const jump = 55 / camera.pitch;
    if (key === 'arrowleft') camera.x -= jump / aspect;
    if (key === 'arrowright') camera.x += jump / aspect;
    if (key === 'arrowup') camera.y -= jump;
    if (key === 'arrowdown') camera.y += jump;
    dirty = true;
  } else return;
  event.preventDefault();
});
const reduced = (event) => { if (event.matches) pause(false); };
media.addEventListener('change', reduced);
const resetClock = () => { previous = 0; };
document.addEventListener('visibilitychange', resetClock);

function failure(message) {
  const p = element('failure');
  const link = document.createElement('a');
  link.href = '/workbench.html';
  link.textContent = 'Open the Kujo workbench';
  p.replaceChildren(document.createTextNode(message + ' '), link);
  p.hidden = false;
}
const observer = new ResizeObserver(resize);
observer.observe(canvas);

try {
  // Fonts are drawn into the live caption canvas and share the same video pixels.
  const [mask, data] = await Promise.all([loadMask(), loadEvidence(), document.fonts.load('16px "Departure Mono"')]);
  evidence = data;
  gpu = createField(canvas, mask, evidence.cards);
  resize();
  pause(playing);
  draw(false);
  canvas.focus({ preventScroll: true });
  raf = requestAnimationFrame(frame);
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    pause(false);
    if (!disposed) failure('The graphics context was lost. Reload to restart.');
  });
} catch (error) {
  console.error(error);
  failure('The immersive canvas could not start.');
}
addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  disposed = true;
  cancelAnimationFrame(raf);
  clearTimeout(pressTimer);
  observer.disconnect();
  media.removeEventListener('change', reduced);
  document.removeEventListener('visibilitychange', resetClock);
  gpu?.dispose();
});

if (testMode && gpu) {
  const composite = new OffscreenCanvas(canvas.width, canvas.height);
  const output = composite.getContext('2d', { alpha: false });
  window.kujoShowcase = {
    seek(at) {
      time = at;
      manual = false;
      playing = false;
      manualWaves.length = 0;
      draw(false);
    },
    compose(at, direct = false) {
      this.seek(at);
      if (direct && !captionOpacity) return canvas;
      output.drawImage(canvas, 0, 0);
      if (captionOpacity && captionRect) {
        output.globalAlpha = captionOpacity;
        output.drawImage(caption, captionRect.x * ratio, captionRect.y * ratio, captionRect.width * ratio, captionRect.height * ratio);
        output.globalAlpha = 1;
      }
      return composite;
    },
    info: () => ({ time, camera: currentCamera(), count, width, height, manual, playing, waves: manualWaves.length, gpu: gpu.info, labels: evidence.labels }),
    start(at, quality = 1) {
      time = at;
      manual = false;
      resolution = quality;
      resize();
      measurements.length = 0;
      gpu.gpu.length = 0;
      tracking = true;
      pause(true);
    },
    stop() {
      tracking = false;
      pause(false);
      return { frames: [...measurements], gpu: [...gpu.gpu] };
    },
  };
}
