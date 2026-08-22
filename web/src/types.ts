export type Channel = 'Google Ads' | 'Meta Ads' | 'TikTok Ads';

export const CHANNELS: Channel[] = ['Google Ads', 'Meta Ads', 'TikTok Ads'];

export interface RouteParams {
  start_date: string;
  end_date: string;
  channel: Channel | null;
}

export interface RouteEnvelope<T> {
  route: string;
  params: RouteParams;
  count: number;
  results: T[];
}

export interface RoasByChannelRow {
  platform: string;
  total_spend: number;
  total_revenue: number;
  total_conversions: number;
  roas: number;
  cpa: number | null;
}

export interface RoasByCampaignRow {
  platform: string;
  campaign_type: string;
  industry: string;
  country: string;
  total_spend: number;
  total_revenue: number;
  total_conversions: number;
  roas: number;
  cpa: number | null;
}

export interface UnderperformerRow {
  platform: string;
  campaign_type: string;
  industry: string;
  country: string;
  total_spend: number;
  total_revenue: number;
  roas: number;
  median_spend: number;
  median_roas: number;
  roas_gap_below_median: number;
}

export interface RollingRoasRow {
  platform: string;
  event_date: string;
  daily_spend: number;
  daily_revenue: number;
  rolling_7d_roas: number | null;
}

export interface WowEfficiencyRow {
  platform: string;
  week_start: string;
  weekly_spend: number;
  weekly_revenue: number;
  weekly_roas: number;
  prior_week_roas: number | null;
  roas_wow_pct_change: number | null;
}

export interface QueryParams {
  startDate: string;
  endDate: string;
  channel: Channel | null;
}
