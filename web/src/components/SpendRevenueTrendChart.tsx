import { Fragment, useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { formatCompactCurrency, formatCurrency, formatDate } from '../lib/format';
import type { WowEfficiencyRow } from '../types';

interface Props {
  data: WowEfficiencyRow[];
}

interface WeeklyTotal {
  week_start: string;
  spend: number;
  revenue: number;
}

function aggregateByWeek(rows: WowEfficiencyRow[]): WeeklyTotal[] {
  const byWeek = new Map<string, WeeklyTotal>();
  for (const r of rows) {
    let w = byWeek.get(r.week_start);
    if (!w) {
      w = { week_start: r.week_start, spend: 0, revenue: 0 };
      byWeek.set(r.week_start, w);
    }
    w.spend += r.weekly_spend;
    w.revenue += r.weekly_revenue;
  }
  return [...byWeek.values()].sort((a, b) => a.week_start.localeCompare(b.week_start));
}

function TrendTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2.5 text-sm shadow-lg"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
    >
      <div className="mb-1.5 font-semibold" style={{ color: 'var(--text-primary)' }}>
        {formatDate(label as string)}
      </div>
      <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1 text-xs">
        {payload.map((entry) => (
          <Fragment key={String(entry.dataKey ?? entry.name)}>
            <span className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
              <span className="inline-block h-0.5 w-3" style={{ background: entry.color }} />
              {entry.name}
            </span>
            <span className="text-right font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {formatCurrency(entry.value as number)}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function TrendLegend() {
  return (
    <div className="mb-1 flex items-center gap-4 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-3" style={{ background: 'var(--series-1)' }} />
        Spend
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-3" style={{ background: 'var(--series-2)' }} />
        Revenue
      </span>
    </div>
  );
}

export function SpendRevenueTrendChart({ data }: Props) {
  const weekly = useMemo(() => aggregateByWeek(data), [data]);

  return (
    <div>
      <TrendLegend />
      <ResponsiveContainer width="100%" height={252}>
        <LineChart data={weekly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--gridline)" />
          <XAxis
            dataKey="week_start"
            tickLine={false}
            axisLine={{ stroke: 'var(--baseline)' }}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickFormatter={(v: string) => formatDate(v)}
            minTickGap={24}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            tickFormatter={(v: number) => formatCompactCurrency(v)}
            width={48}
          />
          <Tooltip content={TrendTooltip} cursor={{ stroke: 'var(--baseline)', strokeWidth: 1 }} />
          <Legend content={() => null} />
          <Line
            type="monotone"
            dataKey="spend"
            name="Spend"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface-1)' }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="var(--series-2)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface-1)' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
