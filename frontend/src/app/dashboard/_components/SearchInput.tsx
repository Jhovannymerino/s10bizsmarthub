import React from 'react';

export function SearchInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: '#8B97A8', fontSize: '0.8rem', pointerEvents: 'none' }}>🔍</span>
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'Buscar...'}
        style={{ padding: '0.4rem 0.75rem 0.4rem 2rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#F8FAFC', fontSize: '0.8rem', outline: 'none', width: 220, fontFamily: 'var(--font-inter), sans-serif', transition: 'border-color 0.15s' }}
        onFocus={e => (e.target.style.borderColor = 'rgba(32,126,131,0.5)')}
        onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
      />
    </div>
  );
}
