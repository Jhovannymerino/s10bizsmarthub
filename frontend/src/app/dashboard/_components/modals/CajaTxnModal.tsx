'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { API, MESES } from '../../_lib/constants';
import { fmt } from '../../_lib/formatters';
import { SortState, sortRows, toggleSort, searchRows } from '../../_lib/sort';
import { SortTh, searchInputStyle } from '../../_lib/SortTh';
import { DocPreview } from './DocPreview';

function AsientoCompletoPanel({ companyId, year, nroAsiento, onClose }: {
  companyId: string; year: number; nroAsiento: string; onClose: () => void;
}) {
  const [lineas, setLineas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const params = new URLSearchParams({ year: String(year), nroAsiento });
    fetch(`${API}/kpi/${companyId}/caja-asiento-lineas?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setLineas(d.lineas || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId, year, nroAsiento]);

  const totalDeb = lineas.reduce((s, t) => s + (t.Debito || 0), 0);
  const totalCred = lineas.reduce((s, t) => s + (t.Credito || 0), 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div style={{ background: '#0D1A2D', border: '1px solid rgba(43,180,187,0.3)', borderRadius: '0.75rem', maxWidth: '90vw', width: 780, maxHeight: '80vh', overflow: 'auto', padding: '1.5rem' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC' }}>Asiento N° {nroAsiento}</div>
            <div style={{ fontSize: '0.75rem', color: '#8B97A8', marginTop: '0.15rem' }}>Partida doble completa — todas las cuentas de este asiento</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#8B97A8' }}>✕</button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>Cargando...</div>
        ) : lineas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8', fontSize: '0.85rem' }}>
            Sin datos disponibles. Ejecuta una sincronización para cargar el asiento completo.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-s10" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th>Cuenta</th><th style={{ minWidth: 200 }}>Descripción</th>
                  <th style={{ minWidth: 200 }}>Glosa</th><th>Tercero</th>
                  <th>Débito</th><th>Crédito</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((t: any, i: number) => (
                  <tr key={i} style={{ background: t.Clase === '10' ? 'rgba(43,180,187,0.07)' : undefined }}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: t.Clase === '10' ? '#2BB4BB' : '#F8FAFC' }}>{t.CodCuenta}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.DesCuenta}>{t.DesCuenta || '—'}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#8B97A8' }} title={t.Glosa}>{t.Glosa || '—'}</td>
                    <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.72rem' }}>{t.Tercero || '—'}</td>
                    <td style={{ color: t.Debito > 0 ? '#10B981' : '#8B97A8' }}>{t.Debito > 0 ? fmt(t.Debito) : '—'}</td>
                    <td style={{ color: t.Credito > 0 ? '#EF4444' : '#8B97A8' }}>{t.Credito > 0 ? fmt(t.Credito) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={4}>TOTAL</td>
                  <td>{fmt(totalDeb)}</td>
                  <td>{fmt(totalCred)}</td>
                </tr>
                {Math.abs(totalDeb - totalCred) > 0.01 && (
                  <tr>
                    <td colSpan={6} style={{ color: '#F87171', fontSize: '0.72rem', textAlign: 'center', padding: '0.5rem' }}>
                      ⚠️ Descuadre: {fmt(Math.abs(totalDeb - totalCred))}
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function CajaTxnModal({ companyId, year, codBanco, desBanco, onClose }: {
  companyId: string; year: number; codBanco: string; desBanco: string; onClose: () => void;
}) {
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [mesFilter, setMesFilter] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ col: '', dir: 'asc' });
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [asientoCompleto, setAsientoCompleto] = useState<string | null>(null);
  const onSort = (col: string) => setSort(s => toggleSort(s, col));

  useEffect(() => {
    setLoading(true);
    setFetchError(false);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const params = new URLSearchParams({ year: String(year), codCuenta: codBanco });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    fetch(`${API}/kpi/${companyId}/caja-transactions?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    })
      .then(r => r.json())
      .then(d => { setTxns(d.transactions || []); setLoading(false); })
      .catch(() => { setFetchError(true); setLoading(false); })
      .finally(() => clearTimeout(timer));
  }, [companyId, year, codBanco, retryCount]);

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
    <>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div style={{ background: '#0D1A2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', maxWidth: '95vw', width: 1020, maxHeight: '85vh', overflow: 'auto', padding: '1.5rem' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#F8FAFC' }}>{codBanco} — {desBanco}</div>
            <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginTop: '0.2rem' }}>
              Movimientos clase 10 · {year} · {filtered.length} asientos · clic en Nro. Asiento para ver partida doble completa
            </div>
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
          <div style={{ textAlign: 'center', padding: '3rem', color: '#8B97A8' }}>Cargando movimientos...</div>
        ) : fetchError ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ color: '#EF4444', fontSize: '0.85rem', marginBottom: '1rem' }}>Error al cargar los datos.</div>
            <button onClick={() => setRetryCount(c => c + 1)}
              style={{ padding: '0.45rem 1.25rem', background: 'rgba(32,126,131,0.15)', border: '1px solid rgba(32,126,131,0.3)', borderRadius: '0.5rem', color: '#2BB4BB', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
              ↻ Reintentar
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#8B97A8', fontSize: '0.85rem' }}>
            {search ? `Sin resultados para "${search}".` : `Sin movimientos para esta cuenta bancaria en ${year}.`}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-s10" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <SortTh col="Fecha" label="Fecha" sort={sort} onSort={onSort} />
                  <SortTh col="NroAsiento" label="Nro. Asiento" sort={sort} onSort={onSort} />
                  <SortTh col="Glosa" label="Glosa" sort={sort} onSort={onSort} style={{ minWidth: 240 }} />
                  <SortTh col="Tercero" label="Tercero" sort={sort} onSort={onSort} style={{ minWidth: 120 }} />
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
                      <td>
                        <button
                          onClick={e => { e.stopPropagation(); setAsientoCompleto(String(t.NroAsiento)); }}
                          title="Ver asiento completo (partida doble)"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2BB4BB', fontFamily: 'monospace', fontSize: '0.72rem', padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                          {t.NroAsiento}
                        </button>
                      </td>
                      <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.Glosa}>{t.Glosa || '—'}</td>
                      <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.72rem' }}>{t.Tercero || '—'}</td>
                      <td style={{ color: t.Debito > 0 ? '#10B981' : '#8B97A8' }}>{t.Debito > 0 ? fmt(t.Debito) : '—'}</td>
                      <td style={{ color: t.Credito > 0 ? '#EF4444' : '#8B97A8' }}>{t.Credito > 0 ? fmt(t.Credito) : '—'}</td>
                      <td style={{ fontWeight: 600, color: neto < 0 ? '#EF4444' : '#10B981' }}>{fmt(neto)}</td>
                      <td>
                        {t.NroD ? (
                          <button onClick={e => { e.stopPropagation(); setDocPreview(String(t.NroD)); }}
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
      </div>
    </div>
    {docPreview !== null && (
      <DocPreview companyId={companyId} nroD={docPreview} onClose={() => setDocPreview(null)} />
    )}
    {asientoCompleto !== null && (
      <AsientoCompletoPanel companyId={companyId} year={year} nroAsiento={asientoCompleto} onClose={() => setAsientoCompleto(null)} />
    )}
    </>
  );
}
