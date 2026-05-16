'use client';
import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MESES } from '../../_lib/constants';
import { fmt, pct } from '../../_lib/formatters';
import { SortState, sortRows, toggleSort } from '../../_lib/sort';
import { SortTh } from '../../_lib/SortTh';
import { TransactionModal } from './TransactionModal';

export function GavCategoryModal({ companyId, year, cat, onClose }: {
  companyId: string; year: number;
  cat: { cod: string; descripcion: string; meses: Record<number, number>; ytd: number };
  onClose: () => void;
}) {
  const [txDrill, setTxDrill] = useState(false);
  const [sort, setSort] = useState<SortState>({ col: '', dir: 'asc' });
  const onSort = (col: string) => setSort(s => toggleSort(s, col));

  const mesesConDatos = Object.entries(cat.meses)
    .filter(([, v]) => (v as number) !== 0)
    .map(([k]) => parseInt(k))
    .sort((a, b) => a - b);
  const chartData = mesesConDatos.map(m => ({ mes: MESES[m - 1], value: cat.meses[m] || 0 }));

  const tableRows = useMemo(() => {
    const rows = mesesConDatos.map(m => ({ _mes: m, mes: MESES[m - 1], importe: cat.meses[m] || 0, pctYtd: cat.ytd > 0 ? ((cat.meses[m] || 0) / cat.ytd) * 100 : 0 }));
    return sort.col ? sortRows(rows, sort.col, sort.dir) : rows;
  }, [mesesConDatos, sort]);

  if (txDrill) {
    return <TransactionModal companyId={companyId} year={year} codCuenta={cat.cod} descripcion={cat.descripcion} onClose={() => setTxDrill(false)} />;
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div style={{ background: '#0D1A2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', maxWidth: '95vw', width: 720, maxHeight: '85vh', overflow: 'auto', padding: '1.5rem' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#F8FAFC' }}>{cat.cod} — {cat.descripcion}</div>
            <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginTop: '0.2rem' }}>GAV mensual · YTD: {fmt(cat.ytd)}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#8B97A8' }}>✕</button>
        </div>
        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#8B97A8' }} />
              <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: '#8B97A8' }} />
              <Tooltip formatter={(v: number) => [fmt(v), 'GAV']} />
              <Bar dataKey="value" fill="#207E83" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <table className="table-s10" style={{ marginTop: '1rem' }}>
          <thead>
            <tr>
              <SortTh col="mes" label="Mes" sort={sort} onSort={onSort} />
              <SortTh col="importe" label="Importe" sort={sort} onSort={onSort} />
              <SortTh col="pctYtd" label="% YTD" sort={sort} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {tableRows.map(row => (
              <tr key={row._mes}>
                <td>{row.mes}</td>
                <td>{fmt(row.importe)}</td>
                <td style={{ color: '#8B97A8' }}>{cat.ytd > 0 ? pct(row.pctYtd) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total-row"><td>TOTAL YTD</td><td>{fmt(cat.ytd)}</td><td>100%</td></tr>
          </tfoot>
        </table>
        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
          <button onClick={() => setTxDrill(true)}
            style={{ padding: '0.45rem 1rem', background: 'rgba(32,126,131,0.15)', border: '1px solid rgba(32,126,131,0.3)', borderRadius: '0.5rem', color: '#2BB4BB', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
            Ver asientos individuales ▶
          </button>
        </div>
      </div>
    </div>
  );
}
