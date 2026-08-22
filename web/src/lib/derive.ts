/**
 * The dashboard's headline "flagged wasted spend" KPI uses a bottom-quartile
 * ROAS threshold (sql/06_underperformers_top_spend_bottom_quartile_roas.sql),
 * not the below-median cut the live /underperformers route returns
 * (sql/03, ~30% of campaigns flagged — too noisy for a single top-line
 * number). The Lambda doesn't expose a route for query 06 yet, but its
 * campaign_agg CTE is exactly what /roas-by-campaign already returns per
 * segment, so this recomputes the same median-spend / p25-ROAS thresholds
 * client-side from that response instead of adding a 6th route. When the
 * live API grows a matching route, swap this for an api.ts call.
 */
import { percentileCont } from './percentile';
import type { RoasByCampaignRow } from '../types';

export interface StrictUnderperformersResult {
  medianSpend: number;
  p25Roas: number;
  flagged: RoasByCampaignRow[];
  totalWastedSpend: number;
}

export function deriveStrictUnderperformers(campaignRows: RoasByCampaignRow[]): StrictUnderperformersResult {
  if (campaignRows.length === 0) {
    return { medianSpend: 0, p25Roas: 0, flagged: [], totalWastedSpend: 0 };
  }
  const medianSpend = percentileCont(
    campaignRows.map((r) => r.total_spend).sort((a, b) => a - b),
    0.5,
  );
  const p25Roas = percentileCont(
    campaignRows.map((r) => r.roas).sort((a, b) => a - b),
    0.25,
  );
  const flagged = campaignRows.filter((r) => r.total_spend >= medianSpend && r.roas < p25Roas);
  const totalWastedSpend = flagged.reduce((sum, r) => sum + r.total_spend, 0);
  return { medianSpend, p25Roas, flagged, totalWastedSpend };
}
