# Visual data

| File | Treatment |
| --- | --- |
| `baseline-terminal.json`, `winner-terminal.json` | Actual stdout for `scenarios/example.json`. Use the matching request hash and changed action in the final before-and-after. |
| `score-progression.csv` | X is ordinal, Y is weighted fixture score. Mark rejected points with an X. Draw the running best eligible score from `milestones.json`. |
| `leaderboard.json` | All candidates pre-ranked, including gate status. |
| `test-distribution.json` | Key is full scenarios passed out of 100. Value is the number of candidates with that pass count. |
| `regression-events.json`, `caught-regressions.json` | Regressions relative to the baseline. For the hard gate scene select candidate 193 and its `exposure-console` failure. |
| `summary.json`, `cassette-reuse.json` | Source for score, counts, measured runtimes and replay labels. |
| `baseline-policy.json`, `winner-policy.json`, `triage-policy.kujo.txt` | Original and frozen configuration, with the executed shared decision function. |
| `cassette-flow.json` | Labels and scene references for the recorded-response sequence. |

Regenerate the tables, metrics, and source snapshots with `tools/lab report results .scratch/visual-data`. The terminal captures and flow annotations have separate sources listed above.
