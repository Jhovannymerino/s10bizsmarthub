'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3202';
const YEAR = new Date().getFullYear();

const COMPANIES = [
  { codEmpresa: '80688541', shortName: 'INTEGRAL', fullName: 'INTEGRAL CONSULTORES S.A.C.' },
  { codEmpresa: '80688706', shortName: 'MEDARQ', fullName: 'MEDARQ S.A.C.' },
  { codEmpresa: '80688524', shortName: 'AMERICANA', fullName: 'COMPAÑÍA AMERICANA DE CONSTRUCCIÓN Y EQUIPAMIENTO S.A.C.' },
];

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

const COLORS_PIE = ['#0D3B5E', '#E25C1A', '#1E8449', '#2874A6', '#8E44AD', '#D35400', '#148F77', '#C0392B'];

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `S/ ${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `S/ ${(n / 1_000).toFixed(0)}K`;
  return `S/ ${n.toFixed(0)}`;
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

async function fetchApi(path: string, token: string) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color: color || '#0D3B5E' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>{sub}</div>}
    </div>
  );
}

function NoDataBanner({ kpi }: { kpi: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, color: '#6b7280', textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📭</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0D3B5E', marginBottom: '0.5rem' }}>Sin datos de {kpi}</div>
      <div style={{ fontSize: '0.875rem', maxWidth: 380 }}>
        El agente de sincronización aún no ha enviado datos desde S10.<br />
        Ejecuta <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>node sync-agent.js</code> desde la red CMO para cargar los datos.
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(COMPANIES[0]);
  const [pl, setPL] = useState<any>(null);
  const [cxc, setCxC] = useState<any>(null);
  const [caja, setCaja] = useState<any>(null);
  const [gav, setGAV] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'pl' | 'cxc' | 'caja' | 'gav'>('pl');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    setLoading(true);
    setPL(null); setCxC(null); setCaja(null); setGAV(null);

    const id = selectedCompany.codEmpresa;
    Promise.all([
      fetchApi(`/kpi/${id}/dashboard?year=${YEAR}`, token),
      fetchApi(`/kpi/${id}/cxc`, token),
      fetchApi(`/kpi/${id}/caja?year=${YEAR}`, token),
      fetchApi(`/kpi/${id}/gav?year=${YEAR}`, token),
    ])
      .then(([plData, cxcData, cajaData, gavData]) => {
        setPL(plData?.plMonthly ? plData : null);
        setCxC(cxcData?.clientes ? cxcData : null);
        setCaja(cajaData?.bancos ? cajaData : null);
        setGAV(gavData?.categorias ? gavData : null);
        setLoading(false);
      })
      .catch((err) => {
        if (err.message === 'unauthorized') { router.push('/login'); return; }
        setError(err.message);
        setLoading(false);
      });
  }, [router, selectedCompany]);

  if (error) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#C0392B', maxWidth: 400 }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Error de conexión</div>
        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>No se pudo conectar con la API.</div>
        <pre style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#9ca3af' }}>{error}</pre>
      </div>
    </div>
  );

  const ytd = pl?.ytd;
  const plMonthly = pl?.plMonthly || [];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div className="sidebar">
        <div style={{ padding: '1.5rem 1.25rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.02em' }}>S10 BizSmartHub</div>
        </div>

        {/* Company selector */}
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '0.65rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Empresa</div>
          {COMPANIES.map((co) => (
            <button
              key={co.codEmpresa}
              onClick={() => { setSelectedCompany(co); setActiveTab('pl'); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: selectedCompany.codEmpresa === co.codEmpresa ? 'rgba(255,255,255,0.15)' : 'none',
                border: 'none', borderRadius: '0.375rem',
                color: selectedCompany.codEmpresa === co.codEmpresa ? '#fff' : '#94A3B8',
                padding: '0.4rem 0.6rem', marginBottom: '0.2rem',
                cursor: 'pointer', fontSize: '0.8rem', fontWeight: selectedCompany.codEmpresa === co.codEmpresa ? 700 : 400,
                transition: 'all 0.15s',
              }}
            >
              {co.shortName}
            </button>
          ))}
        </div>

        {/* Nav tabs */}
        <nav style={{ padding: '0.75rem 0' }}>
          {(['pl', 'cxc', 'caja', 'gav'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`sidebar-link ${activeTab === tab ? 'active' : ''}`}
              style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
            >
              {tab === 'pl' && '📊 P&L'}
              {tab === 'cxc' && '💰 CxC Aging'}
              {tab === 'caja' && '🏦 Posición Caja'}
              {tab === 'gav' && '📋 GAV Detalle'}
            </button>
          ))}
        </nav>
        <div style={{ position: 'absolute', bottom: '1rem', padding: '0 1.25rem' }}>
          <button
            onClick={() => { localStorage.removeItem('token'); router.push('/login'); }}
            style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#CBD5E1', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem', width: '100%' }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="main-content" style={{ width: 'calc(100% - 240px)' }}>
        {/* Header */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0D3B5E', margin: 0 }}>
              {activeTab === 'pl' && 'Estado de Resultados'}
              {activeTab === 'cxc' && 'Cuentas por Cobrar — Aging'}
              {activeTab === 'caja' && 'Posición de Caja'}
              {activeTab === 'gav' && 'Gastos de Admin. y Ventas'}
            </h1>
            <div style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {selectedCompany.fullName} · YTD {YEAR} · Fuente: S10 ERP
            </div>
          </div>
          {loading && (
            <div style={{ fontSize: '0.8rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#E25C1A', animation: 'pulse 1.5s infinite' }} />
              Cargando...
            </div>
          )}
        </div>

        {/* P&L Tab */}
        {activeTab === 'pl' && !pl && !loading && <NoDataBanner kpi="P&L" />}
        {activeTab === 'pl' && ytd && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <KpiCard label="Ingresos YTD" value={fmt(ytd.ingresos)} color="#0D3B5E" />
              <KpiCard label="Margen Bruto" value={fmt(ytd.margenBruto)} sub={pct(ytd.margenBrutoPct)} color="#1E8449" />
              <KpiCard label="EBITDA" value={fmt(ytd.ebitda)} sub={pct(ytd.ebitdaPct)} color={ytd.ebitda >= 0 ? '#1E8449' : '#C0392B'} />
              <KpiCard label="GAV" value={fmt(ytd.gav)} color="#E25C1A" />
              <KpiCard label="Utilidad Neta" value={fmt(ytd.utilidadNeta)} color={ytd.utilidadNeta >= 0 ? '#1E8449' : '#C0392B'} />
            </div>

            <div className="kpi-card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 700, color: '#0D3B5E', marginBottom: '1rem' }}>Ingresos vs EBITDA — Mensual</div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={plMonthly.filter((m: any) => m.ingresos > 0)} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mesLabel" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="ingresos" name="Ingresos" fill="#0D3B5E" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ebitda" name="EBITDA" fill="#E25C1A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="kpi-card">
              <div style={{ fontWeight: 700, color: '#0D3B5E', marginBottom: '1rem' }}>Detalle Mensual</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table-s10">
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      {plMonthly.filter((m: any) => m.ingresos > 0 || m.gav > 0).map((m: any) => (
                        <th key={m.mes}>{m.mesLabel}</th>
                      ))}
                      <th style={{ background: '#1a5276' }}>YTD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: 'ingresos', label: 'Ingresos', fmt: 'currency' },
                      { key: 'costoDirecto', label: 'Costo Directo', fmt: 'currency' },
                      { key: 'margenBruto', label: 'Margen Bruto', fmt: 'currency', bold: true },
                      { key: 'margenBrutoPct', label: '% Margen', fmt: 'pct' },
                      { key: 'gav', label: 'GAV', fmt: 'currency' },
                      { key: 'ebitda', label: 'EBITDA', fmt: 'currency', bold: true },
                      { key: 'ebitdaPct', label: '% EBITDA', fmt: 'pct' },
                      { key: 'gastosFinancieros', label: 'Gastos Financieros', fmt: 'currency' },
                      { key: 'utilidadNeta', label: 'Utilidad Neta', fmt: 'currency', bold: true },
                    ].map((row) => {
                      const activeMeses = plMonthly.filter((m: any) => m.ingresos > 0 || m.gav > 0);
                      return (
                        <tr key={row.key} className={row.bold ? 'total-row' : ''}>
                          <td style={{ fontWeight: row.bold ? 700 : 400 }}>{row.label}</td>
                          {activeMeses.map((m: any) => {
                            const val = m[row.key];
                            const color = row.fmt !== 'pct' && row.key !== 'ingresos' && row.key !== 'costoDirecto' && row.key !== 'gav' && row.key !== 'gastosFinancieros'
                              ? (val >= 0 ? 'positive' : 'negative') : '';
                            return (
                              <td key={m.mes} className={color}>
                                {row.fmt === 'pct' ? pct(val) : fmt(val)}
                              </td>
                            );
                          })}
                          <td style={{ fontWeight: 700 }}>
                            {row.fmt === 'pct' ? pct(ytd[row.key]) : fmt(ytd[row.key])}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* CxC Tab */}
        {activeTab === 'cxc' && !cxc && !loading && <NoDataBanner kpi="CxC" />}
        {activeTab === 'cxc' && cxc && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              <KpiCard label="Cartera Total" value={fmt(cxc.totalSaldo)} color="#0D3B5E" />
              <KpiCard label="+90 días (vencido)" value={fmt(cxc.total90mas)} sub={pct(cxc.pct90mas)} color="#C0392B" />
              <KpiCard label="Clientes" value={cxc.clientes?.length?.toString()} color="#1E8449" />
            </div>
            <div className="kpi-card">
              <div style={{ fontWeight: 700, color: '#0D3B5E', marginBottom: '1rem' }}>Aging por Cliente</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table-s10">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>0-30 días</th>
                      <th>31-60 días</th>
                      <th>61-90 días</th>
                      <th>+90 días</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cxc.clientes?.map((c: any) => (
                      <tr key={c.codCliente}>
                        <td>{c.cliente}</td>
                        <td>{fmt(c.dias0_30)}</td>
                        <td>{fmt(c.dias31_60)}</td>
                        <td>{fmt(c.dias61_90)}</td>
                        <td className={c.dias90mas > 0 ? 'negative' : ''}>{fmt(c.dias90mas)}</td>
                        <td style={{ fontWeight: 600 }}>{fmt(c.saldoTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="total-row">
                      <td>TOTAL</td>
                      <td>{fmt(cxc.clientes?.reduce((s: number, c: any) => s + c.dias0_30, 0))}</td>
                      <td>{fmt(cxc.clientes?.reduce((s: number, c: any) => s + c.dias31_60, 0))}</td>
                      <td>{fmt(cxc.clientes?.reduce((s: number, c: any) => s + c.dias61_90, 0))}</td>
                      <td className="negative">{fmt(cxc.total90mas)}</td>
                      <td>{fmt(cxc.totalSaldo)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Caja Tab */}
        {activeTab === 'caja' && !caja && !loading && <NoDataBanner kpi="Caja" />}
        {activeTab === 'caja' && caja && (
          <div className="kpi-card">
            <div style={{ fontWeight: 700, color: '#0D3B5E', marginBottom: '1rem' }}>Flujo Neto por Banco</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table-s10">
                <thead>
                  <tr>
                    <th>Banco</th>
                    {MESES.map((m, i) => <th key={i}>{m}</th>)}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {caja.bancos?.map((b: any) => {
                    const total = Object.values(b.meses).reduce((s: number, v: any) => s + v, 0) as number;
                    return (
                      <tr key={b.codBanco}>
                        <td>{b.banco}</td>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <td key={m} className={(b.meses[m] || 0) < 0 ? 'negative' : ''}>
                            {fmt(b.meses[m] || 0)}
                          </td>
                        ))}
                        <td style={{ fontWeight: 700 }} className={total < 0 ? 'negative' : ''}>{fmt(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* GAV Tab */}
        {activeTab === 'gav' && !gav && !loading && <NoDataBanner kpi="GAV" />}
        {activeTab === 'gav' && gav && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="kpi-card">
                <div style={{ fontWeight: 700, color: '#0D3B5E', marginBottom: '1rem' }}>GAV por Categoría</div>
                <table className="table-s10">
                  <thead>
                    <tr>
                      <th>Categoría</th>
                      <th>YTD</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gav.categorias?.map((c: any) => (
                      <tr key={c.cod}>
                        <td>{c.descripcion}</td>
                        <td>{fmt(c.ytd)}</td>
                        <td>{pct(c.pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="total-row">
                      <td>TOTAL</td>
                      <td>{fmt(gav.total)}</td>
                      <td>100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="kpi-card">
                <div style={{ fontWeight: 700, color: '#0D3B5E', marginBottom: '1rem' }}>Distribución GAV</div>
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={gav.categorias?.map((c: any) => ({ name: c.descripcion, value: c.ytd }))}
                      cx="50%"
                      cy="45%"
                      outerRadius={110}
                      dataKey="value"
                      label={({ name, pct: p }) => `${(p * 100).toFixed(1)}%`}
                    >
                      {gav.categorias?.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS_PIE[i % COLORS_PIE.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
