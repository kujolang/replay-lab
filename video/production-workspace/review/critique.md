# Independent VideoOps review

**Exact candidate:** `output/draft.mp4`  
**SHA-256:** `04b789133dff1bf425b17a4b78567c1835a69af250d450c0d692dd7cf8ad866a`  
**Decision:** Technical PASS. Visual and factual PASS within the reviewed scope. Combined perceptual gate `REVIEW_INCOMPLETE` pending playback with audible output. No editor repairs identified.

## Evidence in the rendered MP4

- **00:00–00:25.** The problem is readable on frame 0. The explicitly marked baseline excerpt shows `queue_feature`, `P3` and `human_review: false`. The cassette card preserves the exact SHA-256, identifies the scripted loopback provider, and displays the recorded feature/1/91 reply.
- **00:25–00:55.** The stepwise flow keeps the request fixed and identifies the policy as the variable. The reproduced native miss wording is legible. The tuning chart displays the eligible best-so-far steps, candidate 36 at 100%, all three phase counts, and 20,000 replay hits with zero misses or external model calls. The four crosses have their own distinct mark.
- **00:55–01:10.** The expected P0 security decision and observed P2 bug route are readable side by side. The rejection callout pairs 12 hard failures and 0/12 critical escalations with the candidate's separate 90.4% weighted score.
- **01:10–01:32.** The bars identify the 24-case held-out split and distinguish weighted score from fully correct case counts. Paired excerpts show a matching request hash and the P3-to-P1 action change. The repository and `tools/lab test` remain visible through the last frame.
- **Presentation.** Inspected fourteen frames extracted from the exact MP4, including frame 0 and frame 2759. The alternation of dark terminal and light proof panels supports the story. The staged reveals preserve reading time. No clipping or unintentional empty frames were observed.

## Decode, alignment and audio measurements

FFmpeg fully decoded the two streams without error. The file is 1920 × 1080 H.264 at 30 fps, exactly 2,760 decoded video frames and 92.000 seconds, with 48 kHz stereo AAC. Black-frame detection returned no findings. EBU R128 measured −15.7 LUFS integrated loudness, 3.2 LU range and −2.8 dBTP true peak. The only interval exceeding 350 ms below −55 dB begins at 91.446 s, after the last voice stem and during the intentional outro fade. AAC decoder padding can extend this detector interval a few milliseconds beyond the MP4 duration.

Independent band-limited correlation located all six original voice stems at their planned offsets with zero measured onset delta and 0.9994–0.9996 full-stem correlation. The voice measured 29.34–31.40 dB above the residual in the 200–3600 Hz band. Unprimed Whisper on the final AAC mix transcribed all six scenes, including the candidate IDs, weighted score, 20,000 hits, holdout counts and final spoken CTA. Its segment boundaries are estimates and the final timestamp extends beyond the exact media endpoint. The decoded stem measurements and ffprobe duration establish actual timing.

## Remaining capability

The reviewer inspected output frames and analyzed the final audio through local automated tools. Audio listening could not be exercised in this harness. Pronunciation, subjective mix comfort and audible edits therefore remain for a capable playback reviewer on the same checksum. Keep the existing candidate. This gate requires review rather than a new render.
