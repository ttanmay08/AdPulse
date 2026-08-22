import { useRef, useState } from 'react';
import { CHANNELS } from '../types';
import type { Channel } from '../types';
import { useClickOutside } from '../hooks/useClickOutside';
import { CHANNEL_COLOR } from '../lib/colors';

interface Props {
  channel: Channel | null;
  onChange: (channel: Channel | null) => void;
}

const SWATCH = CHANNEL_COLOR;

export function ChannelFilter({ channel, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
      >
        {channel && <span className="h-2 w-2 rounded-full" style={{ background: SWATCH[channel] }} />}
        {channel ?? 'All channels'}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-50">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border py-1.5 shadow-lg"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
        >
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="flex w-full items-center justify-between px-3.5 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: 'var(--text-primary)' }}
          >
            All channels
            {channel === null && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--series-1)" strokeWidth="3">
                <path d="M5 12l5 5L20 7" />
              </svg>
            )}
          </button>
          {CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: 'var(--text-primary)' }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: SWATCH[c] }} />
              <span className="flex-1">{c}</span>
              {channel === c && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--series-1)" strokeWidth="3">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
