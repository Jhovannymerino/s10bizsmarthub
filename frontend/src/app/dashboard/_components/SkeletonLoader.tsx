export function SkeletonLoader() {
  return (
    <div>
      {/* KPI cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton skeleton-card" style={{ height: 88 }} />
        ))}
      </div>
      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="skeleton skeleton-card" style={{ height: 260 }} />
        <div className="skeleton skeleton-card" style={{ height: 260 }} />
      </div>
      {/* Table */}
      <div className="skeleton-card" style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '0.875rem', padding: '1rem', marginBottom: '1.5rem' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 14, borderRadius: 4 }} />
          ))}
        </div>
        {/* Table rows */}
        {[...Array(6)].map((_, row) => (
          <div key={row} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
            {[...Array(4)].map((_, col) => (
              <div key={col} className="skeleton" style={{ height: 12, borderRadius: 3, opacity: 1 - row * 0.1 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
