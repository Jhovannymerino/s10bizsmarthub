'use client';
import React, { useLayoutEffect, useRef } from 'react';
import { Signal, SIGNAL_COLOR, SIGNAL_DOT } from '../_lib/semaforo';

export function KpiCard({ label, value, sub, signal, hint, onClick }: {
  label: string; value: string; sub?: string; signal?: Signal; hint?: string; onClick?: () => void;
}) {
  const valueRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = valueRef.current;
    const card = el?.parentElement;
    if (!el || !card) return;
    // Root font size (respects browser zoom)
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    // Card horizontal padding = 1.5rem × 2
    const available = card.clientWidth - 3 * rootPx;
    if (available <= 0) return;
    // IBM Plex Mono character width ≈ 0.60 × em; use 0.63 for a small safety margin
    const chars = value.length || 1;
    const idealRem = available / (chars * 0.63 * rootPx);
    el.style.fontSize = `${Math.min(1.4, Math.max(0.5, idealRem)).toFixed(2)}rem`;
  }, [value]);

  return (
    <div className="kpi-card" title={hint} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div style={{ fontSize: '0.7rem', color: '#8B97A8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>
        {label}
        {signal && signal !== 'neutral' && (
          <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem' }}>{SIGNAL_DOT[signal]}</span>
        )}
      </div>
      <div
        ref={valueRef}
        className="kpi-value"
        style={{ fontWeight: 700, color: signal ? SIGNAL_COLOR[signal] : '#F8FAFC', fontFamily: 'var(--font-mono)' }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: '0.72rem', color: '#8B97A8', marginTop: '0.2rem' }}>{sub}</div>}
    </div>
  );
}
