# Experiment design

## Fixed conditions

The tuning split uses 25 issue templates across four environments. The 100 scenarios include routine routing, production impact, weak confidence, invalid predictions, contradictory signals, missing fields, malformed labels and embedded instructions. Thirty-six tuning cases are hard invariants, including 12 active exposures, eight additional security-review cases and 16 malformed-input or invalid-response cases.

The held-out split uses 12 separate issue templates across billing and reporting for 24 cases. Inputs, responses and expected decisions were hashed in `scenarios/heldout.sha256` before search. The optimizer consumed only tuning data. The holdout files and cassette subdirectory were made available in the project after the winner freeze commit `0bfdabc`. The oracles are published for audit. The same session authored both datasets, and each uses templated synthetic cases. Results characterize this fixture suite.

## Rounds

| Phase | Evaluations | Selection rule |
| --- | ---: | --- |
| Baseline | 1 control | Capture original policy and field failures. |
| Exploration | 120 candidates | Cross five confidence thresholds, four production weights, three label weights and two contradiction modes. Use a neighboring threshold for the combination equal to the baseline. |
| Refinement | 72 candidates | Take the leading eligible exploration candidate. Evaluate six adjacent confidence thresholds, four impact weights and three label weights with its contradiction mode fixed. |
| Challenge | 8 candidates | Take four leaders. For each, disable active-exposure escalation in one candidate and use a high confidence threshold in another. |
| Final validation | 2 controls | Evaluate only the original policy and frozen winner on the held-out split. |

Each proposal has a tracked parent. Candidate variations are executed parameter changes to the same Kujo decision function. They produced 68 distinct decision sets on the tuning split. Configuration identities include each parameter even when two configurations agree on all observed examples.

## Acceptance

A scenario passes when its category, severity, priority, action, and human-review flag all match and its cassette is available. Confidence is reported from the model and tested at thresholds. The score weights those five fields by 3, 2, 1, 1 and 3 respectively, then divides earned points by available points. A replay failure or hard invariant violation makes the policy ineligible. Eligible policies rank by total points, then by full scenario passes, then by execution order.

A regression is a field that agreed with the oracle under baseline and failed under a candidate. Unsafe routes count cases requiring human review that bypassed it. False escalations count unexpected `page_security` actions. Critical recall counts expected `page_security` actions that kept P0 and human review. Runtime is measured with `performance_now()` around the evaluation loop. It includes reading and decoding native cassettes, policy execution, and evaluation.
