#!/usr/bin/env python3
"""Aggregate invoice CSVs and emit a trailing-90 spend artifact.

The script is defensive by design:

* Missing columns raise actionable errors.
* CSV parsing issues are logged and surfaced instead of being silently ignored.
* The trailing spend artifact is written both to the finance folder and to the
  dashboard public assets directory so the React app can hydrate automatically.
"""

from __future__ import annotations

import json
import logging
from datetime import timedelta
from pathlib import Path
from typing import Iterable, List

import pandas as pd

LOGGER = logging.getLogger("invoice_rollup")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

REQUIRED_COLUMNS = {"date", "amount_usd"}
SRC = Path("invoices/csv")
OUT = Path("invoices")
PUBLIC_OUT = Path("apps/pro-dashboard/public")

OUT.mkdir(parents=True, exist_ok=True)
PUBLIC_OUT.mkdir(parents=True, exist_ok=True)


def load_csv(path: Path) -> pd.DataFrame:
    LOGGER.debug("Loading %s", path)
    frame = pd.read_csv(path)
    missing = REQUIRED_COLUMNS - set(frame.columns)
    if missing:
        raise ValueError(f"Missing columns {sorted(missing)} in {path}")
    frame = frame[list(REQUIRED_COLUMNS)].copy()
    frame["date"] = pd.to_datetime(frame["date"], errors="raise")
    frame["amount_usd"] = pd.to_numeric(frame["amount_usd"], errors="raise")
    return frame


def collect_frames(paths: Iterable[Path]) -> List[pd.DataFrame]:
    frames: List[pd.DataFrame] = []
    errors: List[str] = []
    for csv_path in sorted(paths):
        try:
            frames.append(load_csv(csv_path))
        except Exception as exc:  # pylint: disable=broad-except
            message = f"Failed to load {csv_path}: {exc}"
            LOGGER.error(message)
            errors.append(message)
    if errors:
        (OUT / "invoice_rollup_errors.json").write_text(json.dumps(errors, indent=2))
    return frames


def compute_trailing_90(frames: List[pd.DataFrame]) -> float:
    if not frames:
        LOGGER.warning("No invoice CSVs found in %s", SRC)
        return 0.0
    data = pd.concat(frames, ignore_index=True)
    if data.empty:
        LOGGER.warning("Invoice data is empty after concatenation")
        return 0.0
    last_date = data["date"].max()
    window_start = last_date - timedelta(days=90)
    trailing = data.loc[data["date"] >= window_start, "amount_usd"].sum()
    LOGGER.info("Trailing 90-day spend computed through %s", last_date.date())
    return float(round(trailing, 2))


def write_artifacts(amount: float) -> None:
    payload = f"{amount:.2f}"
    targets = [
        OUT / "trailing_90_usd.txt",
        PUBLIC_OUT / "trailing_90_usd.txt",
    ]
    for target in targets:
        target.write_text(payload)
        LOGGER.info("Wrote trailing spend artifact to %s", target)


def main() -> None:
    frames = collect_frames(SRC.glob("*.csv"))
    trailing = compute_trailing_90(frames)
    write_artifacts(trailing)


if __name__ == "__main__":
    main()
