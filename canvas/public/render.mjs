import { cell, visibleGrid } from './camera.mjs';

const vertex = `#version 300 es
precision highp float;
precision highp int;
uniform ivec2 origin;
uniform int columns;
uniform vec2 cursor;
uniform vec2 viewport;
uniform vec2 stride;
uniform float time;
uniform float size;
out float glow;
out float seed;
uint hash(uvec2 p) {
  uint value = p.x * 747796405u + p.y * 2891336453u;
  value = ((value >> ((value >> 28u) + 4u)) ^ value) * 277803737u;
  return (value >> 22u) ^ value;
}
void main() {
  ivec2 tile = ivec2(gl_VertexID % columns, gl_VertexID / columns);
  ivec2 id = origin + tile;
  vec2 px = cursor + vec2(tile) * stride;
  seed = float(hash(uvec2(id)) & 65535u) / 65535.0;
  float wave = sin(float(id.x) * .17 + float(id.y) * .29 - time * 2.1);
  glow = .48 + .23 * wave + .21 * sin(seed * 23.0 + time * (1.2 + seed));
  vec2 clip = px / viewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0, 1);
  gl_PointSize = size;
}`;

const fragment = `#version 300 es
precision highp float;
uniform float projected;
in float glow;
in float seed;
out vec4 color;
void main() {
  vec2 p = abs(gl_PointCoord - .5) * 2.0;
  float detail = smoothstep(6.0, 22.0, projected);
  float height = mix(.93, .60, detail);
  float edge = max(p.x, p.y / height);
  float shape = 1.0 - smoothstep(.83, 1.0, edge);
  if (shape <= 0.0) discard;
  float outline = smoothstep(.72, .92, edge);
  float scan = step(abs(gl_PointCoord.y - mix(.31, .69, glow)), .018);
  vec3 ink = vec3(.08, .087, .09);
  vec3 paper = vec3(.98);
  float signal = step(.91, seed);
  float body = mix(glow * .79, max(outline, scan * .7), detail);
  color = vec4(mix(paper, ink, body), shape * mix(.72 + .27 * signal, 1.0, detail));
}`;

function programFor(gl) {
  const program = gl.createProgram();
  for (const [kind, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
    const shader = gl.createShader(kind);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      gl.deleteProgram(program);
      throw new Error(error);
    }
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(error);
  }
  gl.useProgram(program);
  return program;
}

const opacity = (time, x, y) => .38 + .29 * Math.sin(time * 1.7 + x * .17 + y * .23) ** 2;
const alphaWords = new Uint32Array(256);
const alphaBytes = new Uint8Array(alphaWords.buffer);
for (let alpha = 0; alpha < alphaWords.length; alpha++) alphaBytes.set([23, 23, 23, alpha], alpha * 4);

export function syntheticRenderer(canvas, forceFallback = false) {
  const gl = forceFallback ? null : canvas.getContext('webgl2', {
    antialias: false, alpha: true, depth: false, stencil: false, powerPreference: 'high-performance',
  });
  let gpu;
  if (gl) {
    try { gpu = programFor(gl); }
    catch (error) { console.warn('WebGL2 field unavailable', error.message); }
  }
  if (!gpu && gl) {
    const fallback = canvas.cloneNode();
    canvas.replaceWith(fallback);
    return syntheticRenderer(fallback, true);
  }
  const ctx = gpu ? null : canvas.getContext('2d');
  const uniforms = gpu && Object.fromEntries(['origin', 'columns', 'cursor', 'viewport', 'stride', 'time', 'size', 'projected']
    .map((name) => [name, gl.getUniformLocation(gpu, name)]));
  const pointRange = gpu && gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
  const renderer = gpu && gl.getExtension('WEBGL_debug_renderer_info');
  const capabilities = gpu ? {
    mode: 'WebGL2', limit: 262144, pointSizeRange: [...pointRange],
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxViewport: [...gl.getParameter(gl.MAX_VIEWPORT_DIMS)],
    gpu: renderer ? gl.getParameter(renderer.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    gpuTimer: Boolean(gl.getExtension('EXT_disjoint_timer_query_webgl2')),
  } : { mode: 'Canvas 2D', limit: 8192, gpuTimer: false };
  const ext = gpu && gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const pending = [];
  const gpuMs = [];
  let sample = 0;
  let raster;
  return {
    canvas, capabilities, gpuMs,
    draw(camera, width, height, time, measure) {
      const grid = visibleGrid(camera, width, height);
      const strideX = cell.x * camera.z;
      const strideY = cell.y * camera.z;
      const x = camera.x + grid.x * strideX;
      const y = camera.y + grid.y * strideY;
      const ratio = canvas.width / width;
      const size = Math.max(.84, 226 * camera.z);
      if (gpu) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.uniform2i(uniforms.origin, grid.x, grid.y);
        gl.uniform1i(uniforms.columns, grid.columns);
        gl.uniform2f(uniforms.cursor, x, y);
        gl.uniform2f(uniforms.viewport, width, height);
        gl.uniform2f(uniforms.stride, strideX, strideY);
        gl.uniform1f(uniforms.time, time);
        gl.uniform1f(uniforms.size, Math.min(size * ratio, pointRange[1]));
        gl.uniform1f(uniforms.projected, size);
        const old = pending[0];
        if (old && gl.getQueryParameter(old, gl.QUERY_RESULT_AVAILABLE)) {
          if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) {
            gpuMs.push(gl.getQueryParameter(old, gl.QUERY_RESULT) / 1e6);
            if (gpuMs.length > 240) gpuMs.shift();
          }
          gl.deleteQuery(pending.shift());
        }
        const query = ext && measure && ++sample % 5 === 0 && pending.length < 4 ? gl.createQuery() : null;
        if (query) gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
        gl.drawArrays(gl.POINTS, 0, grid.count);
        if (query) {
          gl.endQuery(ext.TIME_ELAPSED_EXT);
          pending.push(query);
        }
      } else if (size <= 24) {
        // Batch the dense path into one upload instead of issuing thousands of 2D draw calls.
        if (!raster || raster.width !== canvas.width || raster.height !== canvas.height) {
          raster = ctx.createImageData(canvas.width, canvas.height);
        }
        const pixels = new Uint32Array(raster.data.buffer);
        pixels.fill(0);
        const glyphWidth = Math.max(1, Math.round(size * ratio));
        const glyphHeight = Math.max(1, Math.round(glyphWidth * .6));
        for (let row = 0; row < grid.rows; row++) {
          const top = Math.round((y + row * strideY) * ratio - glyphHeight / 2);
          for (let col = 0; col < grid.columns; col++) {
            const left = Math.round((x + col * strideX) * ratio - glyphWidth / 2);
            const word = Math.round(255 * opacity(time, grid.x + col, grid.y + row));
            const color = alphaWords[word];
            const x0 = Math.max(0, left);
            const x1 = Math.min(left + glyphWidth, raster.width);
            if (x0 >= x1) continue;
            for (let py = Math.max(0, top); py < Math.min(top + glyphHeight, raster.height); py++) {
              pixels.fill(color, py * raster.width + x0, py * raster.width + x1);
            }
          }
        }
        ctx.putImageData(raster, 0, 0);
      } else {
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#171719';
        const drawnSize = Math.min(size, 180);
        for (let row = 0; row < grid.rows; row++) {
          for (let col = 0; col < grid.columns; col++) {
            const i = grid.x + col;
            const j = grid.y + row;
            ctx.globalAlpha = opacity(time, i, j);
            ctx.fillRect(x + col * strideX - drawnSize / 2, y + row * strideY - drawnSize * .3, drawnSize, drawnSize * .6);
          }
        }
        ctx.globalAlpha = 1;
      }
      return grid.count;
    },
    dispose() {
      if (gpu) {
        for (const query of pending) gl.deleteQuery(query);
        gl.deleteProgram(gpu);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    },
  };
}

export function decorate(ctx, camera, width, height, time, ripples, field) {
  const ratio = ctx.canvas.width / width;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  let grid = 18 * camera.z;
  while (grid < 12) grid *= 4;
  while (grid >= 48) grid /= 4;
  const offset = (value) => (value % grid + grid) % grid;
  ctx.fillStyle = '#222';
  ctx.globalAlpha = field ? .08 : .16;
  ctx.beginPath();
  for (let y = offset(camera.y); y < height; y += grid) {
    for (let x = offset(camera.x); x < width; x += grid) ctx.rect(x, y, 1, 1);
  }
  ctx.fill();
  ctx.globalAlpha = 1;
  for (const ripple of ripples) {
    const age = time - ripple.start;
    if (age < 0 || age > .85) continue;
    const x = camera.x + ripple.x * camera.z;
    const y = camera.y + ripple.y * camera.z;
    for (let ring = 0; ring < 3; ring++) {
      ctx.globalAlpha = (1 - age / .85) * .4;
      ctx.strokeStyle = '#252525';
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, 6 + age * (64 + ring * 21)), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}
