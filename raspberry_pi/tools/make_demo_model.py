"""Builds a throwaway fog_model.pkl so the pipeline can be exercised today.

    python3 tools/simulate_sensor.py --seconds 600 --annotate --out /tmp/train.csv
    python3 tools/make_demo_model.py --csv /tmp/train.csv

This trains a small logistic-regression classifier on the *synthetic* recording
from simulate_sensor.py. It exists purely to prove the wiring end-to-end when no
real model is present, and is NOT needed once tremorsense/model/model.pkl is in
place.

It produces a WINDOW-input model, so using it means setting FEATURE_MODE=raw
(or =features) in .env — the shipped RandomForest instead uses the per-sample
contract, FEATURE_MODE=sample. See tremorsense/model/README.md.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tremorsense.classifier import extract_features  # noqa: E402
from tremorsense.config import N_CHANNELS  # noqa: E402


def load_annotated_csv(path: Path) -> tuple[np.ndarray, np.ndarray]:
    """Reads simulate_sensor.py's --annotate output: 9 columns + class."""
    rows, labels = [], []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split(",")
        if len(parts) < N_CHANNELS + 2:
            raise SystemExit(
                "This CSV has no annotation column. Regenerate it with "
                "`python3 tools/simulate_sensor.py --annotate`."
            )
        rows.append([float(part) for part in parts[1 : N_CHANNELS + 1]])
        labels.append(int(parts[N_CHANNELS + 1]))
    return np.array(rows), np.array(labels)


def main() -> int:
    parser = argparse.ArgumentParser(description="Train a demo FOG model")
    parser.add_argument("--csv", required=True, help="Annotated CSV from simulate_sensor.py")
    parser.add_argument("--window", type=int, default=128)
    parser.add_argument("--stride", type=int, default=64)
    parser.add_argument("--rate", type=int, default=64)
    parser.add_argument("--mode", choices=["raw", "features"], default="raw")
    parser.add_argument(
        "--out-dir",
        default=str(Path(__file__).resolve().parent.parent / "tremorsense" / "model"),
    )
    args = parser.parse_args()

    samples, labels = load_annotated_csv(Path(args.csv))

    windows, window_labels = [], []
    for start in range(0, len(samples) - args.window + 1, args.stride):
        block = samples[start : start + args.window]
        block_labels = labels[start : start + args.window]
        windows.append(
            block.reshape(-1) if args.mode == "raw" else extract_features(block, args.rate)
        )
        # A window counts as a freeze when most of it is frozen.
        window_labels.append(2 if (block_labels == 2).mean() > 0.5 else 1)

    X = np.array(windows)
    y = np.array(window_labels)
    if len(set(y.tolist())) < 2:
        raise SystemExit(
            "The recording contains only one class — generate a longer one so it "
            "includes both normal walking and freeze segments."
        )

    scaler = StandardScaler().fit(X)
    model = LogisticRegression(max_iter=2000).fit(scaler.transform(X), y)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, out_dir / "fog_model.pkl")
    joblib.dump(scaler, out_dir / "scaler.pkl")

    accuracy = model.score(scaler.transform(X), y)
    print(f"windows:        {len(X)} ({int((y == 2).sum())} freeze, {int((y == 1).sum())} normal)")
    print(f"input width:    {X.shape[1]} (mode={args.mode})")
    print(f"train accuracy: {accuracy:.3f}  <- on synthetic data; means nothing clinically")
    print(f"wrote:          {out_dir / 'fog_model.pkl'}")
    print(f"wrote:          {out_dir / 'scaler.pkl'}")
    print(f"\nSet FEATURE_MODE={args.mode} and WINDOW_SAMPLES={args.window} in .env to match.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
