'use client';
import React, { useEffect, useMemo, useState } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortState>({ col: '', dir: 'asc' });
  const onSort = (col: string) => setSort(s => toggleSort(s, col));

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const params = new URLSearchParams({ nroD });
    fetch(`${API}/kpi/${companyId}/document-payments?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setPayments(d.payments || []); setLoading(false); })
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
      <div
        style={{ background: '#0D1A2D', border: '1px solid rgba(43,180,187,0.25)', borderRadius: '0.75rem', maxWidth: '95vw', width: 820, maxHeight: '80vh', overflow: 'auto', padding: '1.5rem' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC' }}>Pagos del documento</div>
            <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginTop: '0.2rem' }}>
              {docLabel} · Total pagado: <span style={{ color: '#2BB4BB', fontWeight: 600 }}>{fmt(totalPagado)}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#8B97A8' }}>✕</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#8B97A8' }}>Cargando pagos...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#8B97A8', fontSize: '0.85rem' }}>
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
                    <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#2BB4BB' }}>{p.NroAsiento}</td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.DesBanco}>{p.DesBanco || '—'}</td>
                    <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.72rem' }}>{p.Tercero || '—'}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#8B97A8' }} title={p.Glosa}>{p.Glosa || '—'}</td>
                    <td style={{ color: (p.Debito || 0) > 0 ? '#10B981' : '#8B97A8' }}>
                      {(p.Debito || 0) > 0 ? fmt(p.Debito) : '—'}
                    </td>
                    <td style={{ color: (p.Credito || 0) > 0 ? '#EF4444' : '#8B97A8' }}>
                      {(p.Credito || 0) > 0 ? fmt(p.Credito) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={5}>TOTAL ({filtered.length} movimiento{filtered.length !== 1 ? 's' : ''})</td>
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
