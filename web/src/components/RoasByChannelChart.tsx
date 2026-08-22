import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { CHANNEL_COLOR } from '../lib/colors';
import { formatCurrency, formatRoas } from '../lib/format';
import type { RoasByChannelRow, Channel } from '../types';

interface Props {
  data: RoasByChannelRow[];
}

function ChannelTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload as RoasByChannelRow;
  return (
    <div
      className="rounded-lg border px-3 py-2.5 text-sm shadow-lg"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: CHANNEL_COLOR[row.platform as Channel] }} />
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          {row.platform}
        </span>
      </div>
      <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-xs">
        <span style={{ color: 'var(--text-secondary)' }}>ROAS</span>
        <span className="text-right font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
          {formatRoas(row.roas)}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>Spend</span>
        <span className="text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>
          {formatCurrency(row.total_spend)}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>Revenue</span>
        <span className="text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>
          {formatCurrency(row.total_revenue)}
        </span>
      </div>
    </div>
  );
}

export function RoasByChannelChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 24, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--gridline)" strokeDasharray="0" />
        <XAxis
          dataKey="platform"
          tickLine={false}
          axisLine={{ stroke: 'var(--baseline)' }}
          tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
          tickFormatter={(v: number) => `${v}x`}
          width={36}
        />
        <Tooltip content={ChannelTooltip} cursor={{ fill: 'var(--gridline)', opacity: 0.4 }} />
        <Bar dataKey="roas" radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={false}>
          {data.map((row) => (
            <Cell key={row.platform} fill={CHANNEL_COLOR[row.platform as Channel]} />
          ))}
          <LabelList
            dataKey="roas"
            position="top"
            formatter={(v: unknown) => `${Number(v).toFixed(2)}x`}
            style={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
