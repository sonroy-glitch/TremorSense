"""Local SQLite buffer.

Everything the cane detects is written here first and only deleted once the
server has acknowledged it, so an offline cane (or one that loses power) never
drops data.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from .episodes import Episode, RollupDelta

SCHEMA = """
CREATE TABLE IF NOT EXISTS episode (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at    TEXT NOT NULL UNIQUE,
    ended_at      TEXT NOT NULL,
    duration_ms   INTEGER NOT NULL,
    confidence    REAL,
    window_count  INTEGER,
    uploaded_at   TEXT
);

CREATE INDEX IF NOT EXISTS episode_pending ON episode(uploaded_at, started_at);

-- One row per hour, accumulated in place. `dirty` marks an hour whose totals
-- have changed since the last successful upload.
CREATE TABLE IF NOT EXISTS rollup (
    hour_start    TEXT PRIMARY KEY,
    normal_ms     INTEGER NOT NULL DEFAULT 0,
    freeze_ms     INTEGER NOT NULL DEFAULT 0,
    episode_count INTEGER NOT NULL DEFAULT 0,
    dirty         INTEGER NOT NULL DEFAULT 1
);
"""


def _iso(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).isoformat(timespec="milliseconds")


class Store:
    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(path, isolation_level=None, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        # WAL keeps the writer (inference loop) and reader (uploader) from
        # blocking each other.
        self._db.execute("PRAGMA journal_mode=WAL")
        self._db.executescript(SCHEMA)

    def close(self) -> None:
        self._db.close()

    # -- writes --------------------------------------------------------------

    def add_episode(self, episode: Episode) -> None:
        self._db.execute(
            """
            INSERT INTO episode (started_at, ended_at, duration_ms, confidence, window_count)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(started_at) DO UPDATE SET
                ended_at = excluded.ended_at,
                duration_ms = excluded.duration_ms,
                confidence = excluded.confidence,
                window_count = excluded.window_count,
                uploaded_at = NULL
            """,
            (
                _iso(episode.started_at),
                _iso(episode.ended_at),
                episode.duration_ms,
                episode.confidence,
                episode.window_count,
            ),
        )

    def apply_rollup(self, delta: RollupDelta) -> None:
        """Adds a delta to its hourly bucket and marks the hour for re-upload."""
        if not (delta.normal_ms or delta.freeze_ms or delta.episode_count):
            return
        self._db.execute(
            """
            INSERT INTO rollup (hour_start, normal_ms, freeze_ms, episode_count, dirty)
            VALUES (?, ?, ?, ?, 1)
            ON CONFLICT(hour_start) DO UPDATE SET
                normal_ms = normal_ms + excluded.normal_ms,
                freeze_ms = freeze_ms + excluded.freeze_ms,
                episode_count = episode_count + excluded.episode_count,
                dirty = 1
            """,
            (
                _iso(delta.hour_start),
                delta.normal_ms,
                delta.freeze_ms,
                delta.episode_count,
            ),
        )

    # -- reads ---------------------------------------------------------------

    def pending_episodes(self, limit: int) -> list[sqlite3.Row]:
        return list(
            self._db.execute(
                """
                SELECT * FROM episode
                WHERE uploaded_at IS NULL
                ORDER BY started_at
                LIMIT ?
                """,
                (limit,),
            )
        )

    def dirty_rollups(self, limit: int) -> list[sqlite3.Row]:
        return list(
            self._db.execute(
                "SELECT * FROM rollup WHERE dirty = 1 ORDER BY hour_start LIMIT ?",
                (limit,),
            )
        )

    def pending_counts(self) -> tuple[int, int]:
        episodes = self._db.execute(
            "SELECT COUNT(*) FROM episode WHERE uploaded_at IS NULL"
        ).fetchone()[0]
        rollups = self._db.execute("SELECT COUNT(*) FROM rollup WHERE dirty = 1").fetchone()[0]
        return episodes, rollups

    # -- acknowledgement -----------------------------------------------------

    def mark_episodes_uploaded(self, ids: list[int]) -> None:
        if not ids:
            return
        now = _iso(datetime.now(timezone.utc))
        self._db.executemany(
            "UPDATE episode SET uploaded_at = ? WHERE id = ?",
            [(now, episode_id) for episode_id in ids],
        )

    def mark_rollups_clean(self, uploaded: list[sqlite3.Row]) -> None:
        """Clears `dirty` only for hours whose totals still match what was sent.

        The inference loop keeps classifying during an upload, so an hour can
        grow between being read and being acknowledged. Matching on the totals
        leaves such an hour dirty, and the next upload carries the new value.
        """
        if not uploaded:
            return
        self._db.executemany(
            """
            UPDATE rollup SET dirty = 0
            WHERE hour_start = ? AND normal_ms = ? AND freeze_ms = ? AND episode_count = ?
            """,
            [
                (row["hour_start"], row["normal_ms"], row["freeze_ms"], row["episode_count"])
                for row in uploaded
            ],
        )

    def prune_uploaded(self, keep_days: int = 7) -> int:
        """Deletes acknowledged episodes older than `keep_days` to bound the file."""
        cursor = self._db.execute(
            """
            DELETE FROM episode
            WHERE uploaded_at IS NOT NULL
              AND started_at < datetime('now', ?)
            """,
            (f"-{keep_days} days",),
        )
        return cursor.rowcount or 0
