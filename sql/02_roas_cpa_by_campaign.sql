-- ROAS and CPA by campaign.
-- The source data has no campaign_id/campaign_name — a "campaign" here is the
-- (platform, campaign_type, industry, country) segment. Sorted worst-ROAS-first,
-- which is the order the dashboard's campaign table uses.
SELECT
    platform,
    campaign_type,
    industry,
    country,
    SUM(ad_spend)                                          AS total_spend,
    SUM(revenue)                                            AS total_revenue,
    SUM(conversions)                                        AS total_conversions,
    ROUND(SUM(revenue) / NULLIF(SUM(ad_spend), 0), 4)       AS roas,
    ROUND(SUM(ad_spend) / NULLIF(SUM(conversions), 0), 2)   AS cpa
FROM ad_performance
GROUP BY platform, campaign_type, industry, country
ORDER BY roas ASC;
