'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Download } from 'lucide-react';
import { API } from '../../_lib/constants';
import { fmt } from '../../_lib/formatters';
import { SortState, sortRows, toggleSort, searchRows } from '../../_lib/sort';
import { SortTh, searchInputStyle } from '../../_lib/SortTh';

type Lado = 'cobradas' | 'pagadas';

function exportCSV(filename: string, headers: string[], rows: any[][]) {
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function DetraccionesModal({ companyId, companyName, year, ladoInicial = 'cobradas', onClose }: {
  companyId: string; companyName?: string; year: number; ladoInicial?: Lado; onClose: () => void;
}) {
  const [lado, setLado] = useState<Lado>(ladoInicial);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ col: '', dir: 'asc' });
  const [desde, setDesde] = useState(`${year}-01-01`);
  const [hasta, setHasta] = useState(`${year}-12-31`);
  useEffect(() => { setDesde(`${year}-01-01`); setHasta(`${year}-12-31`); }, [year]);
  const onSort = (col: string) => setSort(s => toggleSort(s, col));
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => { modalRef.current?.focus(); }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    setLoading(true);
    fetch(`${API}/kpi/${companyId}/detracciones?year=${year}&lado=${lado}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId, year, lado]);

  const rows = data?.detracciones || [];
  // Fecha 'DD/MM/YYYY' → 'YYYY-MM-DD' para comparar con el rango
  const toISO = (f: string) => { const [d, m, y] = String(f || '').split('/'); return y ? `${y}-${m}-${d}` : ''; };
  const filtered = useMemo(() => {
    const inRange = rows.filter((r: any) => {
      const iso = toISO(r.fechaDocumento);
      return (!desde || iso >= desde) && (!hasta || iso <= hasta);
    });
    return sortRows(searchRows(inRange, search), sort.col, sort.dir);
  }, [rows, search, sort, desde, hasta]);
  const totalDetrac = filtered.reduce((s: number, r: any) => s + (r.montoDetraccion || 0), 0);

  const estadoColor = (e: string) => e === 'Completo' ? { bg: 'rgba(16,185,129,0.12)', fg: '#10B981' }
    : e === 'Pendiente' ? { bg: 'rgba(239,68,68,0.12)', fg: '#EF4444' }
    : { bg: 'rgba(245,158,11,0.12)', fg: '#F59E0B' };

  const ladoBtn = (l: Lado, label: string) => (
    <button onClick={() => setLado(l)} style={{
      padding: '0.25rem 0.75rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600,
      border: lado === l ? '1px solid rgba(43,180,187,0.5)' : '1px solid rgba(255,255,255,0.1)',
      background: lado === l ? 'rgba(43,180,187,0.2)' : 'rgba(255,255,255,0.04)',
      color: lado === l ? '#2BB4BB' : '#8B97A8',
    }}>{label}</button>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        style={{ background: '#0D1A2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', maxWidth: '96vw', width: 1180, maxHeight: '88vh', overflow: 'auto', padding: '1.5rem', outline: 'none' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#F8FAFC' }}>Reporte de Detracciones</div>
            <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginTop: '0.2rem' }}>
              {companyName ? `${companyName} · ` : ''}{year} · {lado === 'cobradas' ? 'Cobradas (facturas emitidas)' : 'Pagadas (facturas recibidas)'} · {filtered.length} doc · Detracción total: <b style={{ color: '#F59E0B' }}>{fmt(totalDetrac)}</b>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B97A8', display: 'flex' }}><X size={18} aria-hidden="true" /></button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {ladoBtn('cobradas', 'Cobradas (CxC)')}
          {ladoBtn('pagadas', 'Pagadas (CxP)')}
          <input type="text" placeholder="Buscar documento o tercero..." value={search} onChange={e => setSearch(e.target.value)} style={searchInputStyle} />
          <label style={{ fontSize: '0.72rem', color: '#8B97A8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>Desde
            <input type="date" value={desde} min={`${year}-01-01`} max={`${year}-12-31`} onChange={e => setDesde(e.target.value)}
              style={{ padding: '0.3rem 0.4rem', borderRadius: 6, fontSize: '0.74rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: '#F8FAFC', colorScheme: 'dark' }} /></label>
          <label style={{ fontSize: '0.72rem', color: '#8B97A8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>Hasta
            <input type="date" value={hasta} min={`${year}-01-01`} max={`${year}-12-31`} onChange={e => setHasta(e.target.value)}
              style={{ padding: '0.3rem 0.4rem', borderRadius: 6, fontSize: '0.74rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: '#F8FAFC', colorScheme: 'dark' }} /></label>
          <button onClick={() => {
            const headers = ['Estado', 'Documento', 'Fecha doc', 'Tercero', 'RUC', 'Total', 'Detracción', 'Fecha detracción', 'Identificada por', 'Pago', 'Fecha pago'];
            const csv = filtered.map((r: any) => [r.estado, r.doc, r.fechaDocumento, r.tercero, r.ruc, r.total, r.montoDetraccion, r.fechaDetraccion || '', r.metodoDetraccion || '', r.montoPago, r.fechaPago || '']);
            exportCSV(`Detracciones_${lado}_${year}.csv`, headers, csv);
          }} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.7rem', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#8B97A8' }}>
            <Download size={13} aria-hidden="true" /> Exportar
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>Sin documentos con detracción en este período.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-s10" style={{ fontSize: '0.76rem' }}>
              <thead>
                <tr>
                  <th>Estado</th>
                  <SortTh col="doc" label="Documento" sort={sort} onSort={onSort} />
                  <SortTh col="fechaDocumento" label="Fecha doc." sort={sort} onSort={onSort} />
                  <SortTh col="tercero" label={lado === 'cobradas' ? 'Cliente' : 'Proveedor'} sort={sort} onSort={onSort} />
                  <SortTh col="total" label="Total" sort={sort} onSort={onSort} style={{ textAlign: 'right' }} />
                  <SortTh col="montoDetraccion" label="Detracción" sort={sort} onSort={onSort} style={{ textAlign: 'right' }} />
                  <SortTh col="fechaDetraccion" label={lado === 'cobradas' ? 'Cobro detracción' : 'Pago detracción'} sort={sort} onSort={onSort} />
                  <SortTh col="montoPago" label="Pago" sort={sort} onSort={onSort} style={{ textAlign: 'right' }} />
                  <SortTh col="fechaPago" label="Fecha pago" sort={sort} onSort={onSort} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r: any, i: number) => {
                  const ec = estadoColor(r.estado);
                  return (
                    <tr key={i}>
                      <td><span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: ec.bg, color: ec.fg, whiteSpace: 'nowrap' }}>{r.estado}</span></td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{r.doc}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{r.fechaDocumento}</td>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.tercero}>{r.tercero || '—'}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(r.total)}</td>
                      <td style={{ textAlign: 'right', color: '#F59E0B', fontWeight: 600 }}>{fmt(r.montoDetraccion)}</td>
                      <td style={{ whiteSpace: 'nowrap', color: r.fechaDetraccion ? '#F8FAFC' : '#6B7280' }}>
                        {r.fechaDetraccion || '— sin registrar'}
                        {r.fechaDetraccion && r.metodoDetraccion === 'monto' && <span title="Identificada por monto (sin cuenta/glosa de detracción)" style={{ color: '#6B7280', fontSize: '0.62rem', marginLeft: 4 }}>~</span>}
                      </td>
                      <td style={{ textAlign: 'right', color: '#8B97A8' }}>{(r.montoPago ?? 0) > 0 ? fmt(r.montoPago) : '—'}</td>
                      <td style={{ whiteSpace: 'nowrap', color: r.fechaPago ? '#F8FAFC' : '#6B7280' }}>{r.fechaPago || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={5} style={{ textAlign: 'right' }}>TOTAL DETRACCIÓN ({filtered.length})</td>
                  <td style={{ textAlign: 'right', color: '#F59E0B' }}>{fmt(totalDetrac)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <div style={{ fontSize: '0.68rem', color: '#6B7280', marginTop: '0.8rem' }}>
          La fecha de detracción se identifica por la cuenta Banco de la Nación, la glosa, o el monto (marcado con ~). "Sin registrar" = el cobro/pago aún no aparece en los movimientos sincronizados.
        </div>
      </div>
    </div>
  );
}
