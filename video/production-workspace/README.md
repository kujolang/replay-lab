# Kujo Replay Lab explainer

The editable HyperFrames composition runs 92 seconds at 1920 × 1080 and 30 frames per second. It uses the published experiment ledger, numeric exports, native cassette, and terminal captures described in the [original handoff](../VIDEO_HANDOFF.md). The six narration takes use ElevenLabs Siren with the `eleven_v4` model. The music and cut cues were synthesized locally.

The [finished MP4](output/kujo-replay-lab.mp4) and [render metadata](output/metadata.json) are included.

Open [the composition](production/hyperframes/README.md) for preview and render commands. The project contains the exact assets required to render locally. [Narration provenance](production/narration-provenance.json)

The published experiment results remain the data source for the visuals. The film compares baseline and winner on the 24 held-out fixture cases and shows the actual rejection of candidate 193. [Full run results](../../docs/RESULTS.md)

Third-party font notices are in `production/hyperframes/assets/fonts/`. GSAP keeps its notice within the bundled source. The generated voice audio is subject to [ElevenLabs’ generated-content terms](https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform).
