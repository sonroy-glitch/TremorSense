"""Upload entry point, run on a schedule by cron (or systemd).

    python3 -m tremorsense.sync        # one attempt, then exit  <- cron uses this
    python3 -m tremorsense.sync --loop # stay resident, retry every UPLOAD_INTERVAL_S

Each run checks for internet first and does nothing if there's none, so running
it every few minutes from cron is harmless.
"""

from __future__ import annotations

import argparse
import logging
import sys
import time

from .config import load_config
from .store import Store
from .uploader import Uploader, has_internet

log = logging.getLogger("tremorsense.sync")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Upload buffered TremorSense data")
    parser.add_argument("--loop", action="store_true", help="Keep running instead of exiting")
    parser.add_argument(
        "--status",
        action="store_true",
        help="Print what is waiting to upload and exit without uploading",
    )
    args = parser.parse_args(argv)

    config = load_config()
    logging.basicConfig(
        level=config.log_level,
        format="%(asctime)s %(levelname)-7s %(name)s %(message)s",
    )

    store = Store(config.db_path)
    try:
        if args.status:
            episodes, rollups = store.pending_counts()
            online = has_internet(config)
            print(f"cane:      {config.cane_id}")
            print(f"endpoint:  {config.api_base_url}/pi_data")
            print(f"internet:  {'yes' if online else 'no'}")
            print(f"pending:   {episodes} episode(s), {rollups} rollup(s)")
            return 0

        uploader = Uploader(config, store)
        if not args.loop:
            uploader.sync()
            return 0

        while True:
            try:
                # Keep going while full batches are still coming back, so a
                # long offline backlog drains in one pass.
                while uploader.sync():
                    pass
            except Exception:  # noqa: BLE001 - a resident loop must not die
                log.exception("Sync attempt failed")
            time.sleep(config.upload_interval_s)
    finally:
        store.close()


if __name__ == "__main__":
    sys.exit(main())
