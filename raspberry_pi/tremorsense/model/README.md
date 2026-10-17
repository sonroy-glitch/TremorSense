# The model contract

The model in this folder is read by [`../classifier.py`](../classifier.py). The
default path is `model.pkl`; if the folder holds exactly one `.pkl`, that one is
used whatever it's called. A `scaler.pkl` is applied before `predict` if
present. Both are gitignored — they're device artifacts, not source.

## What is currently here

Read off the file itself (`python3 -m tremorsense.checkmodel`):

| Property | Value |
|---|---|
| Estimator | `sklearn.ensemble.RandomForestClassifier` |
| scikit-learn | **1.9.1** — the Pi must install this exact version |
| `n_features_in_` | **9** — one sample per prediction, not a window |
| `classes_` | `[0, 1]` → 0 = normal, 1 = freeze |
| Trees | 200, `max_depth=None` (unbounded) |
| `predict_proba` | yes |
| File size | 1.26 GB |
| Load time | 4 s on a desktop; expect far longer from a Pi's SD card |
| Peak memory to load | **≈2.5 GB** |
| Inference | ~100 ms per 64-sample window on a desktop |

`FEATURE_MODE=sample` and `TIME_FEATURE` in `.env` configure this. The code
cross-checks `n_features_in_` against the configured mode at startup and exits
with a clear message on a mismatch, so a wrong `FEATURE_MODE` can't silently
produce garbage.

## Input

Nine features per sample, in this exact order — the names are the model's own
`feature_names_in_`, and `pandas` (in `requirements.txt`) lets scikit-learn match
them by name rather than position:

| # | Feature | Unit |
|---|---------|------|
| 0 | `time of sample_ms` | ms — see the warning below |
| 1 | `Ankle (shank) acceleration - horizontal forward acceleration!_mg` | mg |
| 2 | `Ankle (shank) acceleration - vertical!_mg` | mg |
| 3 | `Ankle (shank) acceleration - horizontal lateral!_mg` | mg |
| 4 | `Upper leg (thigh) acceleration - horizontal forward acceleration!_mg` | mg |
| 5 | `Upper leg (thigh) acceleration - vertical!_mg` | mg |
| 6 | `Upper leg (thigh) acceleration - horizontal lateral!_mg` | mg |
| 7 | `Trunk acceleration - horizontal forward acceleration!_mg` | mg |
| 8 | `Trunk acceleration - horizontal lateral!_mg` | mg |

Note there is **no trunk vertical channel** — 8 accelerometer channels, not 9.

## Output

`predict`/`predict_proba` return the trained encoding **0 = normal,
1 = freeze**. The package normalizes this onto its own `CLASS_NORMAL = 1` /
`CLASS_FREEZE = 2` (the dataset's annotation values), so both encodings work if
you retrain.

## How per-sample output becomes an episode

A model that labels single samples flickers — at 64 Hz, isolated samples cross
the threshold constantly. Three stages turn that into something reportable:

1. **Vote** — a window (1 s = 64 samples by default) is called a freeze when at
   least `FREEZE_VOTE_RATIO` of its samples have freeze probability ≥
   `FREEZE_THRESHOLD`.
2. **Merge** — consecutive freeze windows become one episode; two freezes
   separated by less than `EPISODE_MERGE_GAP_MS` are merged, so a momentary
   recovery doesn't split one event in two.
3. **Discard** — episodes shorter than `MIN_EPISODE_MS` are dropped as noise.

All four knobs are in `.env`. The whole window is predicted in a single
`predict_proba` call, which is far cheaper than 64 separate ones.

## ⚠️ Two things to be aware of

### The timestamp is a feature

The model was trained with `time of sample_ms` as an input. That column is a
recording-session clock, so a tree can learn "freezes happen around t=180000 in
this dataset" — information that does not exist on a real cane. On the device
the clock restarts from zero on every boot, so this feature's meaning at
inference time is not the meaning it had in training.

`TIME_FEATURE` exists to manage this:

* `elapsed` (default) — ms since detection started, the closest match to the
  training distribution.
* `zero` — always 0, neutralising the feature.
* `board` — the board's raw clock.

**Compare `elapsed` against `zero` on real recordings before trusting either.**
If the two disagree a lot, the model is leaning on the clock, and the right fix
is to retrain without that column.

### Size

≈2.5 GB peak to load means a **Raspberry Pi 4 or 5 with 4 GB or more**. A Pi
Zero, a Pi 3, or a 2 GB Pi 4 will be killed by the OOM reaper. Shrinking it
costs almost nothing in accuracy and buys a lot of headroom:

```python
# any of these, then re-pickle:
RandomForestClassifier(n_estimators=50, max_depth=20, min_samples_leaf=5)
```

Going from 200 unbounded trees to 50 depth-20 trees typically cuts the file by
20-50x. Verify with `python3 -m tremorsense.checkmodel` after.

## Retraining against this contract

```python
import joblib, numpy as np
from sklearn.ensemble import RandomForestClassifier

# X: (n_samples, 9) in the column order above — or a DataFrame with those names
# y: 0 = normal, 1 = freeze   (1/2 also works)
model = RandomForestClassifier(n_estimators=50, max_depth=20, min_samples_leaf=5)
model.fit(X, y)
joblib.dump(model, "model.pkl")
```

For a **window-input** model instead, set `FEATURE_MODE=raw` (flattened
`WINDOW_SAMPLES x 8`) or `FEATURE_MODE=features` (56 statistics — import
`tremorsense.classifier.extract_features` so training and inference can't
drift). Both paths are already implemented.

## Checking a model on the device

```bash
python3 -m tremorsense.checkmodel
```

Prints everything in the table above, classifies one synthetic window, and
measures load time, peak memory and per-window latency against the realtime
budget. Run it before putting the cane on a person.
