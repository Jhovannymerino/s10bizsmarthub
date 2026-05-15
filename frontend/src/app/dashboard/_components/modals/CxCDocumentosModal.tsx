'use client';
import React, { useEffect, useState } from 'react';
import { API } from '../../_lib/constants';
import { fmt } from '../../_lib/formatters';

const fUSD = (v: number) => `$ ${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// CodMoneda en S10: '01'=PEN, '02'=USD — toleramos el campo como 'Moneda' o 'CodMoneda', y '02' o '2'
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
  const [filter, setFilter] = useState<'all' | 'vencido' | 'vigente'>('all');

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

  const filtered = docs.filter(d => {
    if (filter === 'vencido') return (d.DiasVencido ?? 0) > 0;
    if (filter === 'vigente') return (d.DiasVencido ?? 0) <= 0;
    return true;
  });

  const totalPEN = filtered.filter(d => getMoneda(d) === 'PEN').reduce((s, d) => s + (d.Saldo ?? 0), 0);
  const totalUSD = filtered.filter(d => getMoneda(d) === 'USD').reduce((s, d) => s + (d.Saldo ?? 0), 0);
  const hasMixed = totalPEN > 0 && totalUSD > 0;

  const diasColor = (dias: number) => {
    if (dias <= 0) return '#10B981';
    if (dias <= 30) return '#F59E0B';
    if (dias <= 60) return '#F97316';
    return '#EF4444';
  };

  const btnStyle = (active: boolean) => ({
    padding: '0.25rem 0.75rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.78rem',
    border: active ? '1px solid rgba(32,126,131,0.5)' : '1px solid rgba(255,255,255,0.1)',
    background: active ? 'rgba(32,126,131,0.2)' : 'rgba(255,255,255,0.04)',
    color: active ? '#2BB4BB' : '#8B97A8',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div style={{ background: '#0D1A2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', maxWidth: '95vw', width: 1100, maxHeight: '85vh', overflow: 'auto', padding: '1.5rem' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#F8FAFC' }}>{cliente}</div>
            <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginTop: '0.2rem' }}>
              Documentos pendientes · {filtered.length} documentos
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#8B97A8' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button style={btnStyle(filter === 'all')} onClick={() => setFilter('all')}>Todos ({docs.length})</button>
          <button style={btnStyle(filter === 'vencido')} onClick={() => setFilter('vencido')}>
            Vencidos ({docs.filter(d => (d.DiasVencido ?? 0) > 0).length})
          </button>
          <button style={btnStyle(filter === 'vigente')} onClick={() => setFilter('vigente')}>
            Vigentes ({docs.filter(d => (d.DiasVencido ?? 0) <= 0).length})
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>Sin documentos pendientes.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-s10" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Serie / N°</th>
                  <th>Fecha Doc.</th>
                  <th>Vencimiento</th>
                  <th style={{ textAlign: 'right' }}>Días Venc.</th>
                  <th style={{ textAlign: 'center' }}>Moneda</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Pagado</th>
                  <th style={{ textAlign: 'right' }}>Saldo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d: any, i: number) => {
                  const moneda = getMoneda(d);
                  const isUSD = moneda === 'USD';
                  return (
                    <tr key={i} style={{ background: isUSD ? 'rgba(74,222,128,0.03)' : undefined }}>
                      <td style={{ color: '#8B97A8', fontSize: '0.72rem' }}>{d.DesTipo || d.TipoDoc}</td>
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
                      <td style={{ textAlign: 'right', color: '#8B97A8' }}>{fMon(moneda, d.Pagado ?? 0)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: (d.Saldo ?? 0) > 0 ? '#F8FAFC' : '#8B97A8' }}>
                        {fMon(moneda, d.Saldo ?? 0)}
                      </td>
                      <td style={{ fontSize: '0.70rem', color: '#8B97A8' }}>{d.Estado || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={8} style={{ textAlign: 'right' }}>SALDO PENDIENTE</td>
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
  );
}
