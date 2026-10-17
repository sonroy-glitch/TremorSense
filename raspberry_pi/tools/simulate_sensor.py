"""Generates a synthetic sensor recording in the wire-protocol CSV format.

For testing the pipeline before the sensor hardware exists:

    python3 tools/simulate_sensor.py --seconds 120 --out /tmp/walk.csv
    python3 -m tremorsense.detect --csv /tmp/walk.csv

Normal walking is modelled as a ~1 Hz stride oscillation; freeze segments swap
that for the small, fast 3-8 Hz trembling that characterises FOG, which is what
makes the two classes separable at all. This is a convenience fixture, NOT
training data — train on real recordings.
"""

from __future__ import annotations

import argparse
import math
import random


def main() -> None:
    parser = argparse.ArgumentParser(description="Synthesise a TremorSense sensor CSV")
    parser.add_argument("--seconds", type=float, default=120.0)
    parser.add_argument("--rate", type=int, default=64, help="Sample rate in Hz")
    parser.add_argument(
        "--freeze-every",
        type=float,
        default=30.0,
        help="Start a freeze episode every N seconds",
    )
    parser.add_argument("--freeze-length", type=float, default=6.0, help="Freeze length in seconds")
    parser.add_argument("--out", default="-", help="Output file, or - for stdout")
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument(
        "--annotate",
        action="store_true",
        help="Append the true class (1 normal / 2 freeze) as a 10th column",
    )
    args = parser.parse_args()

    rng = random.Random(args.seed)
    total = int(args.seconds * args.rate)
    lines: list[str] = []
    if args.annotate:
        lines.append("# time_ms,ankle_fwd,ankle_vert,ankle_lat,thigh_fwd,thigh_vert,thigh_lat,trunk_fwd,trunk_lat,annotation")
    else:
        lines.append("# time_ms,ankle_fwd,ankle_vert,ankle_lat,thigh_fwd,thigh_vert,thigh_lat,trunk_fwd,trunk_lat")

    for index in range(total):
        t = index / args.rate
        phase = t % args.freeze_every
        frozen = phase >= (args.freeze_every - args.freeze_length)

        if frozen:
            # Small-amplitude trembling in the freeze band, little forward motion.
            swing = 25 * math.sin(2 * math.pi * 5.5 * t)
            forward = 10 * math.sin(2 * math.pi * 5.0 * t)
            noise = 8
        else:
            # Clear ~1 Hz stride.
            swing = 320 * math.sin(2 * math.pi * 1.0 * t)
            forward = 240 * math.sin(2 * math.pi * 1.0 * t + 0.6)
            noise = 25

        def jitter() -> float:
            return rng.gauss(0, noise)

        channels = [
            forward + jitter(),                       # ankle forward
            1000 + swing + jitter(),                  # ankle vertical (gravity)
            swing * 0.4 + jitter(),                   # ankle lateral
            forward * 0.7 + jitter(),                 # thigh forward
            1000 + swing * 0.6 + jitter(),            # thigh vertical
            swing * 0.3 + jitter(),                   # thigh lateral
            forward * 0.4 + jitter(),                 # trunk forward
            swing * 0.2 + jitter(),                   # trunk lateral
        ]

        row = [str(round(t * 1000))] + [f"{value:.1f}" for value in channels]
        if args.annotate:
            row.append("2" if frozen else "1")
        lines.append(",".join(row))

    text = "\n".join(lines) + "\n"
    if args.out == "-":
        print(text, end="")
    else:
        with open(args.out, "w") as handle:
            handle.write(text)
        print(f"Wrote {total} samples ({args.seconds:g}s @ {args.rate}Hz) to {args.out}")


if __name__ == "__main__":
    main()
