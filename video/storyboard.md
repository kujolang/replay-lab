# Storyboard

| Time | Scene | Picture and evidence |
| --- | --- | --- |
| 00–12 s | Baseline makes the wrong call | Start on the real example issue. Emphasize “production jobs have stopped.” Reveal `queue_feature`, P3, and `human_review: false` from the captured baseline JSON. |
| 12–25 s | Capture the interaction | Zoom into the exact request hash, then the cassette record. Show the provider reply as feature, severity 1, confidence 91. Label the provider “scripted loopback fixture.” |
| 25–38 s | Replay under fixed conditions | Animate the supplied data flow. Lock the model request and highlight the policy config changing next. Use the native replay miss test output for a brief cutaway. |
| 38–55 s | Sweep the policy space | Plot all 200 rows in execution order with a stepped best-eligible line from the milestones. Pulse candidate 36 at the first 100% score. Show the three phase counts and the 20,000-hit total. |
| 55–70 s | Reject a dangerous regression | Isolate candidate 193 and `exposure-console`. Show expected P0 + page security over actual P2 + investigate bug. Strike through the candidate rank with “REJECTED · 12 hard failures.” |
| 70–92 s | Validate the frozen winner | Bar pair 59.2% → 100% with 24 held-out issues beneath. Return to the opening issue with P1 and human review. Land on the git repository and `tools/lab test`. |

Render charts from local data. If a terminal excerpt is abbreviated, retain its original field values and identify it as an excerpt. Layout guidance and framing live in [VIDEO_HANDOFF.md](VIDEO_HANDOFF.md).
