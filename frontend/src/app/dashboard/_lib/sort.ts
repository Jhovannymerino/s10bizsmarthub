export type SortState = { col: string; dir: 'asc' | 'desc' };

export function sortRows<T extends Record<string, any>>(arr: T[], col: string, dir: 'asc' | 'desc'): T[] {
  if (!col) return arr;
  return [...arr].sort((a, b) => {
    const av = a[col] ?? '', bv = b[col] ?? '';
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), 'es');
    return dir === 'asc' ? cmp : -cmp;
  });
}

// 3-state toggle: asc → desc → clear
export function toggleSort(cur: SortState, col: string): SortState {
  if (cur.col !== col) return { col, dir: 'asc' };
  if (cur.dir === 'asc') return { col, dir: 'desc' };
  return { col: '', dir: 'asc' };
}

export function searchRows<T extends Record<string, any>>(arr: T[], q: string): T[] {
  if (!q.trim()) return arr;
  const lower = q.toLowerCase();
  return arr.filter(r =>
    Object.values(r).some(v => v != null && String(v).toLowerCase().includes(lower))
  );
}
