"""Reads accelerometer samples from the sensor board on the Pi's USB port.

WIRE PROTOCOL
-------------
The board streams newline-terminated CSV over USB serial (default
/dev/ttyUSB0 @ 115200). One line per sample, nine comma-separated fields:

    time_ms,ankle_fwd,ankle_vert,ankle_lat,thigh_fwd,thigh_vert,thigh_lat,trunk_fwd,trunk_lat

* time_ms   - the board's own millisecond clock (monotonic; may start at 0)
* remaining - acceleration in milli-g (mg), integers or floats

Example:

    1234,-18,984,12,-30,1002,8,-5,41

Lines that are blank, start with '#', or fail to parse are skipped, so a
header row and startup noise are harmless. Nothing is sent back to the board.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Iterator, Protocol

from .config import Config, N_CHANNELS

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Sample:
    """One timestep: the board's clock plus the eight accelerometer channels."""

    time_ms: int
    values: tuple[float, ...]


class SampleSource(Protocol):
    def __iter__(self) -> Iterator[Sample]: ...


def parse_line(line: str) -> Sample | None:
    """Parses one CSV line, or returns None if it isn't a usable sample."""
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    parts = line.split(",")
    if len(parts) < N_CHANNELS + 1:
        return None
    try:
        time_ms = int(float(parts[0]))
        values = tuple(float(part) for part in parts[1 : N_CHANNELS + 1])
    except ValueError:
        # A header row or a truncated line mid-stream lands here.
        return None
    return Sample(time_ms=time_ms, values=values)


class SerialSampleSource:
    """Yields samples from the USB serial port, reconnecting if it drops."""

    def __init__(self, config: Config) -> None:
        self._config = config

    def __iter__(self) -> Iterator[Sample]:
        try:
            import serial  # pyserial, only needed on the real device
        except ImportError as exc:  # pragma: no cover - depends on the host
            raise SystemExit(
                "pyserial is not installed. Run: pip install -r requirements.txt"
            ) from exc

        while True:
            try:
                with serial.Serial(
                    self._config.serial_port,
                    self._config.serial_baud,
                    timeout=2,
                ) as port:
                    log.info("Reading samples from %s", self._config.serial_port)
                    while True:
                        raw = port.readline()
                        if not raw:
                            continue  # read timeout; the board may just be idle
                        sample = parse_line(raw.decode("utf-8", errors="ignore"))
                        if sample is not None:
                            yield sample
            except Exception:  # noqa: BLE001 - keep the cane running regardless
                log.exception("Serial read failed; retrying in 5s")
                import time

                time.sleep(5)


class CsvReplaySampleSource:
    """Replays a recorded CSV file — used by `python -m tremorsense.simulate`.

    Accepts the same column order as the wire protocol. If the file has a
    trailing annotation column (as the training data does) it is ignored.
    """

    def __init__(self, path: str, realtime: bool = False, sample_rate_hz: int = 64) -> None:
        self._path = path
        self._realtime = realtime
        self._interval_s = 1 / sample_rate_hz

    def __iter__(self) -> Iterator[Sample]:
        import time

        with open(self._path) as handle:
            for line in handle:
                sample = parse_line(line)
                if sample is None:
                    continue
                yield sample
                if self._realtime:
                    time.sleep(self._interval_s)
