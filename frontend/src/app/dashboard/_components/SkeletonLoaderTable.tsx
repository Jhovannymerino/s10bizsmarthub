export function SkeletonLoaderTable({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div aria-busy="true" aria-live="polite" aria-label="Cargando datos…">
      {/* Header strip */}
      <div className="skeleton-card" style={{ borderRadius: '0.875rem', padding: '1rem 1.25rem', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div className="skeleton" style={{ height: 16, width: 180, borderRadius: 4 }} />
          <div className="skeleton" style={{ height: 16, width: 100, borderRadius: 4, marginLeft: 'auto' }} />
        </div>
        <div className="skeleton" style={{ height: 11, width: 260, borderRadius: 3, opacity: 0.5 }} />
      </div>

      {/* Table skeleton */}
      <div className="skeleton-card" style={{ borderRadius: '0.875rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
        {/* thead */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '0.75rem', padding: '0.75rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 12, borderRadius: 3, opacity: 0.6 }} />
          ))}
        </div>
        {/* rows */}
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '0.75rem', padding: '0.6rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            {Array.from({ length: cols }).map((_, col) => (
              <div key={col} className="skeleton" style={{ height: 11, borderRadius: 3, opacity: Math.max(0.15, 1 - row * 0.08), width: col === 0 ? '75%' : '60%' }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
