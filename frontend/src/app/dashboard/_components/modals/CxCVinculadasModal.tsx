'use client';
import React, { useMemo, useState } from 'react';
import { fmt } from '../../_lib/formatters';
import { SortState, sortRows, toggleSort, searchRows } from '../../_lib/sort';
import { SortTh, searchInputStyle } from '../../_lib/SortTh';

const fUSD = (v: number) => `$ ${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function getMoneda(d: any): 'USD' | 'PEN' {
  const raw = String(d.Moneda ?? d.CodMoneda ?? '01').trim();
  return raw === '02' || raw === '2' ? 'USD' : 'PEN';
}

function fMon(moneda: 'USD' | 'PEN', v: number) {
  return moneda === 'USD' ? fUSD(v) : fmt(v);
}

export function CxCVinculadasModal({ cliente, docs, onClose }: {
  cliente: string;
  docs: any[];
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ col: '', dir: 'asc' });
  const onSort = (col: string) => setSort(s => toggleSort(s, col));

  const filtered = useMemo(
    () => sortRows(searchRows(docs, search), sort.col, sort.dir),
    [docs, search, sort]
  );

  const totalPEN = filtered.filter(d => getMoneda(d) === 'PEN').reduce((s, d) => s + (d.Saldo ?? 0), 0);
  const totalUSD = filtered.filter(d => getMoneda(d) === 'USD').reduce((s, d) => s + (d.Saldo ?? 0), 0);
  const hasMixed = totalPEN > 0 && totalUSD > 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div style={{ background: '#0D1A2D', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '0.75rem', maxWidth: '95vw', width: 1150, maxHeight: '85vh', overflow: 'auto', padding: '1.5rem' }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#F59E0B' }}>{cliente}</div>
            <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginTop: '0.2rem' }}>
              Cartera Especial · {filtered.length} documento{filtered.length !== 1 ? 's' : ''}
              <span style={{ marginLeft: '0.5rem', padding: '1px 7px', borderRadius: '1rem', background: 'rgba(245,158,11,0.15)', color: '#F59E0B', fontSize: '0.70rem' }}>
                Estado 6 / Vinculada
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#8B97A8' }}>✕</button>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text" placeholder="Buscar..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={searchInputStyle}
          />
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>Sin documentos.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-s10" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <SortTh col="TipoDocumento" label="Tipo" sort={sort} onSort={onSort} />
                  <SortTh col="Numero" label="Serie / N°" sort={sort} onSort={onSort} />
                  <SortTh col="FechaDocumento" label="Fecha Doc." sort={sort} onSort={onSort} />
                  <th style={{ textAlign: 'center' }}>Moneda</th>
                  <SortTh col="Total" label="Total" sort={sort} onSort={onSort} style={{ textAlign: 'right' }} />
                  <SortTh col="Pagado" label="Pagado" sort={sort} onSort={onSort} style={{ textAlign: 'right' }} />
                  <SortTh col="Detraccion" label="Detracción" sort={sort} onSort={onSort} style={{ textAlign: 'right' }} />
                  <SortTh col="Saldo" label="Saldo" sort={sort} onSort={onSort} style={{ textAlign: 'right' }} />
                  <SortTh col="DiasAntiguedad" label="Antigüedad" sort={sort} onSort={onSort} style={{ textAlign: 'right' }} />
                  <SortTh col="Observacion" label="Observación" sort={sort} onSort={onSort} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((d: any, i: number) => {
                  const moneda = getMoneda(d);
                  const isUSD = moneda === 'USD';
                  return (
                    <tr key={i} style={{ background: isUSD ? 'rgba(74,222,128,0.03)' : undefined }}>
                      <td style={{ color: '#8B97A8', fontSize: '0.72rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.TipoDocumento || d.DesTipo}>{d.TipoDocumento || d.DesTipo || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
                        {d.Serie ? `${d.Serie}-${d.Numero}` : d.Numero || '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{d.FechaDocumento}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: '0.70rem', fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                          background: isUSD ? 'rgba(74,222,128,0.15)' : 'rgba(226,92,26,0.15)',
                          color: isUSD ? '#4ade80' : '#E25C1A',
                        }}>
                          {isUSD ? '$ USD' : 'S/ PEN'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{fMon(moneda, d.Total ?? 0)}</td>
                      <td style={{ textAlign: 'right', color: '#8B97A8' }}>{fMon(moneda, d.Pagado ?? 0)}</td>
                      <td style={{ textAlign: 'right', color: (d.Detraccion ?? 0) > 0 ? '#F59E0B' : '#4B5563', fontSize: '0.72rem' }}>
                        {(d.Detraccion ?? 0) > 0 ? fMon(moneda, d.Detraccion) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#F59E0B' }}>
                        {fMon(moneda, d.Saldo ?? 0)}
                      </td>
                      <td style={{ textAlign: 'right', color: (d.DiasAntiguedad ?? 0) > 365 ? '#EF4444' : '#8B97A8', fontSize: '0.72rem' }}>
                        {(d.DiasAntiguedad ?? 0) > 0 ? `${d.DiasAntiguedad}d` : '—'}
                      </td>
                      <td style={{ color: '#8B97A8', fontSize: '0.70rem', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.Observacion}>{d.Observacion || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={7} style={{ textAlign: 'right' }}>SALDO ESPECIAL</td>
                  <td style={{ textAlign: 'right' }}>
                    {hasMixed ? (
                      <>
                        <div>{fmt(totalPEN)}</div>
                        <div style={{ color: '#4ade80', fontSize: '0.72rem' }}>{fUSD(totalUSD)}</div>
                      </>
                    ) : totalUSD > 0 ? fUSD(totalUSD) : fmt(totalPEN)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
