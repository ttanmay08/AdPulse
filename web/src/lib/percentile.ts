/**
 * Mirror Postgres NUMERIC ROUND(): half away from zero. JS's Math.round is
 * "half up" (toward +Infinity), which disagrees with Postgres on negative
 * .5 ties (e.g. -2.5), so every rounding in this codebase goes through this
 * instead — see scripts/generate_dashboard_sample_data.py's round_half_away
 * for the Python-side mirror.
 */
export function roundHalfAway(x: number, digits: number): number {
  const factor = 10 ** digits;
  return (Math.sign(x) * Math.floor(Math.abs(x) * factor + 0.5)) / factor;
}

/** Linear-interpolation percentile, matching Postgres PERCENTILE_CONT. */
export function percentileCont(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return NaN;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const rank = q * (sortedAsc.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sortedAsc[lo];
  const frac = rank - lo;
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * frac;
}
