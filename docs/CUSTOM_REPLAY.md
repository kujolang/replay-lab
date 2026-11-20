# Replay your own Kujo tests

Use Replay Lab's launcher with a Kujo app or test suite in any project. Keep your source, test cases, assertions, and cassettes in that project. The launcher selects Kujo's native cassette mode, preserves your working directory, and returns the workload's exit status.

## Try it offline

The invoice example uses two recorded replies and its own assertions. It runs without a model key or a running server.

```sh
cd examples/invoice
../../tools/replay replay cassettes test-run route_test.kujo
```

Both tests should pass. The example tests invoice routing and has no dependency on the issue-triage app. [Example source](../examples/invoice/route.kujo) · [Example tests](../examples/invoice/route_test.kujo)

## Use it in another project

Install [Kujo](https://github.com/kujolang/kujo/releases/latest). Set `REPLAY_LAB` to the absolute path to this checkout. From your own project root, run the tests once against the provider and then replay them.

```sh
export REPLAY_LAB=/absolute/path/to/replay-lab
mkdir -p tests/cassettes
KUJO_AI_ALLOWED_ENDPOINTS=https://api.example.com/v1/chat/completions \
  "$REPLAY_LAB/tools/replay" record tests/cassettes/suite-v1 test-run tests/model_test.kujo
"$REPLAY_LAB/tools/replay" replay tests/cassettes/suite-v1 test-run tests/model_test.kujo
```

Replace the endpoint and test path with your own. If the provider requires a credential, load it as you would for a normal run. Replay uses the same endpoint, model, messages, body and relevant headers in the request hash. It can run without the API key as long as the workload itself accepts a missing key. Use a new cassette directory to record changed requests.

To run an application or a script with inline assertions, pass its arguments after `--`.

```sh
"$REPLAY_LAB/tools/replay" replay tests/cassettes/suite-v1 run src/main.kujo -- fixtures/example.json
```

A script can call native AI and assert on the result before passing it to the code under test.

```kujo
match ai_chat("Return a greeting.", {
    "endpoint": "https://api.example.com/v1/chat/completions",
    "model": "your-model"
}) {
    case Ok(reply): {
        assert_equal(reply["message"], "Hello.")
    }
    case Err(error): {
        assert_equal(error, null)
    }
}
```

The expected value comes from your test. A launcher can only report the status your app or tests return, so surface AI errors or assert on them. Use test cases that exercise the behavior you want to keep.

## Record the invoice example locally

From `examples/invoice`, run the scripted provider in one terminal.

```sh
"${KUJO_BIN:-kujo}" run --scheduler-no-timeout fixture.kujo
```

From the same directory in a second terminal, record to a new folder.

```sh
KUJO_ALLOW_PRIVATE_NETWORK_DESTINATIONS=1 \
KUJO_AI_ALLOWED_ENDPOINTS=http://127.0.0.1:18744/v1/chat/completions \
  ../../tools/replay record cassettes-local test-run route_test.kujo
```

Stop the provider and replay the new cassettes.

```sh
../../tools/replay replay cassettes-local test-run route_test.kujo
```

## Replay contract

- The supported call path is Kujo's native cassette-aware AI helpers, including `ai_chat`, `ai_stream_chat`, `ai_embedding`, and `ai_tool_loop`. The launcher uses `KUJO_AI_RECORD` or `KUJO_AI_REPLAY` and `KUJO_AI_REPLAY_MODE=strict`. Leave per-call `cassette` options unset so the workload inherits that mode. Raw HTTP, external SDK calls, tool side effects and filesystem effects are outside the cassette scope.
- Strict replay returns a miss when the request hash has no match, without calling a provider. The runner limits general network, subprocess and filesystem-write capabilities. Per-call AI options can override the environment, so set them to inherit or explicitly select strict replay. For workloads with their own integrations, use host network controls when you need to enforce isolation.
- Successful recording requires the workload to pass and at least one cassette to be written. A failed recording stays marked incomplete. Replay refuses that directory. Keep it for inspection or use a new path to retry.
- Native cassettes contain requests and replies. Review them before sharing, even though Kujo redacts configured credentials and sensitive headers. The launcher keeps your directory structure and uses the runtime's native file format.
- If your tests need capabilities beyond reading files and environment variables and using native AI, use Kujo directly with the cassette environment variables and the flags your project requires. [Native cassette behavior](https://github.com/kujolang/kujo/blob/main/docs/AI_RUNTIME.md)
