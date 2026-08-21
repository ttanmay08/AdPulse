-- Week-over-week ROAS efficiency change per channel.
-- Weeks are calendar weeks (Mon-start, via date_trunc); LAG() compares each
-- week to the channel's own immediately preceding week that has data.
WITH weekly_channel AS (
    SELECT
        platform,
        date_trunc('week', event_date)::date               AS week_start,
        SUM(ad_spend)                                        AS weekly_spend,
        SUM(revenue)                                          AS weekly_revenue,
        ROUND(SUM(revenue) / NULLIF(SUM(ad_spend), 0), 4)     AS weekly_roas
    FROM ad_performance
    GROUP BY platform, date_trunc('week', event_date)
),
with_prior AS (
    SELECT
        platform,
        week_start,
        weekly_spend,
        weekly_revenue,
        weekly_roas,
        LAG(weekly_roas) OVER (PARTITION BY platform ORDER BY week_start) AS prior_week_roas
    FROM weekly_channel
)
SELECT
    platform,
    week_start,
    weekly_spend,
    weekly_revenue,
    weekly_roas,
    prior_week_roas,
    ROUND(
        (weekly_roas - prior_week_roas) / NULLIF(prior_week_roas, 0) * 100,
        2
    ) AS roas_wow_pct_change
FROM with_prior
ORDER BY platform, week_start;
