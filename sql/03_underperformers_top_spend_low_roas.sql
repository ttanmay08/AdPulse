-- Flags campaigns (segments) whose total spend is in the top half of all
-- campaigns AND whose blended ROAS is below the median campaign ROAS.
-- These are reallocation candidates: a lot of budget going somewhere that's
-- converting it less efficiently than a typical campaign. This cut is
-- intentionally loose (flags ~30% of campaigns) — for a stricter cut see
-- 06_underperformers_top_spend_bottom_quartile_roas.sql (bottom-quartile
-- ROAS instead of below-median), which is what the dashboard's headline KPI
-- uses.
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
        (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_spend))::numeric AS median_spend,
        (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY roas))::numeric        AS median_roas
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
    t.median_roas,
    ROUND(t.median_roas - ca.roas, 4) AS roas_gap_below_median
FROM campaign_agg ca
CROSS JOIN thresholds t
WHERE ca.total_spend >= t.median_spend
  AND ca.roas < t.median_roas
ORDER BY ca.total_spend DESC;
