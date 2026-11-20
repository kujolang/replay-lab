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
uniform vec2 uEvidence[12];
uniform vec4 uWaves[6];
uniform vec2 uWaveShape[6];
uniform int uWaveCount;
uniform sampler2D uMask;
uniform vec4 uLogo;
uniform float uOpening;
out vec2 vLocal;
flat out vec4 vDrive;
flat out vec4 vInk;
flat out vec3 vTone;
const vec3 palette[6] = vec3[](
  vec3(.75, .94, .18), vec3(.16, .76, .96), vec3(.65, .50, 1.0),
  vec3(1.0, .34, .36), vec3(1.0, .61, .16), vec3(.97, .47, .80)
);
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
  vec2 evidence = uEvidence[actual ? slot : int(h % 12u)];
  int color = int(evidence.x);
  if (!actual && alternate > .56) color = int((h >> 22u) % 6u);
  // Flowing color neighborhoods remain anchored to the same lattice while the camera moves.
  float hue = mod(3.0 + 1.72 * sin(world.x * .025 - world.y * .019 + uTime * .47) +
    1.51 * sin(world.y * .037 + world.x * .013 - uTime * .53) + random * .44, 6.0);
  int index = int(hue);
  vec3 ribbon = mix(palette[index], palette[(index + 1) % 6], smoothstep(0.0, 1.0, fract(hue)));
  vTone = mix(palette[color], ribbon, actual ? 0.0 : .66);
  float tick = uTime * (.65 + alternate * 1.02) + random * 9.0;
  float beat = floor(tick);
  float phase = fract(tick);
  float before = noise(hash(uvec2(h, uint(beat))));
  float after = noise(hash(uvec2(h, uint(beat) + 1u)));
  float spring = (1.0 - exp(-phase * 7.3) * cos(phase * 11.0));
  spring = mix(spring, 1.0, smoothstep(.69, 1.0, phase));
  float level = clamp(mix(before, after, spring), 0.0, 1.0);
  float toggled = smoothstep(.40, .60, level);

  float weight = 0.0;
  float rhythm = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= uWaveCount) break;
    vec4 wave = uWaves[i];
    vec2 origin = (world - wave.xy) * vec2(ASPECT, 1.0);
    vec2 directional = vec2(cos(uWaveShape[i].x), sin(uWaveShape[i].x));
    float elapsed = uTime - wave.z;
    float width = wave.w * .23;
    float radial = length(origin) - elapsed * wave.w;
    float plane = dot(origin, directional) - elapsed * wave.w * .72 + wave.w * .36;
    float d = radial / width;
    float travel = exp(-abs(d) * .59) * (.62 + .38 * cos(d * 3.1));
    float stripe = exp(-abs(plane / width) * 1.68) * .38;
    float edge = smoothstep(0.0, .12, elapsed) * (1.0 - smoothstep(uWaveShape[i].y * .74, uWaveShape[i].y, elapsed));
    weight += (travel + stripe) * edge;
    rhythm += sin(d * 2.4 + uWaveShape[i].x) * travel * edge;
  }
  float wave = 1.0 - exp(-weight * 2.45);
  level = mix(level, clamp(.48 + .41 * rhythm, .03, .98), wave * .72);
  vDrive = vec4(float(color), level, toggled, actual ? evidence.y : 0.0);

  vec2 lp = (world - uLogo.xy) * vec2(ASPECT * 1536.0 / 1527.0, 1.0) / uLogo.z;
  float inside = 0.0;
  if (uLogo.w > 0.0 && max(abs(lp.x), abs(lp.y)) <= .5) inside = textureLod(uMask, lp + .5, 0.0).r;
  float arrival = clamp(.45 + (lp.x * .53 + lp.y * .46) + (random - .5) * .12, 0.0, .87);
  float reveal = smoothstep(arrival, arrival + .13, uLogo.w);
  float sweep = exp(-abs(uLogo.w - arrival) * 22.0) * smoothstep(.001, .035, uLogo.w) * (1.0 - smoothstep(.93, 1.0, uLogo.w));
  float coverage = 1.0;
  if (abs(id.x) > 2 || abs(id.y) > 1) {
    float advance = max(max(abs(world.x) - 2.0, abs(world.y) - 1.0), 1.0);
    coverage = smoothstep(advance * .10, advance * .10 + .29, uOpening);
  }
  vInk = vec4(clamp(wave + sweep * .84, 0.0, 1.0), reveal, inside, coverage);
}`;

const fragment = `#version 300 es
precision highp float;
precision highp int;
uniform float uPitch;
uniform float uTime;
in vec2 vLocal;
flat in vec4 vDrive;
flat in vec4 vInk;
flat in vec3 vTone;
out vec4 outColor;
const vec3 paper = vec3(.969, .965, .941);
const vec3 black = vec3(.065, .064, .07);

float rounded(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float mark(float d, float aa) { return 1.0 - smoothstep(-aa, aa, d); }
float shape(vec2 q, vec2 size, float radius, float aa) { return mark(rounded(q, size, radius), aa); }
int segments(int digit) {
  const int data[10] = int[](63,6,91,79,102,109,125,7,127,111);
  return data[digit];
}
float digit(vec2 p, int val, float aa) {
  int mask = segments(val);
  float use = 0.0;
  if ((mask & 1) != 0) use = max(use, shape(p + vec2(0,.062), vec2(.027,.0049), .0035, aa));
  if ((mask & 2) != 0) use = max(use, shape(p - vec2(.031,-.031), vec2(.0049,.024), .0035, aa));
  if ((mask & 4) != 0) use = max(use, shape(p - vec2(.031, .031), vec2(.0049,.024), .0035, aa));
  if ((mask & 8) != 0) use = max(use, shape(p - vec2(0,.062), vec2(.027,.0049), .0035, aa));
  if ((mask & 16) != 0) use = max(use, shape(p - vec2(-.031, .031), vec2(.0049,.024), .0035, aa));
  if ((mask & 32) != 0) use = max(use, shape(p - vec2(-.031,-.031), vec2(.0049,.024), .0035, aa));
  if ((mask & 64) != 0) use = max(use, shape(p, vec2(.027,.0049), .0035, aa));
  return use;
}
void main() {
  vec2 p = vLocal;
  p.x *= 1.28;
  float aa = min(.19, .64 / uPitch);
  float d = rounded(p, vec2(.556, .434), .071);
  float body = mark(d, aa);
  float offset = .021 * smoothstep(5.0, 35.0, uPitch);
  float shadow = shape(p - vec2(offset, offset), vec2(.562, .438), .075, aa);
  float detail = smoothstep(5.4, 31.0, uPitch);
  float typography = smoothstep(21., 60., uPitch);
  float activity = vDrive.y;
  vec3 tint = vTone;
  float stipple = mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y) + mod(floor(uTime * 9.0 + vDrive.y * 41.0), 2.0), 2.0);
  vec3 pulse = mix(tint * (.54 + .35 * activity), tint, activity);
  vec3 fill = mix(mix(pulse, paper, .08), mix(paper, tint, .07 + activity * .13), detail);
  float edge = 1.0 - mark(d + .010, aa);
  float edgeWeight = edge * smoothstep(3.4, 20.0, uPitch) * .93;
  vec3 surface = fill;
  if (detail > 0.0 && body > .005 && vInk.y < .999) {
    vec2 slider = p - vec2(.311, .004);
    float track = shape(slider, vec2(.096,.302), .025, aa);
    float fillEnd = mix(.27, -.27, activity);
    float juice = track * smoothstep(fillEnd-aa, fillEnd+aa, slider.y) *
      shape(slider, vec2(.080,.282), .017, aa);
    float hatch = step(.7, fract((slider.y + slider.x * .38) * 27.0));
    vec3 juiceColor = mix(tint * .71, tint, .76 + hatch * .24);
    surface = mix(surface, mix(vec3(.88,.87,.84), black, .11), track * detail);
    surface = mix(surface, juiceColor, juice * detail);
    float meter = shape(slider - vec2(0.0, fillEnd), vec2(.074,.008), .004, aa);
    surface = mix(surface, black, meter * juice * detail * .7);

    vec2 toggle = p - vec2(-.225, -.199);
    float housing = shape(toggle, vec2(.183,.090), .089, aa);
    float knob = mark(length(toggle - vec2(mix(-.091, .091, vDrive.z),0)) - .067, aa);
    surface = mix(surface, black, housing * detail);
    surface = mix(surface, mix(paper, tint, vDrive.z * .8), knob * housing * detail);

    if (typography > .001) {
      vec2 led = p - vec2(-.22, .137);
      int value = int(clamp(round(activity * 999.0), 0.0, 999.0));
      float letters = max(digit(led + vec2(.091,0), value/100, aa),
        max(digit(led, (value/10)%10, aa), digit(led - vec2(.091,0), value%10, aa)));
      float evidenceDot = shape(p + vec2(.47,.346), vec2(.022), .01, aa) * vDrive.w;
      surface = mix(surface, black, clamp(letters + evidenceDot, 0.0, 1.0) * typography);
      float ticks = shape(p - vec2(-.214,.288), vec2(.155,.015), .008, aa);
      surface = mix(surface, black, ticks * typography * (.15 + stipple * .17));
    }
  }
  surface = mix(surface, black, edgeWeight);
  float waveShade = smoothstep(.12, .85, activity * .76 + stipple * .24);
  vec3 mono = mix(vec3(.001), vec3(.998), waveShade);
  surface = mix(surface, mono, vInk.x);
  vec3 outerPaper = mix(vec3(.962, .959, .944), mono, vInk.x * .34);
  vec3 innerInk = mix(vec3(.011 + activity * .13), mono, vInk.x * .22);
  vec3 markColor = mix(outerPaper, innerInk, vInk.z);
  surface = mix(surface, markColor, vInk.y);
  vec3 pixel = mix(mix(paper, black, shadow * (.17 + vInk.x * .08) * (1.0-vInk.y)), surface, body);
  outColor = vec4(mix(paper, pixel, vInk.w), 1.0);
}`;

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
  return { bytes, width: canvas.width, height: canvas.height };
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

export function createField(canvas, mask, evidence) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, stencil: false, depth: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL2 is unavailable.');
  const program = link(gl);
  gl.useProgram(program);
  const names = ['Viewport','Center','Pitch','Time','Origin','Columns','Evidence','Waves','WaveShape','WaveCount','Mask','Logo','Opening'];
  const u = Object.fromEntries(names.map((key) => [key, gl.getUniformLocation(program, 'u' + key)]));
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, mask.width, mask.height, 0, gl.RED, gl.UNSIGNED_BYTE, mask.bytes);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(u.Mask, 0);
  gl.uniform2fv(u.Evidence, evidence);
  gl.clearColor(.969, .965, .941, 1);
  const debuggerInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const queries = [];
  const gpu = [];
  const packedWaves = new Float32Array(24);
  const packedShapes = new Float32Array(12);
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
      const active = waves.slice(-6);
      active.forEach((wave, i) => {
        packedWaves.set([wave.x,wave.y,wave.start,wave.velocity], i * 4);
        packedShapes.set([wave.direction,wave.lifetime], i * 2);
      });
      gl.uniform4fv(u.Waves, packedWaves);
      gl.uniform2fv(u.WaveShape, packedShapes);
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
      gl.deleteProgram(program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
