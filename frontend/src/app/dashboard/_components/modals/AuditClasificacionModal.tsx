'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Check, AlertTriangle } from 'lucide-react';
import { API } from '../../_lib/constants';
import { fmt } from '../../_lib/formatters';
import { SortState, sortRows, toggleSort, searchRows } from '../../_lib/sort';
import { SortTh, searchInputStyle } from '../../_lib/SortTh';

const CAT_CONFIG: Record<string, { label: string; color: string; cuenta: string }> = {
  prestamo:  { label: 'Préstamo',  color: '#F59E0B', cuenta: '→ 45' },
  anticipo:  { label: 'Anticipo',  color: '#8B5CF6', cuenta: '→ 162 / revisar' },
  otro:      { label: 'Otro',      color: '#64748B', cuenta: '→ revisar' },
};

type Tab = 'mal42' | 'en45' | 'en16';

export function AuditClasificacionModal({ companyId, onClose }: {
  companyId: string; onClose: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('mal42');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ col: '', dir: 'asc' });
  const onSort = (col: string) => setSort(s => toggleSort(s, col));
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => { modalRef.current?.focus(); }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    fetch(`${API}/kpi/${companyId}/audit/clasificacion`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId]);

  const base42 = useMemo(() => {
    if (!data?.malClasificados) return [];
    return catFilter === 'all' ? data.malClasificados : data.malClasificados.filter((d: any) => d.categoria === catFilter);
  }, [data, catFilter]);

  const filtered42 = useMemo(
    () => sortRows(searchRows(base42, search), sort.col, sort.dir),
    [base42, search, sort],
  );

  const btnStyle = (active: boolean, color?: string) => ({
    padding: '0.25rem 0.75rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.78rem',
    border: active ? `1px solid ${color ?? 'rgba(32,126,131,0.5)'}` : '1px solid rgba(255,255,255,0.1)',
    background: active ? `${color ?? 'rgba(32,126,131'}20` : 'rgba(255,255,255,0.04)',
    color: active ? (color ?? '#2BB4BB') : '#8B97A8',
  });

  const tabStyle = (active: boolean) => ({
    padding: '0.4rem 1rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: active ? 700 : 400,
    borderBottom: active ? '2px solid #2BB4BB' : '2px solid transparent',
    color: active ? '#2BB4BB' : '#8B97A8', background: 'none', border: 'none',
    borderBottomStyle: 'solid' as const,
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="audit-clas-modal-title" tabIndex={-1}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        style={{ background: '#0D1A2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', maxWidth: '95vw', width: 1100, maxHeight: '88vh', overflow: 'auto', padding: '1.5rem', outline: 'none' }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
          <div>
            <div id="audit-clas-modal-title" style={{ fontWeight: 700, fontSize: '1rem', color: '#F8FAFC' }}>Auditoría de Clasificación Contable</div>
            <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginTop: '0.2rem' }}>
              Documentos en cuenta 42 que no son deuda comercial · Comparado con lo que sí está correctamente en 45 y 162
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#8B97A8', display: 'flex' }}><X size={18} aria-hidden="true" /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '1rem' }}>
          <button style={{ ...tabStyle(tab === 'mal42'), display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }} onClick={() => setTab('mal42')}>
            <AlertTriangle size={13} aria-hidden="true" /> Mal clasificados en cta. 42 {data ? `(${data.malClasificados?.length ?? 0} docs · ${fmt(data.total42Revision ?? 0)})` : ''}
          </button>
          <button style={{ ...tabStyle(tab === 'en45'), display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }} onClick={() => setTab('en45')}>
            <Check size={13} aria-hidden="true" /> Correctamente en cta. 45 {data ? `(${data.en45?.length ?? 0} · ${fmt(data.total45 ?? 0)})` : ''}
          </button>
          <button style={{ ...tabStyle(tab === 'en16'), display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }} onClick={() => setTab('en16')}>
            <Check size={13} aria-hidden="true" /> Correctamente en cta. 16x {data ? `(${data.en16?.length ?? 0} · ${fmt(data.total16 ?? 0)})` : ''}
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#8B97A8' }}>Analizando cuentas...</div>
        ) : !data ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#8B97A8' }}>Sin datos disponibles. Ejecuta una sincronización primero.</div>
        ) : tab === 'mal42' ? (
          <>
            {/* Resumen por categoría */}
            {data.resumen42 && Object.keys(data.resumen42).length > 0 && (
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {Object.entries(data.resumen42).map(([cat, v]: any) => {
                  const cfg = CAT_CONFIG[cat] ?? { label: cat, color: '#64748B', cuenta: '' };
                  return (
                    <div key={cat} style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}40`, borderRadius: '0.5rem', padding: '0.6rem 1rem', minWidth: 160 }}>
                      <div style={{ fontSize: '0.7rem', color: cfg.color, fontWeight: 700 }}>{cfg.label} {cfg.cuenta}</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#F8FAFC', marginTop: '0.15rem' }}>{fmt(v.saldo)}</div>
                      <div style={{ fontSize: '0.7rem', color: '#8B97A8' }}>{v.count} documento{v.count !== 1 ? 's' : ''}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Filtros */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button style={btnStyle(catFilter === 'all')} onClick={() => setCatFilter('all')}>Todos ({data.malClasificados?.length ?? 0})</button>
              {Object.entries(CAT_CONFIG).map(([cat, cfg]) => {
                const count = data.malClasificados?.filter((d: any) => d.categoria === cat).length ?? 0;
                if (!count) return null;
                return <button key={cat} style={btnStyle(catFilter === cat, cfg.color)} onClick={() => setCatFilter(cat)}>{cfg.label} ({count})</button>;
              })}
              <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} style={searchInputStyle} />
            </div>

            {filtered42.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>Sin documentos en esta categoría.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table-s10" style={{ fontSize: '0.78rem' }}>
                  <thead>
                    <tr>
                      <SortTh col="categoria" label="Categoría" sort={sort} onSort={onSort} />
                      <SortTh col="proveedor" label="Proveedor" sort={sort} onSort={onSort} style={{ minWidth: 160 }} />
                      <SortTh col="tipo" label="Tipo Doc." sort={sort} onSort={onSort} />
                      <SortTh col="numero" label="N°" sort={sort} onSort={onSort} />
                      <SortTh col="fechaDocumento" label="Fecha" sort={sort} onSort={onSort} />
                      <SortTh col="saldo" label="Saldo" sort={sort} onSort={onSort} />
                      <SortTh col="pagado" label="Pagado" sort={sort} onSort={onSort} />
                      <th style={{ minWidth: 180 }}>Cuenta sugerida</th>
                      <th style={{ minWidth: 220 }}>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered42.map((d: any, i: number) => {
                      const cfg = CAT_CONFIG[d.categoria] ?? { label: d.categoria, color: '#64748B' };
                      return (
                        <tr key={i}>
                          <td>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: cfg.color, background: `${cfg.color}20`, padding: '2px 6px', borderRadius: 3 }}>
                              {cfg.label}
                            </span>
                          </td>
                          <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.proveedor}>{d.proveedor}</td>
                          <td style={{ fontSize: '0.72rem', color: '#8B97A8' }}>{d.tipo}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{d.serie ? `${d.serie}-${d.numero}` : d.numero || '—'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{d.fechaDocumento}</td>
                          <td style={{ fontWeight: 600, color: d.saldo > 0 ? '#F8FAFC' : '#8B97A8' }}>{fmt(d.saldo)}</td>
                          <td style={{ color: d.pagado > 0 ? '#10B981' : '#8B97A8' }}>{d.pagado > 0 ? fmt(d.pagado) : '—'}</td>
                          <td style={{ fontSize: '0.72rem', color: '#F59E0B', fontWeight: 600 }}>{d.cuentaSugerida}</td>
                          <td style={{ fontSize: '0.70rem', color: '#8B97A8', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.motivo}>{d.motivo}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="total-row">
                      <td colSpan={5}>TOTAL ({filtered42.length} documentos)</td>
                      <td>{fmt(filtered42.reduce((s: number, d: any) => s + d.saldo, 0))}</td>
                      <td>{fmt(filtered42.reduce((s: number, d: any) => s + d.pagado, 0))}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        ) : tab === 'en45' ? (
          <div style={{ overflowX: 'auto' }}>
            {data.en45?.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>No hay saldos en cuenta 45.</div>
            ) : (
              <table className="table-s10" style={{ fontSize: '0.78rem' }}>
                <thead>
                  <tr><th>Cuenta</th><th style={{ minWidth: 200 }}>Descripción</th><th style={{ minWidth: 160 }}>Tercero</th><th>Saldo</th></tr>
                </thead>
                <tbody>
                  {data.en45?.map((r: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#2BB4BB' }}>{r.cuenta}</td>
                      <td>{r.desCuenta}</td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.tercero || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{fmt(r.saldoTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="total-row"><td colSpan={3}>TOTAL</td><td>{fmt(data.total45)}</td></tr>
                </tfoot>
              </table>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            {data.en16?.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>No hay saldos en cuenta 16x.</div>
            ) : (
              <table className="table-s10" style={{ fontSize: '0.78rem' }}>
                <thead>
                  <tr><th>Cuenta</th><th style={{ minWidth: 200 }}>Descripción</th><th style={{ minWidth: 160 }}>Tercero</th><th>Saldo</th></tr>
                </thead>
                <tbody>
                  {data.en16?.map((r: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#2BB4BB' }}>{r.cuenta}</td>
                      <td>{r.desCuenta}</td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.tercero || '—'}</td>
                      <td style={{ fontWeight: 600, color: r.saldoTotal < 0 ? '#EF4444' : '#F8FAFC' }}>{fmt(r.saldoTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="total-row"><td colSpan={3}>TOTAL</td><td>{fmt(data.total16)}</td></tr>
                </tfoot>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
