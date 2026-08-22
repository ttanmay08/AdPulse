import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: string;
  subtext?: string;
  accent?: 'neutral' | 'critical';
  icon?: ReactNode;
}

export function KpiCard({ label, value, subtext, accent = 'neutral', icon }: Props) {
  const accentColor = accent === 'critical' ? 'var(--status-critical)' : 'var(--text-primary)';
  return (
    <div
      className="flex flex-col gap-2 rounded-2xl border p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{
              background: accent === 'critical' ? 'color-mix(in srgb, var(--status-critical) 14%, transparent)' : 'color-mix(in srgb, var(--series-1) 12%, transparent)',
              color: accent === 'critical' ? 'var(--status-critical)' : 'var(--series-1)',
            }}
          >
            {icon}
          </span>
        )}
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
      </div>
      <div className="font-display text-3xl font-semibold" style={{ color: accentColor }}>
        {value}
      </div>
      {subtext && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {subtext}
        </p>
      )}
    </div>
  );
}
