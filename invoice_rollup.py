#!/usr/bin/env python3
import pandas as pd
from pathlib import Path

SRC = Path("invoices/csv")
OUT = Path("invoices")
OUT.mkdir(parents=True, exist_ok=True)

frames = []
for p in SRC.glob("*.csv"):
    try:
        df = pd.read_csv(p)
        if {"date","amount_usd"} <= set(df.columns):
            df["date"] = pd.to_datetime(df["date"])
            frames.append(df[["date","amount_usd"]])
    except Exception:
        pass

if frames:
    all_df = pd.concat(frames, ignore_index=True)
    last = all_df["date"].max()
    trailing = all_df[ all_df["date"] >= (last - pd.Timedelta(days=90)) ]["amount_usd"].sum()
else:
    trailing = 0.0

(Path("invoices/trailing_90_usd.txt")).write_text(str(round(float(trailing),2)))
print("trailing_90_usd.txt written:", round(float(trailing),2))
