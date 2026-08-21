import React from 'react';
import { SortState } from '../_lib/sort';

export function SortTh({ label, col, sort, onSort, style }: {
  label: string; col: string; sort: SortState; onSort: (col: string) => void; style?: React.CSSProperties;
}) {
  const active = sort.col === col;
  return (
    <th aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} style={style}>
      <button
        type="button"
        onClick={() => onSort(col)}
        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', userSelect: 'none' }}
      >
        {label}{' '}
        <span style={{ fontSize: '0.6rem', opacity: active ? 0.9 : 0.28 }} aria-hidden="true">
          {active ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}
