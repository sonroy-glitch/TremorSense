"""Configuration for the TremorSense cane, loaded from raspberry_pi/.env."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = PACKAGE_DIR.parent

# The eight accelerometer channels the model consumes, in the exact order the
# sensor board must stream them. Taken from the training data's column order.
CHANNELS: tuple[str, ...] = (
    "ankle_forward_mg",
    "ankle_vertical_mg",
    "ankle_lateral_mg",
    "thigh_forward_mg",
    "thigh_vertical_mg",
    "thigh_lateral_mg",
    "trunk_forward_mg",
    "trunk_lateral_mg",
)
N_CHANNELS = len(CHANNELS)

# The model's own feature names, read from its `feature_names_in_`. It was
# trained on a pandas DataFrame, so passing these names avoids sklearn's
# "X does not have valid feature names" warning and guarantees column order.
# Feature 0 is the timestamp — see Config.time_feature.
MODEL_FEATURE_NAMES: tuple[str, ...] = (
    "time of sample_ms",
    "Ankle (shank) acceleration - horizontal forward acceleration!_mg",
    "Ankle (shank) acceleration - vertical!_mg",
    "Ankle (shank) acceleration - horizontal lateral!_mg",
    "Upper leg (thigh) acceleration - horizontal forward acceleration!_mg",
    "Upper leg (thigh) acceleration - vertical!_mg",
    "Upper leg (thigh) acceleration - horizontal lateral!_mg",
    "Trunk acceleration - horizontal forward acceleration!_mg",
    "Trunk acceleration - horizontal lateral!_mg",
)

# Internal class labels used across this package, matching the dataset's
# annotation values. The model itself was fitted with classes_ = [0, 1]; the
# loader normalizes that onto these.
CLASS_NORMAL = 1
CLASS_FREEZE = 2


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader so the Pi needs no third-party config library."""
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _env(name: str, default: str) -> str:
    return os.environ.get(name) or default


def _env_required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise SystemExit(
            f"Missing required setting {name}. Copy raspberry_pi/.env.example to "
            f"raspberry_pi/.env and fill it in."
        )
    return value


@dataclass(frozen=True)
class Config:
    # --- identity -----------------------------------------------------------
    cane_id: str
    api_base_url: str
    pi_ingest_key: str

    # --- sensor input -------------------------------------------------------
    serial_port: str
    serial_baud: int
    sample_rate_hz: int

    # --- inference ----------------------------------------------------------
    model_path: Path
    scaler_path: Path
    # How a window is turned into model input. Must match how the model was
    # trained — see tremorsense/model/README.md.
    #   "sample"   one row per sample: [time_ms, 8 channels] -> 9 features.
    #              The shipped RandomForest uses this.
    #   "raw"      the flattened window (window_samples x 8 values).
    #   "features" the 56 summary statistics in extract_features().
    feature_mode: str
    # What to put in the model's `time of sample_ms` feature. The shipped model
    # was trained with the timestamp as a real feature, which is why this knob
    # exists at all:
    #   "elapsed" milliseconds since this process started classifying, which is
    #             the closest match to training (each recording began near 0).
    #   "board"   the sensor board's own clock, verbatim.
    #   "zero"    always 0, to neutralise the feature entirely.
    time_feature: str
    window_samples: int
    window_stride_samples: int
    # In "sample" mode the model labels each row independently, which is noisy.
    # A window is called a freeze when at least this fraction of its samples
    # are, which is the smoothing that turns per-sample labels into a state.
    freeze_vote_ratio: float
    # A single window above this probability is not enough on its own; an
    # episode must also last at least min_episode_ms.
    freeze_threshold: float
    min_episode_ms: int
    # Two freezes separated by less than this are treated as one episode, so a
    # momentary recovery mid-freeze doesn't split the event in two.
    episode_merge_gap_ms: int

    # --- storage and upload -------------------------------------------------
    db_path: Path
    upload_interval_s: int
    upload_batch_size: int
    connectivity_url: str
    connectivity_timeout_s: float
    log_level: str

    @property
    def window_ms(self) -> int:
        return round(self.window_samples / self.sample_rate_hz * 1000)

    @property
    def stride_ms(self) -> int:
        return round(self.window_stride_samples / self.sample_rate_hz * 1000)


def load_config() -> Config:
    _load_dotenv(PROJECT_DIR / ".env")

    sample_rate = int(_env("SAMPLE_RATE_HZ", "64"))
    feature_mode = _env("FEATURE_MODE", "sample").lower()

    if feature_mode == "sample":
        # The model classifies single rows, so a window is only a smoothing and
        # batching unit: one second of samples, no overlap. Non-overlapping
        # keeps the hourly time totals exact.
        window_samples = int(_env("WINDOW_SAMPLES", str(sample_rate)))
        stride = int(_env("WINDOW_STRIDE_SAMPLES", str(window_samples)))
    else:
        # Window-input models: 2-second windows advanced every second.
        window_samples = int(_env("WINDOW_SAMPLES", str(sample_rate * 2)))
        stride = int(_env("WINDOW_STRIDE_SAMPLES", str(window_samples // 2)))

    return Config(
        cane_id=_env_required("CANE_ID").upper(),
        api_base_url=_env_required("API_BASE_URL").rstrip("/"),
        pi_ingest_key=_env_required("PI_INGEST_KEY"),
        serial_port=_env("SERIAL_PORT", "/dev/ttyUSB0"),
        serial_baud=int(_env("SERIAL_BAUD", "115200")),
        sample_rate_hz=sample_rate,
        model_path=Path(_env("MODEL_PATH", str(PACKAGE_DIR / "model" / "model.pkl"))),
        scaler_path=Path(_env("SCALER_PATH", str(PACKAGE_DIR / "model" / "scaler.pkl"))),
        feature_mode=feature_mode,
        time_feature=_env("TIME_FEATURE", "elapsed").lower(),
        window_samples=window_samples,
        window_stride_samples=stride,
        freeze_vote_ratio=float(_env("FREEZE_VOTE_RATIO", "0.5")),
        freeze_threshold=float(_env("FREEZE_THRESHOLD", "0.5")),
        min_episode_ms=int(_env("MIN_EPISODE_MS", "1000")),
        episode_merge_gap_ms=int(_env("EPISODE_MERGE_GAP_MS", "2000")),
        db_path=Path(_env("DB_PATH", str(PROJECT_DIR / "data" / "tremorsense.sqlite3"))),
        upload_interval_s=int(_env("UPLOAD_INTERVAL_S", "300")),
        upload_batch_size=int(_env("UPLOAD_BATCH_SIZE", "200")),
        connectivity_url=_env("CONNECTIVITY_URL", "https://www.google.com/generate_204"),
        connectivity_timeout_s=float(_env("CONNECTIVITY_TIMEOUT_S", "5")),
        log_level=_env("LOG_LEVEL", "INFO").upper(),
    )
