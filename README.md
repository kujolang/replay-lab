# Kujo Replay Lab

Kujo Replay Lab takes an issue report, replays an AI classification, and decides where the report should go. The experiment runner exercises 200 policy configurations against the same 100 recorded interactions. A separate evaluation checks the frozen winner on 24 held-out issues.

**Result.** Candidate 36 improved the weighted score from **70.8% to 100%** on tuning and from **59.2% to 100%** on the held-out set. Four candidates failed a hard safety gate. The 200 candidates replayed 20,000 interactions with zero misses. The original HTTP responses came from a scripted local fixture provider. The project measures routing on these fixtures.

## Quickstart

Install the [Kujo v1.9.0 runtime](https://github.com/kujolang/kujo/releases/tag/v1.9.0) and verify `kujo --version`. Set `KUJO_BIN` to the absolute path to that binary if your PATH points elsewhere. Run from the repository root.

```sh
tools/lab triage scenarios/example.json
tools/lab triage scenarios/example.json results/winner-policy.json
tools/lab test
```

The example reports a production failure filed as a feature. The baseline queues it as P3. The winner routes it to a human at P1. Both commands use the same cassette. The output includes the request hash, explanation, confidence and review decision.

## Reproduce the evidence

```sh
mkdir -p .scratch
tools/lab search results baseline
tools/lab search results candidate-36
tools/lab search results candidate-193
tools/lab search .scratch/reproduced
tools/lab final .scratch/reproduced
tools/lab verify results .scratch/reproduced
tools/lab report results .scratch/visual-data
```

Choose a new run directory if `.scratch/reproduced` already exists. The evidence verifier compares all 200 records, baseline and holdout results, omitting measured latency. Candidate 193 reproduces the deliberate failure to page security on active exposure. [Results](docs/RESULTS.md) links to the recorded terminal output and leaderboard.

To inspect a cassette, use the `request_hash` printed by triage as its filename under [cassettes/](cassettes/). Each file contains the normalized request, captured HTTP status and headers, and response body. With a new issue or changed model settings, the CLI emits its safe fallback decision and exits with status 1 when the native lookup misses. To add inputs, capture them through an intentional recording session and version the fixture set.

## Adapt the experiment

1. Freeze the prompt, model options, and recorded interactions. Keep policy inputs out of the request so candidate changes can reuse the same cassettes.
2. Author tuning cases and a separate held-out oracle. Define mandatory escalation and review behavior before scoring.
3. Put the rules you want to test in a small deterministic policy function. Pass configurations to it from the runner.
4. Inspect rejection evidence, freeze the best eligible configuration, and verify it once on the held-out split.

The Kujo runtime owns recording, request hashing, and replay. Native Kujo tests verify the model boundary and policy. The optional Kujo Eval suite checks published artifacts, while RunLedger records the execution receipt. See the [capability audit](docs/CAPABILITY_AUDIT.md), [architecture](docs/ARCHITECTURE.md), [experiment design](docs/EXPERIMENT_DESIGN.md), [recording and reproduction](docs/REPRODUCIBILITY.md), and [video handoff](video/VIDEO_HANDOFF.md).

MIT licensed. [License](LICENSE)
