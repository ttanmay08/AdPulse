import { useRef, useState } from 'react';
import { DATASET_END, DATASET_START, DATE_RANGE_PRESETS, matchingPresetKey } from '../lib/dateRanges';
import { useClickOutside } from '../hooks/useClickOutside';
import { formatDate } from '../lib/format';

interface Props {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
}

export function DateRangePicker({ startDate, endDate, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(startDate);
  const [customEnd, setCustomEnd] = useState(endDate);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  const presetKey = matchingPresetKey(startDate, endDate);
  const label = presetKey
    ? DATE_RANGE_PRESETS.find((p) => p.key === presetKey)!.label
    : `${formatDate(startDate)} – ${formatDate(endDate)}`;

  function applyCustom() {
    if (customStart && customEnd && customStart <= customEnd) {
      onChange(customStart, customEnd);
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        {label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-50">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border shadow-lg"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
        >
          <div className="py-1.5">
            {DATE_RANGE_PRESETS.map((p) => {
              const selected = p.key === presetKey;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    onChange(p.startDate, p.endDate);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-3.5 py-2 text-left text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {p.label}
                  {selected && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--series-1)" strokeWidth="3">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
          <div className="border-t px-3.5 py-3" style={{ borderColor: 'var(--border)' }}>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Custom range
            </p>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customStart}
                min={DATASET_START}
                max={DATASET_END}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full rounded-md border px-1.5 py-1 text-xs"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}
              />
              <span style={{ color: 'var(--text-muted)' }}>–</span>
              <input
                type="date"
                value={customEnd}
                min={DATASET_START}
                max={DATASET_END}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full rounded-md border px-1.5 py-1 text-xs"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}
              />
            </div>
            <button
              type="button"
              onClick={applyCustom}
              className="mt-2 w-full rounded-md py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--series-1)' }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
