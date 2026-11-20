# Capability audit

The published runtime inspected and used for execution is Kujo **v1.9.0**. The macOS x64 archive was verified with its release SHA-256. The existing PATH binary was 1.5.0, so the release binary was selected explicitly.

| Upstream | Reference inspected | Lab use |
| --- | --- | --- |
| Kujo | [v1.9.0 AI runtime](https://github.com/kujolang/kujo/blob/v1.9.0/docs/AI_RUNTIME.md), local source 7a132070 | Owns request identity, recording, strict replay, parsing, test runner and VM. |
| Kujo Skills | [skills](https://github.com/kujolang/kujo-skills/tree/76c2496/skills), 76c2496 (0.7.1) | Kujo Way Development and Core Language conventions. |
| Eval | [source](https://github.com/kujolang/eval/tree/c1b263a), c1b263a (1.1.0) | External evidence checks via `kujo run main.kujo run <suite> --output-dir <dir>`. Weighted scoring and invariant checks run directly in Kujo in the lab. |
| Spec | [README](https://github.com/kujolang/spec/tree/36da0d7), 36da0d7 (1.0.2) | Structured contracts and Eval export inspected. Lab oracle has its own scenario-level schema. |
| RunLedger | [source](https://github.com/kujolang/runledger/tree/ab0ec5d), ab0ec5d and installed CLI 1.2.1 | `start`, `note`, `finish`, and `show --json` capture an operator receipt. The lab executes and scores candidates. |
| AI SDK | [source](https://github.com/kujolang/ai-sdk/blob/9083c0a/src/ai_sdk.kujo), 9083c0a (1.2.0) | Provider normalization and SDK fixture dispatch inspected. This project uses core `ai_chat` directly to exercise native cassette I/O. |
| Agents SDK | [README](https://github.com/kujolang/agents-sdk/tree/70cd1fb), 70cd1fb (1.1.3) | Offline runner fixture boundary inspected. Triage uses one model request and a pure policy function. |
| Kujo Workflows | [repository](https://github.com/kujolang/kujo-workflows/tree/d766eae), d766eae (0.6.2) | Workflow layer inspected, including loop engineering and VideoOps pack boundaries. |
| Docs site | [public docs](https://docs.kujolang.ai), local checkout 09b168e | VM-first quickstart and capability references. |

The core [HTTP/AI implementation](https://github.com/kujolang/kujo/blob/v1.9.0/src/interpreter/native_functions/http.rs) implements `ai_request_hash`, `store_ai_cassette`, `replay_ai_cassette`, and the lookup before HTTP transport. See the embedded hash, round-trip, and redaction tests and the [hermetic miss contract](https://github.com/kujolang/kujo/blob/v1.9.0/tests/ai_replay_hermeticity_contract.rs). Identity includes trimmed endpoint, model, serialized messages/body and relevant headers. Records are version 1 JSON at `<hash>.json` and embed the request hash. Replay checks the version and embedded hash and returns the recorded envelope. A miss fails without network or an unrelated fallback response.

The fixture provider is a small Kujo loopback HTTP endpoint with scripted OpenAI-shaped responses. The native runtime records its actual HTTP exchanges and replays them. There were zero external provider calls and no original billed usage. Policy code executes anew for every candidate while the model boundary runs through native replay for every scenario.

The [standard library](https://github.com/kujolang/kujo/blob/v1.9.0/docs/STANDARD_LIBRARY.md) provides `parse_json`, `to_json`, `read_file`, `write_file`, `append_file`, `sha256`, and `performance_now`. `kujo check` compiles entry points and `kujo test-run -v <file>` runs native assertions. Candidate changes are configuration values passed to previously checked shared source. Every candidate executes that source against the full tuning split.

## Verified v1.9.0 behavior

- VM `kujo run` passed all tuning runs. The separate held-out rerun used `kujo run --interpreter` and produced the same decisions, scores and gate outcomes. Run the replay commands with `--untrusted --allow-ai --allow-fs-read`. The optimizer also needs filesystem write and clock permissions.
- In the tested release, `structured_errors: true` wraps strict replay misses under the outer `kind: "network"`. The native message contains `kind:"replay_miss"` and explicitly says strict replay does not use the network. Tests verify the native message and confirm a changed prompt or temperature cannot reuse the original cassette.
- The native `test-run` runner collects test blocks and executes them in a separate interpreter. Put imports inside each test or in `test_setup`. A top-level `kujo check` does not validate all transitive module bodies, so the evidence checks every Kujo source individually and executes the normal entry points.
- Eval counts the terminal newline as an additional line for `file_line_count` in the inspected version. The independent Kujo verifier counts 200 parsed JSONL rows. The Eval suite checks the selection count and final gate evidence.
