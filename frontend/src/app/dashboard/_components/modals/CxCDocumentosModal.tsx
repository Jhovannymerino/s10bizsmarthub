'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { API } from '../../_lib/constants';
import { fmt } from '../../_lib/formatters';
import { SortState, sortRows, toggleSort, searchRows } from '../../_lib/sort';
import { SortTh, searchInputStyle } from '../../_lib/SortTh';
import { DocPaymentsModal } from './DocPaymentsModal';

const fUSD = (v: number) => `$ ${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function getMoneda(d: any): 'USD' | 'PEN' {
  const raw = String(d.Moneda ?? d.CodMoneda ?? '01').trim();
  return raw === '02' || raw === '2' ? 'USD' : 'PEN';
}

function fMon(moneda: 'USD' | 'PEN', v: number) {
  return moneda === 'USD' ? fUSD(v) : fmt(v);
}

export function CxCDocumentosModal({ companyId, cliente, codCliente, onClose }: {
  companyId: string; cliente: string; codCliente: string; onClose: () => void;
}) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'vencido' | 'vigente' | 'pagado'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ col: '', dir: 'asc' });
  const [pagosDrill, setPagosDrill] = useState<{ nroD: string; label: string; totalPagado: number } | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const params = new URLSearchParams({ codCliente: String(codCliente) });
    fetch(`${API}/kpi/${companyId}/cxc-docs?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setDocs(d.docs || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId, codCliente]);

  const pendientes = docs.filter(d => (d.Saldo ?? 0) > 0 || (d.EsNotaCredito && (d.Saldo ?? 0) < 0));
  const pagados = docs.filter(d => !d.EsNotaCredito && (d.Saldo ?? 0) <= 0);

  const baseFiltered = filter === 'pagado'
    ? pagados
    : pendientes.filter(d => {
        if (filter === 'vencido') return (d.DiasVencido ?? 0) > 0;
        if (filter === 'vigente') return (d.DiasVencido ?? 0) <= 0;
        return true;
      });

  const filtered = useMemo(
    () => sortRows(searchRows(baseFiltered, search), sort.col, sort.dir),
    [baseFiltered, search, sort]
  );

  const totalPEN = filtered.filter(d => getMoneda(d) === 'PEN').reduce((s, d) => s + (d.Saldo ?? 0), 0);
  const totalUSD = filtered.filter(d => getMoneda(d) === 'USD').reduce((s, d) => s + (d.Saldo ?? 0), 0);
  const hasMixed = totalPEN > 0 && totalUSD > 0;

  const diasColor = (dias: number) => {
    if (dias <= 0) return '#10B981';
    if (dias <= 30) return '#F59E0B';
    if (dias <= 60) return '#F97316';
    return '#EF4444';
  };

  const btnStyle = (active: boolean, accent: 'teal' | 'green' = 'teal') => ({
    padding: '0.25rem 0.75rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.78rem',
    border: active
      ? accent === 'green' ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(32,126,131,0.5)'
      : '1px solid rgba(255,255,255,0.1)',
    background: active
      ? accent === 'green' ? 'rgba(16,185,129,0.15)' : 'rgba(32,126,131,0.2)'
      : 'rgba(255,255,255,0.04)',
    color: active
      ? accent === 'green' ? '#10B981' : '#2BB4BB'
      : '#8B97A8',
  });

  const onSort = (col: string) => setSort(s => toggleSort(s, col));
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => { modalRef.current?.focus(); }, []);

  return (
    <>
    {pagosDrill && (
      <DocPaymentsModal
        companyId={companyId}
        nroD={pagosDrill.nroD}
        docLabel={pagosDrill.label}
        totalPagado={pagosDrill.totalPagado}
        onClose={() => setPagosDrill(null)}
      />
    )}
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="cxc-docs-modal-title" tabIndex={-1}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        style={{ background: '#0D1A2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', maxWidth: '95vw', width: 1100, maxHeight: '85vh', overflow: 'auto', padding: '1.5rem', outline: 'none' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div id="cxc-docs-modal-title" style={{ fontWeight: 700, fontSize: '1rem', color: '#F8FAFC' }}>{cliente}</div>
            <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginTop: '0.2rem' }}>
              {filter === 'pagado' ? 'Documentos pagados' : 'Documentos pendientes'} · {filtered.length} documentos
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#8B97A8', display: 'flex' }}><X size={18} aria-hidden="true" /></button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={btnStyle(filter === 'all')} onClick={() => setFilter('all')}>Todos ({pendientes.length})</button>
          <button style={btnStyle(filter === 'vencido')} onClick={() => setFilter('vencido')}>
            Vencidos ({pendientes.filter(d => (d.DiasVencido ?? 0) > 0).length})
          </button>
          <button style={btnStyle(filter === 'vigente')} onClick={() => setFilter('vigente')}>
            Vigentes ({pendientes.filter(d => (d.DiasVencido ?? 0) <= 0).length})
          </button>
          {pagados.length > 0 && (
            <button style={btnStyle(filter === 'pagado', 'green')} onClick={() => setFilter('pagado')}>
              Pagados ({pagados.length})
            </button>
          )}
          <input
            type="text" placeholder="Buscar..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={searchInputStyle}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>{filter === 'pagado' ? 'Sin documentos pagados.' : 'Sin documentos pendientes.'}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-s10" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <SortTh col="DesTipo" label="Tipo" sort={sort} onSort={onSort} />
                  <SortTh col="Numero" label="Serie / N°" sort={sort} onSort={onSort} />
                  <SortTh col="FechaDocumento" label="Fecha Doc." sort={sort} onSort={onSort} />
                  <SortTh col="FechaVencimiento" label="Vencimiento" sort={sort} onSort={onSort} />
                  <SortTh col="DiasVencido" label="Días Venc." sort={sort} onSort={onSort} style={{ textAlign: 'right' }} />
                  <th style={{ textAlign: 'center' }}>Moneda</th>
                  <SortTh col="Total" label="Total" sort={sort} onSort={onSort} style={{ textAlign: 'right' }} />
                  <SortTh col="Pagado" label="Pagado" sort={sort} onSort={onSort} style={{ textAlign: 'right' }} />
                  <SortTh col="Detraccion" label="Detracción" sort={sort} onSort={onSort} style={{ textAlign: 'right' }} />
                  <SortTh col="Saldo" label="Saldo" sort={sort} onSort={onSort} style={{ textAlign: 'right' }} />
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d: any, i: number) => {
                  const moneda = getMoneda(d);
                  const isUSD = moneda === 'USD';
                  const esNC = d.EsNotaCredito === 1;
                  return (
                    <tr key={i} style={{ background: esNC ? 'rgba(239,68,68,0.04)' : isUSD ? 'rgba(74,222,128,0.03)' : undefined }}>
                      <td style={{ color: esNC ? '#EF4444' : '#8B97A8', fontSize: '0.72rem' }}>
                        {esNC && <span title="Nota de Crédito — resta del saldo del cliente" style={{ fontSize: '0.68rem', fontWeight: 700, marginRight: '0.3rem' }}>NC</span>}
                        {d.DesTipo || d.TipoDoc}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
                        {d.Serie ? `${d.Serie}-${d.Numero}` : d.Numero || '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{d.FechaDocumento}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{d.FechaVencimiento}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: diasColor(d.DiasVencido ?? 0) }}>
                        {(d.DiasVencido ?? 0) > 0 ? `+${d.DiasVencido}` : 'Vigente'}
                      </td>
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
                      <td style={{ textAlign: 'right' }}>
                        {(d.Pagado ?? 0) > 0 && d.NroD ? (
                          <button
                            onClick={e => { e.stopPropagation(); setPagosDrill({ nroD: String(d.NroD), label: d.Serie ? `${d.Serie}-${d.Numero}` : (d.Numero || String(d.NroD)), totalPagado: d.Pagado }); }}
                            title="Ver detalle de pagos"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2BB4BB', textDecoration: 'underline', textDecorationStyle: 'dotted', fontSize: '0.78rem', padding: 0 }}>
                            {fMon(moneda, d.Pagado)}
                          </button>
                        ) : (
                          <span style={{ color: '#8B97A8' }}>{fMon(moneda, d.Pagado ?? 0)}</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', color: (d.Detraccion ?? 0) > 0 ? '#F59E0B' : '#4B5563', fontSize: '0.72rem' }}>
                        {(d.Detraccion ?? 0) > 0 ? fMon(moneda, d.Detraccion) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: esNC ? '#EF4444' : (d.Saldo ?? 0) > 0 ? '#F8FAFC' : '#8B97A8' }}>
                        {fMon(moneda, d.Saldo ?? 0)}
                      </td>
                      <td style={{ fontSize: '0.70rem', color: '#8B97A8' }}>{d.Estado || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={9} style={{ textAlign: 'right' }}>{filter === 'pagado' ? 'TOTAL COBRADO' : 'SALDO PENDIENTE'}</td>
                  <td style={{ textAlign: 'right' }}>
                    {hasMixed ? (
                      <>
                        <div>{fmt(totalPEN)}</div>
                        <div style={{ color: '#4ade80', fontSize: '0.72rem' }}>{fUSD(totalUSD)}</div>
                      </>
                    ) : totalUSD > 0 ? fUSD(totalUSD) : fmt(totalPEN)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
