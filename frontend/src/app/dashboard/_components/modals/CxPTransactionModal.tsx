'use client';
import React, { useEffect, useState } from 'react';
import { API } from '../../_lib/constants';
import { fmt } from '../../_lib/formatters';
import { DocPreview } from './DocPreview';

export function CxPTransactionModal({ companyId, year, proveedor, codProveedor, onClose }: {
  companyId: string; year: number; proveedor: string; codProveedor: string; onClose: () => void;
}) {
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [anioFilter, setAnioFilter] = useState<number | null>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const params = new URLSearchParams({ year: String(year), codTercero: String(codProveedor) });
    fetch(`${API}/kpi/${companyId}/cxp-transactions?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setTxns(d.transactions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId, year, codProveedor]);

  const aniosPresentes = Array.from(new Set(txns.map((t: any) => t.Anio as number))).sort((a, b) => b - a);
  const filtered = anioFilter ? txns.filter((t: any) => t.Anio === anioFilter) : txns;
  const totalDeb = filtered.reduce((s: number, t: any) => s + (t.Debito || 0), 0);
  const totalCred = filtered.reduce((s: number, t: any) => s + (t.Credito || 0), 0);

  return (
    <>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div style={{ background: '#0D1A2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', maxWidth: '95vw', width: 1020, maxHeight: '85vh', overflow: 'auto', padding: '1.5rem' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#F8FAFC' }}>{proveedor}</div>
            <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginTop: '0.2rem' }}>Movimientos clase 42 (CxP) · {filtered.length} asientos · 🔗 = documento origen</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#8B97A8' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => setAnioFilter(null)}
            style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', border: anioFilter === null ? '1px solid rgba(32,126,131,0.5)' : '1px solid rgba(255,255,255,0.1)', background: anioFilter === null ? 'rgba(32,126,131,0.2)' : 'rgba(255,255,255,0.04)', color: anioFilter === null ? '#2BB4BB' : '#8B97A8', fontSize: '0.78rem', cursor: 'pointer' }}>
            Todos
          </button>
          {aniosPresentes.map(a => (
            <button key={a} onClick={() => setAnioFilter(a)}
              style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', border: anioFilter === a ? '1px solid rgba(32,126,131,0.5)' : '1px solid rgba(255,255,255,0.1)', background: anioFilter === a ? 'rgba(32,126,131,0.2)' : 'rgba(255,255,255,0.04)', color: anioFilter === a ? '#2BB4BB' : '#8B97A8', fontSize: '0.78rem', cursor: 'pointer' }}>
              {a}
            </button>
          ))}
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>📭</div>
            <div>Sin asientos disponibles. Ejecuta una sincronización completa para cargar los movimientos de CxP.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-s10" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>Fecha</th><th>Nro. Asiento</th><th>Cuenta</th>
                  <th style={{ minWidth: 240 }}>Glosa</th>
                  <th>Débito</th><th>Crédito</th><th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t: any, i: number) => {
                  const neto = (t.Credito || 0) - (t.Debito || 0);
                  return (
                    <tr key={i}>
                      <td style={{ textAlign: 'center', padding: '0 0.25rem' }}>
                        {t.NroD
                          ? <button onClick={e => { e.stopPropagation(); setDocPreview(String(t.NroD)); }}
                              title="Ver documento origen"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2BB4BB', fontSize: '0.9rem', padding: 0, lineHeight: 1 }}>🔗</button>
                          : <span style={{ color: '#4B5563', fontSize: '0.75rem' }}>—</span>
                        }
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{t.Fecha}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{t.NroAsiento}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#2BB4BB' }}>{t.CodCuenta}</td>
                      <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.Glosa}>{t.Glosa || '—'}</td>
                      <td style={{ color: t.Debito > 0 ? '#10B981' : '#8B97A8' }}>{t.Debito > 0 ? fmt(t.Debito) : '—'}</td>
                      <td style={{ color: t.Credito > 0 ? '#EF4444' : '#8B97A8' }}>{t.Credito > 0 ? fmt(t.Credito) : '—'}</td>
                      <td style={{ fontWeight: 600, color: neto > 0 ? '#EF4444' : '#10B981' }}>{fmt(Math.abs(neto))}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={5}>TOTAL</td>
                  <td>{fmt(totalDeb)}</td>
                  <td>{fmt(totalCred)}</td>
                  <td style={{ color: (totalCred - totalDeb) > 0 ? '#EF4444' : '#10B981' }}>{fmt(Math.abs(totalCred - totalDeb))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
    {docPreview && <DocPreview companyId={companyId} nroD={docPreview} onClose={() => setDocPreview(null)} />}
    </>
  );
}
