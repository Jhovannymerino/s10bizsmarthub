'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { API, MESES } from '../../_lib/constants';
import { fmt } from '../../_lib/formatters';
import { SortState, sortRows, toggleSort, searchRows } from '../../_lib/sort';
import { SortTh, searchInputStyle } from '../../_lib/SortTh';
import { DocPreview } from './DocPreview';

export function TransactionModal({ companyId, year, codCuenta, descripcion, onClose }: {
  companyId: string; year: number; codCuenta: string; descripcion: string; onClose: () => void;
}) {
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [mesFilter, setMesFilter] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ col: '', dir: 'asc' });
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const onSort = (col: string) => setSort(s => toggleSort(s, col));

  useEffect(() => {
    setLoading(true);
    setFetchError(false);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const params = new URLSearchParams({ year: String(year), codCuenta });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    fetch(`${API}/kpi/${companyId}/transactions?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    })
      .then(r => r.json())
      .then(d => { setTxns(d.transactions || []); setLoading(false); })
      .catch(() => { setFetchError(true); setLoading(false); })
      .finally(() => clearTimeout(timer));
  }, [companyId, year, codCuenta, retryCount]);

  const mesesPresentes = Array.from(new Set(txns.map((t: any) => t.Mes as number))).sort((a, b) => a - b);
  const byMes = mesFilter ? txns.filter((t: any) => t.Mes === mesFilter) : txns;

  const filtered = useMemo(
    () => sortRows(searchRows(byMes, search), sort.col, sort.dir),
    [byMes, search, sort]
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div style={{ background: '#0D1A2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', maxWidth: '95vw', width: 900, maxHeight: '85vh', overflow: 'auto', padding: '1.5rem' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#F8FAFC' }}>{codCuenta} — {descripcion}</div>
            <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginTop: '0.2rem' }}>Asientos individuales · {filtered.length} movimientos</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#8B97A8' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => setMesFilter(null)} style={btnStyle(mesFilter === null)}>Todos</button>
          {mesesPresentes.map(m => (
            <button key={m} onClick={() => setMesFilter(m)} style={btnStyle(mesFilter === m)}>{MESES[m - 1]}</button>
          ))}
          <input
            type="text" placeholder="Buscar..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={searchInputStyle}
          />
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#8B97A8' }}>Cargando asientos...</div>
        ) : fetchError ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ color: '#EF4444', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Error al cargar los datos. El servidor puede estar ocupado.
            </div>
            <button onClick={() => setRetryCount(c => c + 1)}
              style={{ padding: '0.45rem 1.25rem', background: 'rgba(32,126,131,0.15)', border: '1px solid rgba(32,126,131,0.3)', borderRadius: '0.5rem', color: '#2BB4BB', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
              ↻ Reintentar
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#8B97A8', fontSize: '0.85rem' }}>
            {search ? `Sin resultados para "${search}".` : `Sin asientos para esta cuenta en ${year}.`}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-s10" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <SortTh col="Fecha" label="Fecha" sort={sort} onSort={onSort} />
                  <SortTh col="NroAsiento" label="Nro. Asiento" sort={sort} onSort={onSort} />
                  <SortTh col="Glosa" label="Glosa" sort={sort} onSort={onSort} style={{ minWidth: 260 }} />
                  <SortTh col="Tercero" label="Tercero" sort={sort} onSort={onSort} style={{ minWidth: 160 }} />
                  <SortTh col="Debito" label="Débito" sort={sort} onSort={onSort} />
                  <SortTh col="Credito" label="Crédito" sort={sort} onSort={onSort} />
                  <th>Neto</th>
                  <th>Documento</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t: any, i: number) => {
                  const neto = (t.Debito || 0) - (t.Credito || 0);
                  return (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap' }}>{t.Fecha}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#2BB4BB' }}>{t.NroAsiento || t.CodUnico || '—'}</td>
                      <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.Glosa}>{t.Glosa || '—'}</td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.Tercero}>{t.Tercero || '—'}</td>
                      <td style={{ color: t.Debito > 0 ? '#10B981' : '#8B97A8' }}>{t.Debito > 0 ? fmt(t.Debito) : '—'}</td>
                      <td style={{ color: t.Credito > 0 ? '#EF4444' : '#8B97A8' }}>{t.Credito > 0 ? fmt(t.Credito) : '—'}</td>
                      <td style={{ fontWeight: 600, color: neto < 0 ? '#EF4444' : '#10B981' }}>{fmt(neto)}</td>
                      <td>
                        {t.NroD ? (
                          <button onClick={() => setDocPreview(String(t.NroD))}
                            title={String(t.NroD)}
                            style={{ padding: '0.15rem 0.55rem', borderRadius: '0.75rem', border: '1px solid rgba(43,180,187,0.35)', background: 'rgba(43,180,187,0.08)', color: '#2BB4BB', fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                            🔗 {String(t.NroD).slice(-8)}
                          </button>
                        ) : <span style={{ color: '#4B5563', fontSize: '0.7rem' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={4}>TOTAL</td>
                  <td>{fmt(totalDeb)}</td>
                  <td>{fmt(totalCred)}</td>
                  <td style={{ color: (totalDeb - totalCred) < 0 ? '#EF4444' : '#10B981' }}>{fmt(totalDeb - totalCred)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {docPreview !== null && (
          <DocPreview companyId={companyId} nroD={docPreview} onClose={() => setDocPreview(null)} />
        )}
      </div>
    </div>
  );
}
