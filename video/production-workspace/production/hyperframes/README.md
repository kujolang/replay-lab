# Kujo Replay Lab · editable HyperFrames composition

Open this directory with HyperFrames 0.9.71. The six scene files under
`compositions/` contain editable HTML and scene-local GSAP timelines. `index.html`
places the scenes and audio. The composition uses a 1920 × 1080 canvas at 30 fps
and a 92-second duration.

```sh
DO_NOT_TRACK=1 npx --yes hyperframes@0.9.71 preview
DO_NOT_TRACK=1 npx --yes hyperframes@0.9.71 check --no-craft
DO_NOT_TRACK=1 npx --yes hyperframes@0.9.71 render --fps 30 --quality delivery --output replay-lab.mp4
```

The checked-in scene markup is the editable project. To rebuild it from the
published Replay Lab evidence, run `node tools/build-scenes.mjs` in the original
repository layout. Rebuilding overwrites index and scene files. The script
validates cassette/request identity and the sweep result count. It copies the
audio described by `../../assets/audio/timings.json` when available. Audio carve
settings are authoring adjustments in the checked-in composition.
