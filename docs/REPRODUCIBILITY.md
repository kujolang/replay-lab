# Reproducibility

Install [Kujo](https://github.com/kujolang/kujo/releases/latest). The [README quickstart](../README.md) runs without an HTTP server, API token, or model account. The launcher disables general network client and server capabilities through the runtime's untrusted mode. All AI requests explicitly set native strict cassette mode. An unknown request returns the native miss and a safe fallback, with CLI exit 1.

For your own project, see the [custom replay guide](CUSTOM_REPLAY.md). The commands below reproduce the issue-triage study.

## Offline fixture recording

The shipped cassettes were recorded by the runtime against the Kujo fixture server. Only use this procedure to verify recording or create an intentional new fixture version. The recorder refuses existing destination directories. A failed recording leaves an incomplete marker so the generic launcher refuses to replay it.

Terminal 1:

```sh
"${KUJO_BIN:-kujo}" run --scheduler-no-timeout tools/fixture_provider.kujo -- \
    scenarios/tuning-fixtures.json scenarios/heldout-fixtures.json
```

Terminal 2, with unused destinations:

```sh
mkdir -p .scratch
export KUJO_AI_ALLOWED_ENDPOINTS=http://127.0.0.1:18743/v1/chat/completions
"${KUJO_BIN:-kujo}" run tools/record.kujo -- .scratch/recorded-tuning scenarios/tuning-fixtures.json
"${KUJO_BIN:-kujo}" run tools/record.kujo -- .scratch/recorded-heldout scenarios/heldout-fixtures.json
```

Stop the fixture server with Ctrl+C. The local endpoint is part of request identity. Keep the host, port and path fixed when recovering the same keys. The release preserves normalized request and response content. HTTP header ordering in newly serialized cassette files can vary. Use the committed cassettes for byte-level reproduction and compare regenerated records as JSON.

## Portable verification

`tools/lab search results candidate-36 --behavior` compares every deterministic evaluation field with the published candidate record, including scoring, replay matches, and failure details. Run `tools/lab verify results .scratch/reproduced --behavior` to compare all 200 records and held-out decisions. The verifier checks each run's source fingerprints for internal consistency and omits them only from the cross-revision comparison. It also omits measured latency. Holdout finalization requires the exact source and tuning data of the new sweep. If holdout replay or its gate fails, the command exits nonzero and writes `final-rejected.json`. A passing run publishes `final.json`. Verification and report export require internally consistent measurements and a passing final record. Use a fresh rerun to check the measurements against the source and cassettes.

To reproduce the environment of the published sweep, check out `5b4c8ede0c985ed12339993dc74aef01908fafdf` and run its commands with the [original Kujo release](https://github.com/kujolang/kujo/releases/tag/v1.9.0). CI checks both the original runtime and the latest stable release. In the current checkout, omit `--behavior` when comparing runs from the same source revision. Use the full rerun in the README to reproduce every candidate. To check compatibility through the tree-walking interpreter, substitute its path for the VM final invocation. Run this before a final report exists in the fresh run directory.

```sh
"${KUJO_BIN:-kujo}" run --interpreter --untrusted --allow-ai --allow-fs-read \
    --allow-fs-write --allow-clock experiments/final.kujo -- .scratch/reproduced
```

The optional evidence gate was verified with Kujo Eval 1.1.0 at commit `c1b263a`, checked out at `../eval`.

```sh
"${KUJO_BIN:-kujo}" run --isolated-imports ../eval/main.kujo run \
    experiments/evidence.eval.json --output-dir .scratch/eval --json
```

## Receipt

RunLedger 1.2.1 recorded the optimization session. Its receipt is auxiliary to the candidate JSONL. To record your own run, invoke `runledger start --provider local --model fixture --task "Kujo Replay Lab controlled optimization" --repo "$PWD"` before the sweep. Use the returned ID with `runledger note` to point at your evidence and `runledger finish` to record the verdict. Ledger receipts contain no provider billing data for the lab. [Published receipt fields](../results/runledger-receipt.json)
