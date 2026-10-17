"""Sanity-checks the model file against the device's configuration.

    python3 -m tremorsense.checkmodel

Loads the pickle, reports what the model expects, classifies a synthetic
window, and measures load time, memory and per-window latency — the three
numbers that decide whether this model can run on a given Pi. Run it after
dropping in a new model.
"""

from __future__ import annotations

import logging
import resource
import sys
import time

import numpy as np

from .classifier import FogClassifier, Window, expected_input_width
from .config import CLASS_FREEZE, N_CHANNELS, load_config


def main() -> int:
    config = load_config()
    logging.basicConfig(level="INFO", format="%(levelname)-7s %(message)s")

    size_mb = config.model_path.stat().st_size / 1e6 if config.model_path.is_file() else 0
    print("--- configuration ---")
    print(f"model path:    {config.model_path}")
    print(f"model size:    {size_mb:.0f} MB")
    print(f"scaler:        {'found' if config.scaler_path.is_file() else 'not present'}")
    print(f"feature mode:  {config.feature_mode}")
    print(f"time feature:  {config.time_feature}")
    print(f"window:        {config.window_samples} samples ({config.window_ms}ms) "
          f"@ {config.sample_rate_hz}Hz, stride {config.stride_ms}ms")
    print(f"input width:   {expected_input_width(config)} features per prediction")
    print(f"vote ratio:    {config.freeze_vote_ratio} of samples, "
          f"each over p={config.freeze_threshold}")

    started = time.monotonic()
    classifier = FogClassifier(config)
    load_s = time.monotonic() - started
    peak_mb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024

    model = classifier._model  # noqa: SLF001 - diagnostics are the point here
    print("\n--- model ---")
    print(f"type:          {type(model).__name__}")
    for attribute in ("n_features_in_", "n_estimators", "classes_", "n_classes_"):
        if hasattr(model, attribute):
            print(f"{attribute+':':14} {getattr(model, attribute)}")
    print(f"predict_proba: {hasattr(model, 'predict_proba')}")
    raw_names = getattr(model, "feature_names_in_", None)
    names = [] if raw_names is None else [str(name) for name in raw_names]
    if names:
        print("feature names (model's own order):")
        for index, name in enumerate(names):
            print(f"  [{index}] {name}")

    print("\n--- cost ---")
    print(f"load time:     {load_s:.1f}s")
    print(f"peak memory:   {peak_mb:.0f} MB")

    # A plausible standing-still window: ~1g on the vertical axes, noise elsewhere.
    rng = np.random.default_rng(0)
    data = rng.normal(0, 20, size=(config.window_samples, N_CHANNELS))
    data[:, 1] += 1000
    data[:, 4] += 1000
    window = Window(start_ms=0, end_ms=config.window_ms, data=data)

    try:
        prediction = classifier.classify(window)
    except (ValueError, SystemExit) as error:
        print(f"\nFAILED: {error}")
        return 1

    repeats = 3
    started = time.monotonic()
    for _ in range(repeats):
        classifier.classify(window)
    per_window_ms = (time.monotonic() - started) / repeats * 1000
    budget_ms = config.stride_ms
    print(f"per window:    {per_window_ms:.0f} ms for {config.window_samples} samples")
    print(f"realtime budget: {budget_ms} ms per window on this machine "
          f"({per_window_ms / budget_ms * 100:.0f}% used)")
    if per_window_ms > budget_ms:
        print("  WARNING: slower than realtime here, and a Pi is slower still. "
              "Raise WINDOW_SAMPLES, lower SAMPLE_RATE_HZ, or shrink the model.")

    print("\n--- result on a synthetic standing-still window ---")
    print(f"label:         {prediction.label} "
          f"({'FREEZE' if prediction.label == CLASS_FREEZE else 'normal'})")
    print(f"freeze samples: {prediction.freeze_sample_ratio * 100:.0f}% of the window")
    print(f"confidence:    {prediction.confidence:.3f}"
          if prediction.confidence is not None else "confidence:    n/a")
    print("\nOK: the model loads and classifies. Note this input is synthetic — "
          "it says nothing about accuracy, only that the plumbing matches.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
