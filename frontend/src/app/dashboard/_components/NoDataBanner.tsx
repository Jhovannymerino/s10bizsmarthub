import React from 'react';

export function NoDataBanner({ kpi }: { kpi: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: '#8B97A8', textAlign: 'center', padding: '2rem' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📭</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#F8FAFC', marginBottom: '0.5rem' }}>Sin datos de {kpi}</div>
      <div style={{ fontSize: '0.875rem', maxWidth: 380 }}>
        Ejecuta <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>node sync-agent.js</code> desde la red CMO para cargar los datos.
      </div>
    </div>
  );
}
