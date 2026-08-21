"""
API Gateway (HTTP API, payload format 2.0) Lambda exposing the Phase 1 SQL
queries as JSON, parameterized by start_date / end_date / channel.

Routes (all GET, all query params optional):
  /roas-by-channel     -> sql/01_roas_cpa_by_channel.sql
  /roas-by-campaign    -> sql/02_roas_cpa_by_campaign.sql
  /underperformers     -> sql/03_underperformers_top_spend_low_roas.sql
  /rolling-roas         -> sql/04_rolling_7day_roas_by_channel.sql
  /wow-efficiency        -> sql/05_week_over_week_efficiency_change.sql

Query params:
  start_date, end_date : YYYY-MM-DD, default to the full dataset range
  channel               : platform name (e.g. "Google Ads"), default all channels

Env vars: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_SECRET_ARN
"""
import datetime
import decimal
import json
import os

import boto3
import psycopg2
import psycopg2.extras

QUERIES = {
    "/roas-by-channel": """
        SELECT
            platform,
            SUM(ad_spend)                                        AS total_spend,
            SUM(revenue)                                          AS total_revenue,
            SUM(conversions)                                      AS total_conversions,
            ROUND(SUM(revenue) / NULLIF(SUM(ad_spend), 0), 4)     AS roas,
            ROUND(SUM(ad_spend) / NULLIF(SUM(conversions), 0), 2) AS cpa
        FROM ad_performance
        WHERE event_date BETWEEN %(start_date)s::date AND %(end_date)s::date
          AND (%(channel)s IS NULL OR platform = %(channel)s)
        GROUP BY platform
        ORDER BY roas DESC;
    """,
    "/roas-by-campaign": """
        SELECT
            platform,
            campaign_type,
            industry,
            country,
            SUM(ad_spend)                                        AS total_spend,
            SUM(revenue)                                          AS total_revenue,
            SUM(conversions)                                      AS total_conversions,
            ROUND(SUM(revenue) / NULLIF(SUM(ad_spend), 0), 4)     AS roas,
            ROUND(SUM(ad_spend) / NULLIF(SUM(conversions), 0), 2) AS cpa
        FROM ad_performance
        WHERE event_date BETWEEN %(start_date)s::date AND %(end_date)s::date
          AND (%(channel)s IS NULL OR platform = %(channel)s)
        GROUP BY platform, campaign_type, industry, country
        ORDER BY roas ASC;
    """,
    "/underperformers": """
        WITH campaign_agg AS (
            SELECT
                platform, campaign_type, industry, country,
                SUM(ad_spend)                                    AS total_spend,
                SUM(revenue)                                      AS total_revenue,
                ROUND(SUM(revenue) / NULLIF(SUM(ad_spend), 0), 4) AS roas
            FROM ad_performance
            WHERE event_date BETWEEN %(start_date)s::date AND %(end_date)s::date
              AND (%(channel)s IS NULL OR platform = %(channel)s)
            GROUP BY platform, campaign_type, industry, country
        ),
        thresholds AS (
            SELECT
                (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_spend))::numeric AS median_spend,
                (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY roas))::numeric        AS median_roas
            FROM campaign_agg
        )
        SELECT
            ca.platform, ca.campaign_type, ca.industry, ca.country,
            ca.total_spend, ca.total_revenue, ca.roas,
            t.median_spend, t.median_roas,
            ROUND(t.median_roas - ca.roas, 4) AS roas_gap_below_median
        FROM campaign_agg ca
        CROSS JOIN thresholds t
        WHERE ca.total_spend >= t.median_spend
          AND ca.roas < t.median_roas
        ORDER BY ca.total_spend DESC;
    """,
    "/rolling-roas": """
        WITH daily_channel AS (
            SELECT platform, event_date, SUM(ad_spend) AS daily_spend, SUM(revenue) AS daily_revenue
            FROM ad_performance
            WHERE event_date BETWEEN %(start_date)s::date AND %(end_date)s::date
              AND (%(channel)s IS NULL OR platform = %(channel)s)
            GROUP BY platform, event_date
        )
        SELECT
            platform, event_date, daily_spend, daily_revenue,
            ROUND(SUM(daily_revenue) OVER w / NULLIF(SUM(daily_spend) OVER w, 0), 4) AS rolling_7d_roas
        FROM daily_channel
        WINDOW w AS (
            PARTITION BY platform ORDER BY event_date
            RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW
        )
        ORDER BY platform, event_date;
    """,
    "/wow-efficiency": """
        WITH weekly_channel AS (
            SELECT
                platform,
                date_trunc('week', event_date)::date               AS week_start,
                SUM(ad_spend)                                        AS weekly_spend,
                SUM(revenue)                                          AS weekly_revenue,
                ROUND(SUM(revenue) / NULLIF(SUM(ad_spend), 0), 4)     AS weekly_roas
            FROM ad_performance
            WHERE event_date BETWEEN %(start_date)s::date AND %(end_date)s::date
              AND (%(channel)s IS NULL OR platform = %(channel)s)
            GROUP BY platform, date_trunc('week', event_date)
        ),
        with_prior AS (
            SELECT platform, week_start, weekly_spend, weekly_revenue, weekly_roas,
                LAG(weekly_roas) OVER (PARTITION BY platform ORDER BY week_start) AS prior_week_roas
            FROM weekly_channel
        )
        SELECT
            platform, week_start, weekly_spend, weekly_revenue, weekly_roas, prior_week_roas,
            ROUND((weekly_roas - prior_week_roas) / NULLIF(prior_week_roas, 0) * 100, 2) AS roas_wow_pct_change
        FROM with_prior
        ORDER BY platform, week_start;
    """,
}

_secrets = boto3.client("secretsmanager")
_db_password_cache = None
_conn = None


class _JsonEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, decimal.Decimal):
            return float(o)
        if isinstance(o, (datetime.date, datetime.datetime)):
            return o.isoformat()
        return super().default(o)


def _get_db_password():
    global _db_password_cache
    if _db_password_cache is None:
        secret = _secrets.get_secret_value(SecretId=os.environ["DB_SECRET_ARN"])
        _db_password_cache = json.loads(secret["SecretString"])["password"]
    return _db_password_cache


def _get_connection():
    global _conn
    if _conn is None or _conn.closed:
        _conn = psycopg2.connect(
            host=os.environ["DB_HOST"],
            port=os.environ.get("DB_PORT", "5432"),
            dbname=os.environ["DB_NAME"],
            user=os.environ["DB_USER"],
            password=_get_db_password(),
            connect_timeout=10,
        )
    return _conn


def _response(status, body_obj):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body_obj, cls=_JsonEncoder),
    }


def handler(event, context):
    path = event.get("rawPath", "/")
    sql = QUERIES.get(path)
    if sql is None:
        return _response(404, {"error": f"unknown route {path}", "routes": list(QUERIES)})

    params = event.get("queryStringParameters") or {}
    query_params = {
        "start_date": params.get("start_date", "1970-01-01"),
        "end_date": params.get("end_date", "2100-01-01"),
        "channel": params.get("channel"),
    }

    try:
        conn = _get_connection()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, query_params)
            rows = cur.fetchall()
        return _response(200, {"route": path, "params": query_params, "count": len(rows), "results": rows})
    except Exception as exc:  # noqa: BLE001 - surface any DB/query error as a 500 with detail for debugging
        print(f"ERROR handling {path}: {exc}")
        return _response(500, {"error": str(exc)})
