'use client';
import React, { useEffect, useState } from 'react';
import { API, MESES } from '../../_lib/constants';
import { fmt } from '../../_lib/formatters';
import { DocPreview } from './DocPreview';

export function AccountTxnModal({ companyId, year, codCuenta, descripcion, endpoint, codTercero, onClose }: {
  companyId: string; year: number; codCuenta: string; descripcion: string; endpoint: string; codTercero?: string; onClose: () => void;
}) {
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [mesFilter, setMesFilter] = useState<number | null>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setFetchError(false);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const params = new URLSearchParams({ year: String(year), codCuenta });
    if (codTercero) params.set('codTercero', codTercero);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    fetch(`${API}/kpi/${companyId}/${endpoint}?${params}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal,
    })
      .then(r => r.json())
      .then(d => { setTxns(d.transactions || []); setLoading(false); })
      .catch(() => { setFetchError(true); setLoading(false); })
      .finally(() => clearTimeout(timer));
  }, [companyId, year, codCuenta, codTercero, endpoint, retryCount]);

  const mesesPresentes = Array.from(new Set(txns.map((t: any) => t.Mes as number))).sort((a, b) => a - b);
  const filtered = mesFilter ? txns.filter((t: any) => t.Mes === mesFilter) : txns;
  const totalDeb = filtered.reduce((s: number, t: any) => s + (t.Debito || 0), 0);
  const totalCred = filtered.reduce((s: number, t: any) => s + (t.Credito || 0), 0);

  return (
  <>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={onClose}>
      <div style={{ background: '#0D1A2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', maxWidth: '95vw', width: 960, maxHeight: '85vh', overflow: 'auto', padding: '1.5rem' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#F8FAFC' }}>{codCuenta} — {descripcion}</div>
            <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginTop: '0.2rem' }}>Asientos individuales · {year} · {filtered.length} movimientos · 🔗 = documento origen</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#8B97A8' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => setMesFilter(null)} style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', border: mesFilter === null ? '1px solid rgba(32,126,131,0.5)' : '1px solid rgba(255,255,255,0.1)', background: mesFilter === null ? 'rgba(32,126,131,0.2)' : 'rgba(255,255,255,0.04)', color: mesFilter === null ? '#2BB4BB' : '#8B97A8', fontSize: '0.78rem', cursor: 'pointer' }}>Todos</button>
          {mesesPresentes.map(m => (
            <button key={m} onClick={() => setMesFilter(m)} style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', border: mesFilter === m ? '1px solid rgba(32,126,131,0.5)' : '1px solid rgba(255,255,255,0.1)', background: mesFilter === m ? 'rgba(32,126,131,0.2)' : 'rgba(255,255,255,0.04)', color: mesFilter === m ? '#2BB4BB' : '#8B97A8', fontSize: '0.78rem', cursor: 'pointer' }}>{MESES[m - 1]}</button>
          ))}
        </div>
        {loading ? <div style={{ textAlign: 'center', padding: '3rem', color: '#8B97A8' }}>Cargando asientos...</div>
        : fetchError ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ color: '#EF4444', fontSize: '0.85rem', marginBottom: '1rem' }}>Error al cargar los datos.</div>
            <button onClick={() => setRetryCount(c => c + 1)} style={{ padding: '0.45rem 1.25rem', background: 'rgba(32,126,131,0.15)', border: '1px solid rgba(32,126,131,0.3)', borderRadius: '0.5rem', color: '#2BB4BB', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>↻ Reintentar</button>
          </div>
        ) : filtered.length === 0 ? <div style={{ textAlign: 'center', padding: '3rem', color: '#8B97A8', fontSize: '0.85rem' }}>Sin asientos para esta cuenta en {year}.</div>
        : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-s10" style={{ fontSize: '0.78rem' }}>
              <thead><tr><th style={{ width: 32 }}></th><th>Fecha</th><th>Nro. Asiento</th><th style={{ minWidth: 240 }}>Glosa</th><th style={{ minWidth: 140 }}>Tercero</th><th>Débito</th><th>Crédito</th><th>Neto</th></tr></thead>
              <tbody>
                {filtered.map((t: any, i: number) => {
                  const neto = (t.Debito || 0) - (t.Credito || 0);
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
                      <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.Glosa}>{t.Glosa || '—'}</td>
                      <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.Tercero || '—'}</td>
                      <td style={{ color: t.Debito > 0 ? '#10B981' : '#8B97A8' }}>{t.Debito > 0 ? fmt(t.Debito) : '—'}</td>
                      <td style={{ color: t.Credito > 0 ? '#EF4444' : '#8B97A8' }}>{t.Credito > 0 ? fmt(t.Credito) : '—'}</td>
                      <td style={{ fontWeight: 600, color: neto < 0 ? '#EF4444' : '#10B981' }}>{fmt(neto)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr className="total-row"><td colSpan={5}>TOTAL</td><td>{fmt(totalDeb)}</td><td>{fmt(totalCred)}</td><td style={{ color: (totalDeb - totalCred) < 0 ? '#EF4444' : '#10B981' }}>{fmt(totalDeb - totalCred)}</td></tr></tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
    {docPreview && <DocPreview companyId={companyId} nroD={docPreview} onClose={() => setDocPreview(null)} />}
  </>
  );
}
