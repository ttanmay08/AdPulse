import type { Channel } from '../types';

/** Fixed categorical assignment — never cycled, never re-derived from rank. */
export const CHANNEL_COLOR: Record<Channel, string> = {
  'Google Ads': 'var(--series-1)',
  'Meta Ads': 'var(--series-2)',
  'TikTok Ads': 'var(--series-3)',
};
