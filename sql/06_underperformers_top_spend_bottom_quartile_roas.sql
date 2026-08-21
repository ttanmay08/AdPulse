-- Stricter reallocation-candidate flag: top-half spend AND bottom-quartile
-- ROAS (<= 25th percentile), vs. the below-median cut in
-- 03_underperformers_top_spend_low_roas.sql. This is the query behind the
-- dashboard's headline "flagged wasted spend" KPI (Phase 3) — median-ROAS
-- flags nearly a third of all campaigns, too noisy for a single top-line
-- number; bottom-quartile isolates the segments that are unambiguously
-- burning budget rather than merely below-average.
WITH campaign_agg AS (
    SELECT
        platform,
        campaign_type,
        industry,
        country,
        SUM(ad_spend)                                        AS total_spend,
        SUM(revenue)                                          AS total_revenue,
        ROUND(SUM(revenue) / NULLIF(SUM(ad_spend), 0), 4)     AS roas
    FROM ad_performance
    GROUP BY platform, campaign_type, industry, country
),
thresholds AS (
    SELECT
        (PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY total_spend))::numeric AS median_spend,
        (PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY roas))::numeric        AS p25_roas
    FROM campaign_agg
)
SELECT
    ca.platform,
    ca.campaign_type,
    ca.industry,
    ca.country,
    ca.total_spend,
    ca.total_revenue,
    ca.roas,
    t.median_spend,
    t.p25_roas,
    ROUND(t.p25_roas - ca.roas, 4) AS roas_gap_below_p25
FROM campaign_agg ca
CROSS JOIN thresholds t
WHERE ca.total_spend >= t.median_spend
  AND ca.roas < t.p25_roas
ORDER BY ca.total_spend DESC;
