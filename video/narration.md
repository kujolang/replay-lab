# Narration

**00:00–00:12**
Production jobs have stopped. The report asks for a toggle, so our baseline triage queues a feature at P3 without asking for review. We can reproduce that decision every time.

**00:12–00:25**
Kujo recorded the HTTP exchange with a scripted local classifier. For this issue, the response was feature, severity one, confidence ninety-one. Kujo keys the cassette by the normalized request.

**00:25–00:38**
Strict replay loads that response without opening a socket. Change the prompt or temperature and it returns a replay miss. Keep the request fixed and we can change the policy while keeping the same model input.

**00:38–00:55**
We ran two hundred candidate configurations across a hundred scenarios. Every run replayed the interactions and scored the actual decisions. Candidate thirty-six reached one hundred percent on the tuning suite. All twenty thousand candidate replays matched.

**00:55–01:10**
One change broke a mandatory rule. Candidate one ninety-three disabled the active-exposure escalation and missed all twelve critical cases. Its score was ninety point four percent. The hard gate rejected it.

**01:10–01:32**
We froze the winner before evaluating twenty-four held-out issues. The baseline passed twelve. The winner passed all twenty-four. On the opening issue, the same recorded response now leads to P1 and human review. The source, cassettes, and all two hundred scored runs are in the repository. Run the tests locally with Kujo.
