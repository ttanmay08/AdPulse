"""
S3-triggered Lambda: cleans and loads the ads performance CSV into RDS Postgres.

Mirrors the validation rules in scripts/load_data.py (null/negative row
drop, derived-metric cross-check) without a pandas dependency — pandas'
C extensions would have to be cross-compiled for Lambda's runtime for no
real benefit at this data volume, so this uses the stdlib csv module and
plain Python instead.

Table is created on first run (CREATE TABLE IF NOT EXISTS) so the schema
does not need to be applied out-of-band against a private RDS instance.

Env vars: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_SECRET_ARN
"""
import csv
import io
import json
import os

import boto3
import psycopg2

TARGET_COLUMNS = [
    "event_date", "platform", "campaign_type", "industry", "country",
    "impressions", "clicks", "ctr", "cpc", "ad_spend",
    "conversions", "cpa", "revenue", "roas",
]
INT_COLUMNS = ["impressions", "clicks", "conversions"]
FLOAT_COLUMNS = ["ctr", "cpc", "ad_spend", "cpa", "revenue", "roas"]

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS ad_performance (
    id              BIGSERIAL PRIMARY KEY,
    event_date      DATE            NOT NULL,
    platform        TEXT            NOT NULL,
    campaign_type   TEXT            NOT NULL,
    industry        TEXT            NOT NULL,
    country         TEXT            NOT NULL,
    impressions     INTEGER         NOT NULL CHECK (impressions >= 0),
    clicks          INTEGER         NOT NULL CHECK (clicks >= 0),
    ctr             NUMERIC(6,4)    NOT NULL CHECK (ctr >= 0),
    cpc             NUMERIC(8,2)    NOT NULL CHECK (cpc >= 0),
    ad_spend        NUMERIC(12,2)   NOT NULL CHECK (ad_spend >= 0),
    conversions     INTEGER         NOT NULL CHECK (conversions >= 0),
    cpa             NUMERIC(10,2)   NOT NULL CHECK (cpa >= 0),
    revenue         NUMERIC(14,2)   NOT NULL CHECK (revenue >= 0),
    roas            NUMERIC(10,4)   NOT NULL CHECK (roas >= 0),
    loaded_at       TIMESTAMPTZ     NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_performance_date ON ad_performance (event_date);
CREATE INDEX IF NOT EXISTS idx_ad_performance_platform ON ad_performance (platform);
CREATE INDEX IF NOT EXISTS idx_ad_performance_segment
    ON ad_performance (platform, campaign_type, industry, country);
"""

_s3 = boto3.client("s3")
_secrets = boto3.client("secretsmanager")
_db_password_cache = None  # cached across warm invocations


def _get_db_password():
    global _db_password_cache
    if _db_password_cache is None:
        secret = _secrets.get_secret_value(SecretId=os.environ["DB_SECRET_ARN"])
        _db_password_cache = json.loads(secret["SecretString"])["password"]
    return _db_password_cache


def _clean_rows(reader):
    """Yields cleaned row dicts; logs and skips rows that fail validation."""
    n_seen = n_kept = n_mismatch = 0
    for row in reader:
        n_seen += 1
        cleaned = {
            "event_date": row["date"].strip(),
            "platform": row["platform"].strip(),
            "campaign_type": row["campaign_type"].strip(),
            "industry": row["industry"].strip(),
            "country": row["country"].strip(),
        }

        try:
            for col in INT_COLUMNS:
                cleaned[col] = int(float(row[col]))
            for col, src in [("ctr", "CTR"), ("cpc", "CPC"), ("cpa", "CPA"), ("roas", "ROAS")]:
                cleaned[col] = float(row[src])
            cleaned["ad_spend"] = float(row["ad_spend"])
            cleaned["revenue"] = float(row["revenue"])
        except (KeyError, ValueError):
            print(f"WARNING: dropping row {n_seen} — missing/unparseable field: {row}")
            continue

        if any(cleaned[c] < 0 for c in INT_COLUMNS + FLOAT_COLUMNS):
            print(f"WARNING: dropping row {n_seen} — negative metric: {row}")
            continue

        impressions, clicks = cleaned["impressions"], cleaned["clicks"]
        conversions, ad_spend, revenue = cleaned["conversions"], cleaned["ad_spend"], cleaned["revenue"]
        checks = [
            (clicks / impressions if impressions else 0, cleaned["ctr"]),
            (ad_spend / conversions if conversions else 0, cleaned["cpa"]),
            (revenue / ad_spend if ad_spend else 0, cleaned["roas"]),
        ]
        if any(abs(actual - stated) > 0.02 * max(abs(actual), 1e-9) for actual, stated in checks):
            n_mismatch += 1
            print(f"WARNING: row {n_seen} derived metrics >2% off raw counts — keeping, flagged: {row}")

        n_kept += 1
        yield cleaned

    print(f"Cleaned {n_kept}/{n_seen} rows ({n_seen - n_kept} dropped, {n_mismatch} flagged for metric mismatch)")


def _load_to_postgres(rows):
    print("Fetching DB password from Secrets Manager")
    password = _get_db_password()
    print(f"Connecting to {os.environ['DB_HOST']}:{os.environ.get('DB_PORT', '5432')}")
    conn = psycopg2.connect(
        host=os.environ["DB_HOST"],
        port=os.environ.get("DB_PORT", "5432"),
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=password,
        connect_timeout=10,
    )
    print("Connected")
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(CREATE_TABLE_SQL)
                cur.execute("TRUNCATE TABLE ad_performance RESTART IDENTITY")

                buf = io.StringIO()
                writer = csv.writer(buf)
                count = 0
                for row in rows:
                    writer.writerow(row[c] for c in TARGET_COLUMNS)
                    count += 1
                buf.seek(0)

                cur.copy_expert(
                    f"COPY ad_performance ({', '.join(TARGET_COLUMNS)}) FROM STDIN WITH (FORMAT csv)",
                    buf,
                )
                return count
    finally:
        conn.close()


def handler(event, context):
    record = event["Records"][0]["s3"]
    bucket = record["bucket"]["name"]
    key = record["object"]["key"]
    print(f"Loading s3://{bucket}/{key}")

    obj = _s3.get_object(Bucket=bucket, Key=key)
    print("S3 get_object returned")
    text_stream = io.TextIOWrapper(obj["Body"], encoding="utf-8")
    reader = csv.DictReader(text_stream)
    rows = list(_clean_rows(reader))
    print(f"CSV parsed, {len(rows)} clean rows; connecting to Postgres")

    rows_loaded = _load_to_postgres(rows)
    print(f"Loaded {rows_loaded} rows into ad_performance")

    return {"statusCode": 200, "rows_loaded": rows_loaded}
