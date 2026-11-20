export const scene = Object.freeze({
  duration: 30,
  activation: 3,
  expansion: 8,
  scale: 14,
  replay: 15.1,
  evaluation: 17.2,
  workflow: 19.25,
  formation: 21,
  hold: 27,
});

// A cell is 1 × 1 in lattice space. The extra width is a rendering proportion.
export const aspect = 1.28;
const TAU = 2 * Math.PI;
export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const mix = (a, b, t) => a + (b - a) * t;
export const smooth = (time, low, high) => {
  const t = clamp((time - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
};
const expMix = (a, b, t) => a * (b / a) ** t;
const openingPitch = (width, height) => Math.min(height * .273, width / (4.22 * aspect)) / height;

export function cameraAt(time, width, height) {
  const { activation, expansion, scale, formation, hold } = scene;
  const start = openingPitch(width, height);
  const mid = start * .052;
  // Target a screen-filling field even on portrait and widescreen viewports.
  const dense = Math.sqrt(width * height / (aspect * 147000)) / height;
  const settle = dense * 1.14;
  const kick = smooth(time, .16, activation);
  let size = expMix(start, start * .52, kick);
  if (time > activation) size = expMix(start * .52, mid, smooth(time, activation, expansion));
  if (time > expansion) size = expMix(mid, dense, smooth(time, expansion, scale - .5));
  if (time > scale) size = dense * (1 + .025 * Math.sin((time - scale) * 1.4) * (1 - smooth(time, formation - 1, formation)));
  if (time > formation) size = expMix(dense, settle, smooth(time, formation, hold));
  const drift = smooth(time, 2.2, 8.4) * (1 - smooth(time, formation, hold));
  return {
    x: Math.sin(time * TAU / 16) * drift * 13 - .5 * (1 - smooth(time, 2.2, 8.4)),
    y: Math.sin(time * TAU / 22) * drift * 9,
    pitch: height * size,
  };
}

export function project(camera, width, height) {
  const sx = camera.pitch * aspect;
  const sy = camera.pitch;
  const x = Math.floor(camera.x - width / sx / 2 - .5);
  const y = Math.floor(camera.y - height / sy / 2 - .5);
  const columns = Math.ceil(camera.x + width / sx / 2 + .5) - x + 1;
  const rows = Math.ceil(camera.y + height / sy / 2 + .5) - y + 1;
  return { x, y, columns, rows, count: columns * rows };
}

export function worldAt(camera, px, py, width, height) {
  return { x: camera.x + (px - width / 2) / (camera.pitch * aspect), y: camera.y + (py - height / 2) / camera.pitch };
}

export function zoomAt(camera, px, py, pitch, width, height) {
  const anchor = worldAt(camera, px, py, width, height);
  return { x: anchor.x - (px - width / 2) / (pitch * aspect), y: anchor.y - (py - height / 2) / pitch, pitch };
}

const waveCue = [
  [8.1, -.28, -.25, 3.5, .92],
  [11.6, .29, -.24, 3.5, 2.03],
  [scene.replay, -.39, .23, 3.9, 1.15],
  [scene.workflow, -.23, -.36, 3.45, 2.12],
];

export function waveField(time, width, height) {
  return waveCue.filter(([start, , , duration]) => time >= start && time < start + duration)
    .map(([start, x, y, duration, bearing]) => {
      const camera = cameraAt(start, width, height);
      const span = Math.hypot(width, height) / camera.pitch;
      return { x: camera.x + x * width / (camera.pitch * aspect), y: camera.y + y * height / camera.pitch, start,
        velocity: span * .88 / duration, direction: bearing, lifetime: duration };
    });
}

export function logoAt(time, width, height) {
  const finalPitch = cameraAt(scene.hold, width, height).pitch;
  const artHeight = Math.min(height * .84, width * .88);
  return {
    amount: smooth(time, scene.formation, scene.hold),
    // The SVG artboard, including its margins, keeps the exact source aspect.
    x: 0, y: -height * .07 / finalPitch, height: artHeight / finalPitch,
  };
}
