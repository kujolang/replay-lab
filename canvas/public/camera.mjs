export const cell = { x: 254, y: 162 };
export const cardSize = { x: 226, y: 134 };
export const point = (camera, x, y) => ({ x: (x - camera.x) / camera.z, y: (y - camera.y) / camera.z });

export function zoomAt(camera, x, y, scale, min, max) {
  const anchor = point(camera, x, y);
  const z = Math.min(max, Math.max(min, scale));
  return { x: x - anchor.x * z, y: y - anchor.y * z, z };
}

export function fit(width, height, columns = 4) {
  const rows = Math.ceil(12 / columns);
  const fullWidth = (columns - 1) * cell.x + cardSize.x;
  const fullHeight = (rows - 1) * cell.y + cardSize.y;
  const z = Math.min(1.13, (width - 38) / fullWidth, (height - 48) / fullHeight);
  return { x: width / 2, y: height / 2, z: Math.max(.05, z) };
}

export function cardPosition(index, columns) {
  const rows = Math.ceil(12 / columns);
  return {
    x: (index % columns - (columns - 1) / 2) * cell.x - cardSize.x / 2,
    y: (Math.floor(index / columns) - (rows - 1) / 2) * cell.y - cardSize.y / 2,
  };
}

export function visibleGrid(camera, width, height) {
  const first = point(camera, 0, 0);
  const last = point(camera, width, height);
  const x = Math.floor(first.x / cell.x);
  const y = Math.floor(first.y / cell.y);
  const columns = Math.ceil(last.x / cell.x) - x + 1;
  const rows = Math.ceil(last.y / cell.y) - y + 1;
  return { x, y, columns, rows, count: columns * rows };
}

export function minimumScale(width, height, limit) {
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 30; iteration++) {
    const z = (low + high) / 2;
    // Add three cells to cover the largest bounding box at any camera phase.
    const worst = (Math.ceil(width / (z * cell.x)) + 2) * (Math.ceil(height / (z * cell.y)) + 2);
    if (worst <= limit) high = z;
    else low = z;
  }
  return high;
}

export function pinch(previous, before, after, min, max) {
  const next = zoomAt(previous, before.x, before.y, previous.z * after.distance / before.distance, min, max);
  next.x += after.x - before.x;
  next.y += after.y - before.y;
  return next;
}
