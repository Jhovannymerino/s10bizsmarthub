'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Link2, RotateCcw, ScrollText } from 'lucide-react';
import { API, MESES } from '../../_lib/constants';
import { fmt } from '../../_lib/formatters';
import { SortState, sortRows, toggleSort, searchRows } from '../../_lib/sort';
import { SortTh, searchInputStyle } from '../../_lib/SortTh';
import { DocPreview } from './DocPreview';
import { MayorModal, MayorFiltro } from './MayorModal';

export function AccountTxnModal({ companyId, year, codCuenta, descripcion, endpoint, codTercero, yearOverride, mesPreset, onClose }: {
  companyId: string; year: number; codCuenta: string; descripcion: string; endpoint: string; codTercero?: string; yearOverride?: number; mesPreset?: number; onClose: () => void;
}) {
  const fetchYear = yearOverride ?? year;
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [mesFilter, setMesFilter] = useState<number | null>(mesPreset ?? null);
  const [anioFilter, setAnioFilter] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ col: '', dir: 'asc' });
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [showMayor, setShowMayor] = useState(false);
  const onSort = (col: string) => setSort(s => toggleSort(s, col));

  // codCuenta puede ser clase (2), grupo (4) o cuenta completa — mapear al filtro correcto del mayor.
  const mayorFiltro: MayorFiltro = (() => {
    const f: MayorFiltro = {};
    const cc = String(codCuenta || '');
    if (cc.length <= 2) f.clase = cc;
    else if (cc.length <= 4) f.grupo = cc;
    else f.cuenta = cc;
    if (codTercero) f.tercero = codTercero;
    if (mesFilter) f.mes = mesFilter;
    return f;
  })();
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => { modalRef.current?.focus(); }, []);

  useEffect(() => {
    setLoading(true); setFetchError(false);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const params = new URLSearchParams({ year: String(fetchYear), codCuenta });
    if (codTercero) params.set('codTercero', codTercero);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    fetch(`${API}/kpi/${companyId}/${endpoint}?${params}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal,
    })
      .then(r => r.json())
      .then(d => { setTxns(d.transactions || []); setLoading(false); })
      .catch(() => { setFetchError(true); setLoading(false); })
      .finally(() => clearTimeout(timer));
  }, [companyId, fetchYear, codCuenta, codTercero, endpoint, retryCount]);

  const isActivoFijo = endpoint === 'activo-fijo-transactions';
  const aniosPresentes = isActivoFijo ? Array.from(new Set(txns.map((t: any) => t.Anio as number))).sort((a, b) => b - a) : [];
  const mesesPresentes = Array.from(new Set(txns.map((t: any) => t.Mes as number))).sort((a, b) => a - b);

  const byFilters = txns
    .filter((t: any) => !anioFilter || t.Anio === anioFilter)
    .filter((t: any) => !mesFilter || t.Mes === mesFilter);

  const filtered = useMemo(
    () => sortRows(searchRows(byFilters, search), sort.col, sort.dir),
    [byFilters, search, sort]
  );

  const totalDeb = filtered.reduce((s: number, t: any) => s + (t.Debito || 0), 0);
  const totalCred = filtered.reduce((s: number, t: any) => s + (t.Credito || 0), 0);

  const btnStyle = (active: boolean, accent?: string) => ({
    padding: '0.25rem 0.75rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.78rem',
    border: active ? `1px solid ${accent ? 'rgba(226,92,26,0.5)' : 'rgba(32,126,131,0.5)'}` : '1px solid rgba(255,255,255,0.1)',
    background: active ? (accent ? 'rgba(226,92,26,0.15)' : 'rgba(32,126,131,0.2)') : 'rgba(255,255,255,0.04)',
    color: active ? (accent ? '#E25C1A' : '#2BB4BB') : '#8B97A8',
  });

  return (
  <>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={onClose}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="account-txn-modal-title" tabIndex={-1}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        style={{ background: '#0D1A2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', maxWidth: '95vw', width: 960, maxHeight: '85vh', overflow: 'auto', padding: '1.5rem', outline: 'none' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div id="account-txn-modal-title" style={{ fontWeight: 700, fontSize: '1rem', color: '#F8FAFC' }}>{codCuenta} — {descripcion}</div>
            <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginTop: '0.2rem' }}>Asientos individuales · {fetchYear} · {filtered.length} movimientos · <Link2 size={11} aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle' }} /> = doc. origen</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button onClick={() => setShowMayor(true)}
              title="Ver estas líneas en el libro mayor"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.7rem', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, border: '1px solid rgba(43,180,187,0.4)', background: 'rgba(43,180,187,0.12)', color: '#2BB4BB' }}>
              <ScrollText size={13} aria-hidden="true" /> Ver en el Mayor
            </button>
            <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#8B97A8', display: 'flex' }}><X size={18} aria-hidden="true" /></button>
          </div>
        </div>
        {isActivoFijo && aniosPresentes.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: '#6B7280', marginRight: '0.25rem' }}>Año:</span>
            <button onClick={() => setAnioFilter(null)} style={btnStyle(anioFilter === null, 'orange')}>Todos</button>
            {aniosPresentes.map(a => (
              <button key={a} onClick={() => setAnioFilter(a)} style={btnStyle(anioFilter === a, 'orange')}>{a}</button>
            ))}
          </div>
        )}
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
        {loading ? <div style={{ textAlign: 'center', padding: '3rem', color: '#8B97A8' }}>Cargando asientos...</div>
        : fetchError ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ color: '#EF4444', fontSize: '0.85rem', marginBottom: '1rem' }}>Error al cargar los datos.</div>
            <button onClick={() => setRetryCount(c => c + 1)} style={{ padding: '0.45rem 1.25rem', background: 'rgba(32,126,131,0.15)', border: '1px solid rgba(32,126,131,0.3)', borderRadius: '0.5rem', color: '#2BB4BB', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><RotateCcw size={13} aria-hidden="true" /> Reintentar</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#8B97A8', fontSize: '0.85rem' }}>
            {search ? `Sin resultados para "${search}".` : isActivoFijo
              ? (anioFilter || mesFilter ? 'Sin movimientos con los filtros seleccionados.' : 'Sin movimientos históricos para esta cuenta.')
              : `Sin asientos para esta cuenta en ${fetchYear}.`
            }
          </div>
        )
        : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-s10" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <SortTh col="Fecha" label="Fecha" sort={sort} onSort={onSort} />
                  <SortTh col="NroAsiento" label="Asiento S10" sort={sort} onSort={onSort} style={{ cursor: 'pointer' }} />
                  <SortTh col="Glosa" label="Glosa" sort={sort} onSort={onSort} style={{ minWidth: 240 }} />
                  <SortTh col="Tercero" label="Tercero" sort={sort} onSort={onSort} style={{ minWidth: 140 }} />
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
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#2BB4BB' }}>{t.NroAsiento || t.CodUnico || '—'}</td>
                      <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.Glosa}>{t.Glosa || '—'}</td>
                      <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.Tercero || '—'}</td>
                      <td style={{ color: t.Debito > 0 ? '#10B981' : '#8B97A8' }}>{t.Debito > 0 ? fmt(t.Debito) : '—'}</td>
                      <td style={{ color: t.Credito > 0 ? '#EF4444' : '#8B97A8' }}>{t.Credito > 0 ? fmt(t.Credito) : '—'}</td>
                      <td style={{ fontWeight: 600, color: neto < 0 ? '#EF4444' : '#10B981' }}>{fmt(neto)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr className="total-row"><td colSpan={5}>TOTAL</td><td>{fmt(totalDeb)}</td><td>{fmt(totalCred)}</td><td style={{ color: (totalDeb - totalCred) < 0 ? '#EF4444' : '#10B981' }}>{fmt(totalDeb - totalCred)}</td></tr></tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
    {docPreview && <DocPreview companyId={companyId} nroD={docPreview} onClose={() => setDocPreview(null)} />}
    {showMayor && (
      <MayorModal
        companyId={companyId}
        year={fetchYear}
        filtro={mayorFiltro}
        titulo={`${codCuenta} — ${descripcion}`}
        onClose={() => setShowMayor(false)}
      />
    )}
  </>
  );
}
