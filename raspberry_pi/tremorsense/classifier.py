"""Inference over the accelerometer stream.

The shipped model (a RandomForestClassifier) labels **one sample at a time**
from 9 features: `time of sample_ms` plus the 8 accelerometer channels. Its
`classes_` are [0, 1] — 0 normal, 1 freeze — which this module normalizes onto
CLASS_NORMAL (1) / CLASS_FREEZE (2).

Samples are still grouped into windows, for two reasons: a whole window is
predicted in one call (much cheaper than one call per row), and per-sample
labels are too noisy to use directly, so the window's samples vote on a single
label. Window-input models are still supported via FEATURE_MODE — see
tremorsense/model/README.md, which is the authority on the contract.
"""

from __future__ import annotations

import logging
import pickle
import time
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Iterator

import numpy as np

from .config import (
    CLASS_FREEZE,
    CLASS_NORMAL,
    MODEL_FEATURE_NAMES,
    Config,
    N_CHANNELS,
)
from .sensors import Sample

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Window:
    """A fixed-length block of consecutive samples."""

    start_ms: int
    end_ms: int
    data: np.ndarray  # shape (window_samples, N_CHANNELS), milli-g
    # The board clock for each row, needed because the model takes the
    # timestamp as a feature. Defaults to an even spread across the window.
    sample_times_ms: np.ndarray = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.sample_times_ms is None:
            object.__setattr__(
                self,
                "sample_times_ms",
                np.linspace(self.start_ms, self.end_ms, len(self.data)),
            )


@dataclass(frozen=True)
class Prediction:
    window: Window
    label: int  # CLASS_NORMAL or CLASS_FREEZE
    confidence: float | None  # None when the model exposes no probabilities
    # Fraction of the window's samples the model called a freeze. 0 or 1 for
    # window-input models; anything in between for per-sample ones.
    freeze_sample_ratio: float = 0.0

    @property
    def is_freeze(self) -> bool:
        return self.label == CLASS_FREEZE


def windows(samples: Iterable[Sample], config: Config) -> Iterator[Window]:
    """Groups a sample stream into overlapping fixed-length windows."""
    size = config.window_samples
    stride = config.window_stride_samples
    buffer: deque[Sample] = deque(maxlen=size)
    # Pre-charged so the very first full buffer is emitted immediately; after
    # that a window is emitted once every `stride` new samples.
    since_emit = stride

    for sample in samples:
        buffer.append(sample)
        since_emit += 1
        if len(buffer) < size or since_emit < stride:
            continue
        since_emit = 0
        yield Window(
            start_ms=buffer[0].time_ms,
            end_ms=buffer[-1].time_ms,
            data=np.array([s.values for s in buffer], dtype=np.float64),
            sample_times_ms=np.array([s.time_ms for s in buffer], dtype=np.float64),
        )


def extract_features(window: np.ndarray, sample_rate_hz: int) -> np.ndarray:
    """Summary statistics per channel, for models trained on features.

    Per channel: mean, std, min, max, range, RMS, and the freeze index — the
    ratio of 3-8 Hz spectral power ("freeze band") to 0.5-3 Hz power ("locomotor
    band"), which is the classic Moore/Bachlin indicator for FOG.

    Order is channel-major: all 7 features of channel 0, then channel 1, ...
    """
    features: list[float] = []
    spectrum = np.abs(np.fft.rfft(window - window.mean(axis=0), axis=0)) ** 2
    freqs = np.fft.rfftfreq(window.shape[0], d=1 / sample_rate_hz)
    locomotor = (freqs >= 0.5) & (freqs < 3)
    freeze = (freqs >= 3) & (freqs <= 8)

    for channel in range(window.shape[1]):
        column = window[:, channel]
        locomotor_power = float(spectrum[locomotor, channel].sum())
        freeze_power = float(spectrum[freeze, channel].sum())
        features.extend(
            [
                float(column.mean()),
                float(column.std()),
                float(column.min()),
                float(column.max()),
                float(column.max() - column.min()),
                float(np.sqrt((column**2).mean())),
                freeze_power / locomotor_power if locomotor_power > 0 else 0.0,
            ]
        )
    return np.array(features, dtype=np.float64)


VALID_FEATURE_MODES = frozenset({"sample", "raw", "features"})
VALID_TIME_FEATURES = frozenset({"elapsed", "board", "zero"})


class FogClassifier:
    """Loads the pickled model and labels windows of samples."""

    def __init__(self, config: Config) -> None:
        if config.feature_mode not in VALID_FEATURE_MODES:
            raise SystemExit(
                f"FEATURE_MODE must be one of {sorted(VALID_FEATURE_MODES)}, "
                f"got {config.feature_mode!r}"
            )
        if config.time_feature not in VALID_TIME_FEATURES:
            raise SystemExit(
                f"TIME_FEATURE must be one of {sorted(VALID_TIME_FEATURES)}, "
                f"got {config.time_feature!r}"
            )

        self._config = config
        self._model = _load_pickle(config.model_path, "model")
        self._scaler = (
            _load_pickle(config.scaler_path, "scaler") if config.scaler_path.is_file() else None
        )
        self._origin_ms: int | None = None
        # Column names let sklearn match features by name instead of position,
        # and silence its "X does not have valid feature names" warning. Only
        # usable if pandas is installed; otherwise order alone has to do.
        self._frame = _dataframe_builder(self._model, config)

        if self._scaler is None:
            log.debug("No scaler at %s — feeding the model unscaled input", config.scaler_path)

        expected = getattr(self._model, "n_features_in_", None)
        actual = expected_input_width(config)
        if expected is not None and int(expected) != actual:
            raise SystemExit(
                f"Model expects {int(expected)} features per prediction but "
                f"FEATURE_MODE={config.feature_mode!r} produces {actual}. "
                f"Set FEATURE_MODE to the mode the model was trained with "
                f"(see tremorsense/model/README.md)."
            )

    def _time_column(self, window: Window) -> np.ndarray:
        """The model's `time of sample_ms` feature, per TIME_FEATURE."""
        board_ms = window.sample_times_ms
        if self._config.time_feature == "zero":
            return np.zeros_like(board_ms, dtype=np.float64)
        if self._config.time_feature == "board":
            return board_ms.astype(np.float64)
        # "elapsed": restart the clock at 0 for this process, which is the
        # distribution the model saw during training.
        if self._origin_ms is None:
            self._origin_ms = int(board_ms[0])
        return (board_ms - self._origin_ms).astype(np.float64)

    def _matrix(self, window: Window) -> Any:
        """Builds the model input for one window.

        In "sample" mode this is (n_samples, 9) — every row in the window is
        classified in a single call, which is far cheaper than one call per row.
        """
        if self._config.feature_mode == "sample":
            matrix = np.column_stack([self._time_column(window), window.data])
        elif self._config.feature_mode == "features":
            matrix = extract_features(window.data, self._config.sample_rate_hz).reshape(1, -1)
        else:
            matrix = window.data.reshape(1, -1)

        if self._scaler is not None:
            matrix = self._scaler.transform(matrix)
        return self._frame(matrix) if self._frame is not None else matrix

    def classify(self, window: Window) -> Prediction:
        matrix = self._matrix(window)

        if hasattr(self._model, "predict_proba"):
            probabilities = np.asarray(self._model.predict_proba(matrix))
            classes = [int(c) for c in getattr(self._model, "classes_", [])]
            freeze_column = _freeze_column(classes, probabilities.shape[1])
            freeze_probabilities = probabilities[:, freeze_column]
            return self._smooth(window, freeze_probabilities)

        labels = np.asarray(self._model.predict(matrix)).reshape(-1)
        freezes = np.array([_normalize_label(int(label)) == CLASS_FREEZE for label in labels])
        # No probabilities available, so a vote is all the confidence there is.
        return self._smooth(window, freezes.astype(np.float64))

    def _smooth(self, window: Window, freeze_probabilities: np.ndarray) -> Prediction:
        """Reduces per-sample results to one label for the window.

        Per-sample predictions flicker — a single sample crossing the threshold
        is not a freeze. The window is a freeze when at least
        FREEZE_VOTE_RATIO of its samples are, which is what makes episode
        boundaries stable enough to be worth reporting.
        """
        votes = freeze_probabilities >= self._config.freeze_threshold
        ratio = float(votes.mean()) if votes.size else 0.0
        is_freeze = ratio >= self._config.freeze_vote_ratio
        label = CLASS_FREEZE if is_freeze else CLASS_NORMAL

        # Confidence in the call actually made: how strongly the voting samples
        # supported it.
        if is_freeze:
            confidence = float(freeze_probabilities[votes].mean()) if votes.any() else ratio
        else:
            confidence = float(1 - freeze_probabilities[~votes].mean()) if (~votes).any() else 0.0

        return Prediction(
            window=window,
            label=label,
            confidence=confidence,
            freeze_sample_ratio=ratio,
        )


def _freeze_column(classes: list[int], n_columns: int) -> int:
    """Which predict_proba column is the freeze class.

    Tolerates both encodings seen in practice: the dataset's {1: normal,
    2: freeze} annotations and a zero-based {0: normal, 1: freeze} relabelling
    (which is what the shipped RandomForest was fitted with).
    """
    for index, class_label in enumerate(classes):
        if _normalize_label(class_label) == CLASS_FREEZE:
            return index
    # No classes_ attribute: assume the last column is the positive class.
    return n_columns - 1


def _dataframe_builder(model: Any, config: Config) -> Any:
    """Returns a callable wrapping a matrix in a named DataFrame, or None."""
    # feature_names_in_ is a numpy array, so it must be tested for None rather
    # than for truthiness.
    raw_names = getattr(model, "feature_names_in_", None)
    names = [] if raw_names is None else [str(name) for name in raw_names]
    if not names:
        return None
    try:
        import pandas as pd
    except ImportError:
        log.warning(
            "The model carries feature names but pandas is not installed, so "
            "features are matched by position only. Install pandas to remove "
            "any doubt: pip install pandas"
        )
        return None
    if config.feature_mode == "sample" and tuple(names) != MODEL_FEATURE_NAMES:
        log.warning(
            "The model's feature names differ from the ones this package "
            "documents; using the model's own order: %s",
            names,
        )
    return lambda matrix: pd.DataFrame(matrix, columns=names)


def _normalize_label(raw: int) -> int:
    """Maps the model's output onto CLASS_NORMAL / CLASS_FREEZE.

    Accepts the training annotations {1: normal, 2: freeze} and also a model
    that was trained with a zero-based {0: normal, 1: freeze} encoding.
    """
    if raw in (CLASS_NORMAL, CLASS_FREEZE):
        return raw
    if raw == 0:
        return CLASS_NORMAL
    if raw == 1:
        return CLASS_FREEZE
    raise ValueError(f"Model returned an unexpected class {raw!r}; expected 1 or 2")


def _load_pickle(path: Path, what: str) -> Any:
    if not path.is_file():
        # Be forgiving about the filename: if the folder holds exactly one
        # .pkl, that's unambiguously the one meant.
        candidates = sorted(path.parent.glob("*.pkl")) if path.parent.is_dir() else []
        if what == "model" and len(candidates) == 1:
            log.info("No %s, using the only .pkl in that folder: %s", path.name, candidates[0])
            path = candidates[0]
        else:
            raise SystemExit(
                f"No {what} found at {path}. Drop your trained {what} .pkl there "
                f"(see tremorsense/model/README.md) or set "
                f"{'MODEL_PATH' if what == 'model' else 'SCALER_PATH'} in .env."
            )

    size_mb = path.stat().st_size / 1e6
    if size_mb > 200:
        # Unpickling a forest needs roughly the file size in RAM, so a large
        # model is the difference between running on a Pi and not.
        log.info("Loading %s (%.0f MB) — this can take a while on a Pi", path.name, size_mb)

    started = time.monotonic()
    try:
        import joblib

        loaded = joblib.load(path)
    except ImportError:
        with path.open("rb") as handle:
            loaded = pickle.load(handle)
    log.info("Loaded %s in %.1fs", path.name, time.monotonic() - started)
    return loaded


def expected_input_width(config: Config) -> int:
    """How many features the model is given per prediction."""
    if config.feature_mode == "sample":
        return N_CHANNELS + 1  # the 8 channels plus `time of sample_ms`
    if config.feature_mode == "features":
        return N_CHANNELS * 7
    return config.window_samples * N_CHANNELS
