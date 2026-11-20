# Replay Lab canvas capability map

The existing [Replay Lab](https://github.com/kujolang/replay-lab) already records native model cassettes, applies new policies to old replies, verifies experiments, and ships a recorded video. Its CLI, cassettes, and published evidence remain the sources of truth. The interactive application lives in the isolated `canvas/` directory of that repository. It has no deployment configuration.

| Capability | Interface inspected | Canvas integration |
| --- | --- | --- |
| Native AI replay | [Kujo v1.9.0, `src/interpreter/native_functions/http.rs`](https://github.com/kujolang/kujo/blob/v1.9.0/src/interpreter/native_functions/http.rs) | Runs `tools/lab triage` with strict cassette mode and reads the cassette selected by `request_hash`. The fixture provider originally recorded a real loopback HTTP response with scripted content. |
| Policy comparison | [Replay Lab source](../src/main.kujo), [recorded baseline](../video/visual-data/baseline-terminal.json), [winner policy](../results/winner-policy.json) | Compares the published baseline with a freshly replayed baseline and a freshly replayed winner on the same cassette. Shows changed decision fields and input identity. |
| Eval | [Eval c1b263a](https://github.com/kujolang/eval/tree/c1b263a10702c2fa8ab61ed507029a6bfec2e03d) | Runs three independent JSON assertions on the current replay outputs. Inspects the native test results and measured suite duration. |
| Dispatch | [Dispatch 18b5c73](https://github.com/kujolang/dispatch/tree/18b5c737a73904ae942f0bd1c3baa1f77c2bfb40), `examples/workflows/routed-review.json` | Runs the routed review in explicit offline fixture mode. Reads native state, report, step records, trace events and fixture token estimates. |
| RunLedger | [RunLedger ab0ec5d](https://github.com/kujolang/runledger/tree/ab0ec5d), [published receipt](../results/runledger-receipt.json) | Shows the existing study receipt, with its own run ID and end commit. Accounting is shown only when present. Browser operations have no RunLedger receipt. |
| Workcell | [Workcell 189d7ab](https://github.com/kujolang/workcell/tree/189d7ab), `bin/workcell verify --run … --json` | The verifier authenticates a run directory against its integrity manifest. A Workcell run and receipt are outside this demo. Browser fixture actions run as local subprocesses. |
| Spec | [Spec 36da0d7](https://github.com/kujolang/spec/tree/36da0d7), `validate`, `export-eval` | Exports task contracts and Eval checks. This demo's three assertions are defined directly in an Eval suite. |
| Site identity | [kujolang.ai](https://kujolang.ai), [SiteKit 74cff7b](https://github.com/kujolang/site-kit/tree/74cff7b73f2f21d658fc0219ac7f4d44f7f93efd) | Reuses the Kujo mark, SiteKit light theme, Departure Mono and button styles. Canvas graphics use square outlines, technical linework and halftone texture. |
| High density | Browser graphics | A labeled synthetic renderer animates procedural coordinates and carries no execution evidence. |

Native replay is at the AI call boundary. The showcase does not promise browser-wide session playback, deterministic timing, live inference, or cryptographic attestation of browser operations. See the [existing capability audit](CAPABILITY_AUDIT.md) for the strict miss and runtime contracts.
