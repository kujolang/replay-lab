# Production specification

**Goal.** Viewers can explain how the same recorded classifier reply leads to different auditable routing decisions under candidate policies.

**Output.** HyperFrames, 1920 × 1080, 30 fps, 92 seconds, 2,760 frames. See [style plan](style-plan.md) for palette, motion, type and audio.

| Frames | Principal image and readable interval |
| --- | --- |
| 0–359 | Real scenario excerpt at frame 0. Baseline fields resolve by frame 150. |
| 360–749 | Exact cassette hash, then captured classifier fields with scripted loopback label. Hold the fields across frames 570–740. |
| 750–1139 | Reveal real replay flow node by node. Use the actual native miss excerpt around frames 990–1130. |
| 1140–1649 | Plot 200 CSV records by ordinal. Reveal first eligible 100% at ordinal 36 and show all three phase counts once the trace is complete. |
| 1650–2099 | Candidate 193 passes the score threshold visually, then fails the hard gate. Hold expected P0 against actual P2 at frames 1860–2080. |
| 2100–2759 | Held-out graphic leads. Return to exact CLI fields around frame 2430. Repository and `tools/lab test` hold from around frame 2610 through the end. |

**Spot checks.** Review frames near 0, 200, 630, 1050, 1500, 1950, 2220, 2520 and 2700. Check line wrapping, digest continuity, signed chart rejection, score labels and action/read flags against source. Validate the render's exact duration and confirm the narration and final command are both fully present.
