import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(project, "../../../..");
const work = resolve(project, "../..");
const read = (path) => readFileSync(resolve(repo, path), "utf8");
const json = (path) => JSON.parse(read(path));
const write = (path, content) => writeFileSync(resolve(project, path), content);
const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const handoff = json("video/scenes.json");
const capture = json("video/visual-data/baseline-terminal.json");
const winner = json("video/visual-data/winner-terminal.json");
const issue = json("scenarios/example.json");
const cassette = json(`cassettes/${capture.request_hash}.json`);
const reply = JSON.parse(JSON.parse(cassette.response.body).choices[0].message.content);
const miss = JSON.parse(read("results/tests.log").split("\n").find(line => line.startsWith("Expected native error: ")).slice(23));
const replay = json("video/visual-data/cassette-reuse.json");
const milestones = json("video/visual-data/milestones.json");
const rejected = json("video/visual-data/caught-regressions.json").find(item => item.experiment_id === "candidate-193");
const failure = rejected.failures.find(item => item.id === "exposure-console");
const terminalLog = read("results/optimization.log");
const final = json("results/final.json");
const reproduced = json("results/reproduction.json");
const summary = json("video/visual-data/summary.json");
const candidates = read("video/visual-data/score-progression.csv").trim().split("\n").slice(1).map(line => {
  const [ordinal, id, phase, score, , , , violations, , passed] = line.split(",");
  return { ordinal: Number(ordinal), id, phase, score: Number(score), violations: Number(violations), passed: passed === "true" };
});
if (winner.request_hash !== capture.request_hash || cassette.request_meta.hash !== capture.request_hash) throw new Error("Terminal and cassette identity mismatch");
if (candidates.length !== reproduced.matching_candidate_records) throw new Error("Sweep row mismatch");
if (!terminalLog.includes(rejected.experiment_id) || !terminalLog.includes(final.winner_id)) throw new Error("Experiment missing in the terminal log");

const hr = (s) => esc(s.replaceAll("_", " "));
const percent = (number) => `${Number(number.toFixed(1))}%`;
const phaseCount = (phase) => candidates.filter(row => row.phase === phase).length;
const number = (count) => new Intl.NumberFormat("en-US").format(count);
const clipLine = (key, value, comma = ",") => `  "${key}": <span class="output-value">${esc(JSON.stringify(value))}</span>${comma}`;
const output = (decision) => [clipLine("action", decision.action), clipLine("priority", decision.priority), clipLine("human_review", decision.human_review, "")].join("\n");
const terminal = (className, label, cmd, content) => `<div class="terminal ${className}"><div class="command">${esc(label)}<span style="float:right">${esc(cmd)}</span></div><pre class="output">${content}</pre></div>`;
const foot = (source) => `<div class="footer"><span class="source">${esc(source)}</span><span class="source">github.com/kujolang/kujo-replay-lab</span></div>`;

function scene(id, kind, source, body, animation) {
  const row = handoff.scenes.find(entry => entry.id === id);
  write(`compositions/${id}.html`, `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /></head><body><template>
<style>#root { position: absolute; inset: 0; width: 100%; height: 100%; }</style>
<div id="root" class="scene ${kind} ${id}" data-composition-id="${id}" data-width="1920" data-height="1080" data-duration="${row.duration_seconds}">
  <div class="header"><span class="kicker">Kujo Replay Lab</span></div>
  <main class="content">${body}</main>
  ${foot(source)}
</div>
<script>
(() => {
  const inside = (selector) => document.querySelectorAll(selector);
  const timeline = gsap.timeline({ paused: true });
  const reveal = (selector, at, duration = 0.44, dy = 16) => timeline.fromTo(inside(selector),
    { opacity: 0, y: dy }, { opacity: 1, y: 0, duration, ease: "power3.out" }, at);
  const fade = (selector, at, duration = 0.30) => timeline.to(inside(selector), { opacity: 0, duration, ease: "power1.inOut" }, at);
  ${animation}
  window.__timelines["${id}"] = timeline;
})();
</script>
</template></body></html>
`);
}
const description = issue.description.match(/Existing production jobs have stopped/)[0];
scene("baseline", "", "scenarios/example.json  ·  baseline-terminal.json", `
  <p class="kicker heading opening">Issue report</p>
  <h1 class="quote opening">${esc(description)}.</h1>
  <p class="scenario opening">${esc(issue.title)} <span class="small"> / filed as ${esc(issue.labels[0])}</span></p>
  ${terminal("baseline-terminal", "Baseline · captured output excerpt", "tools/lab triage scenarios/example.json", `{\n${output(capture.decision)}\n}`)}
`, `
  reveal(".baseline-terminal", 3.5, 0.58);
`);

scene("record", "paper", "cassette v1  ·  recorded HTTP response excerpt", `
  <h2 class="heading">Capture the interaction.</h2>
  <p class="sub">Scripted loopback classifier</p>
  <div class="digest">
    <p class="kicker">Normalized request · SHA-256</p>
    <code>${esc(cassette.request_meta.hash)}</code>
  </div>
  <div class="reply">
    <aside class="reply-copy">Kujo recorded the HTTP response once. The cassette preserves what the classifier returned.</aside>
    ${terminal("reply-terminal", "Classifier response", "", `{\n${clipLine("category", reply.category)}\n${clipLine("severity", reply.severity)}\n${clipLine("confidence", reply.confidence, "")}\n}`)}
  </div>
`, `
  reveal(".digest", 0.6, 0.5);
  reveal(".reply", 3.15, 0.52);
`);

const missMarker = miss.message.match(/kind:"replay_miss"/)[0];
const noNetwork = miss.message.split("; ").at(-1);
scene("replay", "", "results/tests.log  ·  actual strict-miss output excerpt", `
  <h2 class="heading">Replay the same response.</h2>
  <p class="sub">Keep the model request fixed. Change the triage policy.</p>
  <div class="flow">
    <div class="flow-node flow-request"><span class="kicker">Input</span><h3>Issue request</h3><p>Same prompt and model options</p></div>
    <span class="flow-arrow flow-request">→</span>
    <div class="flow-node flow-cassette"><span class="kicker">Strict replay</span><h3>Native cassette</h3><p>Lookup by request hash</p></div>
    <span class="flow-arrow flow-cassette">→</span>
    <div class="flow-node flow-policy"><span class="kicker">Candidate</span><h3>Triage policy</h3><p>Change decision rules here</p></div>
    <span class="flow-arrow flow-policy">→</span>
    <div class="flow-node flow-eval"><span class="kicker">Evaluation</span><h3>Fixed oracle</h3><p>Score the resulting decisions</p></div>
  </div>
  ${terminal("miss", "Expected native error · changed request", "", esc(`${missMarker}\n${noNetwork}`))}
`, `
  reveal(".flow-request", 0.15, 0.4, 10);
  reveal(".flow-cassette", 1.2, 0.4, 10);
  reveal(".miss", 4.5, 0.45, 12);
  reveal(".flow-policy", 7.2, 0.42, 10);
  reveal(".flow-eval", 9.3, 0.42, 10);
`);

const plotX = (ordinal) => 76 + ordinal * 7.05;
const plotY = (score) => 416 - (score - 60) * 9.15;
const steps = milestones.reduce((points, row) => [...points, [row.ordinal, points.at(-1)[1]], [row.ordinal, row.score_pct]], [[0, summary.tuning_baseline_pct]]);
steps.push([200, steps.at(-1)[1]]);
const selected = milestones.find(row => row.id === final.winner_id);
const phaseStop = phaseCount("exploration") + phaseCount("refinement");
const circles = candidates.map(({ ordinal, score, passed }) => {
  const x = plotX(ordinal), y = plotY(score);
  return passed
    ? `<circle cx="${x}" cy="${y}" r="3.6" fill="#7a7a7a" fill-opacity=".66"/>`
    : `<path d="M${x - 4} ${y - 4}l8 8m0 -8l-8 8" stroke="#343434" stroke-width="2" fill="none"/>`;
}).join("\n");
const chart = `<svg width="1536" height="470" viewBox="0 0 1536 470" aria-label="Weighted tuning scores for all 200 actual candidates">
  <defs><clipPath id="sweep-reveal"><rect class="sweep-mask" x="68" y="0" width="1440" height="460"/></clipPath></defs>
  ${[60, 70, 80, 90, 100].map(value => `<path d="M76 ${plotY(value)}h1410" stroke="#c7c7c7" fill="none"/><text x="0" y="${plotY(value)+6}" class="chart-label">${value}%</text>`).join("")}
  ${[phaseCount("exploration"), phaseStop].map(value => `<path d="M${plotX(value)} 42V416" stroke="#939393" stroke-dasharray="3 5" fill="none"/>`).join("")}
  <g clip-path="url(#sweep-reveal)">
    ${circles}
    <polyline points="${steps.map(([idx, score]) => `${plotX(idx)},${plotY(score)}`).join(" ")}" stroke="#151515" stroke-width="3.5" fill="none"/>
  </g>
  <g class="sweep-selected">
    <circle cx="${plotX(selected.ordinal)}" cy="${plotY(selected.score_pct)}" r="8" stroke="#151515" stroke-width="3" fill="#efefef"/>
    <text x="${plotX(selected.ordinal)+18}" y="30" class="chart-label" style="fill:#191919;font-size:24px">Candidate ${selected.ordinal} · ${percent(selected.score_pct)}</text>
  </g>
  <text x="75" y="450" class="chart-label">0</text><text x="${plotX(phaseCount("exploration"))-17}" y="450" class="chart-label">${phaseCount("exploration")}</text><text x="${plotX(phaseStop)-31}" y="450" class="chart-label">${phaseStop}</text><text x="${plotX(candidates.length)-13}" y="450" class="chart-label">${candidates.length}</text>
</svg>`;

scene("sweep", "paper", "score-progression.csv  ·  milestones.json  ·  cassette-reuse.json", `
  <h2 class="heading">Sweep the policy space.</h2>
  <p class="sub">${number(candidates.length)} candidates × ${number(replay.tuning_cassettes)} tuning scenarios · weighted score</p>
  <figure class="chart-area" style="margin:0">${chart}</figure>
  <div class="chart-info">
    <div class="left">
      <div><b>${phaseCount("exploration")}</b><span class="small">Exploration</span></div>
      <div><b>${phaseCount("refinement")}</b><span class="small">Refinement</span></div>
      <div><b>${phaseCount("challenge")}</b><span class="small">Challenge</span></div>
    </div>
    <div class="right"><b>${number(replay.candidate_replay_hits)}</b><div class="small">Native replay hits · ${replay.candidate_replay_misses} misses · ${replay.external_model_calls} external model calls</div></div>
  </div>
`, `
  timeline.fromTo(inside(".sweep-mask"), { attr: { width: 0 } },
      { attr: { width: 1440 }, duration: 5.4, ease: "none" }, 2.7);
  reveal(".sweep-selected", 6.8, 0.45, 5);
  reveal(".chart-info .right", 12.7, 0.52, 12);
`);

const configChange = rejected.parameters_changed.escalate_exposure;
scene("regression", "", "caught-regressions.json  ·  exposure-console", `
  <h2 class="heading">The safety gate rejects it.</h2>
  <p class="sub">Candidate ${rejected.ordinal} scored ${percent(rejected.score_pct)} on tuning.</p>
  <p class="reg-toggle"><code>escalate_exposure</code> <span class="small">changed</span> <code>${configChange.from} → ${configChange.to}</code></p>
  <div class="rows">
    ${terminal("expected", "Expected decision", "", `{\n${output(failure.expected)}\n}`)}
    ${terminal("observed", "Actual decision", "", `{\n${output(failure.actual)}\n}`)}
  </div>
  <div class="reg-note"><b>REJECTED · ${rejected.safety_violations} hard failures</b><span class="mono">${rejected.critical_recalled}/${rejected.critical_total} critical escalations</span></div>
`, `
  reveal(".reg-toggle", 2.6, 0.4);
  reveal(".rows .expected", 4.1, 0.44);
  reveal(".rows .observed", 5.7, 0.44);
  reveal(".reg-note", 11.1, 0.5);
`);

function scoreBar(label, outcome, id) {
  return `<div class="bar-row ${id}">
    <div><div class="noun">${esc(label)}</div><div class="small">${outcome.passed_tests}/${outcome.scenario_count} passed</div></div>
    <div class="bar"><span style="width:${outcome.score_pct}%"></span></div>
    <b>${percent(outcome.score_pct)}</b>
  </div>`;
}
scene("validated", "paper", "final.json  ·  captured terminal excerpts  ·  reproduction.json", `
  <div class="result-page">
    <h2 class="heading">The frozen policy holds up.</h2>
    <p class="sub">Weighted score across ${final.winner.scenario_count} held-out cases</p>
    <div class="bars">
      ${scoreBar("Baseline", final.baseline, "bar-base")}
      ${scoreBar("Candidate " + selected.ordinal, final.winner, "bar-winner")}
    </div>
  </div>
  <div class="cmp">
    <h2>Same request. Better routing.</h2>
    <div class="rows">
      ${terminal("before", "Baseline · captured excerpt", "", `{\n${output(capture.decision)}\n}`)}
      ${terminal("after", "Winner · captured excerpt", "", `{\n${output(winner.decision)}\n}`)}
    </div>
    <div class="digest"><p class="kicker">Shared request hash</p><code>${esc(winner.request_hash)}</code></div>
  </div>
  <div class="cta"><code>tools/lab test</code><span class="repo">${reproduced.matching_candidate_records} candidate records reproduced</span></div>
`, `
  timeline.fromTo(inside(".bar-base .bar span"), { scaleX: 0 },
      { scaleX: 1, duration: 1.15, ease: "power3.out" }, 2.5);
  timeline.fromTo(inside(".bar-winner .bar span"), { scaleX: 0 },
      { scaleX: 1, duration: 1.15, ease: "power3.out" }, 4.6);
  fade(".result-page", 8.0, 0.3);
  reveal(".cmp", 8.3, 0.45, 10);
  reveal(".cta", 17.0, 0.45, 8);
`);

const duration = handoff.scenes.reduce((total, row) => total + row.duration_seconds, 0);
if (duration !== 92) throw new Error("Unexpected composition length");

let start = 0;
const hosts = handoff.scenes.map(row => {
  const tag = `<div id="scene-${row.id}" class="clip" data-composition-id="${row.id}" data-composition-src="compositions/${row.id}.html" data-start="${start}" data-duration="${row.duration_seconds}" data-track-index="0" data-track-kind="graphics" data-width="1920" data-height="1080"></div>`;
  start += row.duration_seconds;
  return tag;
});

const upstreamTiming = resolve(work, "assets/audio/timings.json");
const timing = resolve(project, "assets/audio/timings.json");
const carve = resolve(project, "assets/audio/carve.json");
const tunedAttributes = existsSync(carve) ? JSON.parse(readFileSync(carve, "utf8")) : {};
let audio = [];
if (existsSync(upstreamTiming) || existsSync(timing)) {
  const fromWorkspace = existsSync(upstreamTiming);
  const parsed = JSON.parse(readFileSync(fromWorkspace ? upstreamTiming : timing, "utf8"));
  const narration = parsed.narration.map(({ id, path, start, duration }) => ({
    id, path: "assets/audio/" + path.split("/").at(-1), start, duration
  }));
  mkdirSync(resolve(project, "assets/audio"), { recursive: true });
  const tracks = [
    ...narration.map((clip) => ({ ...clip, track: 1, group: "voiceover" })),
    { id: "music-bed", path: "assets/audio/music.wav", start: 0, duration: 92, track: 2, group: "music" },
    { id: "sfx-cues", path: "assets/audio/sfx.wav", start: 0, duration: 92, track: 3, group: "sfx" }
  ];
  if (narration.length !== handoff.scenes.length) throw new Error("Invalid narration clip count");
  tracks.forEach(({ id, path, start, duration, track, group }) => {
    const target = resolve(project, path);
    const local = fromWorkspace ? resolve(work, path) : target;
    if (!existsSync(local) || start < 0 || duration <= 0 || start + duration > 92) {
      throw new Error("Audio outside the production timeline: " + id);
    }
    if (fromWorkspace) copyFileSync(local, target);
    const attributes = Object.entries(tunedAttributes[id] ?? {})
      .map(([key, value]) => " " + esc(key) + '="' + esc(value) + '"').join("");
    audio.push('<audio id="' + esc(id) + '" class="clip" data-start="' + start
      + '" data-duration="' + duration + '" data-track-index="' + track + '" data-audio-group="'
      + group + '" data-volume="1" src="' + esc(path) + '"' + attributes + '></audio>');
  });
  write("assets/audio/timings.json", JSON.stringify({ narration }, null, 2) + "\n");
}

write("index.html", `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Kujo Replay Lab</title><link rel="stylesheet" href="./style.css" />
<script src="assets/vendor/gsap.min.js"></script></head>
<body>
  <div id="replay-lab" data-composition-id="replay-lab" data-width="1920" data-height="1080" data-duration="${duration}" data-fps="30">
    ${hosts.join("\n    ")}
    ${audio.join("\n    ")}
  </div>
  <script>window.__timelines["replay-lab"] = gsap.timeline({ paused: true });</script>
</body>
</html>
`);
