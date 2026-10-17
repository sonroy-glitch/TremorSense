"""Checks for internet, then pushes buffered data to the backend.

Only the standard library is used for HTTP so a bare Raspberry Pi OS install
needs nothing extra beyond the model's own dependencies.
"""

from __future__ import annotations

import json
import logging
import socket
import urllib.error
import urllib.request

from .config import Config
from .store import Store

log = logging.getLogger(__name__)


def has_internet(config: Config) -> bool:
    """True when the connectivity URL answers.

    Defaults to Google's generate_204 endpoint, which returns an empty 204 and
    is the standard captive-portal probe — cheaper and more reliable than ICMP
    ping, which many networks drop and which needs extra privileges.
    """
    request = urllib.request.Request(config.connectivity_url, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=config.connectivity_timeout_s) as response:
            return 200 <= response.status < 400
    except (urllib.error.URLError, socket.timeout, OSError):
        return False


class Uploader:
    def __init__(self, config: Config, store: Store) -> None:
        self._config = config
        self._store = store
        self._url = f"{config.api_base_url}/pi_data"

    def sync(self) -> bool:
        """Uploads one batch. Returns True if anything was accepted.

        Data stays in SQLite until the server acknowledges it, so a failure
        here simply means the next attempt retries the same rows. The server
        upserts on (cane_id, started_at) and (cane_id, hour_start), so a retry
        after a response that was lost in transit cannot create duplicates.
        """
        episodes = self._store.pending_episodes(self._config.upload_batch_size)
        rollups = self._store.dirty_rollups(self._config.upload_batch_size)
        if not episodes and not rollups:
            return False

        if not has_internet(self._config):
            log.info(
                "No internet; holding %d episode(s) and %d rollup(s)",
                len(episodes),
                len(rollups),
            )
            return False

        payload = {
            "cane_id": self._config.cane_id,
            "episodes": [
                {
                    "started_at": row["started_at"],
                    "ended_at": row["ended_at"],
                    "duration_ms": row["duration_ms"],
                    "confidence": row["confidence"],
                    "window_count": row["window_count"],
                }
                for row in episodes
            ],
            "rollups": [
                {
                    "hour_start": row["hour_start"],
                    "normal_ms": row["normal_ms"],
                    "freeze_ms": row["freeze_ms"],
                    "episode_count": row["episode_count"],
                }
                for row in rollups
            ],
        }

        try:
            self._post(payload)
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", errors="ignore")
            if error.code == 404:
                # The cane isn't paired to an account yet. Keep buffering —
                # the data uploads once the patient signs up with this cane ID.
                log.error("Cane %s is not paired yet: %s", self._config.cane_id, body)
            elif error.code == 401:
                log.error("Server rejected PI_INGEST_KEY; check raspberry_pi/.env")
            else:
                log.error("Upload failed (HTTP %s): %s", error.code, body)
            return False
        except (urllib.error.URLError, socket.timeout, OSError) as error:
            log.warning("Upload failed: %s", error)
            return False

        self._store.mark_episodes_uploaded([row["id"] for row in episodes])
        self._store.mark_rollups_clean(rollups)
        pruned = self._store.prune_uploaded()
        log.info(
            "Uploaded %d episode(s), %d rollup(s)%s",
            len(episodes),
            len(rollups),
            f"; pruned {pruned} old row(s)" if pruned else "",
        )
        return True

    def _post(self, payload: dict) -> None:
        request = urllib.request.Request(
            self._url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "content-type": "application/json",
                "x-api-key": self._config.pi_ingest_key,
            },
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            response.read()
