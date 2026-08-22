"""
Phase 3 (dashboard) sample-data generator.

The real API (Lambda + API Gateway) is torn down to avoid RDS cost while the
dashboard is being built, so the dashboard is built against static sample
data instead. This script re-derives that sample data straight from the
source CSV using the exact same aggregation logic as the live SQL
(sql/01..05, see lambda/query/handler.py for the route -> query mapping), so
the numbers the dashboard shows are the real numbers the live API would
return, not placeholders.

Output:
  web/src/data/raw-ad-performance.json
      Row-level (date, platform, campaign_type, industry, country, ad_spend,
      conversions, revenue) records for the whole dataset. This is what the
      frontend's sample-mode query engine (web/src/lib/queryEngine.ts) runs
      its aggregations against, so the date-range picker and channel filter
      work against arbitrary ranges/channels in sample mode exactly like the
      real API would, instead of only supporting a few canned queries.

  web/src/data/sample/*.json
      One file per live route, holding that route's *default* response
      (full dataset, all channels) in the exact envelope shape the Lambda
      returns: {route, params, count, results}. These are golden fixtures:
      the frontend's query engine output for default params is checked
      against these at runtime in dev (see lib/queryEngine.ts self-check)
      so a bug in the JS port of the SQL logic gets caught immediately
      instead of silently drifting from what the live API would say.

Also prints the checkpoint numbers from README.md so this script's output
can be sanity-checked against the last real deployment:
  - roas-by-campaign?channel=Google Ads -> 139 of 407 segments
  - underperformers (loose/median cut) full year -> 119 flagged
  - underperformers (loose/median cut) Q1 2024 -> 83 flagged
  - blended ROAS by channel -> TikTok 7.62, Meta 5.66, Google Ads 3.47
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "raw" / "global_ads_performance_dataset.csv"
WEB_DATA_DIR = ROOT / "web" / "src" / "data"
SAMPLE_DIR = WEB_DATA_DIR / "sample"

DEFAULT_START = "1970-01-01"
DEFAULT_END = "2100-01-01"


def load_df():
    df = pd.read_csv(CSV_PATH, parse_dates=["date"])
    df = df.rename(columns={"date": "event_date"})
    return df


def percentile_cont(series, q):
    """Mirror Postgres PERCENTILE_CONT(q) WITHIN GROUP (ORDER BY x)."""
    return float(np.percentile(series.to_numpy(dtype="float64"), q * 100, method="linear"))


def round_half_away(x, digits):
    """Mirror Postgres NUMERIC ROUND(): half away from zero. Works on scalars,
    numpy arrays, and pandas Series alike. numpy/pandas' own .round() uses
    banker's rounding (half-to-even), which disagrees with Postgres on exact
    .5 ties, so every rounding in this script goes through this instead."""
    factor = 10**digits
    return np.sign(x) * np.floor(np.abs(x) * factor + 0.5) / factor


def filter_df(df, start_date, end_date, channel):
    mask = (df["event_date"] >= start_date) & (df["event_date"] <= end_date)
    if channel:
        mask &= df["platform"] == channel
    return df.loc[mask]


def round_or_none(x, ndigits):
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return None
    return float(round_half_away(float(x), ndigits))


def roas_by_channel(df, start_date, end_date, channel):
    sub = filter_df(df, start_date, end_date, channel)
    g = sub.groupby("platform", as_index=False).agg(
        total_spend=("ad_spend", "sum"),
        total_revenue=("revenue", "sum"),
        total_conversions=("conversions", "sum"),
    )
    g["roas"] = round_half_away(g["total_revenue"] / g["total_spend"], 4)
    g["cpa"] = round_half_away(g["total_spend"] / g["total_conversions"], 2)
    g = g.sort_values("roas", ascending=False)
    results = [
        {
            "platform": r.platform,
            "total_spend": round_or_none(r.total_spend, 2),
            "total_revenue": round_or_none(r.total_revenue, 2),
            "total_conversions": int(r.total_conversions),
            "roas": round_or_none(r.roas, 4),
            "cpa": round_or_none(r.cpa, 2),
        }
        for r in g.itertuples()
    ]
    return results


def campaign_agg(sub):
    g = sub.groupby(["platform", "campaign_type", "industry", "country"], as_index=False).agg(
        total_spend=("ad_spend", "sum"),
        total_revenue=("revenue", "sum"),
    )
    g["roas"] = round_half_away(g["total_revenue"] / g["total_spend"], 4)
    return g


def roas_by_campaign(df, start_date, end_date, channel):
    sub = filter_df(df, start_date, end_date, channel)
    g = sub.groupby(["platform", "campaign_type", "industry", "country"], as_index=False).agg(
        total_spend=("ad_spend", "sum"),
        total_revenue=("revenue", "sum"),
        total_conversions=("conversions", "sum"),
    )
    g["roas"] = round_half_away(g["total_revenue"] / g["total_spend"], 4)
    g["cpa"] = round_half_away(g["total_spend"] / g["total_conversions"], 2)
    # SQL only orders by roas; break ties deterministically (Postgres' own tie
    # order is unspecified/hash-dependent) so this matches the JS port 1:1.
    g = g.sort_values(["roas", "platform", "campaign_type", "industry", "country"], ascending=True)
    results = [
        {
            "platform": r.platform,
            "campaign_type": r.campaign_type,
            "industry": r.industry,
            "country": r.country,
            "total_spend": round_or_none(r.total_spend, 2),
            "total_revenue": round_or_none(r.total_revenue, 2),
            "total_conversions": int(r.total_conversions),
            "roas": round_or_none(r.roas, 4),
            "cpa": round_or_none(r.cpa, 2),
        }
        for r in g.itertuples()
    ]
    return results


def underperformers_loose(df, start_date, end_date, channel):
    sub = filter_df(df, start_date, end_date, channel)
    ca = campaign_agg(sub)
    median_spend = percentile_cont(ca["total_spend"], 0.5)
    median_roas = percentile_cont(ca["roas"], 0.5)
    flagged = ca[(ca["total_spend"] >= median_spend) & (ca["roas"] < median_roas)].copy()
    flagged["roas_gap_below_median"] = round_half_away(median_roas - flagged["roas"], 4)
    flagged = flagged.sort_values(
        ["total_spend", "platform", "campaign_type", "industry", "country"], ascending=[False, True, True, True, True]
    )
    results = [
        {
            "platform": r.platform,
            "campaign_type": r.campaign_type,
            "industry": r.industry,
            "country": r.country,
            "total_spend": round_or_none(r.total_spend, 2),
            "total_revenue": round_or_none(r.total_revenue, 2),
            "roas": round_or_none(r.roas, 4),
            "median_spend": round_or_none(median_spend, 2),
            "median_roas": round_or_none(median_roas, 4),
            "roas_gap_below_median": round_or_none(r.roas_gap_below_median, 4),
        }
        for r in flagged.itertuples()
    ]
    return results


def rolling_roas(df, start_date, end_date, channel):
    sub = filter_df(df, start_date, end_date, channel)
    daily = sub.groupby(["platform", "event_date"], as_index=False).agg(
        daily_spend=("ad_spend", "sum"),
        daily_revenue=("revenue", "sum"),
    )
    out_rows = []
    for platform, grp in daily.groupby("platform"):
        grp = grp.sort_values("event_date").reset_index(drop=True)
        dates = grp["event_date"].to_numpy()
        spends = grp["daily_spend"].to_numpy(dtype="float64")
        revs = grp["daily_revenue"].to_numpy(dtype="float64")
        for i in range(len(grp)):
            window_start = dates[i] - np.timedelta64(6, "D")
            in_window = (dates >= window_start) & (dates <= dates[i])
            spend_sum = spends[in_window].sum()
            rev_sum = revs[in_window].sum()
            roas = round(rev_sum / spend_sum, 4) if spend_sum else None
            out_rows.append(
                {
                    "platform": platform,
                    "event_date": pd.Timestamp(dates[i]).date().isoformat(),
                    "daily_spend": round_or_none(spends[i], 2),
                    "daily_revenue": round_or_none(revs[i], 2),
                    "rolling_7d_roas": roas,
                }
            )
    out_rows.sort(key=lambda r: (r["platform"], r["event_date"]))
    return out_rows


def wow_efficiency(df, start_date, end_date, channel):
    sub = filter_df(df, start_date, end_date, channel).copy()
    sub["week_start"] = sub["event_date"] - pd.to_timedelta(sub["event_date"].dt.weekday, unit="D")
    weekly = sub.groupby(["platform", "week_start"], as_index=False).agg(
        weekly_spend=("ad_spend", "sum"),
        weekly_revenue=("revenue", "sum"),
    )
    weekly["weekly_roas"] = round_half_away(weekly["weekly_revenue"] / weekly["weekly_spend"], 4)
    weekly = weekly.sort_values(["platform", "week_start"])
    weekly["prior_week_roas"] = weekly.groupby("platform")["weekly_roas"].shift(1)
    weekly["roas_wow_pct_change"] = round_half_away(
        (weekly["weekly_roas"] - weekly["prior_week_roas"]) / weekly["prior_week_roas"] * 100, 2
    )
    results = [
        {
            "platform": r.platform,
            "week_start": r.week_start.date().isoformat(),
            "weekly_spend": round_or_none(r.weekly_spend, 2),
            "weekly_revenue": round_or_none(r.weekly_revenue, 2),
            "weekly_roas": round_or_none(r.weekly_roas, 4),
            "prior_week_roas": round_or_none(r.prior_week_roas, 4),
            "roas_wow_pct_change": round_or_none(r.roas_wow_pct_change, 2),
        }
        for r in weekly.itertuples()
    ]
    return results


ROUTES = {
    "/roas-by-channel": roas_by_channel,
    "/roas-by-campaign": roas_by_campaign,
    "/underperformers": underperformers_loose,
    "/rolling-roas": rolling_roas,
    "/wow-efficiency": wow_efficiency,
}


def build_envelope(route, fn, df, start_date, end_date, channel):
    results = fn(df, start_date, end_date, channel)
    return {
        "route": route,
        "params": {"start_date": start_date, "end_date": end_date, "channel": channel},
        "count": len(results),
        "results": results,
    }


def main():
    df = load_df()
    SAMPLE_DIR.mkdir(parents=True, exist_ok=True)

    # 1) row-level dataset for the frontend's client-side query engine
    raw_records = [
        {
            "event_date": r.event_date.date().isoformat(),
            "platform": r.platform,
            "campaign_type": r.campaign_type,
            "industry": r.industry,
            "country": r.country,
            "ad_spend": float(r.ad_spend),
            "conversions": int(r.conversions),
            "revenue": float(r.revenue),
        }
        for r in df.itertuples()
    ]
    (WEB_DATA_DIR).mkdir(parents=True, exist_ok=True)
    with open(WEB_DATA_DIR / "raw-ad-performance.json", "w") as f:
        json.dump(raw_records, f, separators=(",", ":"))

    # 2) golden default-params fixture per route
    slug_map = {
        "/roas-by-channel": "roas-by-channel",
        "/roas-by-campaign": "roas-by-campaign",
        "/underperformers": "underperformers",
        "/rolling-roas": "rolling-roas",
        "/wow-efficiency": "wow-efficiency",
    }
    for route, fn in ROUTES.items():
        envelope = build_envelope(route, fn, df, DEFAULT_START, DEFAULT_END, None)
        with open(SAMPLE_DIR / f"{slug_map[route]}.json", "w") as f:
            json.dump(envelope, f, indent=2)
        print(f"{route}: {envelope['count']} rows")

    # 3) checkpoints against README's last verified deployment
    print("\n--- checkpoints ---")
    gads_segments = len(roas_by_campaign(df, DEFAULT_START, DEFAULT_END, "Google Ads"))
    all_segments = len(roas_by_campaign(df, DEFAULT_START, DEFAULT_END, None))
    print(f"roas-by-campaign?channel=Google Ads -> {gads_segments}/{all_segments} (expect 139/407)")

    full_year_flagged = len(underperformers_loose(df, DEFAULT_START, DEFAULT_END, None))
    q1_flagged = len(underperformers_loose(df, "2024-01-01", "2024-03-31", None))
    print(f"underperformers full-year -> {full_year_flagged} (expect 119)")
    print(f"underperformers Q1 2024 -> {q1_flagged} (expect 83)")

    channel_roas = {r["platform"]: r["roas"] for r in roas_by_channel(df, DEFAULT_START, DEFAULT_END, None)}
    print(f"blended ROAS by channel -> {channel_roas} (expect TikTok~7.62, Meta~5.66, Google~3.47)")


if __name__ == "__main__":
    main()
