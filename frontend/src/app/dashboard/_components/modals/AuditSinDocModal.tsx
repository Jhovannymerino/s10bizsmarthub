'use client';
import React, { useEffect, useState } from 'react';
import { API } from '../../_lib/constants';
import { fmt } from '../../_lib/formatters';

export function AuditSinDocModal({ companyId, year, clase, desClase, onClose }: {
  companyId: string; year: number; clase: string; desClase: string; onClose: () => void;
}) {
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    fetch(`${API}/kpi/${companyId}/audit/sin-doc-transactions?year=${year}&clase=${clase}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setTxns(d.transactions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId, year, clase]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={onClose}>
      <div style={{ background: '#0D1A2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', maxWidth: '95vw', width: 980, maxHeight: '85vh', overflow: 'auto', padding: '1.5rem' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#F8FAFC' }}>Clase {clase} — Asientos sin documento fuente</div>
            <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginTop: '0.2rem' }}>{desClase} · {year} · {txns.length} asientos sin NroD</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#8B97A8' }}>✕</button>
        </div>
        {loading ? <div style={{ textAlign: 'center', padding: '3rem', color: '#8B97A8' }}>Cargando...</div>
        : txns.length === 0 ? <div style={{ textAlign: 'center', padding: '3rem', color: '#10B981', fontSize: '0.85rem' }}>✓ Sin asientos sin documento para esta clase.</div>
        : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-s10" style={{ fontSize: '0.78rem' }}>
              <thead><tr><th>Fecha</th><th>Nro. Asiento</th><th>Cuenta</th><th style={{ minWidth: 200 }}>Glosa</th><th>Tercero</th><th>Débito</th><th>Crédito</th><th>Monto</th></tr></thead>
              <tbody>
                {txns.map((t: any, i: number) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: 'nowrap' }}>{t.Fecha}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{String(t.NroAsiento).slice(0, 8)}…</td>
                    <td style={{ fontFamily: 'monospace', color: '#2BB4BB', fontSize: '0.72rem' }}>{t.CodCuenta}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.Glosa}>{t.Glosa || '—'}</td>
                    <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.Tercero || '—'}</td>
                    <td style={{ color: t.Debito > 0 ? '#10B981' : '#8B97A8' }}>{t.Debito > 0 ? fmt(t.Debito) : '—'}</td>
                    <td style={{ color: t.Credito > 0 ? '#EF4444' : '#8B97A8' }}>{t.Credito > 0 ? fmt(t.Credito) : '—'}</td>
                    <td style={{ fontWeight: 600, color: '#F59E0B' }}>{fmt(t.Monto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="total-row"><td colSpan={7}>TOTAL MONTO SIN DOC</td><td>{fmt(txns.reduce((s: number, t: any) => s + (t.Monto || 0), 0))}</td></tr></tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
