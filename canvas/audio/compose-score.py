"""Synthesize the original Kujo showcase score as a stereo 48 kHz WAV."""

import sys
import wave
from pathlib import Path

import numpy as np


RATE = 48000
LENGTH = 30
BEAT = 60 / 96
RNG = np.random.default_rng(109)
TRACK = np.zeros((LENGTH * RATE, 2))


def timebase(duration):
    return np.arange(round(duration * RATE)) / RATE


def pitch(note):
    return 440 * 2 ** ((note - 69) / 12)


def envelope(t, attack, release):
    return np.clip(t / attack, 0, 1) * np.clip((t[-1] - t) / release, 0, 1)


def place(at, signal, gain, pan=0):
    offset = round(at * RATE)
    end = min(len(TRACK), offset + len(signal))
    if offset >= end:
        return
    angle = (pan + 1) * np.pi / 4
    TRACK[offset:end] += signal[:end - offset, None] * gain * np.array([np.cos(angle), np.sin(angle)])


def pad(at, notes, duration, gain, attack=.92, release=.85):
    t = timebase(duration)
    env = envelope(t, attack, release)
    for i, note in enumerate(notes):
        f = pitch(note)
        phase = RNG.uniform(0, 2 * np.pi)
        fundamental = np.sin(2 * np.pi * f * t + phase + .23 * np.sin(t * (1.9 + i * .31)))
        texture = .19 * np.sin(2 * np.pi * f * 2.003 * t + phase * 2) + .08 * np.sin(2 * np.pi * f * 3.007 * t)
        motion = .87 + .13 * np.cos(2 * np.pi * (.25 + .06 * i) * t + phase)
        place(at, (fundamental + texture) * env * motion, gain / np.sqrt(len(notes)), (-.72, .20, -.19, .74, .44)[i])


def pulse(at, note, gain, pan):
    t = timebase(.28)
    f = pitch(note)
    angle = 2 * np.pi * f * t
    body = np.sin(angle + .47 * np.exp(-12 * t) * np.sin(2 * angle))
    body += .24 * np.sin(2.003 * angle) + .12 * np.sin(3 * angle)
    place(at, body * np.exp(-8.5 * t) * envelope(t, .008, .045), gain, pan)


def keys(at, note, gain, pan):
    t = timebase(1.7)
    f = pitch(note)
    body = np.zeros_like(t)
    for partial, gain_scale, decay in [(1, 1, 2), (2.003, .35, 3.5), (3.008, .19, 6), (4.017, .13, 12)]:
        body += gain_scale * np.sin(2 * np.pi * f * partial * t) * np.exp(-decay * t)
    body *= envelope(t, .006, .24)
    place(at, body, gain, pan)
    place(at + .296, body, gain * .20, -pan)
    place(at + .601, body, gain * .08, pan * .6)


def kick(at, gain):
    t = timebase(.44)
    phase = 2 * np.pi * (40 * t + 6.3 * (1 - np.exp(-14 * t)))
    place(at, np.sin(phase) * np.exp(-11 * t) * envelope(t, .006, .07), gain)


def tick(at, gain, pan):
    t = timebase(.11)
    raw = RNG.uniform(-1, 1, len(t))
    metal = raw - np.roll(raw, 1)
    metal += .48 * np.sin(2 * np.pi * 1840 * t) + .32 * np.sin(2 * np.pi * 2593 * t)
    place(at, metal * np.exp(-38 * t) * envelope(t, .001, .02), gain, pan)


# The original harmonic progression and sparse motif leave room for the visual changes.
chords = [
    (38, 45, 53, 60, 64), (34, 45, 50, 57, 60),
    (43, 46, 53, 57, 62), (39, 46, 55, 60, 62),
]
for bar in range(11):
    at = bar * 4 * BEAT
    chord = chords[bar % len(chords)]
    weight = .46 + .54 * min(1, bar / 4)
    pad(at, chord, 3.2, .105 * weight)
    if bar > 0:
        for index, degrees in enumerate((0, 1, 0, 2, 0, 1, 2, 1)):
            pulse(at + index * BEAT / 2, chord[degrees], .053 * weight * (1 if index % 2 == 0 else .56), (-.16 if index % 2 else .16))
    if bar >= 3:
        kick(at, .105 * weight)
        if bar >= 5:
            kick(at + 2 * BEAT, .077)
        for i, beat_offset in enumerate((.5, 1.5, 2.5, 3.25)):
            tick(at + beat_offset * BEAT, .0085 if i % 2 == 0 else .0065, -.52 if i % 2 == 0 else .58)

for at, note, pan in [
    (1.85, 69, -.42), (3.25, 72, .39), (5.3, 65, -.30), (7.95, 67, .36),
    (9.75, 64, -.42), (12.88, 69, .37), (14.56, 74, -.35),
    (17.35, 72, .38), (19.0, 67, -.36), (21.25, 70, .36), (23.54, 65, -.38),
    (25.25, 64, .30), (27.38, 62, -.22),
]:
    keys(at, note, .058 if 7 < at < 26 else .044, pan)

# A final chord arrives with the wordmark, then decays through the last shot.
pad(26.68, (38, 45, 50, 57, 64), 3.32, .158, attack=.53, release=1.65)
kick(27.30, .115)
dry = TRACK.copy()
for delay, gain in [(.044, .12), (.081, .086), (.136, .051), (.225, .037)]:
    offset = round(delay * RATE)
    TRACK[offset:] += dry[:-offset, ::-1] * gain
timeline = timebase(LENGTH)
TRACK *= (envelope(timeline, .28, .66) ** 1.25)[:, None]
TRACK = np.tanh(TRACK * 1.4)
samples = (TRACK * (.91 / np.max(np.abs(TRACK))) * 32767).astype('<i2')

with wave.open(str(Path(sys.argv[1])), 'wb') as audio:
    audio.setnchannels(2)
    audio.setsampwidth(2)
    audio.setframerate(RATE)
    audio.writeframes(samples.tobytes())
