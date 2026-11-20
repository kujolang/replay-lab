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
