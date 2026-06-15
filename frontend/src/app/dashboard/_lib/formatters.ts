export function fmt(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return '—';
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-S/ ${abs}` : `S/ ${abs}`;
}

export function pct(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return `${n.toFixed(1)}%`;
}

export function fmtDays(n: number): string { return `${Math.round(n)} días`; }

export function fmtX(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return `${n.toFixed(1)}x`;
}

export function yoyPct(curr: number, prev: number): number {
  if (!prev || prev === 0) return 0;
  return ((curr - prev) / Math.abs(prev)) * 100;
}
