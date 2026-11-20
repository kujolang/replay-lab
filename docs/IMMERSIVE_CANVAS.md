# Kujo Infinite Canvas

The immersive field opens at `/`. The earlier execution workbench is available at `/workbench.html` and through the field’s hidden controls.

| Earlier Replay Lab | Immersive rebuild |
| --- | --- |
| [Workbench screenshot](../canvas/artifacts/01-execution-field.png) | [Opening field](../canvas/artifacts/immersive/A-opening.png) |
| [Browser tour](../canvas/artifacts/replay-lab-demo.webm) | [30-second field render](../canvas/artifacts/immersive/kujo-infinite-canvas.mp4) · [480p mobile download](../canvas/artifacts/immersive/kujo-infinite-canvas-480p.mp4) |
| Twelve inspectable cards inside a fixed workbench, plus a separate synthetic renderer | Twelve labeled opening cards, one procedural field with over 100,000 submitted cells, and the authentic Kujo mark formed from the same field |
| Screen recording of clicks and camera changes | A configurable camera and playback timeline rendered directly from the running application |

The square rules, grayscale palette, and Departure Mono typography follow [kujolang.ai](https://kujolang.ai). The logo uses the published [Kujo logomark](https://kujolang.ai/assets/images/kujo-logomark.svg).

## Reproduce

From `canvas/`, run `npm start` and open [http://127.0.0.1:4173](http://127.0.0.1:4173). The field loads the last evidence returned by the running lab, or the bundled prepared snapshot. For fresh runs, press **I** or right-click, open the workbench, and run the three native scenarios using the [runtime setup](../canvas/README.md). The canvas reads the latest results on its next load. Tap to launch a wave, drag to pan, and scroll or pinch to zoom. Use Space to pause and Home to start the sequence again. A touch long-press opens the controls. Reduced-motion settings start the page paused.

For automated verification and artifacts, install the test dependency with `npm ci` and install FFmpeg and a Chrome browser with WebGL2 and WebCodecs H.264 encoding. Run:

```sh
npm run showcase:test
npm run showcase:capture
HEADED=1 npm run showcase:benchmark
npm run showcase:export
```

Use `ARTIFACT_DIR` to write elsewhere, or `CHROME_CHANNEL=bundled` with `npx playwright install chromium`. The bundled browser’s available codecs and GPU may differ from Chrome. The exporter defaults to headed Chrome for hardware encoding. Use `HEADED=0` on a headless host with compatible WebCodecs support. The server and browser are opened and closed by the scripts. No third-party assets or inference services are needed at runtime.

### Visual acceptance frames

- [A — Opening](../canvas/artifacts/immersive/A-opening.png). Twelve ruled records identify the replayed decisions, policy checks, workflow steps, and saved evidence.
- [B — Expansion](../canvas/artifacts/immersive/B-expansion.png). The moving camera reveals hundreds of the same cards.
- [C — Extreme scale](../canvas/artifacts/immersive/C-extreme-scale.png). More than 140,000 submitted cells at roughly two raster pixels of pitch.
- [D — Broad swell at 11 seconds](../canvas/artifacts/immersive/D-wide-swell.png) and [replay phase](../canvas/artifacts/immersive/D-overlapping-waves.png). Broad gray areas fade gradually into white. The caption explains how replay reproduces the triage decision without another model call.
- [E — Reverse zoom](../canvas/artifacts/immersive/E-reverse-zoom.png). Captured after Playwright wheel events at the same pointer anchor. The receipt includes the camera pitch before and after.
- [F — Kujo finale](../canvas/artifacts/immersive/F-kujo-finale.png). The [formation frame](../canvas/artifacts/immersive/F-formation.png) shows the field dissipating from the silhouette outward. The cells inside the K keep moving while the surrounding field fades to white. As the address appears, the grid inside the K fades into the solid black logomark.

[Capture receipt](../canvas/artifacts/immersive/acceptance.json) · [Live measurements](../canvas/artifacts/immersive/performance.json) · [Video verification](../canvas/artifacts/immersive/export.json)

## Rendering and motion

The camera stores a world-space center and a positive pitch. A cell’s signed integer coordinates determine its identity, state sampling, and animation seed. The renderer computes a visible rectangle with a guard band and draws an instanced strip, with four vertices per cell. It allocates no per-cell buffers, textures, or DOM elements. WebGL2 keeps the procedural animation and layout in one broadly available GPU pipeline. WebGPU compute could cache per-cell wave evaluation, but would add another backend and device compatibility requirement.

The fragment shader draws the same square-cornered plates at every scale. At close range, a GPU atlas supplies each record’s type, title, status, and result. The ruled horizontal trace illustrates activity. As the camera pulls back, the lettering and hairlines fade smoothly and the plates become grayscale cells. Wheel zoom preserves the world point under the pointer. Pinch preserves that point under the moving midpoint.

A broad swell and faint wake drift across the grayscale field at different angles. Each uses a smooth falloff, with gentle bending and variation across its width. Spaced cues and taps add a single soft wash with a smooth envelope along and across its direction of travel. `choreography.mjs` holds the camera and wave cues.

The official SVG is an ink square with the K cut out. At startup the app inverts that alpha and stores a companion distance-to-ink channel. During formation, cells inside the mark darken and continue moving. Exterior cells fade to pure white in order of distance from the silhouette, with variation per cell. After that reveal, the address fades in while the renderer blends the cell field into the SVG silhouette sampled per pixel. The white boundary grows outward from the K and fills its internal cutouts. The raster resolution cap is 1,920 × 1,080 and the hidden raster control can reduce rendering cost.

## Provenance

| Source | What drives the field |
| --- | --- |
| Kujo strict replay | The recorded baseline comparison and cassette identity determine the replay caption and representative evidence values. |
| Eval | The native pass count and total drive the evaluation caption. Failed and mismatched records are labeled and use a distinct status mark. |
| Dispatch | Native workflow step statuses drive the completion caption and representative cards. |
| RunLedger | The historical study receipt contributes one representative card. The receipt belongs to the original study. |
| Spec and Workcell | Inspected upstream capabilities. No live Spec or Workcell run is asserted. |
| Procedural data | The expanding population and the animated traces are procedural. The initial twelve titles, outcomes, and statuses come from the saved issue-triage records. Card population measures drawing density and conveys no workflow concurrency or throughput. |

See the [capability map](CANVAS_CAPABILITIES.md) for source links and the original execution boundaries.

## Live performance

Measured in headed Chrome 157.0.8103.80 at 1,280 × 720 on a 16 GB Intel Core i7-9750H MacBook Pro. Chrome reported AMD Radeon Pro 5300M through ANGLE Metal, a 16,384 px texture limit and a 16,384 × 16,384 viewport limit. The original and immersive benchmark profiles use different viewport sizes and choreography.

| Live profile | Mean fps | Frame P95 | Longest frame | GPU draw mean | Peak cells submitted |
| --- | ---: | ---: | ---: | ---: | ---: |
| Full 30-second sequence | 59.2 | 17.4 ms | 116.4 ms | 1.62 ms | 157,379 |
| 75% raster, 12–27 seconds | 59.1 | 17.2 ms | 116.5 ms | 1.66 ms | 157,379 |

The full run averaged 60.0 fps during expansion, massive scale, and logo formation. 5 of 1,776 observed frames exceeded 20 ms. Reported GPU draw times exclude compositing. The live renderer used 9.0% of one CPU core, Chrome as a whole used 24.8%, and the main-thread draw-call P95 was 0.2 ms. Total Chrome RSS was 470 MiB, which can include shared pages. Shared macOS GPU counters include other processes. Per-tab GPU utilization and VRAM were unavailable. After 12 repeated phase jumps and forced collection, the browser retained 93 DOM nodes and approximately 2.19 MiB of JS heap.

The renderer requires WebGL2 and OffscreenCanvas. Browsers without it can open the retained workbench. The raster scale control trades pixel resolution for rendering headroom. This benchmark covers one physical machine.

## Video export

The exporter seeks the same live renderer at exact increments of 1/60 second and encodes each rendered frame with Chrome WebCodecs. The script verifies each encoded timestamp before writing the stream. FFmpeg muxes the bitstream, applying a bounded bitrate for large outputs. FFprobe checks decoded frame count, rate and duration. The export adds the original stereo suspense score, with a low synth pulse, sparse keys, and a final chord timed to the wordmark. It also produces a 480p fast-start MP4 for mobile. Both exports retain the same AAC score. Output cadence is independent of live wall-clock rendering speed.

The score is synthesized locally. To regenerate it with Python and NumPy, run these commands from `canvas/`.

```sh
python3 audio/compose-score.py /tmp/kujo-showcase-score.wav
ffmpeg -i /tmp/kujo-showcase-score.wav -af 'loudnorm=I=-17:TP=-1.8:LRA=8' -ar 48000 -c:a aac -b:a 160k -movflags +faststart audio/showcase-score.m4a
```
