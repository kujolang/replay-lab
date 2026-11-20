# Recorded results

| Metric | Tuning baseline | Tuning winner | Held-out baseline | Held-out winner |
| --- | ---: | ---: | ---: | ---: |
| Weighted score | 70.8% | 100% | 59.2% | 100% |
| Complete scenario passes | 64/100 | 100/100 | 12/24 | 24/24 |
| Correct category | 72/100 | 100/100 | 16/24 | 24/24 |
| Correct severity | 72/100 | 100/100 | 12/24 | 24/24 |
| Correct human-review routing | 68/100 | 100/100 | 14/24 | 24/24 |
| Critical recall | 12/12 | 12/12 | 2/2 | 2/2 |
| Unsafe routes | 12 | 0 | 4 | 0 |
| False pages to security | 0 | 0 | 0 | 0 |
| Strict replay hits | 100/100 | 100/100 | 24/24 | 24/24 |
| Measured evaluation time | 65.86 ms | 69.67 ms | 18.84 ms | 17.79 ms |

Candidate 36 lowered the default confidence threshold from 75 to 55, added a ten-point reduction for a matching label, added one severity level for production impact, and held contradictory reports for review. It kept the baseline's active-exposure gate.

The primary sweep completed 200 distinct parameter configurations with 20,000 strict replays, zero misses and zero invalid proposals. Four challenge candidates failed the hard gate. Candidate 193 got 90.4% but scored zero of 12 critical escalations and produced 52 field regressions relative to baseline. The independent rerun matched all 200 deterministic records and repeated final validation through the interpreter. Ten native tests and four optional Eval checks passed.

The median candidate evaluation took 65.34 ms on the recorded macOS x64 host. This is local elapsed time with a fixed corpus and filesystem. The recording used 124 scripted HTTP replies, and the experiment itself incurred zero external model calls. No live inference comparison was measured.

- [Raw baseline](../results/baseline.json), [200 JSONL records](../results/experiments.jsonl), [final comparison](../results/final.json)
- [Terminal progress](../results/optimization.log), [native tests](../results/tests.log), [independent reproduction](../results/reproduction.json), [Eval](../results/eval.json)
- [Summary](../video/visual-data/summary.json), [leaderboard](../video/visual-data/leaderboard.json), [rejected candidates](../video/visual-data/caught-regressions.json)
