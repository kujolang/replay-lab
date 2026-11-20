import { aspect, project } from './choreography.mjs';

const vertex = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uViewport;
uniform vec2 uCenter;
uniform float uPitch;
uniform float uTime;
uniform ivec2 uOrigin;
uniform int uColumns;
uniform float uEvidence[12];
uniform vec4 uWaves[6];
uniform vec3 uWaveShape[6];
uniform int uWaveCount;
uniform sampler2D uMask;
uniform vec4 uLogo;
uniform float uOpening;
out vec2 vLocal;
out vec2 vLogoPoint;
flat out vec4 vDrive;
flat out vec4 vInk;

const float ASPECT = ${aspect.toFixed(2)};
uint hash(uvec2 p) {
  uint n = p.x * 747796405u + p.y * 2891336453u;
  n = ((n >> ((n >> 28u) + 4u)) ^ n) * 277803737u;
  return (n >> 22u) ^ n;
}
float noise(uint n) { return float(n & 65535u) * (1.0 / 65535.0); }
void main() {
  ivec2 id = uOrigin + ivec2(gl_InstanceID % uColumns, gl_InstanceID / uColumns);
  vec2 world = vec2(id);
  vec2 q = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) - .5;
  vLocal = q;
  vec2 px = (world - uCenter + q) * uPitch * vec2(ASPECT, 1.0);
  gl_Position = vec4(px.x * 2.0 / uViewport.x, -px.y * 2.0 / uViewport.y, 0, 1);

  uint h = hash(uvec2(id));
  float random = noise(h);
  float alternate = noise(h >> 15u);
  int slot = (id.y + 1) * 4 + id.x + 2;
  bool actual = id.x >= -2 && id.x <= 1 && id.y >= -1 && id.y <= 1;
  float status = uEvidence[actual ? slot : int(h % 12u)];
  float atlasSlot = actual && status >= 0.0 ? float(slot) : 12.0;
  float tick = uTime * (.65 + alternate * 1.02) + random * 9.0;
  float beat = floor(tick);
  float phase = fract(tick);
  float before = noise(hash(uvec2(h, uint(beat))));
  float after = noise(hash(uvec2(h, uint(beat) + 1u)));
  float spring = (1.0 - exp(-phase * 7.3) * cos(phase * 11.0));
  spring = mix(spring, 1.0, smoothstep(.69, 1.0, phase));
  float level = clamp(mix(before, after, spring), 0.0, 1.0);
  // A broad swell and its wake drift across the lattice at different speeds.
  vec2 lattice = world * vec2(ASPECT, 1.0);
  float bend = 52.0 * sin(lattice.x * .0058 + uTime * .19)
    + 21.0 * sin(lattice.x * .0102 - uTime * .16);
  float crest = (lattice.y + lattice.x * .14 + bend - 105.0 * sin(uTime * .23 - 2.3)) / 104.0;
  float wake = (lattice.y - lattice.x * .23 - bend * .70 + 125.0 + 69.0 * sin(uTime * .16)) / 124.0;
  float breadth = .74 + .26 * sin(lattice.x * .005 - uTime * .13);
  float wash = exp(-crest * crest) * breadth * .77 + exp(-wake * wake) * .20;
  for (int i = 0; i < 6; i++) {
    if (i >= uWaveCount) break;
    vec4 wave = uWaves[i];
    vec2 d = (world - wave.xy) * vec2(ASPECT, 1.0);
    vec2 axis = uWaveShape[i].xy;
    float elapsed = uTime - wave.z;
    float along = dot(d, axis) / wave.w;
    float across = dot(d, vec2(-axis.y, axis.x)) / wave.w;
    float flow = along - elapsed + .42 * sin(across * .92 + elapsed * .43);
    float spread = flow / 1.15;
    float envelope = exp(-spread * spread - across * across * .10);
    float life = smoothstep(0.0, .40, elapsed) * (1.0 - smoothstep(.62, 1.0, elapsed / uWaveShape[i].z));
    wash += envelope * life * .24;
  }
  float tide = clamp(1.0 - wash, .03, 1.0);
  vDrive = vec4(atlasSlot, level, tide, status);

  vec2 lp = (world - uLogo.xy) * vec2(ASPECT * 1536.0 / 1527.0, 1.0) / uLogo.z;
  vLogoPoint = lp + q * vec2(ASPECT * 1536.0 / 1527.0, 1.0) / uLogo.z;
  float inside = 0.0;
  float shore = 1.0;
  if (uLogo.w > 0.0) {
    vec2 nearest = clamp(lp, -.5, .5);
    vec2 sampleMask = textureLod(uMask, nearest + .5, 0.0).rg;
    inside = max(abs(lp.x), abs(lp.y)) <= .5 ? sampleMask.r : 0.0;
    shore = min(1.0, sampleMask.g * .63 + length(lp - nearest) * .72);
  }
  float fadeStart = clamp(shore * .65 + random * .21, 0.0, .82);
  float outsideFade = smoothstep(fadeStart, fadeStart + .17, uLogo.w);
  float ink = smoothstep(random * .26, .62 + random * .25, uLogo.w);
  float coverage = 1.0;
  if (id.x < -2 || id.x > 1 || abs(id.y) > 1) {
    float advance = max(max(abs(world.x + .5) - 1.5, abs(world.y) - 1.0), 1.0);
    coverage = smoothstep(advance * .10, advance * .10 + .29, uOpening);
  }
  vInk = vec4(outsideFade, ink, inside, coverage);
}`;

const fragment = `#version 300 es
precision highp float;
uniform float uPitch;
uniform float uTime;
uniform sampler2D uCards;
uniform sampler2D uMask;
uniform float uSolid;
in vec2 vLocal;
in vec2 vLogoPoint;
flat in vec4 vDrive;
flat in vec4 vInk;
out vec4 outColor;

float box(vec2 p, vec2 halfSize, float aa) {
  vec2 delta = abs(p) - halfSize;
  return (1.0 - smoothstep(-aa, aa, delta.x)) * (1.0 - smoothstep(-aa, aa, delta.y));
}

void main() {
  vec2 p = vLocal * vec2(1.28, 1.0);
  float aa = min(.17, .54 / uPitch);
  float density = 1.0 - smoothstep(5.0, 48.0, uPitch);
  float detail = 1.0 - density;
  float body = box(p, vec2(.566, .438), aa);
  float inner = box(p, vec2(.558, .430), aa);
  float tide = vDrive.z;
  float amplitude = vDrive.y;
  float stipple = mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0);
  float grain = (stipple - .5) * .07;
  float tone = mix(.985, .13 + .79 * tide + .045 * amplitude + grain, density);
  float edge = body - inner;
  float paper = mix(1.0, .97 - .035 * (1.0 - tide), density);

  if (detail > 0.01 && body > .005 && vInk.y < .97) {
    // Ruled evidence record with a diagram between the title and result.
    float seams = box(p - vec2(0., -.242), vec2(.565, .004), aa)
      + box(p - vec2(0., .234), vec2(.565, .004), aa);
    tone = mix(tone, .65, seams * detail);
    vec2 chart = p - vec2(0., .083);
    float chartArea = box(chart, vec2(.475, .113), aa);
    float graphGrid = step(.94, fract((chart.x + .476) * 9.0))
      + step(.93, fract((chart.y + .113) * 18.0));
    tone = mix(tone, .64, min(1.0, graphGrid) * chartArea * detail * .36);
    float trace = floor((.5 + .37 * sin(floor((chart.x + .49) * 13.0) * .86 + amplitude * 4.0)
      + .10 * sin(uTime * 2.2 + chart.x * 11.0)) * 5.0) / 5.0;
    float y = (trace - .5) * .164;
    float line = (1.0 - smoothstep(.004, .004 + aa, abs(chart.y - y))) * chartArea;
    float cursor = box(chart - vec2(mix(-.43,.43,amplitude), y), vec2(.016), aa) * chartArea;
    tone = mix(tone, mix(.13, .46, tide), max(line, cursor) * detail);

    float lettering = smoothstep(36., 90., uPitch);
    if (lettering > .001) {
      vec2 uv = p / vec2(1.132, .876) + .5;
      vec2 tile = vec2(mod(vDrive.x, 4.0), floor(vDrive.x / 4.0));
      float glyph = texture(uCards, (tile + clamp(uv, .002, .998)) / 4.0).r;
      tone = mix(tone, .045, glyph * lettering * inner);
    }
  }
  float square = mix(paper, tone, body);
  square = mix(square, .09, edge * smoothstep(4.0, 41.0, uPitch));
  // White paper advances out from the silhouette; the intact cells become moving ink.
  float outside = mix(square, 1.0, vInk.x);
  float ink = mix(1.0, .025 + amplitude * .15 + (stipple * .03), body);
  float inside = mix(square, ink, vInk.y);
  float field = mix(1.0, mix(outside, inside, vInk.z), vInk.w);
  if (uSolid > 0.0) {
    float silhouette = max(abs(vLogoPoint.x), abs(vLogoPoint.y)) <= .5
      ? texture(uMask, vLogoPoint + .5).r : 0.0;
    field = mix(field, 1.0 - silhouette, uSolid);
  }
  outColor = vec4(vec3(field), 1.0);
}`;

function distanceToInk(ink, width, height) {
  const distances = Float32Array.from(ink, (value) => value > 127 ? 0 : Infinity);
  // Two chamfer passes approximate Euclidean distance to the nearest ink pixel.
  for (const direction of [1, -1]) {
    for (let row = 0; row < height; row++) {
      const y = direction === 1 ? row : height - 1 - row;
      for (let col = 0; col < width; col++) {
        const x = direction === 1 ? col : width - 1 - col;
        const i = y * width + x;
        if (col > 0) distances[i] = Math.min(distances[i], distances[i - direction] + 1);
        if (row > 0) {
          const upper = i - direction * width;
          distances[i] = Math.min(distances[i], distances[upper] + 1,
            x > 0 ? distances[upper - 1] + 1.414 : Infinity,
            x < width - 1 ? distances[upper + 1] + 1.414 : Infinity);
        }
      }
    }
  }
  return distances;
}

function cardAtlas(cards) {
  const width = 256, height = 200;
  const atlas = new OffscreenCanvas(width * 4, height * 4);
  const ctx = atlas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  const write = (label, x, y, size) => {
    ctx.font = `${size}px "Departure Mono"`;
    ctx.fillText(label, x, y, width - 24);
  };
  const synthetic = { kind: 'SIMULATION', title: 'Field activity', result: 'Procedural signal', state: 'SIMULATED', tone: 5 };
  [...cards, synthetic].forEach((entry, i) => {
    const card = entry || synthetic;
    const x = i % 4 * width;
    const y = Math.floor(i / 4) * height;
    write(card.kind, x + 12, y + 23, 13);
    write(card.title, x + 12, y + 69, 25);
    write(card.state.toUpperCase(), x + 12, y + 162, 13);
    write(card.result, x + 12, y + 181, 14);
    const marks = card.tone === 3 ? 1 : card.tone === 5 ? 2 : 4;
    for (let slot = 0; slot < marks; slot++) ctx.fillRect(x + 211 + slot * 8, y + 19, 5, 7);
  });
  const pixels = ctx.getImageData(0, 0, atlas.width, atlas.height).data;
  const bytes = new Uint8Array(atlas.width * atlas.height);
  for (let i = 0; i < bytes.length; i++) bytes[i] = pixels[i * 4 + 3];
  return { bytes, width: atlas.width, height: atlas.height };
}

export async function loadMask() {
  const image = new Image();
  image.src = '/kujo-logomark.svg';
  await image.decode();
  const canvas = new OffscreenCanvas(764, 768);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const bytes = new Uint8Array(canvas.width * canvas.height);
  // The published SVG is the transparent K cut out of an ink square.
  for (let i = 0; i < bytes.length; i++) bytes[i] = 255 - pixels[i * 4 + 3];
  const distance = distanceToInk(bytes, canvas.width, canvas.height);
  const mask = new Uint8Array(bytes.length * 2);
  for (let i = 0; i < bytes.length; i++) {
    mask[2 * i] = bytes[i];
    mask[2 * i + 1] = Math.round(Math.min(1, distance[i] / (canvas.height * .55)) * 255);
  }
  return { bytes: mask, width: canvas.width, height: canvas.height };
}

function link(gl) {
  const program = gl.createProgram();
  for (const [kind, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
    const shader = gl.createShader(kind);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  return program;
}

export function createField(canvas, mask, cards) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, stencil: false, depth: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL2 is unavailable.');
  const program = link(gl);
  gl.useProgram(program);
  const names = ['Viewport','Center','Pitch','Time','Origin','Columns','Evidence','Waves','WaveShape','WaveCount','Mask','Cards','Logo','Solid','Opening'];
  const u = Object.fromEntries(names.map((key) => [key, gl.getUniformLocation(program, 'u' + key)]));
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  function upload(source, unit, format, channels) {
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, format, source.width, source.height, 0, channels, gl.UNSIGNED_BYTE, source.bytes);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }
  const texture = upload(mask, 0, gl.RG8, gl.RG);
  const atlas = upload(cardAtlas(cards), 1, gl.R8, gl.RED);
  gl.uniform1i(u.Mask, 0);
  gl.uniform1i(u.Cards, 1);
  gl.uniform1fv(u.Evidence, new Float32Array(cards.map((card) => card?.tone ?? -1)));
  gl.clearColor(1, 1, 1, 1);
  const debuggerInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const queries = [];
  const gpu = [];
  const packedWaves = new Float32Array(24);
  const packedShapes = new Float32Array(18);
  let draws = 0;
  return {
    gpu, info: { renderer: debuggerInfo ? gl.getParameter(debuggerInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE), maxViewport: [...gl.getParameter(gl.MAX_VIEWPORT_DIMS)], timer: Boolean(timer) },
    draw({ width, height, camera, time, waves, logo, opening, sample }) {
      const grid = project(camera, width, height);
      const factor = canvas.height / height;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u.Viewport, width, height);
      gl.uniform2f(u.Center, camera.x, camera.y);
      gl.uniform1f(u.Pitch, camera.pitch * factor);
      gl.uniform1f(u.Time, time);
      gl.uniform2i(u.Origin, grid.x, grid.y);
      gl.uniform1i(u.Columns, grid.columns);
      gl.uniform1f(u.Opening, opening);
      gl.uniform4f(u.Logo, logo.x, logo.y, logo.height, logo.amount);
      gl.uniform1f(u.Solid, logo.solid);
      const active = waves.slice(-6);
      active.forEach((wave, i) => {
        packedWaves.set([wave.x,wave.y,wave.start,wave.velocity], i * 4);
        packedShapes.set([Math.cos(wave.direction),Math.sin(wave.direction),wave.lifetime], i * 3);
      });
      gl.uniform4fv(u.Waves, packedWaves);
      gl.uniform3fv(u.WaveShape, packedShapes);
      gl.uniform1i(u.WaveCount, active.length);
      const old = queries[0];
      if (old && gl.getQueryParameter(old, gl.QUERY_RESULT_AVAILABLE)) {
        if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) gpu.push({ time: old.sceneTime, ms: gl.getQueryParameter(old, gl.QUERY_RESULT) / 1e6 });
        gl.deleteQuery(queries.shift());
      }
      const query = sample && timer && ++draws % 8 === 0 && queries.length < 4 ? gl.createQuery() : null;
      if (query) {
        query.sceneTime = time;
        gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
      }
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, grid.count);
      if (query) {
        gl.endQuery(timer.TIME_ELAPSED_EXT);
        queries.push(query);
      }
      return grid.count;
    },
    dispose() {
      for (const query of queries) gl.deleteQuery(query);
      gl.deleteTexture(texture);
      gl.deleteTexture(atlas);
      gl.deleteProgram(program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
