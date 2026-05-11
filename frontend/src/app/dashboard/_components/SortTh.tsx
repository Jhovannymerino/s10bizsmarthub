import React from 'react';
import { SortState } from '../_lib/sort';

export function SortTh({ label, col, sort, onSort, style }: {
  label: string; col: string; sort: SortState; onSort: (col: string) => void; style?: React.CSSProperties;
}) {
  const active = sort.col === col;
  return (
    <th onClick={() => onSort(col)} style={{ cursor: 'pointer', userSelect: 'none', ...style }}>
      {label}{' '}
      <span style={{ fontSize: '0.6rem', opacity: active ? 0.9 : 0.28 }}>
        {active ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </th>
  );
}
