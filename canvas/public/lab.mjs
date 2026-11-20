import { cardPosition, cardSize, cell, fit, minimumScale, pinch, point, zoomAt } from './camera.mjs';
import { decorate, syntheticRenderer } from './render.mjs';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const world = $('world');
const inspector = $('inspector');
const decoration = $('decoration').getContext('2d');
const media = matchMedia('(prefers-reduced-motion: reduce)');
const approaches = ['replay', 'evaluate', 'execute'];
const operationButtons = [...document.querySelectorAll('[data-operation]')];
const mainCard = { execute: 'workflow', replay: 'winner', evaluate: 'eval' };
const colors = { pass: '#316e4a', replay: '#3d557e', record: '#a54822', running: '#a54822', fail: '#962f2f' };
const colorState = (state) => {
  if (/^(pass|passed|completed|matched)$/i.test(state)) return 'pass';
  if (/replayed/i.test(state)) return 'replay';
  if (/recorded/i.test(state)) return 'record';
  if (/running|started/i.test(state)) return 'running';
  if (/failed|mismatch|error/i.test(state)) return 'fail';
  return 'neutral';
};
const format = (value) => typeof value === 'string' ? value : JSON.stringify(value);
const number = (value) => value.toLocaleString('en-US');
const node = (tag, className, content) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
};
const labeledState = (state) => state[0].toUpperCase() + state.slice(1);
const makePill = (state) => {
  const label = node('span', 'pill', labeledState(state));
  label.dataset.tone = colorState(state);
  return label;
};
const evidenceJSON = (name, value, open = false) => {
  const details = node('details', 'details');
  details.open = open;
  details.append(node('summary', '', name), node('pre', '', JSON.stringify(value, null, 2)));
  return details;
};

let data;
let cards = [];
let selected = 'winner';
let camera = { x: 0, y: 0, z: 1 };
let width = 0;
let height = 0;
let columns;
let renderer;
let isSynthetic = false;
let minimum = .024;
let paused = media.matches;
let dirty = true;
let raf;
let lastTime = 0;
let sceneTime = 0;
let rendered = 0;
let lastCount = -1;
let lastReadout = 0;
let active = null;
let activeEvent;
let pollingHandle;
let disposed = false;
let tracking = false;
const frameSamples = [];
const lastFrames = [];
const ripples = [];
const pointers = new Map();
let gestureMoved = false;
let disarmClick = false;
let savedEvidenceCamera;
let fallback = new URLSearchParams(location.search).has('canvas2d');
const maxZoom = 3.4;

function positionCards() {
  cards.forEach((card, index) => {
    Object.assign(card, cardPosition(index, columns));
    card.button.style.left = card.x + 'px';
    card.button.style.top = card.y + 'px';
  });
}

function renderCards() {
  world.replaceChildren();
  cards = approaches.flatMap((group) => data.scenarios[group].map((card) => {
    const button = node('button', 'field-card');
    button.type = 'button';
    button.dataset.card = card.id;
    const head = node('span', 'card-head');
    head.append(node('span', 'card-kicker', card.type), makePill(card.state));
    const foot = node('span', 'card-foot');
    foot.append(node('span', '', card.note));
    if (card.duration != null) foot.append(node('span', '', card.duration + ' ms'));
    button.append(head, node('span', 'card-title', card.title), node('strong', 'card-metric', card.metric), foot);
    button.addEventListener('click', (event) => {
      if (!disarmClick || event.detail === 0) inspect(card.id, { reveal: event.detail === 0 });
    });
    button.addEventListener('focus', () => {
      const placed = cards.find((entry) => entry.id === card.id);
      if (placed) revealCard(placed);
    });
    world.append(button);
    return { ...card, group, button, color: colors[colorState(card.state)] || '#505050' };
  }));
  cards.forEach((card, index) => card.button.style.setProperty('--delay', '-' + index * .19 + 's'));
  positionCards();
  dirty = true;
}

function revealCard(card) {
  const left = camera.x + card.x * camera.z;
  const top = camera.y + card.y * camera.z;
  if (camera.z < .58 || left < 0 || top < 0 || left + 226 * camera.z > width || top + 134 * camera.z > height) {
    const z = Math.max(.75, camera.z);
    camera = { x: width / 2 - (card.x + 113) * z, y: height / 2 - (card.y + 67) * z, z };
    dirty = true;
  }
}

function inspect(id, { reveal = false, focus = false } = {}) {
  if (isSynthetic || !cards.length) return;
  const card = cards.find((entry) => entry.id === id) || cards[0];
  selected = card.id;
  for (const entry of cards) entry.button.setAttribute('aria-pressed', String(entry === card));
  if (reveal) revealCard(card);
  const picker = node('select', '');
  picker.id = 'card-pick';
  picker.setAttribute('aria-label', 'Select evidence card');
  for (const entry of cards) {
    const option = node('option', '', entry.type + ' / ' + entry.title);
    option.value = entry.id;
    picker.append(option);
  }
  picker.value = card.id;
  picker.addEventListener('change', () => inspect(picker.value, { reveal: true, focus: true }));
  const dl = node('dl', 'record-grid');
  const row = (label, value) => {
    if (value === undefined || value === null) return;
    const entry = node('div');
    const dd = node('dd', '', typeof value === 'string' ? value : undefined);
    if (typeof value !== 'string') dd.append(value);
    entry.append(node('dt', '', label), dd);
    dl.append(entry);
  };
  const evidence = card.evidence;
  row('Status', makePill(card.state));
  row('Result', card.metric);
  row('Run ID', card.nativeId || evidence.run_id);
  row('Duration', card.duration == null ? null : card.duration + ' ms');
  row('Note', card.note);
  const requestHash = evidence.output?.request_hash || evidence.request_meta?.hash;
  row('Cassette', requestHash);
  if (card.group === 'execute' && card.id === 'workflow') {
    const usage = evidence.state.budget_usage;
    row('Est. tokens', number(usage.input_tokens) + ' in / ' + number(usage.output_tokens) + ' out');
    if (usage.estimated_cost_usd != null) row('Est. cost', 'USD ' + usage.estimated_cost_usd);
  }
  inspector.replaceChildren(picker, node('p', 'inspect-kicker', card.type), node('h3', '', card.title), dl);
  const comparison = evidence.comparison;
  if (comparison) {
    const summary = node('p', 'inspector-note',
      `Baseline ${comparison.baselineMatches ? 'matches the published run' : 'differs from the published run'}. ${comparison.sameCassette ? 'Both policies use the same cassette.' : 'Cassette hashes differ.'}`);
    const delta = node('div', 'delta');
    for (const { field, baseline, winner } of comparison.changed) {
      const difference = node('div');
      difference.append(node('b', '', field), node('span', '', `${format(baseline)} → ${format(winner)}`));
      delta.append(difference);
    }
    inspector.append(summary, delta);
  }
  const events = evidence.events || evidence.trace?.events;
  if (events) {
    const trace = node('details', 'details');
    const list = node('ol', 'trace-list');
    for (const event of events) list.append(node('li', '', event.message));
    trace.append(node('summary', '', 'Recorded event sequence'), list);
    inspector.append(trace);
  }
  if (evidence.provenance) inspector.append(node('p', 'inspector-note', evidence.provenance));
  if (evidence.output && !events) inspector.append(evidenceJSON('Output', evidence.output));
  if (evidence.input || evidence.inputs) inspector.append(evidenceJSON('Input', evidence.input || evidence.inputs));
  inspector.append(evidenceJSON('Full evidence', evidence));
  const link = node('a', 'ref-link', card.reference);
  link.href = card.url;
  inspector.append(link);
  $('inspector-source').textContent = card.id === 'receipt' ? 'Study archive' : data.updated[card.group] ? 'Local run' : 'Prepared fixture';
  inspector.scrollTop = 0;
  if (focus) picker.focus({ preventScroll: true });
}

function fieldLimit() {
  if (!isSynthetic) return 12;
  return Math.min(Number($('density').value), renderer.capabilities.limit);
}

function fitField() {
  camera = fit(width, height, isSynthetic ? 4 : columns);
  dirty = true;
}

function updateScale() {
  minimum = isSynthetic ? minimumScale(width, height, fieldLimit()) : .024;
  camera = zoomAt(camera, width / 2, height / 2, camera.z, minimum, maxZoom);
  dirty = true;
}

function fieldRenderer(canvas) {
  const next = syntheticRenderer(canvas, fallback);
  next.canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    if (disposed || next !== renderer) return;
    const replacement = next.canvas.cloneNode();
    next.canvas.replaceWith(replacement);
    fallback = true;
    renderer = fieldRenderer(replacement);
    if (isSynthetic) {
      $('renderer').textContent = 'Canvas 2D / procedural';
      inspector.querySelector('details')?.replaceWith(evidenceJSON('Device limits', renderer.capabilities));
      resize();
    }
  }, { once: true });
  return next;
}

function setMode(synthetic) {
  if (isSynthetic === synthetic) return;
  isSynthetic = synthetic;
  if (synthetic) {
    savedEvidenceCamera = camera;
    renderer ??= fieldRenderer($('synthetic-canvas'));
    renderer.canvas.hidden = false;
    fitField();
    const text = node('p', 'inspector-note', 'This field animates procedural cards to test rendering load. Zoom out to increase the number of objects. Select a density limit for slower devices.');
    inspector.replaceChildren(node('p', 'inspect-kicker', 'Rendering benchmark'), node('h3', '', 'Synthetic field'), text);
    inspector.append(evidenceJSON('Device limits', renderer.capabilities));
  } else {
    if (renderer) renderer.canvas.hidden = true;
    camera = savedEvidenceCamera || camera;
    inspect(selected);
  }
  world.hidden = synthetic;
  $('mode').value = synthetic ? 'synthetic' : 'evidence';
  $('density-control').hidden = !synthetic;
  $('field-title').textContent = synthetic ? 'Synthetic stress test' : 'Execution field';
  $('inspector-source').textContent = synthetic ? 'Synthetic data' : $('inspector-source').textContent;
  $('renderer').textContent = synthetic ? renderer.capabilities.mode + ' / procedural' : 'Evidence canvas';
  $('object-label').textContent = synthetic ? 'synthetic elements' : 'evidence cards';
  lastCount = -1;
  resize();
}

function resize() {
  const oldWidth = width;
  const oldHeight = height;
  width = stage.clientWidth;
  height = stage.clientHeight;
  if (!width || !height) return;
  const oldColumns = columns;
  columns = width < 500 ? 2 : 4;
  if (oldColumns !== columns) positionCards();
  if (!oldWidth || (!isSynthetic && oldColumns !== columns)) {
    fitField();
    if (!isSynthetic && columns === 2) {
      const z = (width - 26) / (cell.x + cardSize.x);
      camera = { x: width / 2, y: 18 - cardPosition(0, columns).y * z, z };
    }
  } else camera = { ...camera, x: camera.x + (width - oldWidth) / 2, y: camera.y + (height - oldHeight) / 2 };
  const ratio = Math.min(devicePixelRatio, 2);
  for (const element of [decoration.canvas, renderer?.canvas].filter(Boolean)) {
    element.width = Math.round(width * ratio);
    element.height = Math.round(height * ratio);
    element.style.width = width + 'px';
    element.style.height = height + 'px';
  }
  updateScale();
}

function zoom(x, y, scale) {
  camera = zoomAt(camera, x, y, scale, minimum, maxZoom);
  dirty = true;
}
function centerZoom(factor) { zoom(width / 2, height / 2, camera.z * factor); }

function animate(now) {
  if (disposed) return;
  raf = requestAnimationFrame(animate);
  if (!width || !height) return;
  const delta = lastTime ? now - lastTime : 0;
  lastTime = now;
  if (!paused) sceneTime += Math.min(delta, 66) / 1000;
  if (paused && !dirty && !active && !tracking) return;
  const start = performance.now();
  const count = isSynthetic ? renderer.draw(camera, width, height, sceneTime, tracking) : cards.length;
  if (!isSynthetic && dirty) {
    const detail = Math.max(0, Math.min(1, (camera.z - .15) / .39));
    world.style.transform = `translate(${camera.x}px,${camera.y}px) scale(${camera.z})`;
    world.style.opacity = detail;
    world.inert = detail < .55;
  }
  while (ripples.length && sceneTime - ripples[0].start > .85) ripples.shift();
  decorate(decoration, camera, width, height, sceneTime, cards, ripples, isSynthetic);
  dirty = false;
  rendered++;
  if (delta && delta < 1000) {
    lastFrames.push(delta);
    if (lastFrames.length > 60) lastFrames.shift();
    if (tracking && frameSamples.length < 12000) frameSamples.push({ frame: delta, cpu: performance.now() - start, count });
  }
  if (count !== lastCount) {
    $('object-count').textContent = number(count);
    lastCount = count;
  }
  if (now - lastReadout > 255) {
    $('zoom').textContent = (camera.z * 100).toFixed(camera.z < .1 ? 2 : 0) + '%';
    const center = point(camera, width / 2, height / 2);
    $('coordinates').textContent = `X ${Math.round(center.x)} / Y ${Math.round(center.y)}`;
    $('fps').textContent = paused ? 'Paused' :
      Math.round(lastFrames.length * 1000 / (lastFrames.reduce((a, b) => a + b, 0) || 1000)) + ' fps';
    $('elapsed').textContent = active ? ((Date.now() - active.startedAt) / 1000).toFixed(1) + ' s' : '';
    lastReadout = now;
  }
}

const position = (event) => {
  const bounds = stage.getBoundingClientRect();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
};
const between = ([a, b]) => ({
  x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
});

stage.addEventListener('wheel', (event) => {
  event.preventDefault();
  const { x, y } = position(event);
  const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
  zoom(x, y, camera.z * Math.exp(-Math.max(-500, Math.min(500, event.deltaY * factor)) * .0024));
}, { passive: false });

stage.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || pointers.size === 2) return;
  if (!pointers.size) {
    gestureMoved = false;
    disarmClick = false;
  }
  const start = position(event);
  pointers.set(event.pointerId, { ...start, start });
  if (!event.target.closest('.field-card') || pointers.size === 2) stage.setPointerCapture(event.pointerId);
  if (pointers.size === 2) gestureMoved = true;
});

stage.addEventListener('pointermove', (event) => {
  const last = pointers.get(event.pointerId);
  if (!last) return;
  const next = { ...position(event), start: last.start };
  const before = [...pointers.values()];
  pointers.set(event.pointerId, next);
  if (pointers.size === 2) camera = pinch(camera, between(before), between([...pointers.values()]), minimum, maxZoom);
  else if (gestureMoved || Math.hypot(next.x - last.start.x, next.y - last.start.y) > 4) {
    if (!stage.hasPointerCapture(event.pointerId)) stage.setPointerCapture(event.pointerId);
    const anchor = gestureMoved ? last : last.start;
    camera = { ...camera, x: camera.x + next.x - anchor.x, y: camera.y + next.y - anchor.y };
    gestureMoved = true;
    stage.dataset.drag = '';
  }
  dirty = true;
});

function endPointer(event) {
  if (!pointers.has(event.pointerId)) return;
  pointers.delete(event.pointerId);
  if (event.type === 'pointerup' && !gestureMoved && !event.target.closest('.field-card') && !paused) {
    const p = position(event);
    if (ripples.length >= 12) ripples.shift();
    ripples.push({ ...point(camera, p.x, p.y), start: sceneTime });
    dirty = true;
  }
  disarmClick = gestureMoved;
  if (!pointers.size) delete stage.dataset.drag;
}
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) stage.addEventListener(name, endPointer);

stage.addEventListener('keydown', (event) => {
  if (event.target !== stage) return;
  const moves = { ArrowLeft: [48, 0], ArrowRight: [-48, 0], ArrowUp: [0, 48], ArrowDown: [0, -48] };
  const move = moves[event.key];
  if (move) camera = { ...camera, x: camera.x + move[0], y: camera.y + move[1] };
  else if (event.key === '+' || event.key === '=') centerZoom(1.3);
  else if (event.key === '-') centerZoom(1 / 1.3);
  else if (event.key === 'Home') fitField();
  else return;
  event.preventDefault();
  dirty = true;
});
$('zoom-in').addEventListener('click', () => centerZoom(1.3));
$('zoom-out').addEventListener('click', () => centerZoom(1 / 1.3));
$('fit').addEventListener('click', fitField);
$('mode').addEventListener('change', () => setMode($('mode').value === 'synthetic'));
$('density').addEventListener('change', updateScale);
function setPaused(value) {
  paused = value;
  document.body.toggleAttribute('data-paused', paused);
  $('motion').textContent = paused ? 'Resume' : 'Pause';
  $('motion').ariaPressed = String(paused);
  $('motion').ariaLabel = paused ? 'Resume animation' : 'Pause animation';
  if (paused) $('fps').textContent = 'Paused';
  dirty = true;
}
setPaused(paused);
const reduced = () => setPaused(media.matches);
media.addEventListener('change', reduced);
$('motion').addEventListener('click', () => setPaused(!paused));

$('compare').addEventListener('click', () => {
  disarmClick = false;
  setMode(false);
  inspect('compare', { reveal: true });
});

async function stateRequest(action) {
  const response = await fetch(action ? '/api/' + action : '/api/state',
    action ? { method: 'POST', headers: { 'X-Replay-Lab': '1' } } : {});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

function status(message, { busy = false, error = false } = {}) {
  $('operation-status').toggleAttribute('data-busy', busy);
  $('operation-status').toggleAttribute('data-error', error);
  $('operation-text').textContent = message;
}
function runningCard(id) {
  for (const card of cards) card.button.toggleAttribute('data-running', Boolean(active) && (card.id === mainCard[active.action] || card.id === id));
}

const activeText = { execute: 'Running Dispatch fixture', replay: 'Replaying strict cassette', evaluate: 'Running Eval checks' };
async function runOperation(action) {
  if (!data || active) return;
  setMode(false);
  inspect(mainCard[action], { reveal: true });
  active = { action, startedAt: Date.now() };
  activeEvent = null;
  status(activeText[action], { busy: true });
  runningCard();
  for (const button of operationButtons) button.setAttribute('aria-disabled', 'true');
  let checking = false;
  pollingHandle = setInterval(async () => {
    if (checking || action !== 'execute') return;
    checking = true;
    try {
      const snapshot = await stateRequest();
      const event = snapshot.active?.event;
      if (active?.action === action && event?.id && event.id !== activeEvent) {
        activeEvent = event.id;
        status(event.message, { busy: true });
        runningCard(event.type === 'step_completed' ? null : 'step-' + event.step_id);
      }
    } catch { /* The action request displays the authoritative failure. */ }
    finally { checking = false; }
  }, 160);
  try {
    const result = await stateRequest(action);
    data = result;
    const current = selected;
    renderCards();
    inspect(current);
    const card = cards.find((entry) => entry.id === mainCard[action]);
    status(card.title + ' · ' + labeledState(card.state), { error: colorState(card.state) === 'fail' });
    $('provenance').textContent = 'Latest operation · ' + result.updated[action].replace('T', ' ').slice(0, 19) + ' UTC';
  } catch (error) {
    status(error.message, { error: true });
  } finally {
    clearInterval(pollingHandle);
    active = null;
    $('elapsed').textContent = '';
    for (const button of operationButtons) button.removeAttribute('aria-disabled');
    runningCard();
  }
}
for (const button of operationButtons) button.addEventListener('click', () => runOperation(button.dataset.operation));

const observer = new ResizeObserver(resize);
observer.observe(stage);
raf = requestAnimationFrame(animate);
const start = async () => {
  try {
    data = await stateRequest();
    resize();
    renderCards();
    inspect(selected);
    status('Prepared fixture evidence');
    $('provenance').textContent = 'Offline fixtures prepared ' + data.preparedAt.slice(0, 10) + ' UTC.';
  } catch {
    status('Evidence unavailable. Check the local server and reload.', { error: true });
  }
};
start();

addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  disposed = true;
  cancelAnimationFrame(raf);
  clearInterval(pollingHandle);
  observer.disconnect();
  media.removeEventListener('change', reduced);
  renderer?.dispose();
});

if (new URLSearchParams(location.search).has('benchmark')) {
  window.labBenchmark = {
    state: () => ({ camera: { ...camera }, width, height, rendered, count: lastCount, capabilities: renderer?.capabilities, ripples: ripples.length }),
    mode: setMode,
    pan: (x, y) => { camera = { ...camera, x: camera.x + x, y: camera.y + y }; dirty = true; },
    limit: (limit) => { $('density').value = limit; updateScale(); },
    maximumDensity: () => zoom(width / 2, height / 2, minimum),
    start: () => {
      frameSamples.length = 0;
      if (renderer) renderer.gpuMs.length = 0;
      tracking = true;
    },
    stop: () => {
      tracking = false;
      return { frames: [...frameSamples], gpu: [...(renderer?.gpuMs || [])] };
    },
  };
}
