import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getRoasByCampaign, getRoasByChannel, getWowEfficiency } from './lib/api';
import { deriveStrictUnderperformers } from './lib/derive';
import { formatCompactCurrency, formatRoas } from './lib/format';
import { DATE_RANGE_PRESETS } from './lib/dateRanges';
import { IS_SAMPLE_MODE } from './config';
import { KpiCard } from './components/KpiCard';
import { DateRangePicker } from './components/DateRangePicker';
import { ChannelFilter } from './components/ChannelFilter';
import { RoasByChannelChart } from './components/RoasByChannelChart';
import { SpendRevenueTrendChart } from './components/SpendRevenueTrendChart';
import { CampaignTable } from './components/CampaignTable';
import type { Channel, RoasByCampaignRow, RoasByChannelRow, WowEfficiencyRow } from './types';

const fullYear = DATE_RANGE_PRESETS[0];

interface DashboardData {
  roasByChannel: RoasByChannelRow[];
  roasByCampaign: RoasByCampaignRow[];
  wowEfficiency: WowEfficiencyRow[];
}

function ScorchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2 3 14h7l-1 8 11-14h-7l1-6z" />
    </svg>
  );
}
function DollarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}
function TargetIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

export default function App() {
  const [startDate, setStartDate] = useState(fullYear.startDate);
  const [endDate, setEndDate] = useState(fullYear.endDate);
  const [channel, setChannel] = useState<Channel | null>(null);

  const [data, setData] = useState<DashboardData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsRefreshing(true);
    const params = { startDate, endDate, channel };
    Promise.all([getRoasByChannel(params), getRoasByCampaign(params), getWowEfficiency(params)])
      .then(([roasByChannel, roasByCampaign, wowEfficiency]) => {
        if (cancelled) return;
        setData({ roasByChannel: roasByChannel.results, roasByCampaign: roasByCampaign.results, wowEfficiency: wowEfficiency.results });
        setError(null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setIsRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, channel]);

  const totalSpend = data ? data.roasByChannel.reduce((s, r) => s + r.total_spend, 0) : 0;
  const totalRevenue = data ? data.roasByChannel.reduce((s, r) => s + r.total_revenue, 0) : 0;
  const blendedRoas = totalSpend ? totalRevenue / totalSpend : 0;
  const strict = data ? deriveStrictUnderperformers(data.roasByCampaign) : null;

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-8">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            AdPulse
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Ad spend efficiency across Google, Meta &amp; TikTok
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
          <ChannelFilter channel={channel} onChange={setChannel} />
        </div>
      </header>

      {IS_SAMPLE_MODE && (
        <div
          className="mb-6 rounded-lg border px-3.5 py-2 text-xs"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-muted)' }}
        >
          Running on bundled sample data — the live API is torn down. Set{' '}
          <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">VITE_API_BASE_URL</code> to switch to a real deployment.
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-lg border px-3.5 py-2 text-xs" style={{ borderColor: 'var(--status-critical)', color: 'var(--status-critical)' }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 transition-opacity duration-150 sm:grid-cols-3" style={{ opacity: isRefreshing ? 0.6 : 1 }}>
        <KpiCard label="Total spend" value={data ? formatCompactCurrency(totalSpend) : '—'} subtext={channel ?? 'All channels'} icon={<DollarIcon />} />
        <KpiCard label="Blended ROAS" value={data ? formatRoas(blendedRoas) : '—'} subtext="Revenue ÷ spend, all campaigns" icon={<TargetIcon />} />
        <KpiCard
          label="Flagged wasted spend"
          value={strict ? formatCompactCurrency(strict.totalWastedSpend) : '—'}
          subtext={strict ? `${strict.flagged.length} segments · top-half spend, bottom-quartile ROAS` : undefined}
          accent="critical"
          icon={<ScorchIcon />}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 transition-opacity duration-150 lg:grid-cols-2" style={{ opacity: isRefreshing ? 0.6 : 1 }}>
        <ChartCard title="ROAS by channel" subtitle="Blended return on ad spend">
          {data && <RoasByChannelChart data={data.roasByChannel} />}
        </ChartCard>
        <ChartCard title="Spend vs. revenue" subtitle="Weekly, summed across selected channels">
          {data && <SpendRevenueTrendChart data={data.wowEfficiency} />}
        </ChartCard>
      </div>

      <div className="mt-4 transition-opacity duration-150" style={{ opacity: isRefreshing ? 0.6 : 1 }}>
        <ChartCard title="Campaign segments" subtitle="Platform · type · industry · country, worst offenders first">
          {data && strict && <CampaignTable rows={data.roasByCampaign} flagged={new Set(strict.flagged)} />}
        </ChartCard>
      </div>

      <footer className="mt-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
        <p>AdPulse — Phase 3 dashboard. Data: Kaggle Global Ads Performance dataset, 2024.</p>
        <p className="mt-1">Built by Tanmay Tomar — turning ad spend into decisions</p>
      </footer>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <div className="mb-4">
        <h2 className="font-display text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h2>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {subtitle}
        </p>
      </div>
      {children}
    </div>
  );
}
