# Replay Lab canvas benchmark

The WebGL2 field averaged **60.0 fps** at **260,669 animated elements** on the measured desktop configuration. The evidence view averaged **49.2 fps**, and the software fallback averaged **29.0 fps** at its upper density. The 60 fps result applies to the measured WebGL2 profiles.

## Reproduce

From `canvas/`, run `npm ci` and then:

```sh
HEADED=1 BENCHMARK_MS=8000 npm run benchmark
```

The run used headed Chrome 157.0.8103.80 on a 16 GB Intel Core i7-9750H MacBook Pro. Chrome selected the AMD Radeon Pro 5300M through ANGLE Metal. The desktop browser viewport was 1,440 × 1,024 with a 1,056 × 547 canvas. The simulated phone used a 390 × 844 viewport and the software rendering path. The 4× profile throttled the renderer CPU with Chrome DevTools. All profiles ran on one physical host.

[Raw benchmark results](../canvas/artifacts/benchmark.json)

| Profile | Elements submitted | Mean fps | Median frame | P95 frame | Longest frame | GPU draw mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Evidence | 12 | 49.2 | 16.7 ms | 18.0 ms | 833.6 ms | — |
| WebGL2 16K | 16,215 | 60.0 | 16.7 ms | 18.0 ms | 18.6 ms | 1.08 ms |
| WebGL2 65K | 64,911 | 60.0 | 16.7 ms | 18.0 ms | 18.7 ms | 1.10 ms |
| WebGL2 262K | 260,669 | 60.0 | 16.7 ms | 18.0 ms | 18.7 ms | 1.06 ms |
| WebGL2 262K, 4× CPU throttle | 260,669 | 60.0 | 16.6 ms | 17.9 ms | 18.5 ms | 1.07 ms |
| Canvas 2D phone, high density | 8,107 | 29.0 | 33.2 ms | 54.2 ms | 434.2 ms | — |
| Canvas 2D phone, low density | 943 | 32.5 | 32.1 ms | 51.2 ms | 67.4 ms | — |

The sample holds the camera at the selected limit and animates every submitted element. Density limits include a small guard band for cells intersecting the viewport. Frame cadence comes from `requestAnimationFrame`. The GPU timer samples the draw call every fifth frame and excludes compositor work. Headed results describe frame scheduling on this host. Browser tests independently exercise changing zoom, panning, pinch and maximum-density animation.

## Resource measurements

- At 260,669 elements, Chrome used 25.6% of one CPU core across its processes. The renderer used 9.1%, the GPU process used 15.3%, and the benchmark's measured JS frame-work P95 was 0.1 ms. Combined browser RSS was 494.5 MiB, which can include shared pages.
- The shared macOS accelerator counter reported 96–100% device utilization during these profiles. It includes other GPU clients. The per-draw WebGL timer is the workload-specific GPU measurement. Per-tab VRAM was unavailable.
- After forced garbage collection at cycles 0, 5, 10 and 15 of switching fields, JS heap moved from 1.69 MiB to 1.74 MiB with 631 DOM nodes and 57 listeners at each check. This is a short stability probe.
- WebGL reported point sizes of 1–511 px, 16,384 px maximum texture size, and a 16,384 × 16,384 maximum viewport. The selected renderer and limits are visible in the synthetic inspector.

An evidence-view stall lowered the mean despite a P95 of 18.0 ms. The 60 fps target remains open for the evidence and software rendering profiles. The Canvas 2D path caps density at 8,192 and offers 4,096 and 1,024 limits. Visitors can pause animation in either mode. Physical mobile devices and GPUs beyond the measured host still need coverage.
