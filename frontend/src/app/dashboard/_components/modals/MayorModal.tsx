'use client';
import React, { useEffect, useRef, useState } from 'react';
import { X, ArrowLeft, Link2, Search } from 'lucide-react';
import { API } from '../../_lib/constants';
import { fmt } from '../../_lib/formatters';
import { DocPreview } from './DocPreview';

// La fecha viene como UTC medianoche (p.ej. 2026-01-01T00:00:00Z). Formatear en
// UTC evita que en hora Perú (UTC-5) se muestre el día anterior (31/12/2025).
const fmtFecha = (d: string) => (d ? new Date(d).toLocaleDateString('es-PE', { timeZone: 'UTC' }) : '');

// Filtro de entrada: cualquier número del dashboard abre el mayor acotado a sus líneas.
export interface MayorFiltro {
  cuenta?: string;
  clase?: string;
  grupo?: string;
  nroD?: string;
  tercero?: string;
  search?: string;
  mes?: number;
}

export function MayorModal({ companyId, companyName, year, filtro, titulo, onClose }: {
  companyId: string;
  companyName?: string;
  year: number;
  filtro?: MayorFiltro;
  titulo: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [asiento, setAsiento] = useState<{ nroAsiento: string; fecha: string; codUnico?: string } | null>(null);
  // Búsqueda por texto (glosa / tercero / N° doc) + rango de fechas (default: año completo)
  const [searchInput, setSearchInput] = useState(filtro?.search ?? '');
  const [search, setSearch] = useState(filtro?.search ?? '');
  const [desde, setDesde] = useState(`${year}-01-01`);
  const [hasta, setHasta] = useState(`${year}-12-31`);
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => { modalRef.current?.focus(); }, []);

  // Debounce de la búsqueda para no consultar en cada tecla
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    setLoading(true);
    const p = new URLSearchParams({ year: String(year), page: String(page), pageSize: '150' });
    if (filtro?.cuenta) p.set('cuenta', filtro.cuenta);
    if (filtro?.clase) p.set('clase', filtro.clase);
    if (filtro?.grupo) p.set('grupo', filtro.grupo);
    if (filtro?.nroD) p.set('nroD', filtro.nroD);
    if (filtro?.tercero) p.set('tercero', filtro.tercero);
    if (filtro?.mes) p.set('mes', String(filtro.mes));
    if (search) p.set('search', search);
    if (desde) p.set('desde', desde);
    if (hasta) p.set('hasta', hasta);
    fetch(`${API}/kpi/${companyId}/ledger?${p}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId, year, filtro, page, search, desde, hasta]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const soloUnaCuenta = !!filtro?.cuenta;

  return (
    <>
      {asiento && (
        <AsientoMayorModal companyId={companyId} nroAsiento={asiento.nroAsiento} fecha={asiento.fecha} codUnico={asiento.codUnico} onClose={() => setAsiento(null)} />
      )}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        onClick={onClose}>
        <div ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          style={{ background: '#0D1A2D', border: '1px solid rgba(43,180,187,0.25)', borderRadius: '0.75rem', maxWidth: '95vw', width: 1080, maxHeight: '85vh', overflow: 'auto', padding: '1.5rem', outline: 'none' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: '#2BB4BB', fontSize: '0.72rem', fontWeight: 700, border: '1px solid rgba(43,180,187,0.4)', borderRadius: 4, padding: '1px 6px' }}>EL MAYOR</span>
                {titulo}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginTop: '0.25rem' }}>
                {companyName ? `${companyName} · ` : ''}{year}
                {data && <> · {data.total.toLocaleString()} líneas · Débito <span style={{ color: '#10B981' }}>{fmt(data.totalDebito)}</span> · Crédito <span style={{ color: '#EF4444' }}>{fmt(data.totalCredito)}</span> · Neto <span style={{ color: '#F8FAFC', fontWeight: 600 }}>{fmt(data.saldoNeto)}</span></>}
              </div>
            </div>
            <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B97A8', display: 'flex' }}><X size={18} aria-hidden="true" /></button>
          </div>

          {/* Barra de filtros: búsqueda por texto + rango de fechas */}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
              <Search size={13} aria-hidden="true" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#5B6675' }} />
              <input
                type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
                placeholder="Buscar por glosa, tercero o N° de documento…"
                style={{ width: '100%', padding: '0.35rem 0.5rem 0.35rem 1.7rem', borderRadius: 6, fontSize: '0.76rem',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#F8FAFC', outline: 'none' }} />
            </div>
            <label style={{ fontSize: '0.72rem', color: '#8B97A8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              Desde
              <input type="date" value={desde} min={`${year}-01-01`} max={`${year}-12-31`}
                onChange={e => { setDesde(e.target.value); setPage(1); }}
                style={dateInputStyle} />
            </label>
            <label style={{ fontSize: '0.72rem', color: '#8B97A8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              Hasta
              <input type="date" value={hasta} min={`${year}-01-01`} max={`${year}-12-31`}
                onChange={e => { setHasta(e.target.value); setPage(1); }}
                style={dateInputStyle} />
            </label>
            {(searchInput || desde !== `${year}-01-01` || hasta !== `${year}-12-31`) && (
              <button onClick={() => { setSearchInput(''); setDesde(`${year}-01-01`); setHasta(`${year}-12-31`); setPage(1); }}
                title="Limpiar filtros"
                style={{ padding: '0.3rem 0.6rem', borderRadius: 6, fontSize: '0.72rem', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#8B97A8' }}>
                Limpiar
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#8B97A8' }}>Cargando el mayor...</div>
          ) : !data?.rows?.length ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#8B97A8', fontSize: '0.85rem' }}>Sin asientos para este filtro en {year}.</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table className="table-s10" style={{ fontSize: '0.76rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Fecha</th>
                      <th style={{ textAlign: 'left' }}>Asiento</th>
                      {!soloUnaCuenta && <th style={{ textAlign: 'left' }}>Cuenta</th>}
                      <th style={{ textAlign: 'left' }}>Glosa</th>
                      <th style={{ textAlign: 'left' }}>Tercero</th>
                      <th>Débito</th>
                      <th>Crédito</th>
                      <th>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r: any) => (
                      <tr key={r.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtFecha(r.fecha)}</td>
                        <td>
                          <button onClick={() => setAsiento({ nroAsiento: r.nroAsiento, fecha: r.fecha, codUnico: r.codUnico })} title="Ver partida doble del comprobante"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2BB4BB', textDecoration: 'underline', textDecorationStyle: 'dotted', fontFamily: 'monospace', fontSize: '0.72rem', padding: 0 }}>
                            {r.nroAsiento}
                          </button>
                        </td>
                        {!soloUnaCuenta && <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }} title={r.desCuenta}>{r.codCuenta}</td>}
                        <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#8B97A8' }} title={r.glosa}>{r.glosa || '—'}</td>
                        <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.72rem' }} title={r.tercero}>{r.tercero || '—'}</td>
                        <td style={{ color: r.debito > 0 ? '#10B981' : '#8B97A8' }}>{r.debito > 0 ? fmt(r.debito) : '—'}</td>
                        <td style={{ color: r.credito > 0 ? '#EF4444' : '#8B97A8' }}>{r.credito > 0 ? fmt(r.credito) : '—'}</td>
                        <td style={{ fontWeight: 600, color: r.saldoAcumulado < 0 ? '#EF4444' : '#F8FAFC' }}>{fmt(r.saldoAcumulado)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="total-row">
                      <td colSpan={soloUnaCuenta ? 4 : 5}>TOTAL FILTRADO ({data.total.toLocaleString()} líneas)</td>
                      <td>{fmt(data.totalDebito)}</td>
                      <td>{fmt(data.totalCredito)}</td>
                      <td>{fmt(data.saldoNeto)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={pgBtn(page <= 1)}>← Anterior</button>
                  <span style={{ fontSize: '0.78rem', color: '#8B97A8' }}>Página {page} de {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={pgBtn(page >= totalPages)}>Siguiente →</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// Partida doble del comprobante — mismo lenguaje oscuro
function AsientoMayorModal({ companyId, nroAsiento, fecha, codUnico, onClose }: { companyId: string; nroAsiento: string; fecha?: string; codUnico?: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const p = new URLSearchParams();
    if (codUnico) p.set('codUnico', codUnico);
    if (fecha) p.set('fecha', fecha);
    fetch(`${API}/kpi/${companyId}/ledger/asiento/${nroAsiento}?${p}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setData).catch(() => setData(null));
  }, [companyId, nroAsiento, fecha, codUnico]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div role="dialog" aria-modal="true"
        style={{ background: '#0D1A2D', border: '1px solid rgba(43,180,187,0.3)', borderRadius: '0.75rem', maxWidth: '95vw', width: 880, maxHeight: '85vh', overflow: 'auto', padding: '1.5rem' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B97A8', display: 'flex' }}><ArrowLeft size={16} /></button>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC' }}>Asiento {nroAsiento}</span>
            </div>
            {data && <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginTop: '0.25rem', marginLeft: '1.6rem' }}>{fmtFecha(data.fecha)} · {data.glosa || 'Sin glosa'}{data.operaciones?.length ? <> · <span style={{ color: '#6B7280' }}>{data.operaciones.length === 1 ? 'Operación' : 'Operaciones'} S10: <span style={{ fontFamily: 'monospace', color: '#8B97A8' }}>{data.operaciones.join(', ')}</span></span></> : ''}</div>}
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B97A8', display: 'flex' }}><X size={18} /></button>
        </div>
        {!data ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#8B97A8' }}>Cargando asiento...</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="table-s10" style={{ fontSize: '0.76rem' }}>
                <thead>
                  <tr>
                    <th style={{ width: 28 }}></th>
                    <th style={{ textAlign: 'left' }}>Cuenta</th>
                    <th style={{ textAlign: 'left' }}>Descripción</th>
                    <th style={{ textAlign: 'left' }}>Tercero</th>
                    <th>Débito</th>
                    <th>Crédito</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lineas.map((l: any) => (
                    <tr key={l.id}>
                      <td style={{ textAlign: 'center', padding: '0 0.25rem' }}>
                        {l.nroD
                          ? <button onClick={() => setDocPreview(String(l.nroD))} title="Ver documento origen" aria-label="Ver documento origen"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2BB4BB', padding: 0, display: 'flex' }}><Link2 size={13} aria-hidden="true" /></button>
                          : <span style={{ color: '#4B5563', fontSize: '0.7rem' }}>—</span>}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{l.codCuenta}</td>
                      <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.desCuenta}>{l.desCuenta}</td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.72rem', color: '#8B97A8' }} title={l.tercero}>{l.tercero || '—'}</td>
                      <td style={{ color: l.debito > 0 ? '#10B981' : '#8B97A8' }}>{l.debito > 0 ? fmt(l.debito) : '—'}</td>
                      <td style={{ color: l.credito > 0 ? '#EF4444' : '#8B97A8' }}>{l.credito > 0 ? fmt(l.credito) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="total-row">
                    <td colSpan={4}>TOTALES</td>
                    <td>{fmt(data.totalDebito)}</td>
                    <td>{fmt(data.totalCredito)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{ marginTop: '0.9rem', padding: '0.5rem 0.8rem', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600,
              background: data.cuadra ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: data.cuadra ? '#10B981' : '#EF4444' }}>
              {data.cuadra ? '✓ Asiento cuadrado — partida doble balanceada (Débito = Crédito)' : `⚠ Descuadre de ${fmt(Math.abs(data.totalDebito - data.totalCredito))}`}
            </div>
          </>
        )}
      </div>
      {docPreview && <DocPreview companyId={companyId} nroD={docPreview} onClose={() => setDocPreview(null)} />}
    </div>
  );
}

const dateInputStyle: React.CSSProperties = {
  padding: '0.3rem 0.4rem', borderRadius: 6, fontSize: '0.74rem',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
  color: '#F8FAFC', colorScheme: 'dark', outline: 'none',
};

const pgBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '0.3rem 0.9rem', borderRadius: '0.4rem', fontSize: '0.78rem',
  border: '1px solid rgba(255,255,255,0.12)', cursor: disabled ? 'not-allowed' : 'pointer',
  background: disabled ? 'rgba(255,255,255,0.03)' : 'rgba(43,180,187,0.12)', color: disabled ? '#4B5563' : '#2BB4BB',
});
