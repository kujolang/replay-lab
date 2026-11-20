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
      } else {
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#171719';
        const drawnSize = Math.min(size, 180);
        for (let row = 0; row < grid.rows; row++) {
          for (let col = 0; col < grid.columns; col++) {
            const i = grid.x + col;
            const j = grid.y + row;
            ctx.globalAlpha = .38 + .29 * Math.sin(time * 1.7 + i * .17 + j * .23) ** 2;
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

export function decorate(ctx, camera, width, height, time, cards, ripples, field) {
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
  if (!field) {
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.z, camera.z);
    for (let index = 0; index < cards.length; index++) {
      const { x, y } = cards[index];
      const next = cards[index + 1];
      if (next?.y === y) {
        ctx.fillStyle = '#555950';
        ctx.globalAlpha = .32;
        ctx.fillRect(x + 226, y + 67, 28, 1 / camera.z);
        ctx.globalAlpha = .82;
        ctx.fillRect(x + 228 + (time * 11 + index * 2) % 24, y + 66, 3, 3);
      }
      if (camera.z < .68) {
        const detail = Math.max(0, Math.min(1, (camera.z - .15) / .39));
        const pulse = .70 + .24 * Math.sin(time * 2.3 + index);
        ctx.globalAlpha = (1 - detail) * pulse;
        ctx.fillStyle = cards[index].color;
        ctx.fillRect(x, y, 226, 134);
      }
    }
    ctx.restore();
  }
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
