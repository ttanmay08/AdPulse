-- ROAS and CPA by channel (platform).
-- Blended ROAS/CPA = SUM(revenue)/SUM(spend) and SUM(spend)/SUM(conversions),
-- NOT an average of the per-row ratios — averaging ratios directly would let a
-- handful of low-spend, high-ROAS rows skew the channel-level number even
-- though they moved very little revenue.
SELECT
    platform,
    SUM(ad_spend)                                          AS total_spend,
    SUM(revenue)                                            AS total_revenue,
    SUM(conversions)                                        AS total_conversions,
    ROUND(SUM(revenue) / NULLIF(SUM(ad_spend), 0), 4)       AS roas,
    ROUND(SUM(ad_spend) / NULLIF(SUM(conversions), 0), 2)   AS cpa
FROM ad_performance
GROUP BY platform
ORDER BY roas DESC;
