# Replay Lab hardening audit

## Repository

- Repository and branch: `kujolang/replay-lab`, `main`
- Starting SHA: `5b4c8ede0c985ed12339993dc74aef01908fafdf`
- Verified implementation and CI SHA: `7cbc84d802a65511a0763d682e16191c3325b42b`
- Purpose: record and replay caller-owned Kujo workloads, then demonstrate policy testing through a fixed issue-triage study.
- Dependencies: Kujo 1.9.0 owns request identity, recording, and strict replay. Shell launchers invoke Kujo. Eval checks the published evidence and RunLedger records the receipt. HyperFrames and media assets support the separate video project.

## Baseline

On macOS x64 with the published Kujo 1.9.0 runtime, all 10 lab tests, two invoice tests, and four supplemental Eval checks passed. The example routed as documented. All 200 tuning candidates and both final decisions reproduced against the published records. Gallery reports regenerated. The worktree was clean. No CI workflow was present. The failure paths identified below were outside the original passing checks.

## Findings

| ID | Priority | Area | Finding | Evidence and fix | Status |
| --- | --- | --- | --- | --- | --- |
| RL-01 | P0 | Selection integrity | Holdout trusted a saved candidate selected without reading the complete tuning ledger. The verifier compared the reference freeze only. | Finalization now validates the source map and tuning inputs, then rebuilds the ranking from 200 ledger rows and reconciles the saved policy and freeze. Verification checks both freezes and all stable final fields. | Fixed |
| RL-02 | P0 | Publication | The output-path existence check and normal writes could allow overlapping writers and torn evidence. Finalization wrote its report before checking the final gate. | Native no-overwrite atomic publication reserves the baseline and publishes the freeze last. Rejected holdout measurements go to `final-rejected.json`, with a nonzero exit. Report files publish atomically after input validation. | Fixed |
| RL-03 | P1 | Evaluation work | Every evaluation rebuilt the prompt and recomputed its explicit metadata hash even though case identity was already known. | Prepare messages and metadata hash once per case. Native replay still executes for every decision and independently matches the request. | Fixed |
| RL-04 | P1 | Failure diagnosis | The invalid-candidate branch used an unavailable runtime `throw` form. The custom launcher accepted unrelated JSON as a cassette directory and the fixture recorder left no incomplete marker. | Explicit diagnostic and exit, checked append, native cassette filenames, and an incomplete marker cleared only after successful fixture recording. | Fixed |
| RL-05 | P1 | Regression checks | Fresh reproduction and report consistency depended on manual runs. | Added two native provenance tests and a pinned Linux CI workflow for the full offline sweep and byte-equivalent report export. | Fixed |
| RL-06 | P2 | Source compatibility | Changing the implementation would make the historical checks fail on fingerprints before comparing decisions. | `--behavior` explicitly compares published and current results while preserving each manifest and checking its internal hashes. Same-source verification stays strict by default. Documented the original checkout for exact reproduction. | Fixed |

## Changes and compatibility

- `experiments/provenance.kujo` validates source and cassette manifests, scores against field counts, candidate ordering and policy deltas, and the frozen winner. `experiments/final.kujo`, `experiments/reporting.kujo`, and `tools/verify.kujo` share those checks. Regression tests reject an eligible lower-ranked replacement and a score that disagrees with its counts.
- `experiments/runner.kujo` checks publication results and writes the freeze last. A sweep still writes the same JSONL rows and artifacts. Source fingerprints in new evidence cover the provenance and finalization modules too. A changed holdout failure path preserves rejection evidence separately.
- `src/model.kujo` and `experiments/scoring.kujo` reuse request material within one run. The original classification export, request hashes, oracle, decision shapes and weights are intact. The loader rejects duplicate case IDs because the failure index keys by case ID.
- `tools/replay` and `tools/record.kujo` use the existing native cassette format. No additional runtime dependency or environment variable is required. Old successful captures remain readable. The generic launcher refuses incomplete directories and directories without a native hash filename.
- Published records, cassettes, oracle files, and tracked video artifacts retain their original bytes. Report output for the published run matched byte-for-byte. Source edits require a fresh sweep to generate current fingerprints, with historical verification explicitly requested when needed.

## Performance and efficiency

Using the same published binary and 200-candidate invocation, two sequential alternating pairs on macOS x64 measured original wall times of 22.20 and 26.19 seconds versus 23.33 and 23.83 seconds after hardening. The earlier three-run baseline ranged from 19.71 to 20.64 seconds and an earlier post-change batch ranged from 26.43 to 27.22 seconds. Wall time varied across runs, so the data support no reliable speed claim.

The alternating pairs retired 102.27–102.43 billion instructions before and 99.17–99.38 billion after, about 3% fewer. Maximum resident size moved from 35.14–35.29 MB to 36.03–36.05 MB while inputs retain their prepared messages. A baseline-plus-search run still makes 20,100 native replay calls. It avoids 20,100 duplicate explicit metadata hashes. Network model calls remain zero during the sweep. Token counts, build size, and interactive render time were outside the measurement.

## Audit coverage

| Phases | Coverage |
| --- | --- |
| 0–1 | Read source, launchers, tests, manifests, cassettes, docs, receipts and generated artifacts. Recorded the clean starting SHA and ran the baseline. |
| 2–4 | Traced repeated prompt and hash work, bounded evidence and request lifetimes, and checked for duplicate modules. Preserved all native lookup and evaluation work. |
| 5–6 | Reviewed model input construction, replay volume, handoffs, and command output. Progress stays concise. JSONL, manifests and reports carry the details. There are no tool-registration or MCP schemas in this repository. |
| 7–10 | Traced exit handling, invalid and incomplete state, artifact publication, simultaneous writers, source identity, and runtime network and filesystem trust boundaries. Corrected the faults in the ledger. |
| 11 | Checked the Kujo release pin, CI action pins, optional Eval invocation, and separate HyperFrames version. The native tools have no additional package dependency. |
| 12–13 | Added provenance regressions and a Linux CI ratchet checking all Kujo source, native tests, study decisions and report bytes. |
| 14–15 | Reconciled README and reproduction commands with the historical/current distinction. Kept the custom workload instructions and diagnostic contracts explicit. |
| 16 | Reviewed retained cassettes, video source, audio and benchmark records. They support published reproduction and the editable demo. No removal was justified. |
| 17–18 | Applied the changes above and repeated local checks and the hosted workflow. |

## Security and scope

All study AI calls select native strict mode. The policy evaluates recorded model text as data and keeps the hard safety gate. The custom launcher is for caller-owned Kujo workloads. Per-call cassette options have precedence over environment mode in Kujo 1.9.0, and host-level network isolation remains the enforcement option for code that requires it. No live provider credentials or paid calls were used during verification. The checked example recordings contain scripted synthetic text.

## Cross-repository and remaining work

No cross-repository change is required for this workflow. Kujo's native cassette semantics and optional Eval and RunLedger integrations remain the existing contracts. The audit covered the video source inventory and generator syntax. Visual rerendering and media playback were outside this code change. No P0 or P1 work remains in the audited paths. Expanding to arbitrary untrusted executables or another runtime version would require a separate compatibility and isolation check.

## Verification receipt

Using `KUJO_BIN` set to the published macOS x64 Kujo v1.9.0 binary:

- `git ls-files '*.kujo'` with `kujo check` per file, `tools/lab test`, and `(cd examples/invoice && ../../tools/replay replay cassettes test-run route_test.kujo)` passed. The current suite has 12 lab and two invoice tests.
- `tools/lab search results candidate-36 --behavior` reproduced the winner. `tools/lab search DIR`, `tools/lab final DIR`, and `tools/lab verify results DIR --behavior` reproduced the 200 rows and held-out decisions. Two same-source runs also passed plain `tools/lab verify DIR1 DIR2`.
- `tools/lab report results DIR` regenerated each published report byte-for-byte. `kujo run --isolated-imports ../eval/main.kujo run experiments/evidence.eval.json --output-dir DIR --json` passed four checks.
- A locally served `kujo run tools/record.kujo -- DIR scenarios/tuning-fixtures.json` recorded 100 cassettes, then an empty fixture list left the incomplete marker. A directory containing only `config.json` was rejected by `tools/replay`.
- A copied sweep with a lower-ranked eligible freeze was rejected by `tools/lab final`. A missing holdout cassette produced a rejection file and no passing final. A shared output test ran two concurrent searches and accepted one writer. Strict verification of different source revisions failed as intended.
- Non-gating `kujo lint --json FILE` reported 47 warnings at baseline and 37 after the changes, with zero errors after the changes. The reported rules cover fallible calls and unreachable statements. Runtime and behavioral tests remain the gate.
- `sh -n tools/lab tools/replay`, `node --check video/production-workspace/production/hyperframes/tools/build-scenes.mjs`, and `git diff --check` passed.
- The pinned GitHub Actions [Linux replay run](https://github.com/kujolang/replay-lab/actions/runs/44674252867) passed.
