import React from 'react';
import { Signal, SIGNAL_COLOR, SIGNAL_DOT } from '../_lib/semaforo';

export function KpiCard({ label, value, sub, signal, hint, onClick }: {
  label: string; value: string; sub?: string; signal?: Signal; hint?: string; onClick?: () => void;
}) {
  return (
    <div className="kpi-card" title={hint} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div style={{ fontSize: '0.7rem', color: '#8B97A8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>
        {label}
        {signal && signal !== 'neutral' && (
          <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem' }}>{SIGNAL_DOT[signal]}</span>
        )}
      </div>
      <div className="kpi-value" style={{ fontWeight: 700, color: signal ? SIGNAL_COLOR[signal] : '#F8FAFC', fontFamily: 'var(--font-mono)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '0.72rem', color: '#8B97A8', marginTop: '0.2rem' }}>{sub}</div>}
    </div>
  );
}
