"""
Clean and load the Global Ads Performance CSV into Postgres (table: ad_performance).

Usage:
    psql -d adpulse -f sql/schema.sql      # create/reset the table once
    python scripts/load_data.py            # clean + load the CSV

Env vars (see .env.example): PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
"""
import io
import os
import sys
from pathlib import Path

import pandas as pd
import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "raw" / "global_ads_performance_dataset.csv"

TARGET_COLUMNS = [
    "event_date", "platform", "campaign_type", "industry", "country",
    "impressions", "clicks", "ctr", "cpc", "ad_spend",
    "conversions", "cpa", "revenue", "roas",
]


def load_and_clean(csv_path: Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path)

    df = df.rename(columns={
        "date": "event_date",
        "CTR": "ctr",
        "CPC": "cpc",
        "CPA": "cpa",
        "ROAS": "roas",
    })

    required = set(TARGET_COLUMNS)
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"CSV is missing expected columns: {missing}")

    # Type coercion
    df["event_date"] = pd.to_datetime(df["event_date"]).dt.date
    for col in ["platform", "campaign_type", "industry", "country"]:
        df[col] = df[col].str.strip()
    int_cols = ["impressions", "clicks", "conversions"]
    float_cols = ["ctr", "cpc", "ad_spend", "cpa", "revenue", "roas"]
    for col in int_cols:
        df[col] = df[col].astype(int)
    for col in float_cols:
        df[col] = df[col].astype(float)

    # Data quality checks
    n_before = len(df)

    null_mask = df[TARGET_COLUMNS].isnull().any(axis=1)
    if null_mask.any():
        print(f"WARNING: dropping {null_mask.sum()} row(s) with null values", file=sys.stderr)
        df = df[~null_mask]

    negative_mask = (df[int_cols + float_cols] < 0).any(axis=1)
    if negative_mask.any():
        print(f"WARNING: dropping {negative_mask.sum()} row(s) with negative metrics", file=sys.stderr)
        df = df[~negative_mask]

    # Cross-check source-provided derived metrics against a recompute from raw
    # counts, in case a future data refresh isn't as clean as this one.
    recomputed_ctr = df["clicks"] / df["impressions"]
    recomputed_cpa = df["ad_spend"] / df["conversions"]
    recomputed_roas = df["revenue"] / df["ad_spend"]
    tolerance = 0.02
    mismatch = (
        ((recomputed_ctr - df["ctr"]).abs() > tolerance * recomputed_ctr.clip(lower=1e-9))
        | ((recomputed_cpa - df["cpa"]).abs() > tolerance * recomputed_cpa.clip(lower=1e-9))
        | ((recomputed_roas - df["roas"]).abs() > tolerance * recomputed_roas.clip(lower=1e-9))
    )
    if mismatch.any():
        print(f"WARNING: {mismatch.sum()} row(s) have derived metrics inconsistent "
              f"with raw counts (>2% off) — keeping source values, flagged for review",
              file=sys.stderr)

    print(f"Cleaned {len(df)}/{n_before} rows "
          f"({n_before - len(df)} dropped)")

    return df[TARGET_COLUMNS]


def load_to_postgres(df: pd.DataFrame) -> None:
    conn = psycopg2.connect(
        host=os.environ.get("PGHOST", "localhost"),
        port=os.environ.get("PGPORT", "5432"),
        dbname=os.environ.get("PGDATABASE", "adpulse"),
        user=os.environ.get("PGUSER") or None,
        password=os.environ.get("PGPASSWORD") or None,
    )
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("TRUNCATE TABLE ad_performance RESTART IDENTITY")

                buf = io.StringIO()
                df.to_csv(buf, index=False, header=False)
                buf.seek(0)
                cur.copy_expert(
                    f"COPY ad_performance ({', '.join(TARGET_COLUMNS)}) "
                    f"FROM STDIN WITH (FORMAT csv)",
                    buf,
                )
                cur.execute("SELECT count(*), min(event_date), max(event_date) FROM ad_performance")
                count, min_date, max_date = cur.fetchone()
                print(f"Loaded {count} rows into ad_performance "
                      f"(date range {min_date} to {max_date})")
    finally:
        conn.close()


def main():
    load_dotenv()
    df = load_and_clean(CSV_PATH)
    load_to_postgres(df)


if __name__ == "__main__":
    main()
