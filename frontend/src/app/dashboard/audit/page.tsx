'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3202';

const COMPANIES = [
  { codEmpresa: '22011489', shortName: 'CMO GROUP' },
  { codEmpresa: '80688541', shortName: 'INTEGRAL' },
  { codEmpresa: '80688706', shortName: 'MEDARQ' },
  { codEmpresa: '80688524', shortName: 'AMERICANA' },
];

const CURRENT_YEAR = new Date().getFullYear();

const VALIDATION_INFO: Record<string, { categoria: string; riesgo: string; norma: string }> = {
  V01_partida_doble:               { categoria: 'Integridad Contable', riesgo: 'CRÍTICO', norma: 'NIIF / Partida Doble' },
  V02_apertura:                    { categoria: 'Integridad Contable', riesgo: 'ALTO',    norma: 'NIC 1' },
  V03_patrimonio:                  { categoria: 'Patrimonio',          riesgo: 'CRÍTICO', norma: 'Art. 220 LGS / NIC 1' },
  V04_facturas_sin_asiento_top:    { categoria: 'Ingresos',            riesgo: 'ALTO',    norma: 'NIIF 15 / Bancarización' },
  V04b_facturas_sin_asiento_resumen:{ categoria: 'Ingresos',           riesgo: 'ALTO',    norma: 'NIIF 15' },
  V05_ingresos_sin_doc:            { categoria: 'Ingresos',            riesgo: 'ALTO',    norma: 'NIIF 15 / Art. 24-A LIR' },
  V06_sueldos_aging:               { categoria: 'Laboral',             riesgo: 'ALTO',    norma: 'DL 728' },
  V07_cts_depositos:               { categoria: 'Laboral',             riesgo: 'ALTO',    norma: 'DL 650' },
  V08_participaciones:             { categoria: 'Laboral',             riesgo: 'MEDIO',   norma: 'DL 892' },
  V09_bancos_detalle:              { categoria: 'Caja y Bancos',       riesgo: 'ALTO',    norma: 'NIIF 7' },
  V10_ob_cuentas_banco:            { categoria: 'Caja y Bancos',       riesgo: 'MEDIO',   norma: 'Control Interno' },
  V11_bancarizacion:               { categoria: 'Cumplimiento',        riesgo: 'ALTO',    norma: 'Ley 28194' },
  V12_pergola_aging:               { categoria: 'Cuentas por Cobrar',  riesgo: 'ALTO',    norma: 'NIIF 9' },
  V13_cxc_concentracion:           { categoria: 'Cuentas por Cobrar',  riesgo: 'MEDIO',   norma: 'NIIF 9' },
  V14_intercompany:                { categoria: 'Intercompañía',       riesgo: 'CRÍTICO', norma: 'Art. 32-A LIR / NIC 24' },
  V15_activo_fijo:                 { categoria: 'Activo Fijo',         riesgo: 'MEDIO',   norma: 'NIC 16' },
  V16_trazabilidad_pago:           { categoria: 'Caja y Bancos',       riesgo: 'ALTO',    norma: 'Control Interno' },
  V17_reconciliacion_ingr:         { categoria: 'Ingresos',            riesgo: 'ALTO',    norma: 'NIIF 15 / NIIF 9' },
  V18_tributos:                    { categoria: 'Tributario',          riesgo: 'ALTO',    norma: 'Código Tributario' },
  V19_balance_resumen:             { categoria: 'Balance General',     riesgo: 'MEDIO',   norma: 'NIC 1' },
  V20_fechas_anomalas:             { categoria: 'Calidad de Datos',    riesgo: 'MEDIO',   norma: 'Control Interno' },
  V21_identificadores_dup:         { categoria: 'Calidad de Datos',    riesgo: 'BAJO',    norma: 'Control Interno' },
  V22_conciliacion_estado:         { categoria: 'Caja y Bancos',       riesgo: 'ALTO',    norma: 'Control Interno' },
  V23_pl_anual:                    { categoria: 'P&L',                 riesgo: 'MEDIO',   norma: 'NIIF 15 / NIC 1' },
  V24_ob_vs_contable:              { categoria: 'Coherencia Modular',  riesgo: 'ALTO',    norma: 'Control Interno' },
  V25_pcd_criticas:                { categoria: 'Calidad de Datos',    riesgo: 'MEDIO',   norma: 'PCGR Perú' },
};

const RIESGO_STYLE: Record<string, React.CSSProperties> = {
  CRÍTICO: { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' },
  ALTO:    { background: '#FFEDD5', color: '#9A3412', border: '1px solid #FDBA74' },
  MEDIO:   { background: '#FEF9C3', color: '#854D0E', border: '1px solid #FDE047' },
  BAJO:    { background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC' },
};

function apiFetch(path: string, token: string) {
  return fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });
}

export default function AuditPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(COMPANIES[0].codEmpresa);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
  }, [router]);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError('');
    setData(null);
    apiFetch(`/kpi/${selectedCompany}/validation-forense?year=${year}`, token)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, selectedCompany, year]);

  useEffect(() => { load(); }, [load]);

  const companyName = COMPANIES.find((c) => c.codEmpresa === selectedCompany)?.shortName ?? selectedCompany;

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: '#F8FAFC', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: '#0D3B5E', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={() => router.push('/dashboard')}
          style={{ color: '#93C5FD', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Dashboard
        </button>
        <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>
          Auditoría Forense S10 — Matriz de Validación
        </h1>
      </div>

      {/* Controls */}
      <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Empresa:</label>
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            style={{ padding: '6px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 14 }}
          >
            {COMPANIES.map((c) => (
              <option key={c.codEmpresa} value={c.codEmpresa}>{c.shortName}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Año:</label>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            style={{ padding: '6px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 14 }}
          >
            {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <button
          onClick={load}
          style={{ padding: '7px 18px', background: '#E25C1A', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          Actualizar
        </button>
        {data?.syncedAt && (
          <span style={{ fontSize: 12, color: '#6B7280', marginLeft: 8 }}>
            Datos al: {new Date(data.syncedAt).toLocaleString('es-PE')}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: 24 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: '#6B7280', fontSize: 16 }}>
            Cargando validaciones...
          </div>
        )}

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 16, color: '#B91C1C' }}>
            Error al cargar: {error}
          </div>
        )}

        {data?.message && !data?.validations && (
          <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: 20, color: '#92400E', fontSize: 14 }}>
            {data.message}
          </div>
        )}

        {data?.validations && (
          <>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              <div style={{ background: '#fff', borderRadius: 10, padding: 20, border: '1px solid #E2E8F0', textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: '#0D3B5E' }}>{data.summary.total}</div>
                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Validaciones ejecutadas</div>
              </div>
              <div style={{ background: '#fff', borderRadius: 10, padding: 20, border: '1px solid #BBF7D0', textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: '#15803D' }}>{data.summary.ok}</div>
                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Ejecutadas correctamente</div>
              </div>
              <div style={{ background: '#fff', borderRadius: 10, padding: 20, border: '1px solid #FECACA', textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: '#DC2626' }}>{data.summary.errors}</div>
                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Con error de ejecución</div>
              </div>
            </div>

            {/* Validation matrix */}
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0D3B5E' }}>
                  Matriz de Validación — {companyName} {year}
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6B7280' }}>
                  Haga clic en una fila para ver los registros detallados del S10
                </p>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F1F5F9' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', color: '#374151', fontWeight: 600, width: 40 }}>#</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', color: '#374151', fontWeight: 600 }}>Validación</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', color: '#374151', fontWeight: 600 }}>Categoría</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center', color: '#374151', fontWeight: 600 }}>Riesgo</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', color: '#374151', fontWeight: 600 }}>Norma</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', color: '#374151', fontWeight: 600 }}>Registros</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center', color: '#374151', fontWeight: 600 }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.validations.map((v: any, idx: number) => {
                    const info = VALIDATION_INFO[v.id] ?? { categoria: '—', riesgo: 'MEDIO', norma: '—' };
                    const isExpanded = expandedId === v.id;
                    const rawRows = data.raw?.[v.id]?.rows ?? [];

                    return (
                      <React.Fragment key={v.id}>
                        <tr
                          onClick={() => setExpandedId(isExpanded ? null : v.id)}
                          style={{
                            borderBottom: '1px solid #F1F5F9',
                            cursor: 'pointer',
                            background: isExpanded ? '#EFF6FF' : idx % 2 === 0 ? '#fff' : '#FAFAFA',
                            transition: 'background 0.1s',
                          }}
                        >
                          <td style={{ padding: '10px 16px', color: '#9CA3AF', fontFamily: 'monospace' }}>{idx + 1}</td>
                          <td style={{ padding: '10px 16px' }}>
                            <div style={{ fontWeight: 600, color: '#1E293B' }}>{v.label}</div>
                          </td>
                          <td style={{ padding: '10px 16px', color: '#4B5563' }}>{info.categoria}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, ...RIESGO_STYLE[info.riesgo] }}>
                              {info.riesgo}
                            </span>
                          </td>
                          <td style={{ padding: '10px 16px', color: '#6B7280', fontStyle: 'italic', fontSize: 12 }}>{info.norma}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#374151' }}>
                            {v.rowCount.toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                            {v.error ? (
                              <span style={{ color: '#DC2626', fontWeight: 700, fontSize: 12 }}>ERROR</span>
                            ) : (
                              <Check size={16} color="#15803D" aria-hidden="true" />
                            )}
                          </td>
                        </tr>

                        {/* Expanded detail rows */}
                        {isExpanded && rawRows.length > 0 && (
                          <tr>
                            <td colSpan={7} style={{ padding: 0 }}>
                              <div style={{ background: '#F0F9FF', borderLeft: '4px solid #3B82F6', overflow: 'auto', maxHeight: 320 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                  <thead>
                                    <tr style={{ background: '#DBEAFE' }}>
                                      {Object.keys(rawRows[0]).map((k) => (
                                        <th key={k} style={{ padding: '6px 12px', textAlign: 'left', color: '#1E40AF', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                          {k}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rawRows.slice(0, 50).map((row: any, ri: number) => (
                                      <tr key={ri} style={{ borderBottom: '1px solid #BFDBFE', background: ri % 2 === 0 ? '#EFF6FF' : '#fff' }}>
                                        {Object.values(row).map((val: any, vi: number) => (
                                          <td key={vi} style={{ padding: '5px 12px', color: '#374151', whiteSpace: 'nowrap', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {val === null || val === undefined ? '—' : String(val)}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                    {rawRows.length > 50 && (
                                      <tr>
                                        <td colSpan={Object.keys(rawRows[0]).length} style={{ padding: '6px 12px', color: '#6B7280', fontStyle: 'italic' }}>
                                          ... y {rawRows.length - 50} registros más
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}

                        {isExpanded && v.error && (
                          <tr>
                            <td colSpan={7} style={{ padding: '12px 16px', background: '#FEF2F2', borderLeft: '4px solid #DC2626', color: '#B91C1C', fontSize: 13 }}>
                              Error SQL: {v.error}
                            </td>
                          </tr>
                        )}

                        {isExpanded && !v.error && rawRows.length === 0 && (
                          <tr>
                            <td colSpan={7} style={{ padding: '12px 16px', background: '#F0FDF4', borderLeft: '4px solid #16A34A', color: '#15803D', fontSize: 13 }}>
                              Sin hallazgos — resultado limpio para esta validación.
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer note */}
            <div style={{ marginTop: 20, padding: 16, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12, color: '#6B7280' }}>
              <strong>Nota:</strong> Estos datos se sincronizan automáticamente desde S10 SQL Server.
              Los resultados mostrados son idénticos a los que produce <code>validation-agent.js</code> ejecutado directamente sobre producción.
              Timestamp del último sync: {data.syncedAt ? new Date(data.syncedAt).toLocaleString('es-PE') : 'N/D'}.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
