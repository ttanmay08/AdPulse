-- AdPulse core schema
--
-- Grain: one row per (date, platform, campaign_type, industry, country) observation
-- from the source CSV. The source data has no native campaign_id/campaign_name —
-- a "campaign" is modeled downstream as the (platform, campaign_type, industry,
-- country) segment. That combination is NOT unique even within a single date
-- (12 rows in the source share a full dimension+date key with different metrics),
-- so it is not declared as a table constraint — it's just the GROUP BY used in
-- campaign-level queries.

DROP TABLE IF EXISTS ad_performance;

CREATE TABLE ad_performance (
    id              BIGSERIAL PRIMARY KEY,
    event_date      DATE            NOT NULL,
    platform        TEXT            NOT NULL,   -- Google Ads / Meta Ads / TikTok Ads
    campaign_type   TEXT            NOT NULL,   -- Search / Video / Shopping / Display
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

CREATE INDEX idx_ad_performance_date ON ad_performance (event_date);
CREATE INDEX idx_ad_performance_platform ON ad_performance (platform);
CREATE INDEX idx_ad_performance_segment ON ad_performance (platform, campaign_type, industry, country);
