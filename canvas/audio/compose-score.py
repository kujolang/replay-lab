"""Render the original 30-second Kujo title cue as a stereo 48 kHz WAV."""

import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

RATE = 48000
LENGTH = 30
BEAT = .60
BAR = 4 * BEAT
TWO_PI = 2 * np.pi
RNG = np.random.default_rng(211)
TRACK = np.zeros((RATE * LENGTH, 2))
STRINGS = []


def timeline(duration):
    return np.arange(round(RATE * duration)) / RATE


def hz(note):
    return 440 * 2 ** ((note - 69) / 12)


def curve(t, attack, release):
    return np.minimum(1, t / attack) * np.minimum(1, (t[-1] - t) / release)


def place(at, sound, gain, pan=0):
    begin = round(at * RATE)
    end = min(len(TRACK), begin + len(sound))
    if end <= begin:
        return
    angle = (pan + 1) * np.pi / 4
    TRACK[begin:end] += sound[:end - begin, None] * gain * [np.cos(angle), np.sin(angle)]


def bow(at, pitches, duration, velocity, part=1):
    STRINGS.extend(dict(start=at, length=duration, pitch=pitch, velocity=velocity, part=part) for pitch in pitches)


def machine_bass(at, note, gain, long=False):
    t = timeline(.55 if long else .285)
    p = TWO_PI * hz(note) * t
    cutoff = np.exp(-t * 9)
    body = np.sin(p) + .32 * np.sin(2 * p + .30) + .21 * np.sin(3 * p)
    body += cutoff * (.24 * np.sin(4 * p) + .13 * np.sin(7.003 * p))
    place(at, np.tanh(body * 1.25) * np.exp(-t * (2.8 if long else 7)) * curve(t, .012, .035), gain)


def theme_note(at, note, duration, gain):
    t = timeline(duration + .26)
    f = hz(note)
    phase = TWO_PI * f * t
    envelope = curve(t, .027, .215)
    # The detuned octaves and exposed attack give the lead a controlled, metallic edge.
    voice = np.sin(phase) + .38 * np.sin(phase * 1.997 + .25 * np.sin(phase))
    voice += .24 * np.sin(phase * 3.004) * np.exp(-3 * t)
    voice += .19 * np.sin(phase * .499)
    signal = np.tanh(voice * 1.08) * envelope * np.exp(-t * 1.6)
    place(at, signal, gain, -.21)
    place(at + .153, signal, gain * .23, .58)
    place(at + .309, signal, gain * .09, -.55)
    bow(at + .017, [note - 12], duration * .88, 61)


def thump(at, gain, strike=False):
    t = timeline(.76 if strike else .31)
    phase = TWO_PI * (44 * t + 5.9 * (1 - np.exp(-15 * t)))
    body = np.sin(phase) + .22 * np.sin(1.58 * phase) * np.exp(-t * 14)
    envelope = curve(t, .007, .065) * np.exp(-t * (6 if strike else 11))
    place(at, body * envelope, gain)


def steel(at, gain, pan, duration=.17):
    t = timeline(duration)
    raw = RNG.uniform(-1, 1, len(t))
    sound = .73 * (raw - np.roll(raw, 1)) + .30 * np.sin(TWO_PI * 1593 * t)
    sound += .19 * np.sin(TWO_PI * 2449 * t) + .20 * np.sin(TWO_PI * 508 * t)
    place(at, sound * np.exp(-t * (15 if duration > .2 else 43)) * curve(t, .002, .025), gain, pan)


def rise(at, duration, gain):
    t = timeline(duration)
    noise = RNG.normal(0, 1, len(t))
    smoothed = np.convolve(noise, np.ones(43) / np.sqrt(43), mode='same')
    p = TWO_PI * (67 * t + 42 * t * t)
    signal = (smoothed * .28 + np.sin(p) * .67) * (t / duration) ** 2 * curve(t, .05, .10)
    place(at, signal, gain, .16)


# A four-bar original motif, repeated with changes in register and orchestration.
motif = [(0, 73, .83), (1.5, 69, .43), (2.5, 76, .67), (4, 68, .96),
         (6, 71, .48), (7, 66, .83)]
for cue, strength in [(2.4, .84), (9.6, 1), (19.2, 1.06)]:
    for beat, note, duration in motif:
        theme_note(cue + beat * BEAT, note, duration * BEAT, .18 * strength)

# F-sharp pedal and shifting upper voicings keep the cue tense under the repeated figure.
progression = [
    (42, [54, 61, 68]), (42, [57, 61, 64]), (38, [54, 57, 64]), (35, [54, 57, 61]),
    (42, [54, 61, 69]), (42, [56, 61, 64]), (38, [57, 61, 66]), (40, [56, 59, 66]),
    (42, [54, 61, 68]), (38, [57, 61, 64]), (35, [54, 57, 64]), (42, [54, 61, 69]),
]
for bar, (root, harmony) in enumerate(progression):
    at = bar * BAR
    weight = [.69, .78, .84, .94, 1, 1.03, 1.04, .80, 1.03, 1.05, .88, .73][bar]
    bow(at + .04, harmony, 2.18, 57 + round(weight * 14))
    for step, interval in enumerate((0, 0, 7, 0, 0, 3, 0, 7)):
        # Allow space around the ending and make the continuous timing bed audible early.
        now = at + BEAT * step / 2
        if now >= 27.15:
            break
        accent = (1.00, .44, .55, .67, .83, .54, .63, .53)[step]
        machine_bass(now, root + interval, .22 * accent * weight)
        if step in (0, 3, 4, 6) and bar > 0:
            bow(now + .012, [root + 12 + interval], .15, 68 + round(accent * 16), 0)
        if step in (2, 5, 7) and bar >= 2:
            bow(now + .02, [root + 24 + interval], .08, 68, 2)
        steel(now + .006, .030 * accent * weight, -.46 if step % 2 == 0 else .46)
    if bar > 0:
        thump(at, .24 * weight, strike=bar in (4, 8))
    if bar >= 2 and at + 1.2 < 27.15:
        thump(at + 1.2, .16 * weight)
        steel(at + .9, .058 * weight, .21, .31)
        steel(at + 2.1, .045 * weight, -.21, .26)

for at in (8.66, 18.29, 25.87):
    rise(at, 1.10, .08)

# A signature hit and short, resolved sting accompany the lockup on screen.
thump(27.28, .36, strike=True)
steel(27.30, .046, .26, .48)
machine_bass(27.28, 42, .25, long=True)
bow(27.25, [42, 54, 61, 68], 2.17, 87)
theme_note(27.28, 73, .39, .18)
theme_note(27.70, 66, .61, .16)

# Render the original string performance with the macOS sampler and blend it with the original synthesis.
with tempfile.TemporaryDirectory() as directory:
    work = Path(directory)
    events, rendered = work / 'notes.json', work / 'strings.caf'
    events.write_text(json.dumps(STRINGS))
    runner = work / 'render-strings'
    subprocess.run(['swiftc', str(Path(__file__).with_name('render-strings.swift')), '-o', str(runner)], check=True)
    subprocess.run([str(runner), str(events), str(rendered)], check=True)
    data = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(rendered), '-f', 'f32le', '-'])
    strings = np.frombuffer(data, '<f4').reshape(-1, 2)
    assert strings.shape == TRACK.shape and np.max(np.abs(strings)) > .005
    TRACK += strings * .45
    for delay, gain in [(.043, .072), (.112, .065), (.189, .034)]:
        offset = round(delay * RATE)
        TRACK[offset:] += strings[:-offset, ::-1] * gain

TRACK *= curve(timeline(LENGTH), .037, .51)[:, None]
TRACK = np.tanh(TRACK * 1.55)
samples = (TRACK * (.91 / np.max(np.abs(TRACK))) * 32767).astype('<i2')
with wave.open(sys.argv[1], 'wb') as audio:
    audio.setnchannels(2)
    audio.setsampwidth(2)
    audio.setframerate(RATE)
    audio.writeframes(samples.tobytes())
