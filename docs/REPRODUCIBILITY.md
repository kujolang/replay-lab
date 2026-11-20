# Reproducibility

Use the published Kujo v1.9.0 binary. The [README quickstart](../README.md) runs without an HTTP server, API token, or model account. The launcher disables general network client and server capabilities through the runtime's untrusted mode. All AI requests explicitly set native strict cassette mode. An unknown request returns the native miss and a safe fallback, with CLI exit 1.

## Offline fixture recording

The shipped cassettes were recorded by the runtime against the Kujo fixture server. Only use this procedure to verify recording or create an intentional new fixture version. The recorder refuses existing destination directories.

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

`tools/lab search results candidate-36` verifies the published candidate against the current source, scenario oracle and cassette hashes. Use the full rerun in the README to reproduce every candidate. To check compatibility through the tree-walking interpreter, substitute its path for the VM final invocation. Run this before a final report exists in the fresh run directory.

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
