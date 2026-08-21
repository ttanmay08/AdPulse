-- Rolling 7-calendar-day ROAS trend per channel.
-- Uses a RANGE (not ROWS) frame keyed off event_date, so the window is a true
-- trailing 7-day calendar span even on days with no spend for a channel —
-- ROWS BETWEEN 6 PRECEDING would instead span a variable number of calendar
-- days depending on how sparse that channel's activity is.
WITH daily_channel AS (
    SELECT
        platform,
        event_date,
        SUM(ad_spend) AS daily_spend,
        SUM(revenue)  AS daily_revenue
    FROM ad_performance
    GROUP BY platform, event_date
)
SELECT
    platform,
    event_date,
    daily_spend,
    daily_revenue,
    ROUND(
        SUM(daily_revenue) OVER w / NULLIF(SUM(daily_spend) OVER w, 0),
        4
    ) AS rolling_7d_roas
FROM daily_channel
WINDOW w AS (
    PARTITION BY platform
    ORDER BY event_date
    RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW
)
ORDER BY platform, event_date;
