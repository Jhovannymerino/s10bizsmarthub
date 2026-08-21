'use client';
import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { SortState } from './sort';

export function SortTh({ col, label, sort, onSort, style }: {
  col: string;
  label: string;
  sort: SortState;
  onSort: (col: string) => void;
  style?: React.CSSProperties;
}) {
  const active = sort.col === col;
  const dir = active ? sort.dir : null;
  return (
    <th
      aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}
      style={{ whiteSpace: 'nowrap', ...style }}
    >
      <button
        type="button"
        onClick={() => onSort(col)}
        title={`Ordenar por ${label}`}
        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', userSelect: 'none', display: 'inline-flex', alignItems: 'center' }}
      >
        {label}
        <span style={{ marginLeft: '0.2rem', opacity: active ? 0.9 : 0.25, display: 'inline-flex', verticalAlign: 'middle' }} aria-hidden="true">
          {dir === 'asc' ? <ChevronUp size={12} /> : dir === 'desc' ? <ChevronDown size={12} /> : <ChevronsUpDown size={12} />}
        </span>
      </button>
    </th>
  );
}

export const searchInputStyle: React.CSSProperties = {
  padding: '0.25rem 0.75rem',
  borderRadius: '1rem',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)',
  color: '#F8FAFC',
  fontSize: '0.78rem',
  outline: 'none',
  width: 200,
};
