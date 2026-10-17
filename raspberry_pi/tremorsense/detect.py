"""Inference daemon: read sensors -> classify -> store episodes.

    python3 -m tremorsense.detect                 # read the USB serial port
    python3 -m tremorsense.detect --csv file.csv  # replay a recording instead

This process never uploads; tremorsense.sync does that on a schedule. Keeping
them apart means a network problem can't stall detection.
"""

from __future__ import annotations

import argparse
import logging
import signal
import sys
from types import FrameType

from .classifier import FogClassifier, expected_input_width, windows
from .config import CLASS_FREEZE, load_config
from .episodes import EpisodeAggregator, RollupDelta, hour_of
from .sensors import CsvReplaySampleSource, SerialSampleSource
from .store import Store

log = logging.getLogger("tremorsense.detect")
_stopping = False


def _handle_signal(signum: int, _frame: FrameType | None) -> None:
    global _stopping
    log.info("Received signal %s; finishing the current episode", signum)
    _stopping = True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="TremorSense FOG detection daemon")
    parser.add_argument(
        "--csv",
        help="Replay a CSV recording instead of reading the serial port",
    )
    parser.add_argument(
        "--realtime",
        action="store_true",
        help="With --csv, replay at the configured sample rate instead of as fast as possible",
    )
    args = parser.parse_args(argv)

    config = load_config()
    logging.basicConfig(
        level=config.log_level,
        format="%(asctime)s %(levelname)-7s %(name)s %(message)s",
    )

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    classifier = FogClassifier(config)
    aggregator = EpisodeAggregator(config)
    store = Store(config.db_path)

    log.info(
        "cane=%s window=%d samples (%dms) stride=%dms mode=%s features/window=%d",
        config.cane_id,
        config.window_samples,
        config.window_ms,
        config.stride_ms,
        config.feature_mode,
        expected_input_width(config),
    )

    source = (
        CsvReplaySampleSource(args.csv, args.realtime, config.sample_rate_hz)
        if args.csv
        else SerialSampleSource(config)
    )

    classified = 0
    freezes = 0
    try:
        for window in windows(source, config):
            if _stopping:
                break
            prediction = classifier.classify(window)
            classified += 1
            if prediction.label == CLASS_FREEZE:
                freezes += 1

            episodes, delta = aggregator.add(prediction)
            store.apply_rollup(delta)
            for episode in episodes:
                store.add_episode(episode)
                # The episode is counted in the hour it began, which is not
                # always the hour of the window that closed it.
                store.apply_rollup(RollupDelta(hour_start=hour_of(episode.started_at), episode_count=1))
                log.info(
                    "Freeze episode: %s for %.1fs (confidence %s)",
                    episode.started_at.isoformat(timespec="seconds"),
                    episode.duration_ms / 1000,
                    f"{episode.confidence:.2f}" if episode.confidence is not None else "n/a",
                )

        for episode in aggregator.flush():
            store.add_episode(episode)
            store.apply_rollup(RollupDelta(hour_start=hour_of(episode.started_at), episode_count=1))
    finally:
        pending_episodes, pending_rollups = store.pending_counts()
        store.close()
        log.info(
            "Classified %d window(s), %d freeze; %d episode(s) and %d rollup(s) awaiting upload",
            classified,
            freezes,
            pending_episodes,
            pending_rollups,
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
