# Render log

| Gate | Evidence |
| --- | --- |
| Release toolchain | HyperFrames 0.9.71, Node 26.12.1, FFmpeg and FFprobe on macOS x64 |
| Registry scan | Checked chart components before deciding the 200-point ordinal scatter and running-best trace required a data-specific SVG |
| Static lint | `qa/lint.json` |
| Browser, motion, layout, contrast | `qa/check.json` |
| Source-stage story review | `qa/composition-review.jpg` and `qa/story-stills/` |
| Local preview | `http://localhost:4815/#project/hyperframes` |
| Render invocation | `hyperframes render --fps 30 --quality delivery --workers 6 --output ../../output/draft.mp4` from the editable project |
| Render process | `qa/render.log` |
| Media verification | `qa/ffprobe.json`, `qa/media-contract.txt`, `qa/decode-errors.log`, `qa/loudness.txt` |
| Exact draft digest | `qa/draft.sha256` |

The editor hands off the exact technically verified bytes to the independent
Video Critic. Editorial approval is recorded separately.

## Exact render

The render completed in 96.6 seconds using screenshot capture and hardware
browser GPU. FFprobe verified exactly 2,760 video frames and 92.000 seconds for
both the H.264 and stereo AAC streams. Full software decode emitted no errors.
Integrated loudness was −15.7 LUFS and true peak was −2.8 dBTP. The candidate
SHA-256 is `04b789133dff1bf425b17a4b78567c1835a69af250d450c0d692dd7cf8ad866a`.

The first voiced check ran concurrently with the render and completed its
content checks, but Chrome did not shut down on time. The sequential retry
`qa/check-voiced-retry.json` passed lint, runtime, layout, contrast and audio
checks on the unchanged editable candidate. Exact-render stills are available
in `qa/render-contact-sheet.jpg`. The cold-copy root regeneration check
passed using only published lab evidence and the project's local audio.
