# Replay Lab

[![Version](https://img.shields.io/badge/version-1.0.0-black)](https://github.com/kujolang/replay-lab)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)
[![Built with Kujo](https://img.shields.io/badge/built%20with-Kujo-white.svg)](https://github.com/kujolang/kujo)

Record model replies once and rerun your own Kujo apps and tests offline. Use the same replies to check what changes when you edit your code. The included issue-triage study compares 200 policies against 100 recorded classifier replies.

Candidate 36 raised the weighted score from **70.8% to 100%** on tuning and from **59.2% to 100%** on 24 held-out issues. The safety gate rejected four candidates. All 20,000 candidate replays matched. The replies came from a scripted local classifier, so these scores measure policy decisions on the fixture suite. [Full results](docs/RESULTS.md)

## Demo

https://github.com/user-attachments/assets/b7d15d90-6d6b-4ad8-83c6-4a3b3dbeb520

[Download the 92-second MP4](video/production-workspace/output/kujo-replay-lab.mp4) · [Editable HyperFrames project](video/production-workspace/README.md)

## Run your own tests

Use `tools/replay` from your own project root with Kujo v1.9.0. Run a script or a Kujo test file. Keep the app, assertions, and cassettes in your project.

```sh
/path/to/replay-lab/tools/replay replay tests/cassettes/suite-v1 test-run tests/model_test.kujo
```

Use `record` to capture replies for a new suite. To try a workload beyond triage, run the invoice tests with their bundled cassettes.

```sh
(cd examples/invoice && ../../tools/replay replay cassettes test-run route_test.kujo)
```

[Record and replay your own workload](docs/CUSTOM_REPLAY.md)

## Run the example

Install [Kujo v1.9.0](https://github.com/kujolang/kujo/releases/tag/v1.9.0) and check `kujo --version`. If your PATH points to another version, set `KUJO_BIN` to the absolute path to the v1.9.0 binary.

```sh
git clone https://github.com/kujolang/replay-lab.git
cd replay-lab
tools/lab triage scenarios/example.json
tools/lab triage scenarios/example.json results/winner-policy.json
tools/lab test
```

A production failure was filed as a feature. The baseline queues it at P3. The winning policy sends it to a human at P1. Both decisions use the same cassette. To inspect the recorded reply, open the file named by the CLI’s `request_hash` in [cassettes/](cassettes/).

## Reproduce the results

```sh
mkdir -p .scratch
tools/lab search results baseline --behavior
tools/lab search results candidate-36 --behavior
tools/lab search results candidate-193 --behavior
tools/lab search .scratch/reproduced
tools/lab final .scratch/reproduced
tools/lab verify results .scratch/reproduced --behavior
tools/lab report results .scratch/visual-data
```

Use a fresh directory for each run. The published records use the original source revision. `--behavior` checks them against current code. Candidate 193 shows what happens when the policy fails to page security on an active exposure. The verifier compares all 200 candidate records and the baseline and held-out results, excluding measured latency and source fingerprints. For exact provenance, check out the original revision. [Reproduction guide](docs/REPRODUCIBILITY.md)

## Use replay in your own app

1. Record a set of model replies. Keep the prompt and model options fixed while you change the code that acts on those replies.
2. Write tuning cases and a separate set of held-out cases. Decide which failures must disqualify a candidate.
3. Rank the policies that pass the safety gate, then test the winner on the held-out cases.

Kujo records and replays the responses and hashes each request. If a request changes, strict replay reports a miss. The lab returns a safe fallback and exits with status 1. Kujo Eval checks the published artifacts, and RunLedger records the run. [Architecture](docs/ARCHITECTURE.md) · [Experiment design](docs/EXPERIMENT_DESIGN.md) · [Capability audit](docs/CAPABILITY_AUDIT.md) · [Video handoff](video/VIDEO_HANDOFF.md)
