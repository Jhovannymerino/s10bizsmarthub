'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { API } from '../../_lib/constants';
import { fmt } from '../../_lib/formatters';
import { SortState, sortRows, toggleSort } from '../../_lib/sort';
import { SortTh } from '../../_lib/SortTh';

export function DocPaymentsModal({ companyId, nroD, docLabel, totalPagado, onClose }: {
  companyId: string;
  nroD: string;
  docLabel: string;
  totalPagado: number;
  onClose: () => void;
}) {
  const [payments, setPayments] = useState<any[]>([]);
  const [detraccion, setDetraccion] = useState(0);
  const [detraccionCobrada, setDetraccionCobrada] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortState>({ col: '', dir: 'asc' });
  const onSort = (col: string) => setSort(s => toggleSort(s, col));
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => { modalRef.current?.focus(); }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const params = new URLSearchParams({ nroD });
    fetch(`${API}/kpi/${companyId}/document-payments?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setPayments(d.payments || []); setDetraccion(d.detraccion || 0); setDetraccionCobrada(!!d.detraccionCobrada); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId, nroD]);

  const filtered = useMemo(
    () => sortRows(payments, sort.col, sort.dir),
    [payments, sort],
  );

  const totalDeb = filtered.reduce((s, p) => s + (p.Debito || 0), 0);
  const totalCred = filtered.reduce((s, p) => s + (p.Credito || 0), 0);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}
    >
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="doc-payments-modal-title" tabIndex={-1}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        style={{ background: 'var(--modal-bg)', border: '1px solid rgba(43,180,187,0.25)', borderRadius: '0.75rem', maxWidth: '95vw', width: 820, maxHeight: '80vh', overflow: 'auto', padding: '1.5rem', outline: 'none' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div id="doc-payments-modal-title" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Pagos del documento</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {docLabel} · Total pagado: <span style={{ color: 'var(--primary-light)', fontWeight: 600 }}>{fmt(totalPagado)}</span>
              {detraccion > 0 && (
                <> · Detracción: <span style={{ color: 'var(--yellow)', fontWeight: 600 }}>{fmt(detraccion)}</span>
                  <span style={{ color: detraccionCobrada ? 'var(--green)' : 'var(--text-muted)', marginLeft: '0.3rem' }}>
                    {detraccionCobrada ? '(identificada abajo)' : '(no ubicada en estos movimientos)'}
                  </span>
                </>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={18} aria-hidden="true" /></button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Cargando pagos...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <div>No se encontraron movimientos de caja vinculados a este documento.</div>
            <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#6B7280' }}>
              El pago puede haberse registrado fuera del rango de años sincronizados (2022–presente).
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-s10" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <SortTh col="Fecha" label="Fecha" sort={sort} onSort={onSort} />
                  <SortTh col="tipo" label="Tipo" sort={sort} onSort={onSort} />
                  <SortTh col="NroAsiento" label="Asiento" sort={sort} onSort={onSort} />
                  <SortTh col="DesBanco" label="Cuenta bancaria" sort={sort} onSort={onSort} style={{ minWidth: 180 }} />
                  <SortTh col="Tercero" label="Tercero" sort={sort} onSort={onSort} style={{ minWidth: 140 }} />
                  <SortTh col="Glosa" label="Glosa" sort={sort} onSort={onSort} style={{ minWidth: 200 }} />
                  <SortTh col="Debito" label="Débito" sort={sort} onSort={onSort} />
                  <SortTh col="Credito" label="Crédito" sort={sort} onSort={onSort} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: any, i: number) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.Fecha}</td>
                    <td>
                      {p.tipo && (() => {
                        const c = p.tipo === 'Detracción'
                          ? { bg: 'rgba(245,158,11,0.15)', fg: 'var(--yellow)' }
                          : p.tipo === 'Pago'
                            ? { bg: 'rgba(239,68,68,0.12)', fg: 'var(--red)' }
                            : { bg: 'rgba(16,185,129,0.12)', fg: 'var(--green)' };
                        return <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 7px', borderRadius: 3, background: c.bg, color: c.fg, whiteSpace: 'nowrap' }}>{p.tipo}</span>;
                      })()}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--primary-light)' }}>{p.NroAsiento}</td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.DesBanco}>{p.DesBanco || '—'}</td>
                    <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.72rem' }}>{p.Tercero || '—'}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }} title={p.Glosa}>{p.Glosa || '—'}</td>
                    <td style={{ color: (p.Debito || 0) > 0 ? 'var(--green)' : 'var(--text-muted)' }}>
                      {(p.Debito || 0) > 0 ? fmt(p.Debito) : '—'}
                    </td>
                    <td style={{ color: (p.Credito || 0) > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                      {(p.Credito || 0) > 0 ? fmt(p.Credito) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={6}>TOTAL ({filtered.length} movimiento{filtered.length !== 1 ? 's' : ''})</td>
                  <td>{fmt(totalDeb)}</td>
                  <td>{fmt(totalCred)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
