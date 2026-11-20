"""Prepare reversible, timed Siren v4 audio from acquired VideoOps receipts."""

from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json
import subprocess

WORKSPACE = Path(__file__).resolve().parents[2]
AUDIO = WORKSPACE / "assets" / "audio"
VOICE_LEAD = 0.55
TAIL = 0.35
LAST_TAIL = 1.25


def invoke(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(args, check=True, capture_output=True, text=True)


def audio_probe(filename: Path) -> dict:
    return json.loads(invoke(["ffprobe", "-v", "error", "-select_streams", "a:0",
                              "-show_entries", "stream=sample_rate,channels,duration,codec_name",
                              "-of", "json", str(filename)]).stdout)["streams"][0]


def measured_levels(filename: Path, filter_prefix: str = "") -> dict:
    result = invoke(["ffmpeg", "-hide_banner", "-nostats", "-i", str(filename), "-af",
                     filter_prefix + "loudnorm=I=-18:TP=-2.5:LRA=9:print_format=json",
                     "-f", "null", "-"])
    return json.JSONDecoder().raw_decode(result.stderr[result.stderr.rfind("{"):])[0]


def prepare(shot: dict) -> dict:
    sid = shot["id"]
    receipt = f"media/replay-lab-siren-{sid}/result.json"
    media = json.loads((WORKSPACE / receipt).read_text())
    assert media["state"] == "SUCCESS" and media["model"] == "eleven_v4"
    assert media["voice"] == "eXpIbVcVbLo8ZJQDlDnl"
    source = WORKSPACE / media["derived"][0]["path"]
    length = float(audio_probe(source)["duration"])
    budget = shot["duration"] - VOICE_LEAD - (LAST_TAIL if sid == "validated" else TAIL)
    speed = max(1.0, (length + 0.045) / budget)
    assert speed <= 1.16, (sid, speed)
    speed_filter = f"atempo={speed:.6f}," if speed > 1.0 else ""
    stats = measured_levels(source, speed_filter)
    gain = -18 - float(stats["input_i"])
    filename = AUDIO / f"narration-{sid}.wav"
    invoke(["ffmpeg", "-hide_banner", "-v", "error", "-y", "-i", str(source), "-af",
            speed_filter + f"volume={gain:.3f}dB,alimiter=limit=0.69:attack=4:release=60:level=false:latency=true", "-ac", "1", "-ar", "24000",
            "-c:a", "pcm_s16le", str(filename)])
    measured = audio_probe(filename)
    duration = float(measured["duration"])
    assert duration <= budget, (sid, duration, budget)
    final = measured_levels(filename)
    assert float(final["input_tp"]) < -1.5, (sid, final)
    assert -21 <= float(final["input_i"]) <= -16.5, (sid, final)
    print(f"{sid}: {duration:.3f}s at tempo {speed:.3f}, {final['input_i']} LUFS, {final['input_tp']} dBTP", flush=True)
    return {"id": sid, "path": str(filename.relative_to(WORKSPACE)), "start": shot["start"] + VOICE_LEAD,
            "duration": duration, "end": round(shot["start"] + VOICE_LEAD + duration, 6),
            "original": media["original"]["path"], "original_duration": length,
            "tempo": round(speed, 6), "gain_db": round(gain, 3), "limiter_sample_ceiling": 0.69,
            "provider_receipt": receipt,
            "integrated_loudness_lufs": float(final["input_i"]), "true_peak_dbtp": float(final["input_tp"])}


def main() -> None:
    shots = json.loads((WORKSPACE / "planning" / "shot-list.json").read_text())["shots"]
    with ThreadPoolExecutor(max_workers=2) as pool:
        voice = list(pool.map(prepare, shots))
    stems = []
    for name, purpose in (("music", "instrumental bed"), ("sfx", "cut accents")):
        path = AUDIO / f"{name}.wav"
        duration = float(audio_probe(path)["duration"])
        assert duration == 92.0
        stems.append({"path": str(path.relative_to(WORKSPACE)), "start": 0, "duration": duration, "purpose": purpose})
    (AUDIO / "timings.json").write_text(json.dumps(
        {"scene_duration_seconds": 92, "sample_rate": 24000, "narration": voice, "stems": stems},
        indent=2) + "\n")


if __name__ == "__main__":
    main()
