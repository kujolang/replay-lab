# Kujo Infinite Canvas

The immersive field opens at `/`. The earlier execution workbench is available at `/workbench.html` and through the field’s hidden controls.

| Earlier Replay Lab | Immersive rebuild |
| --- | --- |
| [Workbench screenshot](../canvas/artifacts/01-execution-field.png) | [Opening field](../canvas/artifacts/immersive/A-opening.png) |
| [Browser tour](../canvas/artifacts/replay-lab-demo.webm) | [30-second field render](../canvas/artifacts/immersive/kujo-infinite-canvas.mp4) |
| Twelve inspectable cards inside a fixed workbench, plus a separate synthetic renderer | Fifteen opening cards, one procedural field with over 100,000 submitted cells, and the authentic Kujo mark formed from the same field |
| Screen recording of clicks and camera changes | A configurable camera and playback timeline rendered directly from the running application |

The original [Blood fast demonstration](https://x.com/kitlangton/status/2123830841961046469) informed the acceleration, density, and interference waves. This implementation uses its own light card design, Kujo evidence, and Kujo composition. The logo SVG is the published [Kujo logomark](https://kujolang.ai/assets/images/kujo-logomark.svg).

## Reproduce

From `canvas/`, run `npm start` and open [http://127.0.0.1:4173](http://127.0.0.1:4173). The field loads the last evidence returned by the running lab, or the bundled prepared snapshot. For fresh runs, press **I** or right-click, open the workbench, and run the three native scenarios using the [runtime setup](../canvas/README.md). The canvas reads the latest results on its next load. Tap to launch a wave, drag to pan, and scroll or pinch to zoom. Use Space to pause and Home to start the sequence again. A touch long-press opens the controls. Reduced-motion settings start the page paused.

For automated verification and artifacts, install the test dependency with `npm ci` and install FFmpeg and a Chrome browser with WebGL2 and WebCodecs H.264 encoding. Run:

```sh
npm run showcase:test
npm run showcase:capture
HEADED=1 npm run showcase:benchmark
npm run showcase:export
```

Use `ARTIFACT_DIR` to write elsewhere, or `CHROME_CHANNEL=bundled` with `npx playwright install chromium`. The bundled browser’s available codecs and GPU may differ from Chrome. The server and browser are opened and closed by the scripts. No third-party assets or inference services are needed at runtime.

### Visual acceptance frames

- [A — Opening](../canvas/artifacts/immersive/A-opening.png). Fifteen cards with switches, vertical levels and three-digit activity.
- [B — Expansion](../canvas/artifacts/immersive/B-expansion.png). The moving camera reveals hundreds of the same cards.
- [C — Extreme scale](../canvas/artifacts/immersive/C-extreme-scale.png). More than 140,000 submitted cells at roughly two raster pixels of pitch.
- [D — Overlapping waves](../canvas/artifacts/immersive/D-overlapping-waves.png). Replay-driven labels surround genuine recorded comparisons.
- [E — Reverse zoom](../canvas/artifacts/immersive/E-reverse-zoom.png). Captured after Playwright wheel events at the same pointer anchor. The receipt includes the camera pitch before and after.
- [F — Kujo finale](../canvas/artifacts/immersive/F-kujo-finale.png). The mark is drawn by the field’s cells.

[Capture receipt](../canvas/artifacts/immersive/acceptance.json) · [Live measurements](../canvas/artifacts/immersive/performance.json) · [Video verification](../canvas/artifacts/immersive/export.json)

## Rendering and motion

The camera stores a world-space center and a positive pitch. A cell’s signed integer coordinates determine its identity, state sampling, and animation seed. The renderer computes a visible rectangle with a guard band and draws an instanced strip, with four vertices per cell. It allocates no per-cell buffers, textures, or DOM elements. WebGL2 keeps the procedural animation and layout in one broadly available GPU pipeline. WebGPU compute could cache per-cell wave evaluation, but would add another backend and device compatibility requirement.

The fragment shader uses the same rounded-box signed-distance formula at every pitch. It attenuates outlines, slider controls, and seven-segment digits using smooth functions of projected pixel pitch. When text falls below legibility, its contrast tends toward zero while the card remains. The same lattice governs auto and manual cameras. Wheel zoom preserves the world point under the pointer. Pinch preserves that point under the moving midpoint. The inverse projection lets a click place the next wave directly in lattice coordinates.

Damped transitions combine two seeded values each beat. A GPU wave combines a traveling radial envelope with a directional front and interference phase. Active waves add together and influence per-cell intensity, desaturation and level before rendering. The wave state travels through the cells. No separate circle is composited over the scene. `choreography.mjs` holds the camera and wave cues. The field keeps animating after the 30-second ending.

The official SVG is an ink square with transparent paths for the K. At startup the application rasterizes its alpha and inverts it into a single-channel mask, preserving the viewBox aspect and the nested cutout. During formation, a diagonal arrival threshold reveals that mask cell by cell. The shader moves interior card color toward ink and exterior card color toward paper. The logo SVG never appears as an image layer in the showcase. The raster resolution cap is 1,920 × 1,080, and the hidden raster control can reduce rendering cost further.

## Provenance

| Source | What drives the field |
| --- | --- |
| Kujo strict replay | The recorded baseline comparison and cassette identity determine the replay caption and representative evidence values. |
| Eval | The native pass count and total drive the evaluation caption. Failed and mismatched records use a failure color. |
| Dispatch | Native workflow step statuses drive the completion caption and representative cards. |
| RunLedger | The historical study receipt contributes one representative card. The receipt belongs to the original study. |
| Spec and Workcell | Inspected upstream capabilities. No live Spec or Workcell run is asserted. |
| Procedural data | Cell positions, surrounding signals, levels, toggles and 000–999 displays are synthetic animation, with state classes sampled from the evidence model. Card population measures drawing density and conveys no workflow concurrency or throughput. |

See the [capability map](CANVAS_CAPABILITIES.md) for source links and the original execution boundaries.

## Live performance

Measured in headed Chrome 157.0.8103.80 at 1,280 × 720 on a 16 GB Intel Core i7-9750H MacBook Pro. Chrome reported AMD Radeon Pro 5300M through ANGLE Metal, a 16,384 px texture limit and a 16,384 × 16,384 viewport limit. The original and immersive benchmark profiles use different viewport sizes and choreography.

| Live profile | Mean fps | Frame P95 | Longest frame | GPU draw mean | Peak cells submitted |
| --- | ---: | ---: | ---: | ---: | ---: |
| Full 30-second sequence | 59.1 | 17.7 ms | 118.2 ms | 1.54 ms | 157,379 |
| 75% raster, 12–27 seconds | 59.1 | 17.3 ms | 100.6 ms | 1.87 ms | 157,379 |

The full run averaged 60.0 fps during expansion, massive scale, and logo formation. Five of 1,774 observed frames exceeded 20 ms. Reported GPU draw times exclude compositing. The live renderer used 8.6% of one CPU core, Chrome as a whole used 24.0%, and the main-thread draw-call P95 was 0.2 ms. Total Chrome RSS was 466 MiB, which can include shared pages. The busiest shared macOS GPU counter read 98–100% and includes other processes. Per-tab GPU utilization and VRAM were unavailable. After 12 repeated phase jumps and forced collection, the browser retained 93 DOM nodes and approximately 2.15 MiB of JS heap.

The renderer requires WebGL2. Browsers without it can open the retained workbench. The raster scale control trades pixel resolution for rendering headroom. This benchmark covers one physical machine.

## Video export

The exporter seeks the same live renderer at exact increments of 1/60 second and encodes each rendered frame with Chrome WebCodecs. FFmpeg muxes the bitstream and FFprobe verifies the decoded frame count, rate and duration. The output cadence is independent of live wall-clock rendering speed.
