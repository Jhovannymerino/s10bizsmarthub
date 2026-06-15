import React from 'react';
import { Download } from 'lucide-react';

export function ExportBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} title="Exportar a CSV (Excel)" aria-label="Exportar a CSV"
      style={{ padding: '0.3rem 0.75rem', borderRadius: '0.375rem', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#8B97A8', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
      <Download size={13} aria-hidden="true" /> CSV
    </button>
  );
}
