# TremorSense cane — Raspberry Pi

Runs on the cane's Pi. Reads the accelerometers over USB, classifies gait with
the trained model in `tremorsense/model/`, records every freeze episode
locally, and uploads them to the backend whenever internet is available.

The current model is a `RandomForestClassifier` that labels **one sample at a
time** from 9 features (`time of sample_ms` + the 8 accelerometer channels).
Per-sample labels are noisy, so each 1-second window of samples votes on a
single label before episodes are formed. Full details, including two
significant caveats, are in
[`tremorsense/model/README.md`](tremorsense/model/README.md) — read it.

**Normal gait never produces a row.** Only freeze episodes are uploaded
individually; normal time is summarised as hourly totals, so the dashboard can
say "2.3% of time walking" without storing ~43,000 timestamps a day.

## Layout

```
raspberry_pi/
├── tremorsense/
│   ├── config.py       settings from .env
│   ├── sensors.py      USB serial reader + the wire protocol (documented here)
│   ├── classifier.py   sliding windows, model loading, feature extraction
│   ├── episodes.py     merges freeze windows into episodes
│   ├── store.py        SQLite buffer (survives offline + reboot)
│   ├── uploader.py     connectivity check + POST /pi_data
│   ├── detect.py       `python3 -m tremorsense.detect`      <- daemon
│   ├── sync.py         `python3 -m tremorsense.sync`        <- cron
│   ├── checkmodel.py   `python3 -m tremorsense.checkmodel`  <- sanity check
│   └── model/README.md THE MODEL CONTRACT — read this before training
├── tools/
│   ├── simulate_sensor.py  synthesise a sensor recording (no hardware needed)
│   └── make_demo_model.py  throwaway model so you can test the pipeline today
└── deploy/             systemd units + crontab example
```

## Hardware requirements

The shipped model is 1.26 GB and needs **≈2.5 GB of RAM to load**, so it
requires a **Raspberry Pi 4 or 5 with 4 GB or more**. A Pi Zero, a Pi 3, or a
2 GB Pi 4 will be killed by the OOM reaper. `checkmodel` prints the real
numbers for your model and warns if inference is slower than realtime.

scikit-learn must be **1.9.1** — the version the model was pickled with.
`requirements.txt` pins it.

## Install on the Pi

```bash
git clone <your repo> ~/TremorSenseProject
cd ~/TremorSenseProject/raspberry_pi
python3 -m venv venv
venv/bin/pip install -r requirements.txt

cp .env.example .env
nano .env          # CANE_ID, API_BASE_URL, PI_INGEST_KEY at minimum
```

Then drop your trained model at `tremorsense/model/model.pkl` (plus
`scaler.pkl` if you use one) and verify it loads, fits in RAM, and keeps up
with realtime:

```bash
venv/bin/python -m tremorsense.checkmodel
```

Install the services:

```bash
sudo cp deploy/tremorsense-detect.service /etc/systemd/system/
sudo cp deploy/tremorsense-sync.service /etc/systemd/system/
sudo cp deploy/tremorsense-sync.timer   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tremorsense-detect tremorsense-sync.timer
```

Watch it work:

```bash
journalctl -u tremorsense-detect -f
venv/bin/python -m tremorsense.sync --status
```

`deploy/crontab.example` does the same thing with cron if you prefer.

## Sensor wire protocol

The board streams newline-terminated CSV on `/dev/ttyUSB0` at 115200 baud —
one line per sample, nine fields, accelerations in **milli-g**:

```
time_ms,ankle_fwd,ankle_vert,ankle_lat,thigh_fwd,thigh_vert,thigh_lat,trunk_fwd,trunk_lat
1234,-18,984,12,-30,1002,8,-5,41
```

Channel order is fixed and must match the model's training data — see
[`tremorsense/model/README.md`](tremorsense/model/README.md). Blank lines,
`#` comments and unparseable lines are skipped, so a header row is fine.
Default sample rate is 64 Hz.

## Testing without hardware

```bash
# Synthesise a recording and run the real model over it
venv/bin/python tools/simulate_sensor.py --seconds 300 --seed 7 --out /tmp/walk.csv
venv/bin/python -m tremorsense.detect --csv /tmp/walk.csv

# Upload whatever it found
venv/bin/python -m tremorsense.sync
venv/bin/python -m tremorsense.sync --status
```

The synthesised signal is sine waves, not real accelerometer data, so the model
will usually call all of it normal. That exercises the plumbing, not accuracy —
to see the freeze path, replay a real recording that contains an episode.

`tools/make_demo_model.py` trains a throwaway **window-input** model
(`FEATURE_MODE=raw`) for testing when no real model is present. It is not
needed now that `model.pkl` is in place.

## How offline buffering works

1. `detect` writes every episode to `data/tremorsense.sqlite3` immediately.
2. `sync` checks `CONNECTIVITY_URL` (Google's `generate_204` by default — the
   standard captive-portal probe, more reliable than ICMP ping and needs no
   elevated privileges).
3. With no internet it logs and exits; the rows stay pending.
4. On success the server's acknowledgement marks rows uploaded. Acknowledged
   episodes are pruned after 7 days.
5. Retries are safe: the server upserts on `(cane_id, started_at)` for episodes
   and `(cane_id, hour_start)` for rollups, so a response lost in transit can
   never produce duplicates.

A cane that is offline for a week keeps every episode and drains the backlog in
one pass when it reconnects (`sync --loop` or repeated cron runs).

## Tuning

| Setting | Effect |
|---|---|
| `FREEZE_THRESHOLD` | Higher = fewer, more confident freeze detections. Needs a model with `predict_proba`. |
| `MIN_EPISODE_MS` | Episodes shorter than this are discarded as noise. Default 1000 ms. |
| `EPISODE_MERGE_GAP_MS` | Freezes closer together than this become one episode. Default 2000 ms. |
| `FREEZE_VOTE_RATIO` | Fraction of a window's samples that must be frozen for the window to count. Higher = stricter. |
| `WINDOW_SAMPLES` / `WINDOW_STRIDE_SAMPLES` | How many samples vote together (1 s by default). Larger = smoother but coarser episode edges. |
| `TIME_FEATURE` | What goes in the model's timestamp feature: `elapsed`, `board`, or `zero`. See the model README. |

## Caveats

* `time_ms` from the board is monotonic but has no date, so episode timestamps
  are anchored to the Pi's wall clock. **Keep the Pi's clock correct** (NTP, or
  a battery-backed RTC if it's often offline) or episodes land at the wrong time.
* The cane must be paired first: a `404` from `/pi_data` means no account has
  signed up with this `CANE_ID` yet. Data keeps buffering until someone does.
