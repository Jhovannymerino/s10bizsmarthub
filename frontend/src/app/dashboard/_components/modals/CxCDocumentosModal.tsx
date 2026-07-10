'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, ScrollText, Download } from 'lucide-react';
import { API } from '../../_lib/constants';
import { fmt } from '../../_lib/formatters';
import { SortState, sortRows, toggleSort, searchRows } from '../../_lib/sort';
import { SortTh, searchInputStyle } from '../../_lib/SortTh';
import { DocPaymentsModal } from './DocPaymentsModal';
import { MayorModal } from './MayorModal';

const fUSD = (v: number) => `$ ${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function exportCSV(filename: string, headers: string[], rows: any[][]) {
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function getMoneda(d: any): 'USD' | 'PEN' {
  const raw = String(d.Moneda ?? d.CodMoneda ?? '01').trim();
  return raw === '02' || raw === '2' ? 'USD' : 'PEN';
}

function fMon(moneda: 'USD' | 'PEN', v: number) {
  return moneda === 'USD' ? fUSD(v) : fmt(v);
}

// Clasificación de cada documento por su estado real (a partir del Saldo que calcula el agente):
//  - NC  : nota de crédito (resta del saldo del cliente; flotante si Saldo<0, aplicada si Saldo≈0)
//  - Pendiente : factura con saldo por cobrar (>0)
//  - Saldado   : factura con saldo ≈0 (pagada o anulada por su NC)
const EPS = 0.01;
const esNC = (d: any) => d.EsNotaCredito === 1;
const saldoVal = (d: any) => d.Saldo ?? 0;
const esSaldado = (d: any) => Math.abs(saldoVal(d)) <= EPS;        // saldo neto cero
const esPendiente = (d: any) => !esNC(d) && saldoVal(d) > EPS;    // factura por cobrar
const esNCflotante = (d: any) => esNC(d) && saldoVal(d) < -EPS;   // NC sin aplicar (saldo negativo)

type Filter = 'pendientes' | 'vencido' | 'vigente' | 'saldados' | 'nc' | 'todos';

export function CxCDocumentosModal({ companyId, cliente, codCliente, year, onClose }: {
  companyId: string; cliente: string; codCliente: string; year?: number; onClose: () => void;
}) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('pendientes');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ col: '', dir: 'asc' });
  const [pagosDrill, setPagosDrill] = useState<{ nroD: string; label: string; totalPagado: number } | null>(null);
  const [verMayor, setVerMayor] = useState(false);

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

  // Conjuntos por estado
  const pendientes = docs.filter(d => esPendiente(d) || esNCflotante(d)); // cartera: facturas + NC flotantes
  const saldados   = docs.filter(d => esSaldado(d));                       // facturas pagadas/anuladas + NC aplicadas
  const notasCred  = docs.filter(d => esNC(d));                            // todas las NC

  const baseFiltered =
    filter === 'todos'    ? docs
    : filter === 'saldados' ? saldados
    : filter === 'nc'       ? notasCred
    : pendientes.filter(d => {
        if (filter === 'vencido') return (d.DiasVencido ?? 0) > 0;
        if (filter === 'vigente') return (d.DiasVencido ?? 0) <= 0;
        return true; // 'pendientes'
      });

  const filtered = useMemo(
    () => sortRows(searchRows(baseFiltered, search), sort.col, sort.dir),
    [baseFiltered, search, sort]
  );

  const totalPEN = filtered.filter(d => getMoneda(d) === 'PEN').reduce((s, d) => s + (d.Saldo ?? 0), 0);
  const totalUSD = filtered.filter(d => getMoneda(d) === 'USD').reduce((s, d) => s + (d.Saldo ?? 0), 0);
  const hasMixed = Math.abs(totalPEN) > EPS && Math.abs(totalUSD) > EPS;

  // Neto del cliente (todas las monedas en su valor nominal, solo informativo en el header)
  const netoPEN = docs.filter(d => getMoneda(d) === 'PEN').reduce((s, d) => s + (d.Saldo ?? 0), 0);
  const netoUSD = docs.filter(d => getMoneda(d) === 'USD').reduce((s, d) => s + (d.Saldo ?? 0), 0);

  const diasColor = (dias: number) => {
    if (dias <= 0) return '#10B981';
    if (dias <= 30) return '#F59E0B';
    if (dias <= 60) return '#F97316';
    return '#EF4444';
  };

  const btnStyle = (active: boolean, accent: 'teal' | 'green' | 'red' = 'teal') => {
    const colors = {
      teal:  { border: 'rgba(32,126,131,0.5)',  bg: 'rgba(32,126,131,0.2)',  fg: '#2BB4BB' },
      green: { border: 'rgba(16,185,129,0.5)',  bg: 'rgba(16,185,129,0.15)', fg: '#10B981' },
      red:   { border: 'rgba(239,68,68,0.5)',   bg: 'rgba(239,68,68,0.15)',  fg: '#EF4444' },
    }[accent];
    return {
      padding: '0.25rem 0.75rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.78rem',
      border: active ? `1px solid ${colors.border}` : '1px solid rgba(255,255,255,0.1)',
      background: active ? colors.bg : 'rgba(255,255,255,0.04)',
      color: active ? colors.fg : '#8B97A8',
    };
  };

  const onSort = (col: string) => setSort(s => toggleSort(s, col));
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => { modalRef.current?.focus(); }, []);

  const filterLabel: Record<Filter, string> = {
    pendientes: 'Documentos pendientes', vencido: 'Documentos vencidos', vigente: 'Documentos vigentes',
    saldados: 'Documentos saldados / pagados', nc: 'Notas de crédito', todos: 'Todos los documentos',
  };
  const footerLabel = filter === 'saldados' ? 'SALDO (≈0)'
    : filter === 'nc' ? 'TOTAL NC'
    : filter === 'todos' ? 'NETO' : 'SALDO PENDIENTE';

  // Badge de estado por fila
  const estadoBadge = (d: any) => {
    if (esNC(d)) return { label: 'NC', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' };
    if (esSaldado(d)) return { label: 'Saldado', color: '#10B981', bg: 'rgba(16,185,129,0.12)' };
    return { label: 'Pendiente', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' };
  };

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
    {verMayor && (
      <MayorModal
        companyId={companyId}
        companyName={cliente}
        year={year ?? new Date().getFullYear()}
        filtro={{ tercero: codCliente }}
        titulo={`Movimientos de ${cliente}`}
        onClose={() => setVerMayor(false)}
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
              {filterLabel[filter]} · {filtered.length} documentos
              <span style={{ marginLeft: '0.6rem', color: '#5B6675' }}>·</span>
              <span style={{ marginLeft: '0.6rem' }} title="Saldo neto del cliente sumando todos sus documentos (facturas − NC)">
                Neto: <b style={{ color: (Math.abs(netoPEN) > EPS || Math.abs(netoUSD) > EPS) ? '#F8FAFC' : '#10B981' }}>
                  {Math.abs(netoPEN) > EPS ? fmt(netoPEN) : ''}{(Math.abs(netoPEN) > EPS && Math.abs(netoUSD) > EPS) ? ' · ' : ''}{Math.abs(netoUSD) > EPS ? fUSD(netoUSD) : (Math.abs(netoPEN) > EPS ? '' : fmt(0))}
                </b>
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button onClick={() => setVerMayor(true)}
              title="Ver todos los movimientos contables de este cliente en el Mayor (la prueba contable detrás de cada documento)"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.7rem', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, border: '1px solid rgba(43,180,187,0.4)', background: 'rgba(43,180,187,0.12)', color: '#2BB4BB' }}>
              <ScrollText size={13} aria-hidden="true" /> Ver en el Mayor
            </button>
            <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#8B97A8', display: 'flex' }}><X size={18} aria-hidden="true" /></button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={btnStyle(filter === 'pendientes')} onClick={() => setFilter('pendientes')}>Pendientes ({pendientes.length})</button>
          <button style={btnStyle(filter === 'vencido')} onClick={() => setFilter('vencido')}>
            Vencidos ({pendientes.filter(d => (d.DiasVencido ?? 0) > 0).length})
          </button>
          <button style={btnStyle(filter === 'vigente')} onClick={() => setFilter('vigente')}>
            Vigentes ({pendientes.filter(d => (d.DiasVencido ?? 0) <= 0).length})
          </button>
          <button style={btnStyle(filter === 'saldados', 'green')} onClick={() => setFilter('saldados')}>
            Saldados ({saldados.length})
          </button>
          <button style={btnStyle(filter === 'nc', 'red')} onClick={() => setFilter('nc')}>
            Notas de crédito ({notasCred.length})
          </button>
          <button style={btnStyle(filter === 'todos')} onClick={() => setFilter('todos')}>Todos ({docs.length})</button>
          <input
            type="text" placeholder="Buscar N° doc..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={searchInputStyle}
          />
          <button onClick={() => {
            const headers = ['Estado', 'Tipo', 'Serie/N°', 'Fecha Doc.', 'Vencimiento', 'Días Venc.', 'Moneda', 'Total', 'Pagado', 'Detracción', 'Saldo'];
            const rows = filtered.map((d: any) => [
              estadoBadge(d).label, d.DesTipo || d.TipoDoc, d.Serie ? `${d.Serie}-${d.Numero}` : d.Numero,
              d.FechaDocumento, d.FechaVencimiento, d.DiasVencido, getMoneda(d),
              d.Total, d.Pagado, d.Detraccion, d.Saldo,
            ]);
            exportCSV(`CxC_${String(cliente).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}_${filter}.csv`, headers, rows);
          }} title="Exportar a Excel (CSV) los documentos de esta vista"
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.7rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#8B97A8' }}>
            <Download size={13} aria-hidden="true" /> Exportar
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>Sin documentos en esta vista.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-s10" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th>Estado</th>
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
                </tr>
              </thead>
              <tbody>
                {filtered.map((d: any, i: number) => {
                  const moneda = getMoneda(d);
                  const isUSD = moneda === 'USD';
                  const nc = esNC(d);
                  const settled = esSaldado(d);
                  const badge = estadoBadge(d);
                  return (
                    <tr key={i} style={{ background: nc ? 'rgba(239,68,68,0.04)' : settled ? 'rgba(16,185,129,0.03)' : isUSD ? 'rgba(74,222,128,0.03)' : undefined }}>
                      <td>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 7px', borderRadius: 3, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ color: nc ? '#EF4444' : '#8B97A8', fontSize: '0.72rem' }}>
                        {d.DesTipo || d.TipoDoc}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
                        {d.Serie ? `${d.Serie}-${d.Numero}` : d.Numero || '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{d.FechaDocumento}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{d.FechaVencimiento}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: settled || nc ? '#4B5563' : diasColor(d.DiasVencido ?? 0) }}>
                        {settled || nc ? '—' : (d.DiasVencido ?? 0) > 0 ? `+${d.DiasVencido}` : 'Vigente'}
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
                      <td style={{ textAlign: 'right', fontWeight: 600, color: nc ? '#EF4444' : settled ? '#10B981' : '#F8FAFC' }}>
                        {fMon(moneda, d.Saldo ?? 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={10} style={{ textAlign: 'right' }}>{footerLabel}</td>
                  <td style={{ textAlign: 'right' }}>
                    {hasMixed ? (
                      <>
                        <div>{fmt(totalPEN)}</div>
                        <div style={{ color: '#4ade80', fontSize: '0.72rem' }}>{fUSD(totalUSD)}</div>
                      </>
                    ) : Math.abs(totalUSD) > EPS ? fUSD(totalUSD) : fmt(totalPEN)}
                  </td>
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
