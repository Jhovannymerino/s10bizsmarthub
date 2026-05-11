'use client';
import React, { useState } from 'react';
import { MESES } from '../../_lib/constants';
import { fmt } from '../../_lib/formatters';
import { TransactionModal } from './TransactionModal';

export function DetalleModal({ title, rows, activeMeses, companyId, year, onClose }: {
  title: string; rows: any[]; activeMeses: number[]; companyId: string; year: number; onClose: () => void;
}) {
  const [txDrill, setTxDrill] = useState<{ codCuenta: string; descripcion: string } | null>(null);

  if (!rows?.length) return null;
  return (
    <>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div style={{ background: '#0D1A2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto', padding: '1.5rem', minWidth: 600 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#F8FAFC' }}>Detalle: {title}</div>
            <div style={{ fontSize: '0.75rem', color: '#8B97A8', marginTop: '0.2rem' }}>Click en una cuenta para ver los asientos individuales</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#8B97A8' }}>✕</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table-s10" style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th style={{ minWidth: 60 }}>Cuenta</th>
                <th style={{ minWidth: 200 }}>Descripción</th>
                {activeMeses.map(m => <th key={m}>{MESES[m - 1]}</th>)}
                <th style={{ background: 'rgba(32,126,131,0.2)' }}>YTD</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.codCuenta} style={{ cursor: 'pointer' }}
                  onClick={() => setTxDrill({ codCuenta: r.codCuenta, descripcion: r.descripcion })}
                  title="Ver asientos individuales">
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#2BB4BB' }}>{r.codCuenta}</td>
                  <td style={{ color: '#2BB4BB' }}>{r.descripcion} <span style={{ fontSize: '0.65rem' }}>▶</span></td>
                  {activeMeses.map(m => (
                    <td key={m} style={{ color: (r.meses[m] || 0) < 0 ? '#EF4444' : undefined }}>
                      {fmt(r.meses[m] || 0)}
                    </td>
                  ))}
                  <td style={{ fontWeight: 700 }}>{fmt(r.ytd)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td colSpan={2}>TOTAL</td>
                {activeMeses.map(m => (
                  <td key={m}>{fmt(rows.reduce((s: number, r: any) => s + (r.meses[m] || 0), 0))}</td>
                ))}
                <td>{fmt(rows.reduce((s: number, r: any) => s + r.ytd, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
    {txDrill && (
      <TransactionModal
        companyId={companyId}
        year={year}
        codCuenta={txDrill.codCuenta}
        descripcion={txDrill.descripcion}
        onClose={() => setTxDrill(null)}
      />
    )}
    </>
  );
}
