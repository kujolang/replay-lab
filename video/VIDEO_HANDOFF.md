# Kujo Replay Lab video handoff

**Format.** 92 seconds, 16:9, black-and-white. Use a dark terminal surface, near-white typography, thin divider lines, and a restrained monospace for code. Use the included diagram or rebuild it as editable HyperFrames elements. Keep all evidence labels and critical numbers readable at 1080p.

Open on a live production failure filed as a feature. Show that the baseline suggests `queue_feature`, P3, and no human review. Later reveal the winning policy's P1 manual-review recommendation for the same recorded classification. Render the terminal with the real CLI commands or the captured outputs. The same request digest is visible in both captures.

- **Recorded interaction.** The local scripted provider returned feature, severity 1, confidence 91 for the example. Kujo recorded its HTTP response and replays the matching version-1 cassette without opening a socket. [Actual cassette](../cassettes/800b44749f9307b18c443ef73846e7b6775b2ce5f035518bbf7418a4b0effab9.json)
- **Controlled experiment.** 120 exploration, 72 refinement, and eight challenge candidates ran on the same 100 scenarios. The policy changed downstream of the model request. The candidate runs logged 20,000 native replay hits and zero misses. [Execution log](../results/optimization.log)
- **Caught regression.** Candidate 193 disabled the active-exposure rule, missed all 12 critical cases and scored 90.4%. The gate rejected it despite its score. Use the `exposure-console` failure, where a P2 bug route would have skipped human review. [Full rejected records](visual-data/caught-regressions.json)
- **Frozen result.** Candidate 36 scored 100% versus 70.8% in tuning. The held-out comparison was 100% versus 59.2%, with 24/24 versus 12/24 fully correct. Both policies paged security on both held-out active exposures. [Held-out evidence](../results/final.json)
- **Verification.** Native tests passed, including a forced request mismatch. The complete sweep was independently rerun from the published fixture and source bytes. All 200 deterministic records matched, along with the VM/interpreter held-out decisions. [Tests](../results/tests.log) · [Reproduction](../results/reproduction.json)

The fixture replies were scripted. Use “zero external model calls” and “native replay hits.” Keep the 100% score attached to the fixture split and omit dollar savings, commercial model accuracy, or latency comparisons with live inference.

Start with [storyboard](storyboard.md), [shot list](scenes.json), and [narration](narration.md). [Visual data index](visual-data/README.md) maps each chart and terminal capture. The diagram source is available under [assets](assets/replay-flow.svg).
