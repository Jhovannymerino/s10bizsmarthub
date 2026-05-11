export type SortState = { col: string; dir: 'asc' | 'desc' };

export function sortRows<T extends Record<string, any>>(arr: T[], col: string, dir: 'asc' | 'desc'): T[] {
  return [...arr].sort((a, b) => {
    const av = a[col] ?? 0, bv = b[col] ?? 0;
    const cmp = typeof av === 'string' ? av.localeCompare(bv, 'es') : (av as number) - (bv as number);
    return dir === 'asc' ? cmp : -cmp;
  });
}

export function toggleSort(cur: SortState, col: string): SortState {
  return cur.col === col
    ? { col, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
    : { col, dir: 'desc' };
}
