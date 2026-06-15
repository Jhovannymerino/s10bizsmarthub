'use client';
import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, ChevronRight, ChevronDown, Search } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3202';

const COMPANIES = [
  { codEmpresa: '22011489', shortName: 'CMO GROUP' },
  { codEmpresa: '80688541', shortName: 'INTEGRAL' },
  { codEmpresa: '80688706', shortName: 'MEDARQ' },
  { codEmpresa: '80688524', shortName: 'AMERICANA' },
];
const CURRENT_YEAR = new Date().getFullYear();
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

const CLASE_NAMES: Record<string, string> = {
  '10': 'Caja y Bancos', '12': 'CxC Comerciales', '13': 'CxC Relacionadas',
  '14': 'CxC Personal/Accionistas', '16': 'CxC Diversas', '17': 'Entregas a Rendir',
  '18': 'Servicios Pagados por Anticipado', '20': 'Mercaderías', '24': 'Materias Primas',
  '25': 'Materiales Auxiliares', '33': 'Inmuebles, Maq. y Equipo', '34': 'Intangibles',
  '39': 'Depreciación Acumulada', '40': 'Tributos por Pagar', '41': 'Remuneraciones por Pagar',
  '42': 'CxP Comerciales', '43': 'CxP Relacionadas', '44': 'CxP Directores/Gerentes',
  '45': 'Obligaciones Financieras', '46': 'CxP Diversas', '47': 'CxP Diversas Relacionadas',
  '50': 'Capital', '52': 'Capital Adicional', '58': 'Reservas', '59': 'Resultados Acumulados',
  '60': 'Compras', '61': 'Variación de Existencias', '62': 'Gastos de Personal',
  '63': 'Servicios Prestados por Terceros', '64': 'Gastos por Tributos', '65': 'Otros Gastos de Gestión',
  '66': 'Gastos Financieros', '67': 'Gastos Financieros', '68': 'Valuación y Deterioro',
  '69': 'Costo de Ventas', '70': 'Ventas', '74': 'Descuentos sobre Ventas',
  '75': 'Otros Ingresos de Gestión', '77': 'Ingresos Financieros', '79': 'Cargas Imputables a Cuentas de Costos',
  '91': 'Costos Directos', '94': 'Gastos Administrativos', '95': 'Gastos de Ventas', '97': 'Gastos Financieros',
};

function fmt(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return '—';
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-${abs}` : abs;
}

function apiFetch(path: string, token: string) {
  return fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });
}

export default function LedgerPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, fontFamily: 'Inter, sans-serif', color: '#6B7280' }}>Cargando...</div>}>
      <LedgerPageInner />
    </Suspense>
  );
}

function LedgerPageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [token, setToken] = useState('');

  // Estado inicial desde query params (deep-link "Ver en el mayor")
  const [company, setCompany] = useState(sp.get('company') || COMPANIES[0].codEmpresa);
  const [year, setYear] = useState(parseInt(sp.get('year') || `${CURRENT_YEAR}`, 10));
  const [cuenta, setCuenta] = useState(sp.get('cuenta') || '');
  const [mes, setMes] = useState<number | ''>(sp.get('mes') ? parseInt(sp.get('mes')!, 10) : '');
  const [nroD, setNroD] = useState(sp.get('nroD') || '');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [tree, setTree] = useState<any>(null);
  const [ledger, setLedger] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedClases, setExpandedClases] = useState<Set<string>>(new Set());
  const [expandedGrupos, setExpandedGrupos] = useState<Set<string>>(new Set());
  const [asientoDrill, setAsientoDrill] = useState<string | null>(null);

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (t) setToken(t);
  }, []);

  // Cargar árbol de cuentas
  useEffect(() => {
    if (!token) return;
    apiFetch(`/kpi/${company}/ledger/cuentas?year=${year}`, token)
      .then(setTree)
      .catch(() => setTree(null));
  }, [token, company, year]);

  // Cargar mayor filtrado
  const loadLedger = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ year: `${year}`, page: `${page}`, pageSize: '100' });
    if (cuenta) params.set('cuenta', cuenta);
    if (mes) params.set('mes', `${mes}`);
    if (nroD) params.set('nroD', nroD);
    if (search) params.set('search', search);
    apiFetch(`/kpi/${company}/ledger?${params}`, token)
      .then(setLedger)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, company, year, cuenta, mes, nroD, search, page]);

  useEffect(() => { loadLedger(); }, [loadLedger]);

  // Reset page cuando cambian filtros
  useEffect(() => { setPage(1); }, [company, year, cuenta, mes, nroD, search]);

  const totalPages = ledger ? Math.max(1, Math.ceil(ledger.total / ledger.pageSize)) : 1;
  const companyName = COMPANIES.find((c) => c.codEmpresa === company)?.shortName ?? company;
  const cuentaLabel = useMemo(() => {
    if (!cuenta || !tree) return '';
    for (const cl of tree.clases) for (const gr of cl.grupos) {
      const c = gr.cuentas.find((x: any) => x.codCuenta === cuenta);
      if (c) return `${c.codCuenta} — ${c.desCuenta}`;
    }
    return cuenta;
  }, [cuenta, tree]);

  const exportCsv = () => {
    if (!ledger?.rows?.length) return;
    const head = ['Fecha', 'Asiento', 'NroD', 'Cuenta', 'Descripcion', 'Glosa', 'Tercero', 'Debito', 'Credito', 'Saldo'];
    const lines = ledger.rows.map((r: any) => [
      new Date(r.fecha).toLocaleDateString('es-PE'), r.nroAsiento, r.nroD ?? '', r.codCuenta,
      `"${(r.desCuenta ?? '').replace(/"/g, '""')}"`, `"${(r.glosa ?? '').replace(/"/g, '""')}"`,
      `"${(r.tercero ?? '').replace(/"/g, '""')}"`, r.debito, r.credito, r.saldoAcumulado,
    ].join(','));
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `mayor_${companyName}_${year}${cuenta ? '_' + cuenta : ''}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const toggleClase = (k: string) => setExpandedClases((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleGrupo = (k: string) => setExpandedGrupos((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: '#F8FAFC', minHeight: '100vh' }}>
      {asientoDrill && (
        <AsientoModal company={company} nroAsiento={asientoDrill} token={token} onClose={() => setAsientoDrill(null)} />
      )}

      {/* Header */}
      <div style={{ background: '#0D3B5E', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => router.push('/dashboard')}
          style={{ color: '#93C5FD', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>
          ← Dashboard
        </button>
        <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>
          El Mayor — Libro Mayor Contable
        </h1>
        <span style={{ color: '#93C5FD', fontSize: 12 }}>Toda la verdad contable · trazabilidad de cualquier asiento</span>
      </div>

      {/* Controls */}
      <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={company} onChange={(e) => setCompany(e.target.value)}
          style={{ padding: '6px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 14 }}>
          {COMPANIES.map((c) => <option key={c.codEmpresa} value={c.codEmpresa}>{c.shortName}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
          style={{ padding: '6px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 14 }}>
          {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3, CURRENT_YEAR - 4].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={mes} onChange={(e) => setMes(e.target.value ? parseInt(e.target.value) : '')}
          style={{ padding: '6px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 14 }}>
          <option value="">Todo el año</option>
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: 8, color: '#9CA3AF' }} />
          <input type="text" placeholder="Buscar glosa / tercero / doc..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '6px 12px 6px 28px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 14, width: 240 }} />
        </div>
        {(cuenta || nroD) && (
          <button onClick={() => { setCuenta(''); setNroD(''); }}
            style={{ padding: '6px 12px', background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
            Limpiar filtro {cuenta ? `cuenta` : 'doc'} ✕
          </button>
        )}
        <button onClick={exportCsv}
          style={{ padding: '7px 18px', background: '#E25C1A', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>
          Exportar CSV
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, padding: 16, alignItems: 'flex-start' }}>
        {/* Árbol de cuentas */}
        <div style={{ width: 320, flexShrink: 0, background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', maxHeight: 'calc(100vh - 180px)', overflow: 'auto' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', fontWeight: 700, fontSize: 14, color: '#0D3B5E', position: 'sticky', top: 0, background: '#fff' }}>
            Plan de Cuentas {year}
          </div>
          <div style={{ padding: 8 }}>
            <button onClick={() => setCuenta('')}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: !cuenta ? '#EFF6FF' : 'transparent', color: !cuenta ? '#1D4ED8' : '#374151' }}>
              Todas las cuentas
            </button>
            {tree?.clases?.map((cl: any) => (
              <div key={cl.clase}>
                <div onClick={() => toggleClase(cl.clase)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#0D3B5E' }}>
                  {expandedClases.has(cl.clase) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>{cl.clase}</span>
                  <span style={{ color: '#6B7280', fontWeight: 400, fontSize: 12 }}>{CLASE_NAMES[cl.clase] ?? ''}</span>
                </div>
                {expandedClases.has(cl.clase) && cl.grupos.map((gr: any) => (
                  <div key={gr.grupoCuenta} style={{ marginLeft: 14 }}>
                    <div onClick={() => toggleGrupo(gr.grupoCuenta)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#374151' }}>
                      {expandedGrupos.has(gr.grupoCuenta) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      {gr.grupoCuenta}
                    </div>
                    {expandedGrupos.has(gr.grupoCuenta) && gr.cuentas.map((c: any) => (
                      <button key={c.codCuenta} onClick={() => setCuenta(c.codCuenta)}
                        title={`${fmt(c.saldo)} · ${c.movimientos} movs`}
                        style={{ display: 'block', width: '100%', textAlign: 'left', marginLeft: 18, padding: '4px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 12, background: cuenta === c.codCuenta ? '#EFF6FF' : 'transparent', color: cuenta === c.codCuenta ? '#1D4ED8' : '#4B5563' }}>
                        <span style={{ fontFamily: 'monospace' }}>{c.codCuenta}</span> {c.desCuenta}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Tabla del mayor */}
        <div style={{ flex: 1, background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0D3B5E' }}>
                {cuentaLabel || `Mayor completo — ${companyName} ${year}`}
              </h2>
              {ledger && (
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B7280' }}>
                  {ledger.total.toLocaleString()} líneas · Débito {fmt(ledger.totalDebito)} · Crédito {fmt(ledger.totalCredito)} · Neto {fmt(ledger.saldoNeto)}
                </p>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 50, color: '#6B7280' }}>Cargando mayor...</div>
          ) : error ? (
            <div style={{ padding: 16, color: '#B91C1C' }}>Error: {error}</div>
          ) : !ledger?.rows?.length ? (
            <div style={{ textAlign: 'center', padding: 50, color: '#6B7280' }}>Sin movimientos para este filtro.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#F1F5F9', position: 'sticky', top: 0 }}>
                    <th style={thL}>Fecha</th>
                    <th style={thL}>Asiento</th>
                    <th style={thL}>Doc.</th>
                    {!cuenta && <th style={thL}>Cuenta</th>}
                    <th style={thL}>Glosa</th>
                    <th style={thL}>Tercero</th>
                    <th style={thR}>Débito</th>
                    <th style={thR}>Crédito</th>
                    <th style={thR}>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.rows.map((r: any) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={tdL}>{new Date(r.fecha).toLocaleDateString('es-PE')}</td>
                      <td style={tdL}>
                        <button onClick={() => setAsientoDrill(r.nroAsiento)}
                          style={{ background: 'none', border: 'none', color: '#1D4ED8', cursor: 'pointer', fontFamily: 'monospace', textDecoration: 'underline', textDecorationStyle: 'dotted', padding: 0, fontSize: 12.5 }}>
                          {r.nroAsiento}
                        </button>
                      </td>
                      <td style={{ ...tdL, fontFamily: 'monospace', color: '#6B7280' }}>
                        {r.nroD ? (
                          <button onClick={() => setNroD(String(r.nroD))} title="Filtrar por este documento"
                            style={{ background: 'none', border: 'none', color: '#0D9488', cursor: 'pointer', fontFamily: 'monospace', padding: 0, fontSize: 12.5 }}>
                            {r.nroD}
                          </button>
                        ) : '—'}
                      </td>
                      {!cuenta && (
                        <td style={tdL}>
                          <button onClick={() => setCuenta(r.codCuenta)} title={r.desCuenta}
                            style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer', fontFamily: 'monospace', padding: 0, fontSize: 12.5 }}>
                            {r.codCuenta}
                          </button>
                        </td>
                      )}
                      <td style={{ ...tdL, maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.glosa}>{r.glosa || '—'}</td>
                      <td style={{ ...tdL, maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.tercero}>{r.tercero || '—'}</td>
                      <td style={{ ...tdR, color: r.debito > 0 ? '#15803D' : '#CBD5E1' }}>{r.debito > 0 ? fmt(r.debito) : '—'}</td>
                      <td style={{ ...tdR, color: r.credito > 0 ? '#DC2626' : '#CBD5E1' }}>{r.credito > 0 ? fmt(r.credito) : '—'}</td>
                      <td style={{ ...tdR, fontWeight: 600, color: r.saldoAcumulado < 0 ? '#DC2626' : '#0D3B5E' }}>{fmt(r.saldoAcumulado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          {ledger && totalPages > 1 && (
            <div style={{ padding: 12, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, borderTop: '1px solid #E2E8F0' }}>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={pgBtn(page <= 1)}>← Anterior</button>
              <span style={{ fontSize: 13, color: '#6B7280' }}>Página {page} de {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={pgBtn(page >= totalPages)}>Siguiente →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal: partida doble completa de un asiento ──
function AsientoModal({ company, nroAsiento, token, onClose }: { company: string; nroAsiento: string; token: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    apiFetch(`/kpi/${company}/ledger/asiento/${nroAsiento}`, token).then(setData).catch(() => setData(null));
  }, [company, nroAsiento, token]);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 10, maxWidth: 900, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0D3B5E' }}>Asiento {nroAsiento}</div>
            {data && (
              <div style={{ fontSize: 13, color: '#6B7280' }}>
                {data.fecha ? new Date(data.fecha).toLocaleDateString('es-PE') : ''} · {data.glosa || 'Sin glosa'}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}><X size={20} /></button>
        </div>
        {!data ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#6B7280' }}>Cargando...</div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F1F5F9' }}>
                  <th style={thL}>Cuenta</th><th style={thL}>Descripción</th><th style={thL}>Glosa</th>
                  <th style={thL}>Tercero</th><th style={thR}>Débito</th><th style={thR}>Crédito</th>
                </tr>
              </thead>
              <tbody>
                {data.lineas.map((l: any) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ ...tdL, fontFamily: 'monospace' }}>{l.codCuenta}</td>
                    <td style={tdL}>{l.desCuenta}</td>
                    <td style={{ ...tdL, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.glosa}>{l.glosa || '—'}</td>
                    <td style={tdL}>{l.tercero || '—'}</td>
                    <td style={{ ...tdR, color: l.debito > 0 ? '#15803D' : '#CBD5E1' }}>{l.debito > 0 ? fmt(l.debito) : '—'}</td>
                    <td style={{ ...tdR, color: l.credito > 0 ? '#DC2626' : '#CBD5E1' }}>{l.credito > 0 ? fmt(l.credito) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#F8FAFC', fontWeight: 700 }}>
                  <td colSpan={4} style={{ ...tdR }}>TOTALES</td>
                  <td style={tdR}>{fmt(data.totalDebito)}</td>
                  <td style={tdR}>{fmt(data.totalCredito)}</td>
                </tr>
              </tfoot>
            </table>
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: data.cuadra ? '#DCFCE7' : '#FEE2E2', color: data.cuadra ? '#166534' : '#991B1B' }}>
              {data.cuadra ? '✓ Asiento cuadrado — partida doble balanceada (Débito = Crédito)' : `⚠ Descuadre de ${fmt(Math.abs(data.totalDebito - data.totalCredito))}`}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const thL: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', color: '#374151', fontWeight: 600, fontSize: 12 };
const thR: React.CSSProperties = { ...thL, textAlign: 'right' };
const tdL: React.CSSProperties = { padding: '6px 12px', textAlign: 'left', color: '#374151' };
const tdR: React.CSSProperties = { padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace' };
const pgBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13,
  cursor: disabled ? 'not-allowed' : 'pointer', background: disabled ? '#F3F4F6' : '#fff', color: disabled ? '#9CA3AF' : '#374151',
});
