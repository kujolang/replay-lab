# Replay Lab evidence hardening

The [previous hardening audit](repository-hardening.md) covers the original provenance and replay changes. This pass checked the boundaries between saved study records, final validation, and report generation.

## Repository

- Scope `kujolang/replay-lab` on `main`. Starting SHA `9594e9bfaed37b035c7499f224bdea378d098f48`. Verified implementation and CI SHA `95f6351204c7b9ec755c243db9124ec1059af165`.
- The launchers call Kujo for native recording, matching, replay, and tests. The optional Eval suite checks the published evidence. RunLedger provides a historical receipt. HyperFrames builds the separate explainer.

## Baseline and findings

The released Kujo v1.9.0 runtime passed source checks, 12 lab tests, two invoice tests, the 200-candidate sweep, finalization, and published report comparison on macOS x64. A local fixture server recorded 100 responses using the documented command. The targeted checks below showed gaps in the passing baseline.

| ID | Priority | Area | Finding and evidence | Action and status |
| --- | --- | --- | --- | --- |
| RL-07 | P0 | Evidence integrity | Report export accepted a copied final record with a 98% winner score and a matching delta while its field counts and points still showed 100%. | Fixed. Tuning and held-out evidence share measurement validation. Scores, replay and test counts, safety tallies, and their detail arrays must agree. Export and verification require a passing held-out winner and complete replay. The inconsistent copy now produces an error and no report directory. |
| RL-08 | P1 | Reproduction | Single-experiment replay checked a short list of fields. Failure and regression details, routing counts, and other deterministic fields could differ from the saved row without failing replay verification. | Fixed. The rerun compares every returned evaluation field except measured runtime. |
| RL-09 | P1 | CI report coverage | The byte comparison iterated over generated files only. A probe with `summary.json` omitted passed the old loop. | Fixed. CI compares both generated contents and inventory. It excludes four hand-authored files in the video data directory. The missing-file probe now fails. |

The evaluation oracle, scorer, policy, CLI syntax, environment variables, cassette format, and report schemas retain their contracts. The evidence readers now reject contradictory rows and refused final outcomes. Use `final-rejected.json` for investigation after a failed finalization. Use a fresh run and compare it with the published reference to check decisions against the source and cassettes. Internal consistency checks cannot establish the origin of an evidence folder on their own.

## Audit coverage

| Phases | Evidence |
| --- | --- |
| 0–1 | Inspected the clean starting tree, native code, examples, launcher flags, release matrix, provenance and video exports. Ran the original source checks, tests and full reproducibility workflow. |
| 2–4 | Traced the bounded lists in the 100-case scorer and the 200-row readers. Reused one measurement check for tuning and holdout, and removed redundant verification checks. The sweep still evaluates every candidate through native replay. No runtime or memory improvement was measured. |
| 5–6 | Reviewed prompt construction, cassette reuse, evidence output and video handoff. The study still writes one progress line per evaluation and uses an explicit single-record JSON rerun. There is no MCP or tool registration schema to slim down. Token and render measurements were outside this pass. |
| 7–10 | Checked malformed and incomplete evidence, existing atomic file writes, strict matching and exit behavior. Refused inconsistent reports before publication. The workload launcher still relies on Kujo capability flags and expects caller-owned code. Host controls remain the boundary for arbitrary workloads. |
| 11 | Checked the pinned CI action and its original/latest stable release inputs, the optional Eval checkout, and the separate HyperFrames tree. The patch adds no dependencies. |
| 12–13 | Added two Kujo regressions for contradictory scores and safety tallies. Made CI verify both report file inventory and bytes. |
| 14–15 | Updated the reproduction guide with the stronger single-record and final validation contracts. It points developers to a fresh run for checking recorded results against code. |
| 16 | Kept original evidence and media. The cassettes, oracle, results and video files were verified unchanged from the starting SHA. |
| 17–18 | Applied the fixes and ran the verification below. |

No cross-repository change is required. The latest stable release was v1.9.0 during verification. The CI latest-release job covers subsequent published releases when it runs. This code pass checked the HyperFrames generator syntax and regenerated the study exports. It did not rerender the video.

## Verification

With `KUJO_BIN=/tmp/kujo-replay-runtime-190/kujo` on macOS x64:

- `git ls-files '*.kujo'` and `"$KUJO_BIN" check FILE` for each tracked source passed.
- `tools/lab test` passed all 14 lab tests. `(cd examples/invoice && ../../tools/replay replay cassettes test-run route_test.kujo)` passed both invoice tests.
- `tools/lab search results ID --behavior` reproduced `baseline`, `candidate-36`, and rejected `candidate-193`. `tools/lab search DIR`, `tools/lab final DIR`, and `tools/lab verify results DIR --behavior` matched 200 tuning records, four rejections, the baseline and both held-out evaluations. Candidate 36 remained the winner.
- `tools/lab report results REPORT_DIR` reproduced all 11 generated files. `diff -r -x README.md -x cassette-flow.json -x baseline-terminal.json -x winner-terminal.json video/visual-data REPORT_DIR` passed for the full export and failed for the missing-file probe.
- `"$KUJO_BIN" run --isolated-imports ../eval/main.kujo run experiments/evidence.eval.json --output-dir DIR --json` passed four checks with Eval at `c1b263a`.
- `sh -n tools/lab`, `sh -n tools/replay`, `node --check video/production-workspace/production/hyperframes/tools/build-scenes.mjs`, and `git diff --check` passed.
- Hosted verification [original and latest release jobs](https://github.com/kujolang/replay-lab/actions/runs/44675670485).
