'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Link2 } from 'lucide-react';
import { API } from '../../_lib/constants';
import { fmt } from '../../_lib/formatters';
import { SortState, sortRows, toggleSort, searchRows } from '../../_lib/sort';
import { SortTh, searchInputStyle } from '../../_lib/SortTh';
import { DocPreview } from './DocPreview';

export function CxCTransactionModal({ companyId, year, cliente, codCliente, onClose }: {
  companyId: string; year: number; cliente: string; codCliente: string; onClose: () => void;
}) {
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [anioFilter, setAnioFilter] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ col: '', dir: 'asc' });
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const onSort = (col: string) => setSort(s => toggleSort(s, col));
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => { modalRef.current?.focus(); }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const params = new URLSearchParams({ year: String(year), codTercero: String(codCliente) });
    fetch(`${API}/kpi/${companyId}/cxc-transactions?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setTxns(d.transactions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId, year, codCliente]);

  const aniosPresentes = Array.from(new Set(txns.map((t: any) => t.Anio as number))).sort((a, b) => b - a);
  const byAnio = anioFilter ? txns.filter((t: any) => t.Anio === anioFilter) : txns;

  const filtered = useMemo(
    () => sortRows(searchRows(byAnio, search), sort.col, sort.dir),
    [byAnio, search, sort]
  );

  const totalDeb = filtered.reduce((s: number, t: any) => s + (t.Debito || 0), 0);
  const totalCred = filtered.reduce((s: number, t: any) => s + (t.Credito || 0), 0);

  const btnStyle = (active: boolean) => ({
    padding: '0.25rem 0.75rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.78rem',
    border: active ? '1px solid rgba(32,126,131,0.5)' : '1px solid rgba(255,255,255,0.1)',
    background: active ? 'rgba(32,126,131,0.2)' : 'rgba(255,255,255,0.04)',
    color: active ? '#2BB4BB' : '#8B97A8',
  });

  return (
    <>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="cxc-txn-modal-title" tabIndex={-1}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        style={{ background: '#0D1A2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', maxWidth: '95vw', width: 1020, maxHeight: '85vh', overflow: 'auto', padding: '1.5rem', outline: 'none' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div id="cxc-txn-modal-title" style={{ fontWeight: 700, fontSize: '1rem', color: '#F8FAFC' }}>{cliente}</div>
            <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginTop: '0.2rem' }}>Movimientos clase 12 (CxC) · {filtered.length} asientos · <Link2 size={11} aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle' }} /> = doc. origen</div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#8B97A8', display: 'flex' }}><X size={18} aria-hidden="true" /></button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => setAnioFilter(null)} style={btnStyle(anioFilter === null)}>Todos</button>
          {aniosPresentes.map(a => (
            <button key={a} onClick={() => setAnioFilter(a)} style={btnStyle(anioFilter === a)}>{a}</button>
          ))}
          <input
            type="text" placeholder="Buscar..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={searchInputStyle}
          />
        </div>
        {loading ? <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>Cargando...</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-s10" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <SortTh col="Fecha" label="Fecha" sort={sort} onSort={onSort} />
                  <SortTh col="NroAsiento" label="Nro. Asiento" sort={sort} onSort={onSort} />
                  <SortTh col="CodCuenta" label="Cuenta" sort={sort} onSort={onSort} />
                  <SortTh col="Glosa" label="Glosa" sort={sort} onSort={onSort} style={{ minWidth: 240 }} />
                  <SortTh col="Debito" label="Débito" sort={sort} onSort={onSort} />
                  <SortTh col="Credito" label="Crédito" sort={sort} onSort={onSort} />
                  <th>Neto</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t: any, i: number) => {
                  const neto = (t.Debito || 0) - (t.Credito || 0);
                  return (
                    <tr key={i}>
                      <td style={{ textAlign: 'center', padding: '0 0.25rem' }}>
                        {t.NroD
                          ? <button onClick={e => { e.stopPropagation(); setDocPreview(String(t.NroD)); }}
                              title="Ver documento origen" aria-label="Ver documento origen"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2BB4BB', fontSize: '0.9rem', padding: 0, lineHeight: 1, display: 'flex' }}><Link2 size={14} aria-hidden="true" /></button>
                          : <span style={{ color: '#4B5563', fontSize: '0.75rem' }}>—</span>
                        }
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{t.Fecha}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{t.NroAsiento}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#2BB4BB' }}>{t.CodCuenta}</td>
                      <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.Glosa}>{t.Glosa || '—'}</td>
                      <td style={{ color: t.Debito > 0 ? '#10B981' : '#8B97A8' }}>{t.Debito > 0 ? fmt(t.Debito) : '—'}</td>
                      <td style={{ color: t.Credito > 0 ? '#EF4444' : '#8B97A8' }}>{t.Credito > 0 ? fmt(t.Credito) : '—'}</td>
                      <td style={{ fontWeight: 600, color: neto < 0 ? '#EF4444' : '#10B981' }}>{fmt(neto)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={5}>TOTAL</td>
                  <td>{fmt(totalDeb)}</td>
                  <td>{fmt(totalCred)}</td>
                  <td style={{ color: (totalDeb - totalCred) < 0 ? '#EF4444' : '#10B981' }}>{fmt(totalDeb - totalCred)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
    {docPreview && <DocPreview companyId={companyId} nroD={docPreview} onClose={() => setDocPreview(null)} />}
    </>
  );
}
