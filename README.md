# AdPulse

Marketing ad spend analytics pipeline: identifies underperforming ad spend
across channels and campaigns and flags reallocation opportunities.

Dataset: Kaggle "Global Ads Performance" (Google Ads / Meta Ads / TikTok Ads
campaign-level data).

## Status

- [x] Phase 1 — data, schema, core SQL (local Postgres)
- [x] Phase 2 — cloud plumbing (Terraform: S3, Lambda, RDS, API Gateway)
- [ ] Phase 3 — dashboard (S3 + CloudFront)

## Data notes

- 1,800 rows, 2024-01-01 to 2024-12-30 (360 of 365 days have at least one row).
- Columns: `date, platform, campaign_type, industry, country, impressions,
  clicks, CTR, CPC, ad_spend, conversions, CPA, revenue, ROAS`.
- No nulls, no exact-duplicate rows. Source-provided CTR/CPC/CPA/ROAS all
  reconcile with the raw counts (impressions/clicks/spend/conversions/revenue).
- **No native campaign identifier.** The closest thing to a "campaign" is the
  combination of `(platform, campaign_type, industry, country)` — 407 distinct
  combinations — and even that isn't a unique key: 12 of those combinations
  have two different rows on the same date with different metrics (e.g. two
  separate Google Ads / Search / Fintech / UAE campaigns both running on
  2024-01-21). Campaign-level SQL in this project groups by that 4-column
  segment and documents it as such rather than pretending it's a real
  campaign ID.

## Schema

Single denormalized fact table, `ad_performance` (`sql/schema.sql`). The
platform/campaign_type/industry/country columns are plain category strings
with no attributes of their own, so splitting them into dimension tables
would add joins without adding information — not worth it at this scale.

## Setup

```bash
# Postgres (local — Phase 2 points this at RDS instead)
brew install postgresql@16
brew services start postgresql@16
createdb adpulse

# Python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # fill in PGUSER/PGPASSWORD if not using local trust auth
```

## Load the data

```bash
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
psql -d adpulse -f sql/schema.sql      # (re)create the table
source venv/bin/activate
python scripts/load_data.py            # clean + load the CSV
```

`scripts/load_data.py` drops null/negative rows (none present in the current
dataset) and cross-checks the source's derived metrics (CTR/CPA/ROAS) against
a recompute from raw counts, flagging any row that drifts >2% — a guard for
future data refreshes that aren't as clean as this one.

## Analysis queries (`sql/`)

| File | What it answers |
|---|---|
| `01_roas_cpa_by_channel.sql` | Blended ROAS/CPA per platform |
| `02_roas_cpa_by_campaign.sql` | Blended ROAS/CPA per campaign segment, worst-first |
| `03_underperformers_top_spend_low_roas.sql` | CTE: campaigns with top-half spend AND below-median ROAS — reallocation candidates (loose cut) |
| `04_rolling_7day_roas_by_channel.sql` | Trailing 7-calendar-day ROAS per channel (window function, `RANGE` frame) |
| `05_week_over_week_efficiency_change.sql` | Week-over-week % change in ROAS per channel (`LAG`) |
| `06_underperformers_top_spend_bottom_quartile_roas.sql` | CTE: campaigns with top-half spend AND bottom-quartile (p25) ROAS — stricter cut, **used for the Phase 3 dashboard's headline "flagged wasted spend" KPI** |

Run any of them with:

```bash
psql -d adpulse -f sql/01_roas_cpa_by_channel.sql
```

### Headline results (current dataset)

- Blended ROAS by channel: **TikTok 7.62**, **Meta 5.66**, **Google 3.47** —
  Google is by far the biggest spender ($6.35M) but the least efficient.
- Loose cut (top-half spend / below-median ROAS, `03`): 119 of 407 campaign
  segments (29%) flagged, totaling **$5.85M** of $11.1M total spend.
- Strict cut (top-half spend / bottom-quartile ROAS, `06` — the dashboard KPI):
  **57 segments flagged, $2.91M**. Nearly all of it ($2.6M+) is Google Ads,
  reinforcing that Google is where reallocation should start.

## Phase 2 — AWS infrastructure

Terraform (`terraform/`) provisions:

- **VPC** with two private subnets, no NAT gateway and no internet gateway.
  Nothing in this stack needs outbound internet: the load Lambda reaches S3
  through a free **gateway endpoint**, and both Lambdas fetch the RDS master
  password from Secrets Manager through an **interface endpoint** — the
  cheapest topology that still keeps RDS fully private.
- **S3** raw landing bucket (`raw/` prefix, versioned, public access blocked),
  with an event notification that invokes the load Lambda on every `.csv`
  upload.
- **RDS Postgres 16.15** (`db.t4g.micro`, single-AZ, `publicly_accessible =
  false`), master password managed natively by RDS in Secrets Manager
  (`manage_master_user_password = true` — no password ever passed through
  Terraform state or a plaintext Lambda env var).
- **Load Lambda** (`lambda/load/handler.py`, Python 3.12, VPC-attached):
  triggered by the S3 upload, re-implements `scripts/load_data.py`'s cleaning
  rules (null/negative-row drop, derived-metric cross-check) without pandas —
  its C-extension wheels aren't worth cross-compiling for Lambda's runtime at
  this data volume, so this uses the stdlib `csv` module. Creates the table
  on first run (`CREATE TABLE IF NOT EXISTS`, same DDL as `sql/schema.sql`)
  so schema setup doesn't require out-of-band `psql` access to a private RDS
  instance.
- **Query Lambda + API Gateway (HTTP API)** (`lambda/query/handler.py`):
  exposes the 5 Phase 1 SQL queries as `GET` JSON routes, each parameterized
  by `start_date`, `end_date`, `channel` (all optional):

  | Route | Source query |
  |---|---|
  | `/roas-by-channel` | `sql/01_roas_cpa_by_channel.sql` |
  | `/roas-by-campaign` | `sql/02_roas_cpa_by_campaign.sql` |
  | `/underperformers` | `sql/03_underperformers_top_spend_low_roas.sql` |
  | `/rolling-roas` | `sql/04_rolling_7day_roas_by_channel.sql` |
  | `/wow-efficiency` | `sql/05_week_over_week_efficiency_change.sql` |

  e.g. `GET /roas-by-campaign?channel=Google%20Ads&start_date=2024-01-01&end_date=2024-03-31`
- **IAM**: two least-privilege Lambda roles — the load role gets `s3:GetObject`
  scoped to `raw/*` plus `secretsmanager:GetSecretValue` on the RDS secret;
  the query role gets only the Secrets Manager read.

### Deploying

```bash
cd lambda && ./build.sh                        # builds Lambda zips (manylinux psycopg2 wheel)
cd ../terraform
terraform init
terraform plan -out=tfplan
terraform apply tfplan

aws s3 cp ../data/raw/global_ads_performance_dataset.csv \
  s3://$(terraform output -raw raw_bucket_name)/raw/global_ads_performance_dataset.csv
# ^ upload triggers the load Lambda automatically

curl "$(terraform output -raw api_endpoint)roas-by-channel"
```

Tear down with `terraform destroy` when you're done — RDS is the only real
ongoing cost (~$12-15/mo on `db.t4g.micro` outside the Free Tier); everything
else here is pennies.

### Verified deployed (2026-08-21)

- `terraform apply`: 40 resources created in `ap-south-1`, zero errors on the
  final apply.
- Uploaded the CSV to S3 → load Lambda cleaned and loaded all 1,800 rows into
  RDS (confirmed via CloudWatch logs and a direct synchronous invoke).
- All 5 API routes hit and returned correct JSON, including
  `channel`/`start_date`/`end_date` filtering (e.g. `/roas-by-campaign` with
  `channel=Google Ads` returned 139 of 407 segments; `/underperformers` scoped
  to Q1 2024 returned 83 flagged segments vs. 119 for the full year).
- One real bug caught and fixed during deployment: the Lambdas' Secrets
  Manager calls were hanging for the full timeout because the VPC had no
  route to Secrets Manager's public endpoint (no NAT, no interface endpoint)
  — fixed by adding a Secrets Manager VPC interface endpoint
  (`aws_vpc_endpoint.secretsmanager` in `terraform/vpc.tf`).
