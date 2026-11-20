# Production notes

The composition uses HyperFrames CLI 0.9.71, Chrome hardware browser capture
when available and fixed 1920 × 1080, 30 fps, 92-second output. The preview runs
locally. The six sub-compositions follow the handoff's 12, 13, 13, 17, 15 and
22-second scene durations. The last scene switches from held-out scores to the
paired terminal excerpts, then holds the closing bumper for four seconds. Headline and JSON excerpts are editable text. The native test error
uses the literal strict replay marker and network wording from the log.

`hyperframes/tools/build-scenes.mjs` pulls the published evidence from the
repository. The chart draws every candidate from `score-progression.csv`, uses
the exact best eligible milestones and marks the failed safety gate rows with
crosses. Scores display rounded to at most one decimal place. The normalized
digest is identical in the captured baseline and winner JSON. One rejected
candidate row drives both the config change and the expected/actual example.

Local Inter and JetBrains Mono WOFF2 files come from the installed HyperFrames
0.9.71 code-editorial preset. Both families are distributed under the SIL Open
Font License. The bundled GSAP 3.15.0 from the same CLI ships with GreenSock's
standard-license notice inside its source. All composition fonts, JS and audio
resolve locally. Captured data remains in the Replay Lab repository and the
Asset Scout's shared workspace.

Motion repair during visual preflight used HyperFrames' scene-scoped document
queries instead of querying authored root attributes. The compiler flattens
those inner roots. The revised scenes register and seek independently.

The approved narration consisted of six complete ElevenLabs Siren takes.
The render uses the normalized scene derivatives with 0.55 seconds of lead-in
per shot. It adds local original music and three aligned cut cues. The music
uses the HyperFrames voiceover-carve script at strength 0.8 with six speech
sources. Source audio and receipts are managed by the Asset Scout and Media
Generator. The project-local timing and carve files are sufficient to regenerate
the editable index and reproduce its media placement without those receipts.

## Brand revision

The logomark uses the K paths from `kujo-command/img/kujo-logomark-black.svg`, the same artwork used in the Hermes and OpenCode videos. The bumper SVG fills the K directly against black so its edges stay dark. Departure Mono and its license come from `kujo-command/fonts`. The first 2.5 seconds lead with repeatable inputs. The final four seconds lead with catching regressions. The comparison screen stacks the terminal panels, request hash, and reproduced-record count in normal grid flow with 38 px gaps. The regression screen also has clearance above and below its rule.

## Chart revision

The video drops the bottom rule and text from every evidence scene. The sweep
marks each candidate and distinguishes eligible runs, rejected runs, and the
best eligible score. The sweep area and held-out bars use the same 4×4 Bayer
order as Watchdog. SVG draws the pattern so it stays fixed while the chart
reveals. [Dither Kit](https://tripwire.sh/dither-kit)

## Bumper cleanup

Both bumpers show the K and benefit headline. The first issue scene opens
with the headline and goes straight to the evidence.
