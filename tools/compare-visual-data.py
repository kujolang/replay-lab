"""Compare generated report inventory, tolerating float round-trip drift in timings."""

import csv
import json
import math
import sys
from pathlib import Path

HAND_AUTHORED = {"README.md", "cassette-flow.json", "baseline-terminal.json", "winner-terminal.json"}
TIMING_TOLERANCE_MS = 1e-9


def strict_inventory(directory):
    return sorted(
        path.relative_to(directory).as_posix()
        for path in directory.rglob("*")
        if path.is_file() and path.name not in HAND_AUTHORED
    )


def timing_matches(expected, actual):
    return (
        type(expected) in (int, float)
        and type(actual) in (int, float)
        and math.isfinite(expected)
        and math.isfinite(actual)
        and expected >= 0
        and actual >= 0
        and abs(expected - actual) <= TIMING_TOLERANCE_MS
    )


def json_equal(expected, actual):
    return json.dumps(expected, sort_keys=True) == json.dumps(actual, sort_keys=True)


def compare_report(name, expected, actual):
    if expected.read_bytes() == actual.read_bytes():
        return True
    if name == "score-progression.csv":
        with expected.open(newline="") as old_file, actual.open(newline="") as new_file:
            old_csv = csv.DictReader(old_file)
            new_csv = csv.DictReader(new_file)
            if old_csv.fieldnames != new_csv.fieldnames:
                return False
            return all(
                timing_matches(float(old.pop("runtime_ms")), float(new.pop("runtime_ms"))) and old == new
                for old, new in zip(old_csv, new_csv, strict=True)
            )
    if name not in {"leaderboard.json", "summary.json"}:
        return False
    old, new = json.loads(expected.read_bytes()), json.loads(actual.read_bytes())
    if name == "leaderboard.json":
        return all(
            timing_matches(a.pop("runtime_ms"), b.pop("runtime_ms")) and json_equal(a, b)
            for a, b in zip(old, new, strict=True)
        )
    old_times, new_times = old.pop("runtime_ms"), new.pop("runtime_ms")
    return (
        json_equal(old, new)
        and old_times.keys() == new_times.keys()
        and all(timing_matches(old_times[key], new_times[key]) for key in old_times)
    )


def main(expected, actual):
    names = strict_inventory(expected)
    if not names or names != strict_inventory(actual):
        raise SystemExit("Visual-data report inventory changed.")
    for name in names:
        try:
            matches = compare_report(name, expected / name, actual / name)
        except (KeyError, TypeError, ValueError):
            matches = False
        if not matches:
            raise SystemExit(f"Visual-data report differs: {name}")
    print(f"Verified {len(names)} generated visual-data reports.")


if __name__ == "__main__":
    main(*(Path(value) for value in sys.argv[1:]))
