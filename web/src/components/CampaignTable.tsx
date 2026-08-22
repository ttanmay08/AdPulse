import { useState } from 'react';
import type { ReactNode } from 'react';
import { CHANNEL_COLOR } from '../lib/colors';
import { formatCurrency, formatRoas } from '../lib/format';
import type { Channel, RoasByCampaignRow } from '../types';

interface Props {
  rows: RoasByCampaignRow[];
  flagged: Set<RoasByCampaignRow>;
}

const PAGE_SIZE = 10;

export function CampaignTable({ rows, flagged }: Props) {
  const [page, setPage] = useState(0);
  const [rowsForPage, setRowsForPage] = useState(rows);
  if (rows !== rowsForPage) {
    setRowsForPage(rows);
    setPage(0);
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
              <Th>Campaign segment</Th>
              <Th align="right">Spend</Th>
              <Th align="right">Revenue</Th>
              <Th align="right">ROAS</Th>
              <Th align="center">Flag</Th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const isFlagged = flagged.has(row);
              const key = `${row.platform}|${row.campaign_type}|${row.industry}|${row.country}`;
              return (
                <tr
                  key={key}
                  className="border-b transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                  style={{ borderColor: 'var(--gridline)' }}
                >
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CHANNEL_COLOR[row.platform as Channel] }} />
                      <div>
                        <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {row.platform} · {row.campaign_type}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {row.industry} · {row.country}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(row.total_spend)}
                  </td>
                  <td className="py-3 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(row.total_revenue)}
                  </td>
                  <td
                    className="py-3 text-right font-semibold tabular-nums"
                    style={{ color: isFlagged ? 'var(--status-critical)' : 'var(--text-primary)' }}
                  >
                    {formatRoas(row.roas)}
                  </td>
                  <td className="py-3 text-center">
                    {isFlagged && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{ background: 'color-mix(in srgb, var(--status-critical) 14%, transparent)', color: 'var(--status-critical)' }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2 1 21h22L12 2zm0 6 6.5 11h-13L12 8zm-1 3v4h2v-4h-2zm0 5v2h2v-2h-2z" />
                        </svg>
                        Wasted spend
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>
          {rows.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min(rows.length, (page + 1) * PAGE_SIZE)} of {rows.length} segments,
          worst ROAS first
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-md border px-2.5 py-1 font-medium disabled:opacity-40"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Prev
          </button>
          <span>
            Page {page + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            className="rounded-md border px-2.5 py-1 font-medium disabled:opacity-40"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      className="py-2 text-xs font-semibold uppercase tracking-wide"
      style={{ color: 'var(--text-muted)', textAlign: align }}
    >
      {children}
    </th>
  );
}
