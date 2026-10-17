"""Turns a stream of per-window predictions into freeze episodes.

Normal windows never become rows — they only add to the hourly totals. A run of
freeze windows becomes one episode, and two runs separated by a short gap are
merged so a momentary recovery mid-freeze doesn't split the event in two.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from .classifier import Prediction
from .config import Config


@dataclass(frozen=True)
class Episode:
    started_at: datetime
    ended_at: datetime
    duration_ms: int
    confidence: float | None
    window_count: int


@dataclass(frozen=True)
class RollupDelta:
    """Time to add to one hourly bucket. Accumulated in SQLite, not in memory,
    so a reboot mid-hour doesn't lose the hour's totals."""

    hour_start: datetime
    normal_ms: int = 0
    freeze_ms: int = 0
    episode_count: int = 0


@dataclass
class _OpenEpisode:
    started_at: datetime
    ended_at: datetime
    window_count: int = 0
    confidences: list[float] = field(default_factory=list)


class EpisodeAggregator:
    """Feed it predictions; it hands back completed episodes.

    The board's `time_ms` clock is monotonic but has no idea what day it is, so
    window times are anchored to the Pi's wall clock the first time a sample is
    seen. Anything the Pi reports is therefore in real UTC.
    """

    def __init__(self, config: Config) -> None:
        self._config = config
        self._clock_origin: datetime | None = None
        self._first_time_ms: int | None = None
        self._open: _OpenEpisode | None = None

    # -- time ----------------------------------------------------------------

    def _to_utc(self, time_ms: int) -> datetime:
        if self._clock_origin is None or self._first_time_ms is None:
            self._clock_origin = datetime.now(timezone.utc)
            self._first_time_ms = time_ms
        return self._clock_origin + timedelta(milliseconds=time_ms - self._first_time_ms)

    # -- ingest --------------------------------------------------------------

    def add(self, prediction: Prediction) -> tuple[list[Episode], RollupDelta]:
        """Records one classified window.

        Returns any episode this window completed, plus the hourly time to
        credit for the window itself.
        """
        start = self._to_utc(prediction.window.start_ms)
        end = self._to_utc(prediction.window.end_ms)
        window_ms = max(0, int((end - start).total_seconds() * 1000))
        delta = self._rollup_delta(start, prediction.is_freeze, window_ms)

        if prediction.is_freeze:
            if self._open is None:
                self._open = _OpenEpisode(started_at=start, ended_at=end)
            elif start - self._open.ended_at > timedelta(
                milliseconds=self._config.episode_merge_gap_ms
            ):
                # The gap is too long to be the same episode — close and reopen.
                finished = self._close()
                self._open = _OpenEpisode(started_at=start, ended_at=end)
                return finished, delta
            self._open.ended_at = max(self._open.ended_at, end)
            self._open.window_count += 1
            if prediction.confidence is not None:
                self._open.confidences.append(prediction.confidence)
            return [], delta

        # A normal window only ends the episode once the merge gap has elapsed,
        # so brief recoveries stay inside one episode.
        if self._open is not None and start - self._open.ended_at >= timedelta(
            milliseconds=self._config.episode_merge_gap_ms
        ):
            return self._close(), delta
        return [], delta

    def flush(self) -> list[Episode]:
        """Closes any episode still open (called on shutdown)."""
        return self._close()

    def _close(self) -> list[Episode]:
        open_episode, self._open = self._open, None
        if open_episode is None:
            return []
        duration_ms = int(
            (open_episode.ended_at - open_episode.started_at).total_seconds() * 1000
        )
        # Drop blips: a single noisy window is not an episode.
        if duration_ms < self._config.min_episode_ms:
            return []
        confidence = (
            sum(open_episode.confidences) / len(open_episode.confidences)
            if open_episode.confidences
            else None
        )
        return [
            Episode(
                started_at=open_episode.started_at,
                ended_at=open_episode.ended_at,
                duration_ms=duration_ms,
                confidence=confidence,
                window_count=open_episode.window_count,
            )
        ]

    # -- hourly rollups ------------------------------------------------------

    def _rollup_delta(self, moment: datetime, is_freeze: bool, window_ms: int) -> RollupDelta:
        hour = moment.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
        # Windows overlap, so crediting the full window length would double-count
        # time. Only the newly advanced slice (the stride) is counted.
        credited_ms = min(window_ms, self._config.stride_ms) or window_ms
        if is_freeze:
            return RollupDelta(hour_start=hour, freeze_ms=credited_ms)
        return RollupDelta(hour_start=hour, normal_ms=credited_ms)


def hour_of(moment: datetime) -> datetime:
    """Top of the UTC hour containing `moment` — the rollup bucket key."""
    return moment.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
