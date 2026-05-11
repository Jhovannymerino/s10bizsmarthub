'use client';
import React, { useEffect, useState } from 'react';
import { API } from '../../_lib/constants';
import { fmt } from '../../_lib/formatters';

export function DocPreview({ companyId, nroD, onClose }: { companyId: string; nroD: string; onClose: () => void }) {
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API}/kpi/${companyId}/documento?nroD=${encodeURIComponent(nroD)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setDoc(d && d.tipo ? d : null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId, nroD]);

  const TIPO_LABEL: Record<string, string> = { emitida: 'Factura Emitida', recibida: 'Factura Recibida', honorario: 'Honorario' };
  const found = doc && doc.tipo;
  const d = doc?.doc;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={onClose}>
      <div style={{ background: '#0D1A2D', border: '1px solid rgba(43,180,187,0.3)', borderRadius: '0.75rem', width: 520, padding: '1.5rem', maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 700, color: '#2BB4BB', fontSize: '0.9rem' }}>
            {loading ? 'Cargando documento...' : found ? `${TIPO_LABEL[doc.tipo] || doc.tipo} · ${String(nroD).slice(-8).toUpperCase()}` : `Sin documento fuente`}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8B97A8', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>
        {!loading && found && d && (() => {
          const rows = [
            ['Serie-Número', `${d.Serie || '—'}-${d.Numero}`],
            ['Fecha', d.FechaDocumento],
            ['Vencimiento', d.FechaVencimiento],
            ['Tipo', d.TipoDocumento],
            ['Cliente / Proveedor', d.Cliente || d.Proveedor || '—'],
            ['RUC', d.RucCliente || d.RucProveedor || '—'],
            ['Neto', fmt(d.TotalNeto)],
            ['IGV', fmt(d.TotalImpuesto)],
            ['Total', fmt(d.Total)],
            ['Pagado', fmt(d.TotalPagado)],
            ['Saldo', fmt(d.Saldo ?? d.TotalSaldo)],
            ['Estado', d.Estado],
            ...(d.Observacion ? [['Observación', d.Observacion]] : []),
            ...(d.Categoria ? [['Categoría', d.Categoria]] : []),
          ];
          return (
            <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
              <tbody>
                {rows.map(([k, v]) => v && v !== '—' && v !== fmt(0) ? (
                  <tr key={k} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '0.4rem 0.5rem', color: '#8B97A8', fontWeight: 600, whiteSpace: 'nowrap', width: '40%' }}>{k}</td>
                    <td style={{ padding: '0.4rem 0.5rem', color: '#F8FAFC' }}>{v}</td>
                  </tr>
                ) : null)}
              </tbody>
            </table>
          );
        })()}
        {!loading && !found && (
          <div style={{ color: '#8B97A8', fontSize: '0.82rem' }}>Este asiento no tiene documento fuente registrado (asiento manual, planilla, ajuste o depreciación).</div>
        )}
      </div>
    </div>
  );
}
