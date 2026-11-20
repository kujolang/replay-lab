# Replay Lab canvas architecture

This document describes the retained execution workbench at `/workbench.html`. See [Kujo Infinite Canvas](IMMERSIVE_CANVAS.md) for the default full-screen field.

The [canvas app](../canvas/) is isolated from the CLI, existing release workflows, and the main Kujo site. It uses native HTML controls, the vendored SiteKit light theme and Departure Mono font, a Canvas 2D decoration layer, and a dedicated WebGL2 rendering path.

## Evidence flow

1. `server.mjs` starts on loopback and loads the snapshot produced by `scripts/prepare.mjs`. Fixed same-origin actions run the exact scenario entry points in `scenarios.mjs`. The server accepts no user-defined commands, workflow paths, or model endpoints.
2. Native Kujo strict replay serves the scripted classifier reply from the cassette selected by the request hash. Baseline and winner re-run policy logic over that recorded response. Compare checks the fresh baseline against the published baseline and lists actual decision deltas.
3. Eval reads the resulting JSON from an isolated directory. Dispatch runs its routed review fixture in a separate isolated directory. The adapter reads any available Dispatch trace during the run and preserves the finished state, trace and report in memory. Evidence replaces the absolute Dispatch checkout prefix with `<dispatch>/`. Dispatch can flush fast events together. The inspector exposes the full persisted sequence.
4. The browser updates card details using evidence returned by the runner. Dispatch's native ID, fixture accounting, Eval's suite duration and Replay Lab's measured subprocess wall time come from different sources and are labeled accordingly. The browser's elapsed counter measures a running request. The lab serializes fixture operations, limits subprocess run time, and removes temporary output on completion.

## Rendering

The canvas camera is a translation and a positive scale. Every card has a stable slot and ID across zoom. World-to-screen projection applies the same camera to DOM cards, glyphs, connections and canvas ripples. Wheel zoom uses an exponential multiplier and preserves the world point under the cursor. Pinch zoom preserves the old midpoint's world point under the new midpoint. Responsive reflow adjusts the initial card arrangement when crossing the narrow-screen breakpoint. Within a layout, card text fades as the animated glyph becomes prominent at distance.

The synthetic field is procedural. A visible bounding rectangle in the same world coordinate system gives WebGL2 a starting cell, dimensions and a projection. A single `gl.drawArrays(gl.POINTS, …)` call assigns one vertex per cell. The shader derives the cell's phase from integer coordinates, then adjusts intensity and scan-line position with time. Subpixel and far-away cells shade as small pulses. Nearby cells have an outline and an animated scan line. GPU point-size limits cap glyph size at close range. The renderer allocates no per-cell DOM nodes, geometry buffers, or textures.

WebGPU compute offers no required capability for this grid and would add device negotiation and another rendering path. Instanced quads would allow larger nearby shapes at the cost of extra vertex work. The current WebGL2 point primitive avoids that overhead. A bounded Canvas 2D path keeps animation and panning available on devices without WebGL2 or after context loss, with up to 8,192 procedural elements. The distant Canvas 2D path batches glyphs into a reusable pixel buffer. The selected density limit sets the farthest zoom available for that viewport. Raster layers render at one pixel per CSS pixel. Card text and interface controls retain native browser resolution. Pausing and the lower density options let visitors control rendering load.

## Limits

- The local process retains the latest result for each scenario. Restarting restores the prepared snapshot. No history persistence, hosted service, or per-user runner is configured.
- The demo uses recorded loopback HTTP replies and Dispatch model fixtures. It does not make live provider calls, record new cassettes through the UI, or run Workcell verification. The [capability map](CANVAS_CAPABILITIES.md) identifies upstream interfaces for those operations.
- The real evidence field contains twelve records and can be panned indefinitely for practical use. Extreme-density exploration uses the separate synthetic field. Its coordinates are stable as the camera moves, but its elements carry no native execution data.
- Automatic density tuning, a multi-browser/physical-device performance matrix, and public hosting are outside the delivered local benchmark. The app exposes the renderer, density, and recent cadence for manual adjustment.
