"""Rebuild the original 92-second Replay Lab instrumental bed and cut cues."""

import json
from pathlib import Path

import numpy as np
import soundfile as sf

AUDIO = Path(__file__).resolve().parents[1] / "audio"
SAMPLE_RATE = 24000
RUNTIME = 92


def pan(left_right: float) -> np.ndarray:
    return np.array([np.sqrt((1 - left_right) / 2), np.sqrt((1 + left_right) / 2)], dtype=np.float32)


def add_tone(track: np.ndarray, start: float, length: float, frequency: float,
             volume: float, position: float, texture: str) -> None:
    start_index = round(start * SAMPLE_RATE)
    end_index = min(len(track), start_index + round(length * SAMPLE_RATE))
    if end_index <= start_index:
        return
    time = np.arange(end_index - start_index, dtype=np.float32) / SAMPLE_RATE
    if texture == "pad":
        envelope = np.minimum(time / 1.8, 1) * np.minimum((length - time) / 2.6, 1)
        waveform = (np.sin(2 * np.pi * frequency * time)
                    + 0.15 * np.sin(2 * np.pi * (2.001 * frequency) * time + 0.42)
                    + 0.05 * np.sin(2 * np.pi * (3.003 * frequency) * time - 0.52))
        waveform *= 0.91 + 0.09 * np.sin(2 * np.pi * 0.20 * time)
    else:
        envelope = np.minimum(time / 0.013, 1) * np.exp(-time / (length / 5))
        envelope *= np.minimum((length - time) / 0.05, 1)
        waveform = (np.sin(2 * np.pi * frequency * time) +
                    0.22 * np.sin(2 * np.pi * (1.496 * frequency) * time + 0.62))
    track[start_index:end_index] += ((volume * waveform * envelope)[:, None] * pan(position))


def make_music() -> list[dict]:
    bed = np.zeros((RUNTIME * SAMPLE_RATE, 2), dtype=np.float32)
    accents = np.zeros_like(bed)
    # D minor voicing, with softer downshift at safety rejection and a final resolution.
    sections = [
        (0, 13, (73.42, 146.83, 220, 261.63)),
        (11, 15, (65.41, 130.81, 196, 293.66)),
        (24, 15, (58.27, 116.54, 174.61, 261.63)),
        (37, 19, (73.42, 146.83, 220, 293.66)),
        (54, 17, (55, 110, 164.81, 219.42)),
        (69, 11, (58.27, 116.54, 174.61, 293.66)),
        (78, 14, (73.42, 146.83, 220, 293.66))
    ]
    positions = (0, -0.32, 0.37, 0.16)
    amounts = (0.009, 0.009, 0.006, 0.003)
    for start, duration, chord in sections:
        for frequency, position, amount in zip(chord, positions, amounts):
            add_tone(bed, start, duration, frequency, amount, position, "pad")
        repeat = 1.36 if start == 37 else 2.72
        for index, offset in enumerate(np.arange(0.8, duration - 1.5, repeat)):
            if start == 54 and offset < 3.5:
                continue
            frequency = chord[(1, 3, 2, 1)[index % 4]] * 1.997
            add_tone(bed, start + float(offset), 0.52, frequency,
                     0.007 if start == 37 else 0.005, (-1)**index * 0.35, "pulse")
    cues = [
        (12.0, 330, 0.14, "Cassette shot cut"),
        (38.0, 220, 0.22, "Sweep shot cut"),
        (55.0, 118, 0.32, "Rejected candidate shot cut"),
    ]
    for start, frequency, duration, _ in cues:
        add_tone(accents, start, duration, frequency, 0.032, 0, "pulse")
    fixture = []
    for name, track in [("music", bed), ("sfx", accents)]:
        path = AUDIO / f"{name}.wav"
        track *= 1.7 if name == "music" else 2.4
        sf.write(path, track, SAMPLE_RATE, subtype="PCM_16")
        fixture.append({"path": f"assets/audio/{name}.wav", "start": 0, "duration": RUNTIME,
                       "purpose": "instrumental bed" if name == "music" else "cut accents",
                       "max_sample_peak": round(float(np.max(np.abs(track))), 6)})
    (AUDIO / "sfx-cues.json").write_text(json.dumps(
        [{"time": start, "label": label} for start, _, _, label in cues], indent=2) + "\n")
    return fixture


if __name__ == "__main__":
    AUDIO.mkdir(exist_ok=True, parents=True)
    make_music()
