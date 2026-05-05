'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, ComposedChart, ReferenceLine,
} from 'recharts';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3202';

const COMPANIES = [
  { codEmpresa: '22011489', shortName: 'CMO GROUP',  fullName: 'CMO GROUP S.A.' },
  { codEmpresa: '80688541', shortName: 'INTEGRAL',   fullName: 'INTEGRAL CONSULTORES S.A.C.' },
  { codEmpresa: '80688706', shortName: 'MEDARQ',     fullName: 'MEDARQ S.A.C.' },
  { codEmpresa: '80688524', shortName: 'AMERICANA',  fullName: 'COMPAÑÍA AMERICANA DE CONSTRUCCIÓN Y EQUIPAMIENTO S.A.C.' },
];
const GRUPO = { codEmpresa: 'GRUPO', shortName: 'GRUPO', fullName: 'Consolidado del Grupo' };

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
const COLORS_PIE = ['#0D3B5E', '#E25C1A', '#1E8449', '#2874A6', '#8E44AD', '#D35400', '#148F77', '#C0392B'];
const COLORS_EMPRESA = ['#0D3B5E', '#E25C1A', '#1E8449', '#2874A6'];

// ─── Formatters ───────────────────────────────
function fmt(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `S/ ${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `S/ ${(n / 1_000).toFixed(0)}K`;
  return `S/ ${n.toFixed(0)}`;
}
function pct(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return `${n.toFixed(1)}%`;
}
function fmtDays(n: number): string { return `${Math.round(n)} días`; }
function fmtX(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return `${n.toFixed(1)}x`;
}
function yoyPct(curr: number, prev: number): number {
  if (!prev || prev === 0) return 0;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

// ─── Semáforo ─────────────────────────────────
type Signal = 'green' | 'yellow' | 'red' | 'neutral';
function semaforo(key: string, value: number | null): Signal {
  if (value === null || value === undefined) return 'neutral';
  const v = value;
  switch (key) {
    case 'margenBrutoPct': return v >= 30 ? 'green' : v >= 15 ? 'yellow' : 'red';
    case 'ebitdaPct':      return v >= 15 ? 'green' : v >= 5  ? 'yellow' : 'red';
    case 'margenNetoPct':  return v >= 10 ? 'green' : v >= 3  ? 'yellow' : 'red';
    case 'gavPct':         return v <= 15 ? 'green' : v <= 25 ? 'yellow' : 'red';
    case 'dso':            return v <= 60 ? 'green' : v <= 90 ? 'yellow' : 'red';
    case 'covIntereses':   return v >= 3  ? 'green' : v >= 1.5? 'yellow' : 'red';
    case 'pct90mas':       return v <= 20 ? 'green' : v <= 40 ? 'yellow' : 'red';
    case 'concentracion':  return v <= 50 ? 'green' : v <= 70 ? 'yellow' : 'red';
    default: return 'neutral';
  }
}
const SIGNAL_COLOR: Record<Signal, string> = {
  green: '#1E8449', yellow: '#D4AC0D', red: '#C0392B', neutral: '#0D3B5E',
};
const SIGNAL_DOT: Record<Signal, string> = {
  green: '🟢', yellow: '🟡', red: '🔴', neutral: '',
};

// ─── API ──────────────────────────────────────
async function fetchApi(path: string, token: string) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

// ─── Components ───────────────────────────────
function KpiCard({ label, value, sub, signal, hint }: {
  label: string; value: string; sub?: string; signal?: Signal; hint?: string;
}) {
  const color = SIGNAL_COLOR[signal || 'neutral'];
  return (
    <div className="kpi-card" style={{ position: 'relative' }}>
      {signal && signal !== 'neutral' && (
        <span style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', fontSize: '0.85rem' }}>
          {SIGNAL_DOT[signal]}
        </span>
      )}
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color }}>{value}</div>
      {sub && <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>{sub}</div>}
      {hint && <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.25rem' }}>{hint}</div>}
    </div>
  );
}

function NoDataBanner({ kpi }: { kpi: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, color: '#6b7280', textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📭</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0D3B5E', marginBottom: '0.5rem' }}>Sin datos de {kpi}</div>
      <div style={{ fontSize: '0.875rem', maxWidth: 380 }}>
        Ejecuta <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>node sync-agent.js</code> desde la red CMO para cargar los datos.
      </div>
    </div>
  );
}

function DetalleModal({ title, rows, activeMeses, onClose }: {
  title: string; rows: any[]; activeMeses: number[]; onClose: () => void;
}) {
  if (!rows?.length) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '0.75rem', maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto', padding: '1.5rem', minWidth: 600 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0D3B5E' }}>Detalle: {title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table-s10" style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th style={{ minWidth: 60 }}>Cuenta</th>
                <th style={{ minWidth: 200 }}>Descripción</th>
                {activeMeses.map(m => <th key={m}>{MESES[m - 1]}</th>)}
                <th style={{ background: '#1a5276' }}>YTD</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.codCuenta}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{r.codCuenta}</td>
                  <td>{r.descripcion}</td>
                  {activeMeses.map(m => (
                    <td key={m} style={{ color: (r.meses[m] || 0) < 0 ? '#C0392B' : undefined }}>
                      {fmt(r.meses[m] || 0)}
                    </td>
                  ))}
                  <td style={{ fontWeight: 700 }}>{fmt(r.ytd)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td colSpan={2}>TOTAL</td>
                {activeMeses.map(m => (
                  <td key={m}>{fmt(rows.reduce((s: number, r: any) => s + (r.meses[m] || 0), 0))}</td>
                ))}
                <td>{fmt(rows.reduce((s: number, r: any) => s + r.ytd, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Waterfall chart ──────────────────────────
function buildWaterfallData(ytd: any) {
  const ing = ytd.ingresos || 0;
  const costo = ytd.costoDirecto || 0;
  const margen = ytd.margenBruto || 0;
  const gav = ytd.gav || 0;
  const ebitda = ytd.ebitda || 0;
  const gf = ytd.gastosFinancieros || 0;
  const util = ytd.utilidadNeta || 0;
  return [
    { name: 'Ingresos',    base: 0,                  value: ing,            type: 'income' },
    { name: 'Costo Dir.',  base: margen > 0 ? margen : 0, value: Math.abs(costo), type: 'expense' },
    { name: 'Margen',      base: 0,                  value: margen,         type: 'total' },
    { name: 'GAV',         base: ebitda > 0 ? ebitda : 0, value: Math.abs(gav), type: 'expense' },
    { name: 'EBITDA',      base: 0,                  value: ebitda,         type: 'total' },
    { name: 'Gastos Fin.', base: util > 0 ? util : 0, value: Math.abs(gf), type: 'expense' },
    { name: 'Utilidad',    base: 0,                  value: util,           type: 'total' },
  ];
}

function WaterfallChart({ ytd }: { ytd: any }) {
  const data = buildWaterfallData(ytd);
  const getColor = (type: string, value: number) => {
    if (type === 'total') return value >= 0 ? '#1E8449' : '#C0392B';
    if (type === 'expense') return '#C0392B';
    return '#0D3B5E';
  };

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 10, bottom: 5, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10 }} />
        <Tooltip
          formatter={(val: number, name: string) => name === 'base' ? null : [fmt(val), '']}
          labelFormatter={(l) => l}
        />
        <Bar dataKey="base" stackId="wf" fill="transparent" />
        <Bar dataKey="value" stackId="wf" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={getColor(entry.type, entry.value)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── YoY badge ────────────────────────────────
function YoYBadge({ curr, prev }: { curr: number; prev: number | undefined }) {
  if (!prev && prev !== 0) return null;
  const delta = yoyPct(curr, prev);
  const color = delta >= 0 ? '#1E8449' : '#C0392B';
  const arrow = delta >= 0 ? '▲' : '▼';
  return (
    <span style={{ fontSize: '0.7rem', color, marginLeft: '0.4rem', fontWeight: 600 }}>
      {arrow} {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

// ═══════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════
export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<typeof COMPANIES[0] | typeof GRUPO>(COMPANIES[0]);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [pl, setPL] = useState<any>(null);
  const [cxc, setCxC] = useState<any>(null);
  const [caja, setCaja] = useState<any>(null);
  const [gav, setGAV] = useState<any>(null);
  const [consolidado, setConsolidado] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'pl' | 'cxc' | 'caja' | 'gav'>('pl');
  const [drillDown, setDrillDown] = useState<{ title: string; rows: any[] } | null>(null);

  const isGrupo = selectedCompany.codEmpresa === 'GRUPO';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    setLoading(true);
    setPL(null); setCxC(null); setCaja(null); setGAV(null); setConsolidado(null);

    if (isGrupo) {
      Promise.all([
        fetchApi(`/kpi/consolidado?year=${selectedYear}`, token),
        fetchApi(`/kpi/${COMPANIES[0].codEmpresa}/cxc`, token),
      ])
        .then(([conData, cxcData]) => {
          setConsolidado(conData?.ytd ? conData : null);
          setCxC(cxcData?.clientes ? cxcData : null);
          setLoading(false);
        })
        .catch((err) => {
          if (err.message === 'unauthorized') { router.push('/login'); return; }
          setError(err.message);
          setLoading(false);
        });
    } else {
      const id = selectedCompany.codEmpresa;
      Promise.all([
        fetchApi(`/kpi/${id}/dashboard?year=${selectedYear}`, token),
        fetchApi(`/kpi/${id}/cxc`, token),
        fetchApi(`/kpi/${id}/caja?year=${selectedYear}`, token),
        fetchApi(`/kpi/${id}/gav?year=${selectedYear}`, token),
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
    }
  }, [router, selectedCompany, selectedYear]);

  if (error) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#C0392B', maxWidth: 400 }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Error de conexión</div>
        <pre style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#9ca3af' }}>{error}</pre>
      </div>
    </div>
  );

  const ytd = isGrupo ? consolidado?.ytd : pl?.ytd;
  const plMonthly: any[] = isGrupo ? (consolidado?.plMonthly || []) : (pl?.plMonthly || []);
  const detalle = pl?.detalle || {};
  const prevYear = pl?.prevYear || null;
  const activeMeses = plMonthly.filter((m: any) => m.ingresos > 0 || m.gav > 0).map((m: any) => m.mes);

  // DSO calculado (CxC saldo / ingresos anualizados × 365)
  const dso = (cxc?.totalSaldo && ytd?.ingresos && ytd.ingresos > 0)
    ? Math.round((cxc.totalSaldo / ytd.ingresos) * 365)
    : null;

  // Último mes con datos de caja
  const mesConDatos = caja?.totalPorMes
    ? Object.entries(caja.totalPorMes as Record<string, number>)
        .filter(([, v]) => (v as number) !== 0)
        .map(([k]) => parseInt(k))
    : [];
  const ultimoMesCaja = mesConDatos.length ? Math.max(...mesConDatos) : null;
  const saldoCaja = ultimoMesCaja && caja?.totalPorMes ? caja.totalPorMes[ultimoMesCaja] : null;

  // Cash Runway: saldo acumulado YTD / gasto fijo mensual (GAV + Gastos Fin.)
  // Usamos solo GAV + GastosFinancieros para evitar que costoDirecto negativo anule el denominador
  const saldoAcumCaja = caja?.totalPorMes
    ? Object.values(caja.totalPorMes as Record<string, number>).reduce((s, v) => s + (v as number), 0)
    : null;
  const gastoFijoMensual = (ytd && activeMeses.length > 0)
    ? (Math.abs(ytd.gav || 0) + Math.abs(ytd.gastosFinancieros || 0)) / activeMeses.length
    : null;
  const runway = (saldoAcumCaja != null && saldoAcumCaja > 0 && gastoFijoMensual != null && gastoFijoMensual > 100)
    ? Math.min(Math.round(saldoAcumCaja / gastoFijoMensual), 120)
    : null;

  const PL_ROWS = [
    { key: 'ingresos',          label: 'Ingresos',           fmt: 'currency', detalleKey: 'ingresos',          drillable: true },
    { key: 'costoDirecto',      label: 'Costo Directo',      fmt: 'currency', detalleKey: 'costoDirecto',      drillable: true },
    { key: 'margenBruto',       label: 'Margen Bruto',       fmt: 'currency', bold: true },
    { key: 'margenBrutoPct',    label: '% Margen',           fmt: 'pct' },
    { key: 'gav',               label: 'GAV',                fmt: 'currency', detalleKey: 'gav',               drillable: true },
    { key: 'ebitda',            label: 'EBITDA',             fmt: 'currency', bold: true },
    { key: 'ebitdaPct',         label: '% EBITDA',           fmt: 'pct' },
    { key: 'gastosFinancieros', label: 'Gastos Financieros', fmt: 'currency', detalleKey: 'gastosFinancieros', drillable: true },
    { key: 'utilidadNeta',      label: 'Utilidad Neta',      fmt: 'currency', bold: true },
    { key: 'utilidadNetaPct',   label: '% Margen Neto',      fmt: 'pct' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {drillDown && (
        <DetalleModal
          title={drillDown.title}
          rows={drillDown.rows}
          activeMeses={activeMeses.length ? activeMeses : [1,2,3,4,5,6,7,8,9,10,11,12]}
          onClose={() => setDrillDown(null)}
        />
      )}

      {/* ── Sidebar ── */}
      <div className="sidebar">
        <div style={{ padding: '1.5rem 1.25rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.02em' }}>S10 BizSmartHub</div>
        </div>

        {/* Company selector */}
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '0.65rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Empresa</div>

          {/* Botón GRUPO */}
          <button
            onClick={() => { setSelectedCompany(GRUPO); setActiveTab('pl'); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: isGrupo ? 'rgba(255,255,255,0.15)' : 'none',
              border: isGrupo ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
              borderRadius: '0.375rem',
              color: isGrupo ? '#fff' : '#94A3B8',
              padding: '0.4rem 0.6rem', marginBottom: '0.4rem',
              cursor: 'pointer', fontSize: '0.8rem',
              fontWeight: isGrupo ? 700 : 400,
            }}
          >
            🏢 GRUPO (Consolidado)
          </button>

          {/* Divisor */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0.25rem 0 0.4rem' }} />

          {COMPANIES.map((co) => {
            const active = !isGrupo && selectedCompany.codEmpresa === co.codEmpresa;
            return (
              <button
                key={co.codEmpresa}
                onClick={() => { setSelectedCompany(co); setActiveTab('pl'); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: active ? 'rgba(255,255,255,0.15)' : 'none',
                  border: 'none', borderRadius: '0.375rem',
                  color: active ? '#fff' : '#94A3B8',
                  padding: '0.4rem 0.6rem', marginBottom: '0.2rem',
                  cursor: 'pointer', fontSize: '0.8rem',
                  fontWeight: active ? 700 : 400,
                }}
              >
                {co.shortName}
              </button>
            );
          })}
        </div>

        {/* Year selector */}
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '0.65rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Año</div>
          {YEARS.map((y) => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              style={{
                display: 'inline-block', marginRight: '0.4rem',
                background: selectedYear === y ? 'rgba(255,255,255,0.15)' : 'none',
                border: selectedYear === y ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
                borderRadius: '0.375rem',
                color: selectedYear === y ? '#fff' : '#94A3B8',
                padding: '0.3rem 0.6rem',
                cursor: 'pointer', fontSize: '0.8rem', fontWeight: selectedYear === y ? 700 : 400,
              }}
            >
              {y}
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
              {tab === 'pl'  && '📊 P&L'}
              {tab === 'cxc' && '💰 CxC Aging'}
              {tab === 'caja'&& '🏦 Posición Caja'}
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

      {/* ── Main content ── */}
      <div className="main-content" style={{ width: 'calc(100% - 240px)' }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0D3B5E', margin: 0 }}>
              {activeTab === 'pl'  && (isGrupo ? 'Consolidado del Grupo' : 'Estado de Resultados')}
              {activeTab === 'cxc' && 'Cuentas por Cobrar — Aging'}
              {activeTab === 'caja'&& 'Posición de Caja'}
              {activeTab === 'gav' && 'Gastos de Admin. y Ventas'}
            </h1>
            <div style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {selectedCompany.fullName} · YTD {selectedYear} · Fuente: S10 ERP
              {prevYear && <span style={{ marginLeft: '0.5rem', color: '#9ca3af' }}>· vs {prevYear.year}</span>}
            </div>
          </div>
          {loading && <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Cargando...</div>}
        </div>

        {/* ═══ P&L Tab ═══ */}
        {activeTab === 'pl' && !ytd && !loading && <NoDataBanner kpi="P&L" />}
        {activeTab === 'pl' && ytd && (
          <>
            {/* KPI Cards con semáforo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <KpiCard
                label="Ingresos YTD"
                value={fmt(ytd.ingresos)}
                sub={prevYear ? `Ant: ${fmt(prevYear.ytd.ingresos)}` : undefined}
                signal="neutral"
              />
              <KpiCard
                label="Margen Bruto"
                value={fmt(ytd.margenBruto)}
                sub={pct(ytd.margenBrutoPct)}
                signal={semaforo('margenBrutoPct', ytd.margenBrutoPct)}
                hint={prevYear ? `Ant: ${pct(prevYear.ytd.margenBrutoPct)}` : undefined}
              />
              <KpiCard
                label="EBITDA"
                value={fmt(ytd.ebitda)}
                sub={pct(ytd.ebitdaPct)}
                signal={semaforo('ebitdaPct', ytd.ebitdaPct)}
                hint={prevYear ? `Ant: ${pct(prevYear.ytd.ebitdaPct)}` : undefined}
              />
              <KpiCard
                label="Margen Neto"
                value={pct(ytd.margenNetoPct ?? 0)}
                sub={fmt(ytd.utilidadNeta)}
                signal={semaforo('margenNetoPct', ytd.margenNetoPct)}
                hint={prevYear ? `Ant: ${pct(prevYear.ytd.margenNetoPct ?? 0)}` : undefined}
              />
              <KpiCard
                label="GAV / Ingresos"
                value={pct(ytd.gavPct ?? 0)}
                sub={fmt(ytd.gav)}
                signal={semaforo('gavPct', ytd.gavPct)}
              />
              {ytd.covIntereses !== null && ytd.covIntereses !== undefined && (
                <KpiCard
                  label="Cobertura Intereses"
                  value={fmtX(ytd.covIntereses)}
                  sub="EBITDA / Gastos Fin."
                  signal={semaforo('covIntereses', ytd.covIntereses)}
                />
              )}
            </div>

            {/* Vista Grupo: ranking de empresas */}
            {isGrupo && consolidado?.empresas?.length > 0 && (
              <div className="kpi-card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: 700, color: '#0D3B5E', marginBottom: '1rem' }}>Aporte por Empresa</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  {consolidado.empresas
                    .sort((a: any, b: any) => b.ytd.ingresos - a.ytd.ingresos)
                    .map((e: any, i: number) => (
                      <div key={e.codEmpresa} style={{ background: '#f8fafc', borderRadius: '0.5rem', padding: '0.75rem', borderLeft: `4px solid ${COLORS_EMPRESA[i % 4]}` }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: COLORS_EMPRESA[i % 4], textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                          {e.shortName} · {e.pctIngresos}% del grupo
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0D3B5E' }}>{fmt(e.ytd.ingresos)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.2rem' }}>
                          EBITDA {pct(e.ytd.ebitdaPct ?? 0)} · Neto {fmt(e.ytd.utilidadNeta)}
                        </div>
                      </div>
                    ))}
                </div>
                {/* Bar chart comparativo */}
                <div style={{ marginTop: '1rem' }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={consolidado.empresas.map((e: any) => ({ name: e.shortName, Ingresos: e.ytd.ingresos, EBITDA: e.ytd.ebitda, Utilidad: e.ytd.utilidadNeta }))} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Bar dataKey="Ingresos" fill="#0D3B5E" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="EBITDA" fill="#E25C1A" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Utilidad" fill="#1E8449" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Waterfall chart */}
            <div className="kpi-card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 700, color: '#0D3B5E', marginBottom: '0.75rem' }}>
                Cascada P&L — YTD {selectedYear}
              </div>
              <WaterfallChart ytd={ytd} />
            </div>

            {/* Gráfico mensual Ingresos vs EBITDA */}
            {!isGrupo && (
              <div className="kpi-card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: 700, color: '#0D3B5E', marginBottom: '1rem' }}>Ingresos vs EBITDA — Mensual</div>
                <ResponsiveContainer width="100%" height={220}>
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
            )}

            {/* Tabla Detalle Mensual con YoY */}
            <div className="kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ fontWeight: 700, color: '#0D3B5E' }}>Detalle Mensual</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  {!isGrupo && 'Click en Ingresos, Costo, GAV o Gastos para ver el desglose'}
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table-s10">
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      {plMonthly.filter((m: any) => m.ingresos > 0 || m.gav > 0).map((m: any) => (
                        <th key={m.mes}>{m.mesLabel}</th>
                      ))}
                      <th style={{ background: '#1a5276' }}>YTD {selectedYear}</th>
                      {prevYear && <th style={{ background: '#2c3e50' }}>YTD {prevYear.year}</th>}
                      {prevYear && <th style={{ background: '#34495e' }}>∆ YoY</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {PL_ROWS.map((row) => {
                      const mesesActivos = plMonthly.filter((m: any) => m.ingresos > 0 || m.gav > 0);
                      const isDrillable = !isGrupo && row.drillable && detalle[row.detalleKey!]?.length > 0;
                      // utilidadNetaPct en snapshots viejos se guardó como margenNetoPct
                      const resolveYtdVal = (ytdObj: any) =>
                        ytdObj?.[row.key] !== undefined ? ytdObj[row.key] : (row.key === 'utilidadNetaPct' ? ytdObj?.['margenNetoPct'] : undefined);
                      const prevVal = resolveYtdVal(prevYear?.ytd);
                      const currVal = resolveYtdVal(ytd);
                      const delta = prevVal !== undefined ? yoyPct(currVal, prevVal) : null;
                      return (
                        <tr
                          key={row.key}
                          className={row.bold ? 'total-row' : ''}
                          onClick={isDrillable ? () => setDrillDown({ title: row.label, rows: detalle[row.detalleKey!] }) : undefined}
                          style={{ cursor: isDrillable ? 'pointer' : 'default' }}
                          title={isDrillable ? `Ver desglose de ${row.label}` : undefined}
                        >
                          <td style={{ fontWeight: row.bold ? 700 : 400 }}>
                            {row.label}
                            {isDrillable && (
                              <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: '#2874A6' }}>
                                ▶ {detalle[row.detalleKey!].length} cuentas
                              </span>
                            )}
                          </td>
                          {mesesActivos.map((m: any) => {
                            const val = m[row.key];
                            return (
                              <td key={m.mes} className={val < 0 && row.fmt !== 'pct' ? 'negative' : ''}>
                                {row.fmt === 'pct' ? pct(val) : fmt(val)}
                              </td>
                            );
                          })}
                          <td style={{ fontWeight: 700 }}>
                            {row.fmt === 'pct' ? pct(currVal) : fmt(currVal)}
                          </td>
                          {prevYear && (
                            <td style={{ color: '#6b7280', fontStyle: 'italic' }}>
                              {row.fmt === 'pct' ? pct(prevVal ?? 0) : fmt(prevVal ?? 0)}
                            </td>
                          )}
                          {prevYear && (
                            <td style={{ fontWeight: 600, color: delta !== null ? (delta >= 0 ? '#1E8449' : '#C0392B') : '#6b7280', fontSize: '0.85rem' }}>
                              {delta !== null ? `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}%` : '—'}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ═══ CxC Tab ═══ */}
        {activeTab === 'cxc' && !cxc && !loading && <NoDataBanner kpi="CxC" />}
        {activeTab === 'cxc' && cxc && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <KpiCard label="Cartera Total" value={fmt(cxc.totalSaldo)} signal="neutral" />
              <KpiCard
                label="+90 días vencido"
                value={fmt(cxc.total90mas)}
                sub={pct(cxc.pct90mas)}
                signal={semaforo('pct90mas', cxc.pct90mas)}
              />
              <KpiCard label="N° Clientes" value={String(cxc.numClientes ?? cxc.clientes?.length ?? 0)} signal="neutral" />
              {dso !== null && (
                <KpiCard
                  label="DSO (Días de Cobro)"
                  value={fmtDays(dso)}
                  sub="Cartera / (Ingresos / 365)"
                  signal={semaforo('dso', dso)}
                />
              )}
              <KpiCard
                label="Concentración Top 3"
                value={pct(cxc.concentracionTop3 ?? 0)}
                sub="% cartera en 3 principales clientes"
                signal={semaforo('concentracion', cxc.concentracionTop3)}
              />
            </div>
            <div className="kpi-card">
              <div style={{ fontWeight: 700, color: '#0D3B5E', marginBottom: '1rem' }}>Aging por Cliente</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table-s10">
                  <thead>
                    <tr>
                      <th>Cliente</th><th>0-30 días</th><th>31-60 días</th><th>61-90 días</th><th>+90 días</th><th>Total</th><th>% Cartera</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...cxc.clientes].sort((a: any, b: any) => b.saldoTotal - a.saldoTotal).map((c: any) => (
                      <tr key={c.codCliente}>
                        <td>{c.cliente}</td>
                        <td>{fmt(c.dias0_30)}</td>
                        <td>{fmt(c.dias31_60)}</td>
                        <td>{fmt(c.dias61_90)}</td>
                        <td className={c.dias90mas > 0 ? 'negative' : ''}>{fmt(c.dias90mas)}</td>
                        <td style={{ fontWeight: 600 }}>{fmt(c.saldoTotal)}</td>
                        <td style={{ color: '#6b7280' }}>{cxc.totalSaldo > 0 ? pct((c.saldoTotal / cxc.totalSaldo) * 100) : '—'}</td>
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
                      <td>100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ═══ Caja Tab ═══ */}
        {activeTab === 'caja' && !caja && !loading && <NoDataBanner kpi="Caja" />}
        {activeTab === 'caja' && caja && (
          <>
            {/* KPI cards de caja */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {saldoCaja !== null && (
                <KpiCard
                  label={`Saldo Neto (${MESES[(ultimoMesCaja ?? 1) - 1]})`}
                  value={fmt(saldoCaja)}
                  sub="Flujo neto del último mes con datos"
                  signal={saldoCaja >= 0 ? 'green' : 'red'}
                />
              )}
              {runway !== null && (
                <KpiCard
                  label="Cash Runway"
                  value={`${runway} mes${runway !== 1 ? 'es' : ''}`}
                  sub="Saldo / gasto operativo mensual"
                  signal={runway >= 3 ? 'green' : runway >= 1 ? 'yellow' : 'red'}
                />
              )}
              <KpiCard
                label="Bancos activos"
                value={String(caja.bancos?.filter((b: any) => Object.values(b.meses).some((v: any) => v !== 0)).length ?? 0)}
                signal="neutral"
              />
            </div>

            {/* Tabla flujo por banco */}
            <div className="kpi-card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 700, color: '#0D3B5E', marginBottom: '1rem' }}>Flujo Neto por Banco</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table-s10">
                  <thead>
                    <tr>
                      <th>Banco</th>
                      {MESES.map((m, i) => <th key={i}>{m}</th>)}
                      <th>Total Año</th>
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
                  {caja.totalPorMes && (
                    <tfoot>
                      <tr className="total-row">
                        <td>TOTAL</td>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <td key={m} className={(caja.totalPorMes[m] || 0) < 0 ? 'negative' : ''}>
                            {fmt(caja.totalPorMes[m] || 0)}
                          </td>
                        ))}
                        <td>{fmt(Object.values(caja.totalPorMes as Record<string, number>).reduce((s, v) => s + v, 0))}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </>
        )}

        {/* ═══ GAV Tab ═══ */}
        {activeTab === 'gav' && !gav && !loading && <NoDataBanner kpi="GAV" />}
        {activeTab === 'gav' && gav && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="kpi-card">
              <div style={{ fontWeight: 700, color: '#0D3B5E', marginBottom: '1rem' }}>GAV por Categoría</div>
              <table className="table-s10">
                <thead>
                  <tr><th>Categoría</th><th>YTD</th><th>% GAV</th><th>% Ingresos</th></tr>
                </thead>
                <tbody>
                  {gav.categorias?.map((c: any) => (
                    <tr key={c.cod}>
                      <td>{c.descripcion}</td>
                      <td>{fmt(c.ytd)}</td>
                      <td>{pct(c.pct)}</td>
                      <td style={{ color: '#6b7280' }}>
                        {ytd?.ingresos > 0 ? pct((c.ytd / ytd.ingresos) * 100) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="total-row">
                    <td>TOTAL</td>
                    <td>{fmt(gav.total)}</td>
                    <td>100%</td>
                    <td style={{ color: '#6b7280' }}>
                      {ytd?.ingresos > 0 ? pct((gav.total / ytd.ingresos) * 100) : '—'}
                    </td>
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
                    cx="50%" cy="45%" outerRadius={110} dataKey="value"
                    label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(1)}%` : ''}
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
        )}
      </div>
    </div>
  );
}
