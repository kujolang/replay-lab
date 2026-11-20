# Render verification

The [current MP4](../output/kujo-replay-lab.mp4) shows the K and benefit headline on each bumper. The first issue scene opens with its headline. Its SHA-256 is `22628a58b868dd216d1ce9983041d5106c1f11183a124d825fe5f5694c37546c`.

HyperFrames passed its checks. Full decoding passed at 92.000 seconds and 2,760 frames. Rendered stills show both clean bumpers and the opening issue screen. The pixel checks confirmed dark logo edges on both bumpers. The AAC stream matches the previous version byte-for-byte.

## Chart revision

The chart revision removed the bottom rule and text from the evidence scenes and added ordered dither to the sweep and held-out charts. Its SHA-256 is `489058455f935288bcf9c5599568e81fe2622a64260fb2bd603fe5616f5f0004`.

HyperFrames passed lint, runtime, layout, contrast, and audio checks. Full decoding passed at 92.000 seconds, 1920 × 1080, and 2,760 frames. Rendered stills confirm the revised charts, terminal comparison, and both bumpers. The AAC stream matches the previous version byte-for-byte.

## Branding revision

The branding revision added benefit-led Kujo K bumpers, Departure Mono display text, and more space on the closing evidence screens. Its SHA-256 is `81277ae433c61a13a63afb7c3cbc32909ff48a73559487e7bb3190efccdbce8b`.

HyperFrames passed the layout, contrast, runtime, lint, and audio checks. Full decoding passed at 92.000 seconds, 1920 × 1080, and 2,760 frames. The intro, closing score and terminal screens, and outro were checked against the rendered frames. The AAC stream hash matches the original render byte-for-byte.

## Original version

The original MP4 was byte-identical to the independent review candidate. Its SHA-256 is `04b789133dff1bf425b17a4b78567c1835a69af250d450c0d692dd7cf8ad866a`.

HyperFrames passed lint, runtime, layout, contrast and audio checks. Independent review verified the complete decode, six scene transitions, experiment claims, and all six narration clips by comparing the final mix with the source stems and checking a local transcription. The final mix measured −15.7 LUFS and −2.8 dBTP. The review left human playback of the audio pending.

[Detailed review](critique.md) · [Render properties](../output/metadata.json)
