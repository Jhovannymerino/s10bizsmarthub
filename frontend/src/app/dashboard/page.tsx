'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, ComposedChart, ReferenceLine,
} from 'recharts';
import { DocPreview } from './_components/modals/DocPreview';
import { TransactionModal } from './_components/modals/TransactionModal';
import { CxCTransactionModal } from './_components/modals/CxCTransactionModal';
import { CxPTransactionModal } from './_components/modals/CxPTransactionModal';
import { GavCategoryModal } from './_components/modals/GavCategoryModal';
import { DetalleModal } from './_components/modals/DetalleModal';
import { CajaTxnModal } from './_components/modals/CajaTxnModal';
import { AccountTxnModal } from './_components/modals/AccountTxnModal';
import { AuditSinDocModal } from './_components/modals/AuditSinDocModal';
import { API, COMPANIES, GRUPO, CURRENT_YEAR, MIN_YEAR, MESES, COLORS_PIE, COLORS_EMPRESA, CLASE_NAMES } from './_lib/constants';
import { fmt, pct, fmtDays, fmtX, yoyPct } from './_lib/formatters';
import { exportCSV } from './_lib/csv';
import { SortState, sortRows, toggleSort } from './_lib/sort';
import { Signal, semaforo, SIGNAL_COLOR, SIGNAL_DOT } from './_lib/semaforo';
import { fetchApi } from './_lib/api';
import { KpiCard } from './_components/KpiCard';
import { NoDataBanner } from './_components/NoDataBanner';
import { ExportBtn } from './_components/ExportBtn';
import { SearchInput } from './_components/SearchInput';
import { SortTh } from './_components/SortTh';
import { SkeletonLoader } from './_components/SkeletonLoader';

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

const getWfColor = (type: string, value: number) => {
  if (type === 'total') return value >= 0 ? '#10B981' : '#EF4444';
  if (type === 'expense') return '#EF4444';
  return '#207E83';
};

const WaterfallChart = React.memo(function WaterfallChart({ ytd }: { ytd: any }) {
  const data = React.useMemo(() => buildWaterfallData(ytd), [
    ytd?.ingresos, ytd?.costoDirecto, ytd?.margenBruto,
    ytd?.gav, ytd?.ebitda, ytd?.gastosFinancieros, ytd?.utilidadNeta,
  ]);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 10, bottom: 5, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8B97A8' }} />
        <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: '#8B97A8' }} />
        <Tooltip
          formatter={(val: number, name: string) => name === 'base' ? null : [fmt(val), '']}
          labelFormatter={(l) => l}
        />
        <Bar dataKey="base" stackId="wf" fill="transparent" />
        <Bar dataKey="value" stackId="wf" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={getWfColor(entry.type, entry.value)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

// ─── YoY badge ────────────────────────────────
const YoYBadge = React.memo(function YoYBadge({ curr, prev }: { curr: number; prev: number | undefined }) {
  if (!prev && prev !== 0) return null;
  const delta = yoyPct(curr, prev);
  const color = delta >= 0 ? '#10B981' : '#EF4444';
  const arrow = delta >= 0 ? '▲' : '▼';
  return (
    <span style={{ fontSize: '0.7rem', color, marginLeft: '0.4rem', fontWeight: 600 }}>
      {arrow} {Math.abs(delta).toFixed(1)}%
    </span>
  );
});

// ═══════════════════════════════════════════════
// DIRECTORIO — Input components (defined at module level
// to preserve focus across re-renders of DashboardPage)
// ═══════════════════════════════════════════════
const DIR_INPUT_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(43,180,187,0.25)',
  borderRadius: '0.35rem', padding: '0.35rem 0.55rem', color: '#F8FAFC',
  fontSize: '0.75rem', fontFamily: 'monospace', width: '100%',
};
const DIR_INPUT_TEXT: React.CSSProperties = { ...DIR_INPUT_STYLE, fontFamily: 'inherit' };
const DIR_OPTION_STYLE: React.CSSProperties = { background: '#0E1A2E', color: '#F8FAFC' };

function DirNumInput({ path, value, onChange }: { path: string; value: number; onChange: (p: string, v: any) => void }) {
  // Permite vaciar el campo durante la edición sin saltar a "0"
  const [local, setLocal] = React.useState<string>(value != null ? String(value) : '');
  React.useEffect(() => { setLocal(value != null ? String(value) : ''); }, [value]);
  return <input type="number" step="0.01" value={local} style={DIR_INPUT_STYLE}
    onChange={e => setLocal(e.target.value)}
    onBlur={() => onChange(path, parseFloat(local) || 0)} />;
}
function DirTextInput({ path, value, placeholder, onChange }: { path: string; value: string; placeholder?: string; onChange: (p: string, v: any) => void }) {
  return <input type="text" value={value || ''} placeholder={placeholder} style={DIR_INPUT_TEXT}
    onChange={e => onChange(path, e.target.value)} />;
}
function DirTextArea({ path, value, rows = 2, onChange }: { path: string; value: string; rows?: number; onChange: (p: string, v: any) => void }) {
  return <textarea value={value || ''} rows={rows} style={{ ...DIR_INPUT_TEXT, resize: 'vertical', minHeight: 40 }}
    onChange={e => onChange(path, e.target.value)} />;
}
function DirSelectInput({ path, value, options, onChange }: { path: string; value: string; options: string[]; onChange: (p: string, v: any) => void }) {
  return (
    <select value={value || options[0]} style={DIR_INPUT_STYLE} onChange={e => onChange(path, e.target.value)}>
      {options.map(o => <option key={o} value={o} style={DIR_OPTION_STYLE}>{o}</option>)}
    </select>
  );
}

// ═══════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════
export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<typeof COMPANIES[0] | typeof GRUPO>(() => {
    if (typeof window === 'undefined') return COMPANIES[0];
    try {
      const info = JSON.parse(localStorage.getItem('userInfo') || '{}');
      const allowed: string[] = info.allowedCompanies ?? [];
      if (info.role === 'admin' || allowed.length === 0) return COMPANIES[0];
      return COMPANIES.find(c => allowed.includes(c.codEmpresa)) ?? COMPANIES[0];
    } catch { return COMPANIES[0]; }
  });
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'done' | 'unavailable' | 'error'>('idle');
  const [syncMsg, setSyncMsg] = useState('');
  const [syncProgress, setSyncProgress] = useState<any>(null);
  const syncPollRef = useRef<NodeJS.Timeout | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pl, setPL] = useState<any>(null);
  const [cxc, setCxC] = useState<any>(null);
  const [caja, setCaja] = useState<any>(null);
  const [gav, setGAV] = useState<any>(null);
  const [consolidado, setConsolidado] = useState<any>(null);
  const [scorecard, setScorecard] = useState<any>(null);
  const [cajaPosicion, setCajaPosicion] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'inicio' | 'pl' | 'cxc' | 'cxp' | 'caja' | 'gav' | 'docs' | 'admin' | 'balance' | 'otras_cxc' | 'otras_cxp' | 'prestamos' | 'tributos' | 'laboral' | 'activo_fijo' | 'tesoreria' | 'patrimonio' | 'inventarios' | 'gastos_nat' | 'caja_saldos' | 'conciliacion' | 'audit' | 'validation_forense' | 'directorio'>('inicio');
  const [selectedQuarter, setSelectedQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const [userRole, setUserRole] = useState<string>(() => {
    if (typeof window === 'undefined') return 'viewer';
    try { return JSON.parse(localStorage.getItem('userInfo') || '{}').role ?? 'viewer'; } catch { return 'viewer'; }
  });
  const [userAllowedCompanies, setUserAllowedCompanies] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('userInfo') || '{}').allowedCompanies ?? []; } catch { return []; }
  });
  const [userEmail, setUserEmail] = useState<string>('');
  // ── Admin: gestión de usuarios ──
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminModal, setAdminModal] = useState<{ mode: 'create' | 'edit'; user?: any } | null>(null);
  const [adminForm, setAdminForm] = useState({ email: '', password: '', role: 'viewer', allowedCompanies: [] as string[], active: true });
  const [adminError, setAdminError] = useState('');
  const [adminSuccess, setAdminSuccess] = useState('');
  const [cxp, setCxP] = useState<any>(null);
  const [drillDown, setDrillDown] = useState<{ title: string; rows: any[] } | null>(null);
  const [cxcTxDrill, setCxCTxDrill] = useState<{ cliente: string; codCliente: string } | null>(null);
  const [cxpTxDrill, setCxPTxDrill] = useState<{ proveedor: string; codProveedor: string } | null>(null);
  const [cajaTxDrill, setCajaTxDrill] = useState<{ codBanco: string; desBanco: string } | null>(null);
  const [accountTxDrill, setAccountTxDrill] = useState<{ codCuenta: string; descripcion: string; endpoint: string; codTercero?: string; yearOverride?: number; mesPreset?: number } | null>(null);
  const [auditSinDocDrill, setAuditSinDocDrill] = useState<{ clase: string; desClase: string } | null>(null);
  const [gavDrill, setGavDrill] = useState<{ cod: string; descripcion: string; meses: Record<number, number>; ytd: number } | null>(null);
  const [cxcSearch, setCxcSearch] = useState('');
  const [cxpSearch, setCxpSearch] = useState('');
  const [cxcSort, setCxcSort] = useState<SortState>({ col: 'saldoTotal', dir: 'desc' });
  const [cxpSort, setCxpSort] = useState<SortState>({ col: 'saldoTotal', dir: 'desc' });
  const [gavSort, setGavSort] = useState<SortState>({ col: 'ytd', dir: 'desc' });
  const [docs, setDocs] = useState<{ emitidas: any[]; recibidas: any[]; honorarios: any[] } | null>(null);
  const [docsTab, setDocsTab] = useState<'emitidas' | 'recibidas' | 'honorarios' | 'operativos'>('emitidas');
  const [docsSearch, setDocsSearch] = useState('');
  const [docsOnlySinAsiento, setDocsOnlySinAsiento] = useState(false);
  const [docsOnlyDuplicados, setDocsOnlyDuplicados] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  // ── Nuevos módulos (lazy-loaded al seleccionar el tab) ──
  const [cxcSplitData, setCxcSplitData] = useState<any>(null);
  const [balanceData, setBalanceData] = useState<any>(null);
  const [otrasCxCData, setOtrasCxCData] = useState<any>(null);
  const [otrasCxPData, setOtrasCxPData] = useState<any>(null);
  const [prestamosData, setPrestamosData] = useState<{ otorgados: any; recibidos: any } | null>(null);
  const [prestamosDocPreview, setPrestamosDocPreview] = useState<string | null>(null);
  const [tributosData, setTributosData] = useState<any>(null);
  const [laboralData, setLaboralData] = useState<any>(null);
  const [activoFijoData, setActivoFijoData] = useState<any>(null);
  const [gastosNatData, setGastosNatData] = useState<any>(null);
  const [cajaSaldosData, setCajaSaldosData] = useState<any>(null);
  const [auditData, setAuditData] = useState<any>(null);
  const [validacionForenseData, setValidacionForenseData] = useState<any>(null);
  const [directorioData, setDirectorioData] = useState<any>(null);
  const [directorioEditing, setDirectorioEditing] = useState<boolean>(false);
  const [directorioSaving, setDirectorioSaving] = useState<boolean>(false);
  const [directorioDraft, setDirectorioDraft] = useState<any>(null);
  const [validacionForenseExpanded, setValidacionForenseExpanded] = useState<string | null>(null);
  const [forenseFacturasDrillKey, setForenseFacturasDrillKey] = useState<string | null>(null);
  const [balanceViewMode, setBalanceViewMode] = useState<'saldos' | 'sumas'>('saldos');
  const [tesoreriaData, setTesoreriaData] = useState<any>(null);
  const [patrimonioData, setPatrimonioData] = useState<any>(null);
  const [inventariosData, setInventariosData] = useState<any>(null);
  const [conciliacionData, setConciliacionData] = useState<any>(null);
  const [newTabLoading, setNewTabLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState<Record<string, boolean>>({ balance: true, tesoreria: true, obligaciones: true, auditoria: true });
  // Cache key: tabName → `${companyId}:${year}` (year-dependent) or `${companyId}` (static)
  const loadedRef = useRef<Record<string, string>>({});

  const isGrupo = selectedCompany.codEmpresa === 'GRUPO';
  const visibleCompanies = userRole === 'admin'
    ? COMPANIES
    : COMPANIES.filter(c => userAllowedCompanies.includes(c.codEmpresa));

  useEffect(() => {
    const info = localStorage.getItem('userInfo');
    if (info) {
      try {
        const parsed = JSON.parse(info);
        setUserRole(parsed.role ?? 'viewer');
        setUserAllowedCompanies(parsed.allowedCompanies ?? []);
        setUserEmail(parsed.email ?? '');
      } catch { /* ignore */ }
    }
  }, []);

  // Cargar años disponibles según empresa seleccionada
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    if (isGrupo) {
      const grupoYears: number[] = [];
      for (let y = CURRENT_YEAR; y >= MIN_YEAR; y--) grupoYears.push(y);
      setAvailableYears(grupoYears);
      if (!grupoYears.includes(selectedYear)) setSelectedYear(grupoYears[0]);
      return;
    }
    fetchApi(`/kpi/${selectedCompany.codEmpresa}/available-years`, token)
      .then((data) => {
        const years: number[] = data?.years?.length ? data.years : [CURRENT_YEAR];
        setAvailableYears(years);
        if (!years.includes(selectedYear)) setSelectedYear(years[0]);
      })
      .catch(() => {
        const fallback = [CURRENT_YEAR];
        setAvailableYears(fallback);
      });
  }, [selectedCompany]);

  // Al montar: detecta si hay un sync corriendo y retoma el polling automáticamente (admin only)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try { if (JSON.parse(localStorage.getItem('userInfo') || '{}').role !== 'admin') return; } catch { return; }
    fetch(`${API}/sync/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(s => {
        if (!s.running || syncPollRef.current) return;
        setSyncStatus('running');
        setSyncMsg('');
        setSyncProgress(s);
        const poll = setInterval(async () => {
          try {
            const st = await fetch(`${API}/sync/status`, { headers: { Authorization: `Bearer ${token}` } });
            const ps = await st.json();
            setSyncProgress(ps);
            if (!ps.running) {
              clearInterval(poll);
              syncPollRef.current = null;
              setSyncStatus('done');
              setSyncMsg('');
              setRefreshKey(k => k + 1);
              setTimeout(() => { setSyncStatus('idle'); setSyncProgress(null); }, 12000);
            }
          } catch {
            clearInterval(poll);
            syncPollRef.current = null;
            setSyncStatus('idle');
            setSyncMsg('');
            setSyncProgress(null);
          }
        }, 4000);
        syncPollRef.current = poll;
        setTimeout(() => { clearInterval(poll); syncPollRef.current = null; setSyncStatus(prev => prev === 'running' ? 'idle' : prev); setSyncProgress(null); }, 1500000);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    loadedRef.current = {};
    setLoading(true);
    setCxcSplitData(null);
    setPL(null); setCxC(null); setCxP(null); setCaja(null); setGAV(null); setConsolidado(null); setScorecard(null);
    setBalanceData(null); setOtrasCxCData(null); setOtrasCxPData(null); setPrestamosData(null);
    setTributosData(null); setLaboralData(null); setActivoFijoData(null); setGastosNatData(null);
    setCajaSaldosData(null); setAuditData(null); setTesoreriaData(null); setPatrimonioData(null); setInventariosData(null); setConciliacionData(null);

    // Cancel any in-flight requests from previous company/year selection
    const ctrl = new AbortController();
    const { signal } = ctrl;

    if (isGrupo) {
      setLastSync(null);
      Promise.all([
        fetchApi(`/kpi/consolidado?year=${selectedYear}`, token, signal),
        fetchApi(`/kpi/scorecard?year=${selectedYear}`, token, signal),
        fetchApi(`/kpi/${COMPANIES[0].codEmpresa}/cxc`, token, signal),
      ])
        .then(([conData, scData, cxcData]) => {
          setConsolidado(conData?.ytd ? conData : null);
          setScorecard(scData?.companies ? scData : null);
          setCxC(cxcData?.clientes ? cxcData : null);
          setLoading(false);
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          if (err.message === 'unauthorized') { router.push('/login'); return; }
          setError(err.message);
          setLoading(false);
        });
    } else {
      const id = selectedCompany.codEmpresa;
      setLastSync(null);
      Promise.all([
        fetchApi(`/kpi/${id}/dashboard?year=${selectedYear}`, token, signal),
        fetchApi(`/kpi/${id}/cxc`, token, signal),
        fetchApi(`/kpi/${id}/cxp`, token, signal),
        fetchApi(`/kpi/${id}/caja?year=${selectedYear}`, token, signal),
        fetchApi(`/kpi/${id}/gav?year=${selectedYear}`, token, signal),
        fetchApi(`/kpi/${id}/last-sync?year=${selectedYear}`, token, signal),
        fetchApi(`/kpi/${id}/cxc-split`, token, signal),
      ])
        .then(([plData, cxcData, cxpData, cajaData, gavData, syncData, splitData]) => {
          setPL(plData?.plMonthly ? plData : null);
          setCxC(cxcData?.clientes ? cxcData : null);
          setCxP(cxpData?.proveedores ? cxpData : null);
          setCaja(cajaData?.bancos ? cajaData : null);
          setGAV(gavData?.categorias ? gavData : null);
          setLastSync(syncData?.lastSync ?? null);
          setCxcSplitData(splitData?.rows?.length ? splitData : null);
          setLoading(false);
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          if (err.message === 'unauthorized') { router.push('/login'); return; }
          setError(err.message);
          setLoading(false);
        });
    }

    return () => ctrl.abort();
  }, [router, selectedCompany, selectedYear, refreshKey]);

  useEffect(() => {
    if (activeTab !== 'caja' || isGrupo) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    const id = selectedCompany.codEmpresa;
    setCajaPosicion(null);
    fetchApi(`/kpi/${id}/caja-posicion?year=${selectedYear}&quarter=${selectedQuarter}`, token)
      .then(data => setCajaPosicion(data))
      .catch(() => {});
  }, [activeTab, selectedCompany, selectedYear, selectedQuarter, isGrupo]);

  useEffect(() => {
    if (activeTab !== 'docs' || isGrupo) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    const id = selectedCompany.codEmpresa;
    setDocs(null);
    setDocsSearch('');
    setDocsOnlySinAsiento(false);
    Promise.all([
      fetchApi(`/kpi/${id}/facturas-emitidas?year=${selectedYear}`, token),
      fetchApi(`/kpi/${id}/facturas-recibidas?year=${selectedYear}`, token),
      fetchApi(`/kpi/${id}/honorarios-recibidos?year=${selectedYear}`, token),
    ])
      .then(([emitData, reciData, honorData]) => {
        setDocs({
          emitidas: emitData?.facturas || [],
          recibidas: reciData?.facturas || [],
          honorarios: honorData?.facturas || [],
        });
      })
      .catch(() => {});
  }, [activeTab, selectedCompany, selectedYear, isGrupo]);

  // ── Lazy load nuevos módulos ──────────────────
  useEffect(() => {
    const NEW_TABS = ['balance','otras_cxc','otras_cxp','prestamos','tributos','laboral','activo_fijo','tesoreria','patrimonio','inventarios','gastos_nat','caja_saldos','conciliacion','audit','validation_forense'];
    if (!NEW_TABS.includes(activeTab) || isGrupo) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    const id = selectedCompany.codEmpresa;

    // Year-dependent tabs: cache key includes year; static tabs: cache key is company only
    const yearDependent = new Set(['gastos_nat','audit','tesoreria','inventarios','tributos','validation_forense']);
    const cacheKey = yearDependent.has(activeTab) ? `${id}:${selectedYear}` : id;
    if (loadedRef.current[activeTab] === cacheKey) return;

    setNewTabLoading(true);
    const done = (setter: () => void) => { setter(); loadedRef.current[activeTab] = cacheKey; setNewTabLoading(false); };

    if (activeTab === 'balance') {
      fetchApi(`/kpi/${id}/balance?year=${selectedYear}`, token)
        .then(d => done(() => setBalanceData(d)))
        .catch(() => done(() => setBalanceData({ rows: [] })));
    } else if (activeTab === 'otras_cxc') {
      fetchApi(`/kpi/${id}/otras-cxc`, token)
        .then(d => done(() => setOtrasCxCData(d)))
        .catch(() => done(() => setOtrasCxCData({ rows: [] })));
    } else if (activeTab === 'otras_cxp') {
      fetchApi(`/kpi/${id}/otras-cxp`, token)
        .then(d => done(() => setOtrasCxPData(d)))
        .catch(() => done(() => setOtrasCxPData({ rows: [] })));
    } else if (activeTab === 'prestamos') {
      Promise.all([
        fetchApi(`/kpi/${id}/prestamos-otorgados`, token),
        fetchApi(`/kpi/${id}/prestamos-recibidos`, token),
      ]).then(([ot, re]) => done(() => setPrestamosData({ otorgados: ot, recibidos: re })))
        .catch(() => done(() => setPrestamosData({ otorgados: { rows: [] }, recibidos: { rows: [] } })));
    } else if (activeTab === 'tributos') {
      fetchApi(`/kpi/${id}/tributos?year=${selectedYear}`, token)
        .then(d => done(() => setTributosData(d)))
        .catch(() => done(() => setTributosData({ rows: [] })));
    } else if (activeTab === 'laboral') {
      fetchApi(`/kpi/${id}/laboral`, token)
        .then(d => done(() => setLaboralData(d)))
        .catch(() => done(() => setLaboralData({ rows: [] })));
    } else if (activeTab === 'activo_fijo') {
      fetchApi(`/kpi/${id}/activo-fijo`, token)
        .then(d => done(() => setActivoFijoData(d)))
        .catch(() => done(() => setActivoFijoData({ rows: [] })));
    } else if (activeTab === 'tesoreria') {
      fetchApi(`/kpi/${id}/tesoreria?year=${selectedYear}`, token)
        .then(d => done(() => setTesoreriaData(d)))
        .catch(() => done(() => setTesoreriaData({ bancos: [] })));
    } else if (activeTab === 'patrimonio') {
      fetchApi(`/kpi/${id}/patrimonio`, token)
        .then(d => done(() => setPatrimonioData(d)))
        .catch(() => done(() => setPatrimonioData({ rows: [] })));
    } else if (activeTab === 'inventarios') {
      fetchApi(`/kpi/${id}/inventarios?year=${selectedYear}`, token)
        .then(d => done(() => setInventariosData(d)))
        .catch(() => done(() => setInventariosData({ rows: [] })));
    } else if (activeTab === 'gastos_nat') {
      fetchApi(`/kpi/${id}/gastos-naturaleza?year=${selectedYear}`, token)
        .then(d => done(() => setGastosNatData(d)))
        .catch(() => done(() => setGastosNatData({ rows: [] })));
    } else if (activeTab === 'caja_saldos') {
      fetchApi(`/kpi/${id}/caja-saldos`, token)
        .then(d => done(() => setCajaSaldosData(d)))
        .catch(() => done(() => setCajaSaldosData({ rows: [] })));
    } else if (activeTab === 'conciliacion') {
      fetchApi(`/kpi/${id}/conciliacion-bancaria`, token)
        .then(d => done(() => setConciliacionData(d)))
        .catch(() => done(() => setConciliacionData({ rows: [], movsSinConciliar: [] })));
    } else if (activeTab === 'audit') {
      Promise.all([
        fetchApi(`/kpi/${id}/audit/sin-doc?year=${selectedYear}`, token),
        fetchApi(`/kpi/${id}/audit/descuadres?year=${selectedYear}`, token),
        fetchApi(`/kpi/${id}/audit/atipicos?year=${selectedYear}`, token),
        fetchApi(`/kpi/${id}/audit/conciliacion?year=${selectedYear}`, token),
      ]).then(([sd, desc, at, conc]) => done(() => setAuditData({ sinDoc: sd, descuadres: desc, atipicos: at, conciliacion: conc })))
        .catch(() => done(() => setAuditData({})));
    } else if (activeTab === 'validation_forense') {
      fetchApi(`/kpi/${id}/validation-forense?year=${selectedYear}`, token)
        .then(d => done(() => setValidacionForenseData(d)))
        .catch(() => done(() => setValidacionForenseData(null)));
    }
  }, [activeTab, selectedCompany, selectedYear, isGrupo]);

  // Directorio: depende de empresa + año + trimestre (independiente del resto)
  useEffect(() => {
    if (activeTab !== 'directorio' || isGrupo) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    const id = selectedCompany.codEmpresa;
    setDirectorioEditing(false);
    setDirectorioData(null);
    fetchApi(`/kpi/${id}/directorio?year=${selectedYear}&quarter=${selectedQuarter}`, token)
      .then(d => { setDirectorioData(d); setDirectorioDraft(JSON.parse(JSON.stringify(d?.data || {}))); })
      .catch(() => { setDirectorioData(null); setDirectorioDraft(null); });
  }, [activeTab, selectedCompany, selectedYear, selectedQuarter, isGrupo]);

  if (error) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#EF4444', maxWidth: 400 }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Error de conexión</div>
        <pre style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#8B97A8' }}>{error}</pre>
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

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as typeof activeTab);
    setSidebarOpen(false);
  };

  // Auto-expand the section that contains the active tab
  useEffect(() => {
    const sectionOf: Record<string, string> = {
      balance: 'balance', otras_cxc: 'balance', otras_cxp: 'balance',
      prestamos: 'balance', patrimonio: 'balance', inventarios: 'balance',
      tesoreria: 'tesoreria', caja_saldos: 'tesoreria',
      conciliacion: 'tesoreria', gastos_nat: 'tesoreria',
      tributos: 'obligaciones', laboral: 'obligaciones', activo_fijo: 'obligaciones',
      audit: 'auditoria', validation_forense: 'auditoria',
    };
    const sec = sectionOf[activeTab];
    if (sec) setNavCollapsed(s => ({ ...s, [sec]: false }));
  }, [activeTab]);

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: '#050a12' } as React.CSSProperties}>

      {/* ── Mobile top bar ── */}
      <div className="mobile-topbar">
        <div className="mobile-topbar-brand">
          <div className="brand-avatar">S</div>
          <div className="mobile-topbar-info">
            <div className="mobile-topbar-company">{selectedCompany.shortName}</div>
            <div className="mobile-topbar-year">{selectedYear}</div>
          </div>
        </div>
        <div className="mobile-topbar-actions">
          <div className={`mobile-sync-dot${syncStatus === 'running' ? ' running' : syncStatus === 'error' ? ' error' : ''}`} title={syncStatus} />
          <button className="hamburger-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Abrir menú">
            {sidebarOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* ── Sidebar overlay backdrop (mobile) ── */}
      {sidebarOpen && (
        <div className="sidebar-overlay open" onClick={() => setSidebarOpen(false)} />
      )}
      {drillDown && (
        <DetalleModal
          title={drillDown.title}
          rows={drillDown.rows}
          activeMeses={activeMeses.length ? activeMeses : [1,2,3,4,5,6,7,8,9,10,11,12]}
          companyId={selectedCompany.codEmpresa}
          year={selectedYear}
          onClose={() => setDrillDown(null)}
        />
      )}
      {cxcTxDrill && (
        <CxCTransactionModal
          companyId={selectedCompany.codEmpresa}
          year={selectedYear}
          cliente={cxcTxDrill.cliente}
          codCliente={cxcTxDrill.codCliente}
          onClose={() => setCxCTxDrill(null)}
        />
      )}
      {cxpTxDrill && (
        <CxPTransactionModal
          companyId={selectedCompany.codEmpresa}
          year={selectedYear}
          proveedor={cxpTxDrill.proveedor}
          codProveedor={cxpTxDrill.codProveedor}
          onClose={() => setCxPTxDrill(null)}
        />
      )}
      {gavDrill && (
        <GavCategoryModal
          companyId={selectedCompany.codEmpresa}
          year={selectedYear}
          cat={gavDrill}
          onClose={() => setGavDrill(null)}
        />
      )}
      {cajaTxDrill && (
        <CajaTxnModal
          companyId={selectedCompany.codEmpresa}
          year={selectedYear}
          codBanco={cajaTxDrill.codBanco}
          desBanco={cajaTxDrill.desBanco}
          onClose={() => setCajaTxDrill(null)}
        />
      )}
      {accountTxDrill && (
        <AccountTxnModal
          companyId={selectedCompany.codEmpresa}
          year={selectedYear}
          codCuenta={accountTxDrill.codCuenta}
          descripcion={accountTxDrill.descripcion}
          endpoint={accountTxDrill.endpoint}
          codTercero={accountTxDrill.codTercero}
          yearOverride={accountTxDrill.yearOverride}
          mesPreset={accountTxDrill.mesPreset}
          onClose={() => setAccountTxDrill(null)}
        />
      )}
      {auditSinDocDrill && (
        <AuditSinDocModal
          companyId={selectedCompany.codEmpresa}
          year={selectedYear}
          clase={auditSinDocDrill.clase}
          desClase={auditSinDocDrill.desClase}
          onClose={() => setAuditSinDocDrill(null)}
        />
      )}

      {/* ── Sidebar ── */}
      <div className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-inner">

        {/* Logo + status */}
        <div style={{ padding: '1.125rem 1rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #207E83, #2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 900, color: '#fff', flexShrink: 0, boxShadow: '0 0 0 2px rgba(255,255,255,0.08), 0 8px 20px rgba(32,126,131,0.3)' }}>S</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '0.9rem', color: '#F8FAFC', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              S10 <span style={{ color: '#2BB4BB' }}>BizSmartHub</span>
            </div>
            <div style={{ fontSize: '0.5rem', color: '#8B97A8', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '0.1rem' }}>Dashboard Financiero</div>
          </div>
          <div
            title={syncStatus === 'running' ? 'Sincronizando…' : syncStatus === 'error' ? 'Error de sync' : syncStatus === 'unavailable' ? 'Sync no disponible' : 'Sistema online'}
            style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, transition: 'background 0.3s',
              background: syncStatus === 'running' ? '#F59E0B' : syncStatus === 'error' ? '#EF4444' : syncStatus === 'unavailable' ? '#F59E0B' : '#10B981',
              boxShadow: syncStatus === 'running' ? '0 0 6px #F59E0B' : syncStatus === 'error' ? '0 0 6px #EF4444' : '0 0 6px #10B981',
            }}
          />
        </div>

        {/* Sync — solo admin */}
        {userRole === 'admin' && <div style={{ padding: '0.625rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            disabled={syncStatus === 'running'}
            onClick={async () => {
              const token = localStorage.getItem('token');
              if (!token) return;
              setSyncStatus('running');
              setSyncMsg('Iniciando sincronización...');
              setSyncProgress(null);
              try {
                const res = await fetch(`${API}/sync/trigger?years=${CURRENT_YEAR}&fast=true`, {
                  method: 'POST', headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.status === 'unavailable') {
                  setSyncStatus('unavailable');
                  setSyncMsg(data.message || 'Servicio no disponible');
                  setTimeout(() => { setSyncStatus('idle'); setSyncMsg(''); setSyncProgress(null); }, 10000);
                  return;
                }
                setSyncMsg(data.status === 'busy' ? 'Sync en progreso — monitoreando...' : 'Conectando a S10 vía VPN...');
                if (!syncPollRef.current) {
                  const poll = setInterval(async () => {
                    try {
                      const st = await fetch(`${API}/sync/status`, { headers: { Authorization: `Bearer ${token}` } });
                      const s = await st.json();
                      setSyncProgress(s);
                      if (!s.running) {
                        clearInterval(poll);
                        syncPollRef.current = null;
                        setSyncStatus('done');
                        setSyncMsg('');
                        setRefreshKey(k => k + 1);
                        setTimeout(() => { setSyncStatus('idle'); setSyncProgress(null); }, 12000);
                      }
                    } catch { clearInterval(poll); syncPollRef.current = null; setSyncStatus('idle'); setSyncMsg(''); setSyncProgress(null); }
                  }, 4000);
                  syncPollRef.current = poll;
                  setTimeout(() => { clearInterval(poll); syncPollRef.current = null; setSyncStatus(prev => prev === 'running' ? 'idle' : prev); setSyncProgress(null); }, 1500000);
                }
              } catch {
                setSyncStatus('error');
                setSyncMsg('No se pudo conectar al servidor.');
                setTimeout(() => { setSyncStatus('idle'); setSyncMsg(''); setSyncProgress(null); }, 6000);
              }
            }}
            style={{
              width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
              border: '1px solid rgba(32,126,131,0.25)',
              background: syncStatus === 'running' ? 'rgba(245,158,11,0.1)' : syncStatus === 'done' ? 'rgba(16,185,129,0.12)' : syncStatus === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(32,126,131,0.08)',
              color: syncStatus === 'done' ? '#10B981' : syncStatus === 'error' ? '#EF4444' : syncStatus === 'running' ? '#F59E0B' : '#2BB4BB',
              fontSize: '0.75rem', fontWeight: 600, cursor: syncStatus === 'running' ? 'default' : 'pointer',
              letterSpacing: '0.03em', transition: 'all 0.2s', fontFamily: "'Inter', sans-serif",
            }}
          >
            {syncStatus === 'running' ? '⏳ Sincronizando…' : syncStatus === 'done' ? '✓ Datos actualizados' : syncStatus === 'error' ? '✗ Reintentar sync' : syncStatus === 'unavailable' ? '⚠ No disponible' : '↻ Sincronizar datos'}
          </button>

          {/* Sync histórico: todos los años 2022→actual, fast mode */}
          <button
            disabled={syncStatus === 'running'}
            onClick={async () => {
              const token = localStorage.getItem('token');
              if (!token) return;
              setSyncStatus('running');
              setSyncMsg('Iniciando sync histórico...');
              setSyncProgress(null);
              try {
                const allYears = Array.from({ length: CURRENT_YEAR - 2022 + 1 }, (_, i) => 2022 + i).join(',');
                const res = await fetch(`${API}/sync/trigger?years=${allYears}&fast=true`, {
                  method: 'POST', headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.status === 'unavailable') {
                  setSyncStatus('unavailable');
                  setSyncMsg(data.message || 'Servicio no disponible');
                  setTimeout(() => { setSyncStatus('idle'); setSyncMsg(''); setSyncProgress(null); }, 10000);
                  return;
                }
                setSyncMsg(data.status === 'busy' ? 'Sync en progreso — monitoreando...' : 'Conectando a S10 vía VPN...');
                if (!syncPollRef.current) {
                  const poll = setInterval(async () => {
                    try {
                      const st = await fetch(`${API}/sync/status`, { headers: { Authorization: `Bearer ${token}` } });
                      const s = await st.json();
                      setSyncProgress(s);
                      if (!s.running) {
                        clearInterval(poll);
                        syncPollRef.current = null;
                        setSyncStatus('done');
                        setSyncMsg('');
                        setRefreshKey(k => k + 1);
                        setTimeout(() => { setSyncStatus('idle'); setSyncProgress(null); }, 12000);
                      }
                    } catch { clearInterval(poll); syncPollRef.current = null; setSyncStatus('idle'); setSyncMsg(''); setSyncProgress(null); }
                  }, 4000);
                  syncPollRef.current = poll;
                  setTimeout(() => { clearInterval(poll); syncPollRef.current = null; setSyncStatus(prev => prev === 'running' ? 'idle' : prev); setSyncProgress(null); }, 1500000);
                }
              } catch {
                setSyncStatus('error');
                setSyncMsg('No se pudo conectar al servidor.');
                setTimeout(() => { setSyncStatus('idle'); setSyncMsg(''); setSyncProgress(null); }, 6000);
              }
            }}
            style={{
              width: '100%', marginTop: '0.35rem', padding: '0.35rem 0.75rem', borderRadius: '0.5rem',
              border: '1px solid rgba(139,97,184,0.25)',
              background: syncStatus === 'running' ? 'rgba(245,158,11,0.08)' : 'rgba(139,97,184,0.07)',
              color: syncStatus === 'running' ? '#F59E0B' : '#9B72CF',
              fontSize: '0.68rem', fontWeight: 600, cursor: syncStatus === 'running' ? 'default' : 'pointer',
              letterSpacing: '0.03em', transition: 'all 0.2s', fontFamily: "'Inter', sans-serif",
            }}
          >
            {syncStatus === 'running' ? '⏳ Sincronizando…' : '⟳ Sync histórico 2022→' + CURRENT_YEAR}
          </button>

          {syncStatus === 'running' && syncProgress?.running && syncProgress?.totalYears > 0 && (() => {
            const p = syncProgress;
            const done = p.completedYears?.length ?? 0;
            const total = p.totalYears ?? 1;
            const pct = Math.round((done / total) * 100);
            const elapsed = p.elapsed ?? 0;
            const mins = Math.floor(elapsed / 60);
            const secs = elapsed % 60;
            const elapsedStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
            const estimatedTotal = done > 0 ? Math.round(elapsed / done * total) : null;
            const remaining = estimatedTotal ? Math.max(0, estimatedTotal - elapsed) : null;
            const remainingStr = remaining !== null ? (remaining > 60 ? `~${Math.ceil(remaining / 60)}m` : `~${remaining}s`) : '…';
            return (
              <div style={{ marginTop: '0.5rem', background: 'rgba(0,0,0,0.25)', borderRadius: '0.5rem', padding: '0.5rem 0.6rem', border: '1px solid rgba(245,158,11,0.15)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.62rem', color: '#F59E0B', fontWeight: 700 }}>AÑO {done + 1}/{total}</span>
                  <span style={{ fontSize: '0.58rem', color: '#8B97A8' }}>{elapsedStr}{remaining !== null ? ` · ${remainingStr}` : ''}</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: '0.35rem' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #F59E0B, #FBBF24)', borderRadius: 4, transition: 'width 0.6s ease' }} />
                </div>
                {p.currentYear && <div style={{ fontSize: '0.65rem', color: '#E5E7EB', fontWeight: 600 }}>📅 {p.currentYear}{p.currentBatch && <span style={{ color: '#9CA3AF', fontWeight: 400 }}> · {p.currentBatch}</span>}</div>}
                {p.currentCompany && <div style={{ fontSize: '0.6rem', color: '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🏢 {p.currentCompany}</div>}
                {p.completedYears?.length > 0 && <div style={{ fontSize: '0.58rem', color: '#6B7280', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.25rem', marginTop: '0.2rem' }}>✓ {p.completedYears.join(', ')}</div>}
              </div>
            );
          })()}
          {syncMsg && !(syncStatus === 'running' && syncProgress?.running && syncProgress?.totalYears > 0) && (
            <div style={{ fontSize: '0.62rem', color: syncStatus === 'unavailable' ? '#F59E0B' : '#8B97A8', marginTop: '0.35rem', lineHeight: 1.4 }}>{syncMsg}</div>
          )}
          {syncStatus === 'done' && syncProgress?.completedYears?.length > 0 && (
            <div style={{ marginTop: '0.4rem', fontSize: '0.6rem', color: '#10B981', background: 'rgba(16,185,129,0.08)', borderRadius: '0.4rem', padding: '0.35rem 0.5rem', border: '1px solid rgba(16,185,129,0.15)' }}>
              ✓ {syncProgress.completedYears.length} años: {syncProgress.completedYears.join(', ')}
            </div>
          )}
        </div>}

        {/* Última sincronización — visible para todos los usuarios */}
        {lastSync && (
          <div style={{ padding: '0.4rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.6rem', color: '#4B5563', textAlign: 'center', letterSpacing: '0.02em' }}>
            Datos al {new Date(lastSync).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </div>
        )}

        {/* Nav principal */}
        <nav style={{ flex: 1, padding: '0.5rem 0', overflow: 'auto' }}>

          {/* Inicio */}
          <button onClick={() => handleTabChange('inicio')}
            className={`sidebar-link ${activeTab === 'inicio' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
            🏠  Inicio
          </button>

          {/* Directorio — ítem suelto, sin label de sección */}
          {!isGrupo && (
            <button onClick={() => handleTabChange('directorio')}
              className={`sidebar-link ${activeTab === 'directorio' ? 'active' : ''}`}
              style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
              🎯  Directorio
            </button>
          )}

          {/* Resultados — siempre visible, sin colapso */}
          <div className="sidebar-section-label" style={{ marginTop: '0.75rem' }}>Resultados</div>
          {(['pl', 'cxc', 'cxp', 'caja', 'gav', 'docs'] as const).map((tab) => (
            <button key={tab} onClick={() => handleTabChange(tab)}
              className={`sidebar-link ${activeTab === tab ? 'active' : ''}`}
              style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
              {tab === 'pl'   && '📊  P&L'}
              {tab === 'cxc'  && '💰  CxC Aging'}
              {tab === 'cxp'  && '🏪  CxP Aging'}
              {tab === 'caja' && '💵  Posición Caja'}
              {tab === 'gav'  && '📋  GAV Detalle'}
              {tab === 'docs' && '🧾  Documentos'}
            </button>
          ))}

          {!isGrupo && (
            <>
              {/* Balance & Patrimonio — colapsable */}
              <div className="sidebar-section-label nav-group-header accent-blue"
                style={{ marginTop: '0.75rem' }}
                onClick={() => setNavCollapsed(s => ({ ...s, balance: !s.balance }))}>
                <span className="sidebar-section-label-text">Balance & Patrimonio</span>
                <span className={`nav-group-arrow${!navCollapsed.balance ? ' open' : ''}`}>›</span>
              </div>
              {!navCollapsed.balance && (
                <div className="nav-section-items">
                  {(['balance','otras_cxc','otras_cxp','prestamos','patrimonio','inventarios'] as const).map((tab) => (
                    <button key={tab} onClick={() => handleTabChange(tab)}
                      className={`sidebar-link ${activeTab === tab ? 'active' : ''}`}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                      {tab === 'balance'    && '⚖️  Balance General'}
                      {tab === 'otras_cxc' && '📌  Otras CxC'}
                      {tab === 'otras_cxp' && '🗃️  Otras CxP'}
                      {tab === 'prestamos' && '💳  Préstamos'}
                      {tab === 'patrimonio' && '🏛️  Patrimonio'}
                      {tab === 'inventarios' && '📦  Inventarios'}
                    </button>
                  ))}
                </div>
              )}

              {/* Tesorería & Bancos — colapsable */}
              <div className="sidebar-section-label nav-group-header accent-green"
                style={{ marginTop: '0.5rem' }}
                onClick={() => setNavCollapsed(s => ({ ...s, tesoreria: !s.tesoreria }))}>
                <span className="sidebar-section-label-text">Tesorería & Bancos</span>
                <span className={`nav-group-arrow${!navCollapsed.tesoreria ? ' open' : ''}`}>›</span>
              </div>
              {!navCollapsed.tesoreria && (
                <div className="nav-section-items">
                  {(['tesoreria','caja_saldos','conciliacion','gastos_nat'] as const).map((tab) => (
                    <button key={tab} onClick={() => handleTabChange(tab)}
                      className={`sidebar-link ${activeTab === tab ? 'active' : ''}`}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                      {tab === 'tesoreria'   && '💹  Tesorería'}
                      {tab === 'caja_saldos' && '🏦  Saldos Banco'}
                      {tab === 'conciliacion' && '🔄  Conciliación Bancaria'}
                      {tab === 'gastos_nat'  && '📈  Gastos Naturaleza'}
                    </button>
                  ))}
                </div>
              )}

              {/* Obligaciones — colapsable */}
              <div className="sidebar-section-label nav-group-header accent-amber"
                style={{ marginTop: '0.5rem' }}
                onClick={() => setNavCollapsed(s => ({ ...s, obligaciones: !s.obligaciones }))}>
                <span className="sidebar-section-label-text">Obligaciones</span>
                <span className={`nav-group-arrow${!navCollapsed.obligaciones ? ' open' : ''}`}>›</span>
              </div>
              {!navCollapsed.obligaciones && (
                <div className="nav-section-items">
                  {(['tributos','laboral','activo_fijo'] as const).map((tab) => (
                    <button key={tab} onClick={() => handleTabChange(tab)}
                      className={`sidebar-link ${activeTab === tab ? 'active' : ''}`}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                      {tab === 'tributos'    && '📜  Tributos'}
                      {tab === 'laboral'     && '👷  Laboral'}
                      {tab === 'activo_fijo' && '🏗️  Activo Fijo'}
                    </button>
                  ))}
                </div>
              )}

              {/* Auditoría — colapsable */}
              <div className="sidebar-section-label nav-group-header accent-purple"
                style={{ marginTop: '0.5rem' }}
                onClick={() => setNavCollapsed(s => ({ ...s, auditoria: !s.auditoria }))}>
                <span className="sidebar-section-label-text">Auditoría</span>
                <span className={`nav-group-arrow${!navCollapsed.auditoria ? ' open' : ''}`}>›</span>
              </div>
              {!navCollapsed.auditoria && (
                <div className="nav-section-items">
                  <button onClick={() => handleTabChange('audit')}
                    className={`sidebar-link ${activeTab === 'audit' ? 'active' : ''}`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                    🔍  Módulo Auditoría
                  </button>
                  <button onClick={() => handleTabChange('validation_forense')}
                    className={`sidebar-link ${activeTab === 'validation_forense' ? 'active' : ''}`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                    🧪  Validación Forense S10
                  </button>
                </div>
              )}
            </>
          )}

          {/* Configuración — solo admin */}
          {userRole === 'admin' && (
            <>
              <div className="sidebar-section-label" style={{ marginTop: '0.75rem' }}>Configuración</div>
              <button
                onClick={() => {
                  setActiveTab('admin');
                  const token = localStorage.getItem('token');
                  if (!token || adminUsers.length > 0) return;
                  setAdminLoading(true);
                  fetch(`${API}/users`, { headers: { Authorization: `Bearer ${token}` } })
                    .then(r => r.json()).then(data => { setAdminUsers(Array.isArray(data) ? data : []); setAdminLoading(false); })
                    .catch(() => setAdminLoading(false));
                }}
                className={`sidebar-link ${activeTab === 'admin' ? 'active' : ''}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                ⚙️  Administración
              </button>
            </>
          )}
        </nav>

        {/* User + logout */}
        <div style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.6rem', padding: '0 0.25rem' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #2563EB, #4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, color: '#fff', flexShrink: 0, boxShadow: '0 0 10px rgba(79,70,229,0.4)' }}>
              {userEmail ? userEmail[0].toUpperCase() : 'U'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#F8FAFC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: "'Inter', sans-serif" }}>{userEmail || 'Usuario'}</div>
              <div style={{ fontSize: '0.6rem', color: '#8B97A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{userRole}</div>
            </div>
          </div>
          <button
            onClick={() => { localStorage.removeItem('token'); router.push('/login'); }}
            style={{ width: '100%', padding: '0.45rem 0.75rem', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', color: '#EF4444', borderRadius: '0.625rem', cursor: 'pointer', fontSize: '0.73rem', fontWeight: 600, letterSpacing: '0.04em', fontFamily: "'Inter', sans-serif" }}
          >
            Cerrar sesión
          </button>
        </div>

        </div>{/* end sidebar-inner */}
      </div>

      {/* ── Main content ── */}
      <div className="main-content" style={{ width: 'calc(100% - 272px)', position: 'relative', flex: 1 }}>
        {/* Tab loading bar */}
        {newTabLoading && <div className="tab-loading-bar" />}
        {/* Decorative background blurs */}
        <div className="bg-blur-primary" />
        <div className="bg-blur-indigo" />
        <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── Empresa + Año (top bar) ── */}
        <div className="context-topbar">
          <div className="context-topbar-companies">
            {userRole === 'admin' && (
              <button
                className={`context-pill${isGrupo ? ' active' : ''}`}
                onClick={() => { setSelectedCompany(GRUPO); setActiveTab('inicio'); }}
              >
                🏢 GRUPO
              </button>
            )}
            {visibleCompanies.map((co) => (
              <button
                key={co.codEmpresa}
                className={`context-pill${!isGrupo && selectedCompany.codEmpresa === co.codEmpresa ? ' active' : ''}`}
                onClick={() => { setSelectedCompany(co); setActiveTab('inicio'); setSidebarOpen(false); }}
              >
                {co.shortName}
              </button>
            ))}
          </div>
          <div className="context-topbar-years">
            {availableYears.map((y) => (
              <button
                key={y}
                className={`context-year${selectedYear === y ? ' active' : ''}`}
                onClick={() => setSelectedYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* ── Sync running banner ── */}
        {syncStatus === 'running' && (() => {
          const sp = syncProgress;
          const elapsed = sp?.elapsed ?? 0;
          const done = sp?.completedYears?.length ?? 0;
          const total = sp?.totalYears ?? 0;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const estRemaining = done > 0 ? Math.round(elapsed / done * (total - done)) : null;
          const fmtTime = (s: number) => s >= 60 ? `${Math.floor(s/60)}m ${s%60}s` : `${s}s`;
          return (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#F59E0B' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1rem', animation: 'spin 2s linear infinite' }}>⟳</span>
                <span style={{ fontWeight: 600 }}>Sincronización en progreso</span>
                {total > 0 && <span style={{ color: '#8B97A8', fontSize: '0.75rem' }}>AÑO {done + 1}/{total} · {elapsed > 0 ? `${fmtTime(elapsed)} transcurrido` : ''}{estRemaining ? ` · ~${fmtTime(estRemaining)} restante` : ''}</span>}
              </div>
              {total > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '4px', height: '4px', marginBottom: '0.5rem', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#F59E0B', borderRadius: '4px', transition: 'width 1s ease' }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.75rem', color: '#8B97A8' }}>
                {sp?.currentYear && <span>Año: <span style={{ color: '#F59E0B', fontWeight: 600 }}>{sp.currentYear}</span></span>}
                {sp?.currentCompany && <span>Empresa: <span style={{ color: '#CBD5E1' }}>{sp.currentCompany}</span></span>}
                {sp?.currentBatch && <span>Lote: <span style={{ color: '#CBD5E1' }}>{sp.currentBatch}</span></span>}
                {sp?.companiesDone?.length > 0 && <span>En este año: <span style={{ color: '#22C55E' }}>{sp.companiesDone.length} empresa{sp.companiesDone.length !== 1 ? 's' : ''} listas</span></span>}
              </div>
            </div>
          );
        })()}
        {/* ── Breadcrumb ── */}
        {activeTab !== 'inicio' && (
          <div className="breadcrumb" style={{ marginBottom: '1.25rem' }}>
            <span
              style={{ cursor: 'pointer', color: 'var(--primary-light)', opacity: 0.7 }}
              onClick={() => handleTabChange('inicio')}
            >
              Inicio
            </span>
            <span className="breadcrumb-sep">›</span>
            <span style={{ opacity: 0.6 }}>{selectedCompany.shortName}</span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-current">
              {activeTab === 'pl' && 'P&L'}
              {activeTab === 'cxc' && 'CxC Aging'}
              {activeTab === 'cxp' && 'CxP Aging'}
              {activeTab === 'caja' && 'Posición Caja'}
              {activeTab === 'gav' && 'GAV Detalle'}
              {activeTab === 'docs' && 'Documentos'}
              {activeTab === 'admin' && 'Administración'}
              {activeTab === 'balance' && 'Balance General'}
              {activeTab === 'otras_cxc' && 'Otras CxC'}
              {activeTab === 'otras_cxp' && 'Otras CxP'}
              {activeTab === 'prestamos' && 'Préstamos'}
              {activeTab === 'tributos' && 'Tributos'}
              {activeTab === 'laboral' && 'Laboral'}
              {activeTab === 'activo_fijo' && 'Activo Fijo'}
              {activeTab === 'tesoreria' && 'Tesorería'}
              {activeTab === 'patrimonio' && 'Patrimonio'}
              {activeTab === 'inventarios' && 'Inventarios'}
              {activeTab === 'gastos_nat' && 'Gastos Naturaleza'}
              {activeTab === 'caja_saldos' && 'Saldos Banco'}
              {activeTab === 'conciliacion' && 'Conciliación'}
              {activeTab === 'audit' && 'Auditoría'}
              {activeTab === 'validation_forense' && 'Validación Forense'}
              {activeTab === 'directorio' && 'Reporte Directorio'}
            </span>
            {lastSync && (
              <>
                <span className="breadcrumb-sep" style={{ marginLeft: 'auto' }} />
                <span style={{ color: '#10B981', fontSize: '0.65rem', fontWeight: 600, marginLeft: 'auto' }}>
                  ● {new Date(lastSync).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </>
            )}
          </div>
        )}

        <div style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="page-section-label">
              {activeTab === 'inicio' && (isGrupo ? 'Consolidado del Grupo' : 'Resumen Ejecutivo')}
              {activeTab === 'pl'    && (isGrupo ? 'Consolidado del Grupo' : 'Business Intelligence')}
              {activeTab === 'cxc'   && 'Gestión de Cartera'}
              {activeTab === 'cxp'   && 'Gestión de Pagos'}
              {activeTab === 'caja'  && 'Tesorería'}
              {activeTab === 'gav'   && 'Gastos Operativos'}
              {activeTab === 'docs'       && 'Documentos'}
              {activeTab === 'admin'      && 'Administración'}
              {activeTab === 'balance'    && 'Balance Sheet'}
              {activeTab === 'otras_cxc'  && 'Cuentas por Cobrar'}
              {activeTab === 'otras_cxp'  && 'Cuentas por Pagar'}
              {activeTab === 'prestamos'  && 'Financiero'}
              {activeTab === 'tributos'   && 'Tributario'}
              {activeTab === 'laboral'    && 'Laboral'}
              {activeTab === 'activo_fijo' && 'Activos'}
              {activeTab === 'tesoreria'   && 'Tesorería'}
              {activeTab === 'patrimonio'  && 'Patrimonio'}
              {activeTab === 'inventarios' && 'Inventarios'}
              {activeTab === 'gastos_nat' && 'Contabilidad'}
              {activeTab === 'caja_saldos' && 'Saldos Bancarios'}
              {activeTab === 'conciliacion' && 'Control Interno'}
              {activeTab === 'audit'             && 'Control Interno'}
              {activeTab === 'validation_forense' && 'Control Interno'}
              {activeTab === 'directorio'       && 'Reporte Directorio'}
            </div>
            <h1 className="page-title">
              {activeTab === 'inicio' && (isGrupo ? 'Dashboard Ejecutivo' : selectedCompany.shortName)}
              {activeTab === 'pl'    && (isGrupo ? 'Análisis Ejecutivo' : 'Estado de Resultados')}
              {activeTab === 'cxc'   && 'Cuentas por Cobrar (Clase 12)'}
              {activeTab === 'cxp'   && 'Cuentas por Pagar (Clase 42)'}
              {activeTab === 'caja'  && 'Posición de Caja'}
              {activeTab === 'gav'   && 'GAV Detalle'}
              {activeTab === 'docs'  && 'Documentos del Período'}
              {activeTab === 'admin' && 'Usuarios del Sistema'}
              {activeTab === 'balance'    && 'Balance General'}
              {activeTab === 'otras_cxc'  && 'Otras CxC (Clases 13,14,16,17,18)'}
              {activeTab === 'otras_cxp'  && 'Otras CxP (Clases 43–47)'}
              {activeTab === 'prestamos'  && 'Préstamos (Tipo 071)'}
              {activeTab === 'tributos'   && 'Tributos por Pagar (Clase 40)'}
              {activeTab === 'laboral'    && 'Obligaciones Laborales (Clase 41)'}
              {activeTab === 'activo_fijo' && 'Activo Fijo (Clase 33/39)'}
              {activeTab === 'tesoreria'   && `Tesorería — Posición Bancaria ${selectedYear}`}
              {activeTab === 'patrimonio'  && 'Patrimonio Neto (Clases 50–59)'}
              {activeTab === 'inventarios' && `Inventarios y Existencias (Clases 20–29) · ${selectedYear}`}
              {activeTab === 'gastos_nat' && 'Gastos por Naturaleza (Clases 60–68)'}
              {activeTab === 'caja_saldos' && 'Saldos Bancarios Acumulados'}
              {activeTab === 'conciliacion' && 'Conciliación Bancaria — Estado del Módulo S10'}
              {activeTab === 'audit'             && 'Módulo de Auditoría'}
              {activeTab === 'validation_forense' && 'Validación Forense S10'}
              {activeTab === 'directorio' && `Reporte Directorio · ${selectedQuarter} ${selectedYear}`}
            </h1>
            <div style={{ color: '#8B97A8', fontSize: '0.8rem', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span>{selectedCompany.fullName}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>YTD {selectedYear}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>Fuente: S10 ERP</span>
              {prevYear && <><span style={{ opacity: 0.4 }}>·</span><span>vs {prevYear.year}</span></>}
            </div>
          </div>
          {/* Tab loading indicator */}
          {newTabLoading && (
            <div style={{ padding: '0.35rem 0.75rem', background: 'rgba(32,126,131,0.1)', border: '1px solid rgba(32,126,131,0.2)', borderRadius: '2rem', fontSize: '0.68rem', color: '#2BB4BB', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>
              ● Cargando
            </div>
          )}
        </div>

        {/* ═══ INICIO / Home Tab ═══ */}
        {activeTab === 'inicio' && (
          <div>
            {loading ? <SkeletonLoader /> : (
              <>
                {/* KPI summary cards */}
                {ytd ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
                    <KpiCard label="Ingresos YTD" value={fmt(ytd.ingresos)} signal="neutral"
                      sub={prevYear ? `Ant: ${fmt(prevYear.ytd?.ingresos)}` : `${selectedYear}`} />
                    <KpiCard label="Margen Bruto" value={pct(ytd.margenBrutoPct)} signal={semaforo('margenBrutoPct', ytd.margenBrutoPct)}
                      sub={fmt(ytd.margenBruto)} hint={prevYear ? `Ant: ${pct(prevYear.ytd?.margenBrutoPct)}` : undefined} />
                    <KpiCard label="EBITDA" value={fmt(ytd.ebitda)} signal={semaforo('ebitdaPct', ytd.ebitdaPct)}
                      sub={pct(ytd.ebitdaPct)} hint={prevYear ? `Ant: ${pct(prevYear.ytd?.ebitdaPct)}` : undefined} />
                    <KpiCard label="Utilidad Neta" value={fmt(ytd.utilidadNeta)} signal={semaforo('margenNetoPct', ytd.margenNetoPct ?? 0)}
                      sub={pct(ytd.margenNetoPct ?? 0)} />
                    {cxcSplitData
                      ? <>
                          <KpiCard label="CxC Comercial" value={fmt(cxcSplitData.comercial)}
                            signal={dso && dso > 60 ? 'red' : dso && dso > 45 ? 'yellow' : 'green'}
                            sub={dso ? `DSO ${dso}d` : 'sin DSO'}
                            hint="Solo facturas y NC (131/125/128/134)"
                            onClick={() => setActiveTab('cxc')} />
                          {cxcSplitData.otras > 0 && <KpiCard label="Otras CxC" value={fmt(cxcSplitData.otras)}
                            signal="neutral"
                            sub="Préstamos, DSP, transferencias"
                            hint="Tipos 071, 058, 060 y otros no tributarios"
                            onClick={() => setActiveTab('otras_cxc')} />}
                        </>
                      : cxc && <KpiCard label="CxC Total" value={fmt(cxc.totalSaldo)} signal={dso && dso > 60 ? 'red' : dso && dso > 45 ? 'yellow' : 'green'}
                          sub={dso ? `DSO ${dso}d` : 'sin DSO'} />}
                    {saldoCaja != null && <KpiCard label="Saldo Caja" value={fmt(saldoCaja)} signal={saldoCaja > 0 ? 'green' : 'red'}
                      sub={runway ? `Runway ${runway}m` : 'sin runway'} />}
                  </div>
                ) : (
                  <div style={{ marginBottom: '1.75rem' }}>
                    <SkeletonLoader />
                  </div>
                )}

                {/* Per-company scorecard when GRUPO */}
                {isGrupo && scorecard?.companies?.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div className="page-section-label" style={{ marginBottom: '0.75rem' }}>Scorecard por Empresa · {selectedYear}</div>
                    <div className="home-kpi-grid">
                      {scorecard.companies.map((emp: any) => {
                        const co = COMPANIES.find(c => c.codEmpresa === emp.codEmpresa);
                        return (
                          <div
                            key={emp.codEmpresa}
                            className="home-company-card"
                            style={{ cursor: 'pointer' }}
                            onClick={() => { if (co) { setSelectedCompany(co); setActiveTab('pl'); } }}
                          >
                            <div className="home-company-name">{co?.shortName || emp.name?.split(' ')[0] || emp.codEmpresa}</div>
                            <div className="home-metric-row">
                              <span className="home-metric-label">Ingresos</span>
                              <span className="home-metric-value">{fmt(emp.ytd?.ingresos ?? 0)}</span>
                            </div>
                            <div className="home-metric-row">
                              <span className="home-metric-label">Margen</span>
                              <span className="home-metric-value" style={{ color: (emp.ytd?.margenBrutoPct ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                {pct(emp.ytd?.margenBrutoPct ?? 0)}
                              </span>
                            </div>
                            <div className="home-metric-row">
                              <span className="home-metric-label">EBITDA</span>
                              <span className="home-metric-value" style={{ color: (emp.ytd?.ebitda ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                {fmt(emp.ytd?.ebitda ?? 0)}
                              </span>
                            </div>
                            <div className="home-metric-row">
                              <span className="home-metric-label">Utilidad</span>
                              <span className="home-metric-value" style={{ color: (emp.ytd?.utilidadNeta ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                {fmt(emp.ytd?.utilidadNeta ?? 0)}
                              </span>
                            </div>
                            {emp.dso !== null && (
                              <div className="home-metric-row">
                                <span className="home-metric-label">DSO</span>
                                <span className="home-metric-value" style={{ color: emp.dso > 60 ? 'var(--red)' : emp.dso > 45 ? 'var(--yellow)' : 'var(--green)' }}>
                                  {emp.dso}d
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quick access cards */}
                <div className="page-section-label" style={{ marginBottom: '0.75rem' }}>Acceso Rápido</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  {([
                    { tab: 'pl',   icon: '📊', label: 'P&L', desc: 'Estado de Resultados' },
                    { tab: 'cxc',  icon: '💰', label: 'CxC',  desc: 'Cuentas por Cobrar' },
                    { tab: 'cxp',  icon: '🏪', label: 'CxP',  desc: 'Cuentas por Pagar' },
                    { tab: 'caja', icon: '🏦', label: 'Caja', desc: 'Posición de Caja' },
                    { tab: 'gav',  icon: '📋', label: 'GAV',  desc: 'Gastos Operativos' },
                    { tab: 'docs', icon: '🧾', label: 'Docs', desc: 'Documentos' },
                  ] as const).map(item => (
                    <button key={item.tab} onClick={() => handleTabChange(item.tab)}
                      style={{
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '0.75rem', padding: '1rem 0.75rem', cursor: 'pointer',
                        textAlign: 'center', transition: 'all 0.15s', color: 'var(--text-primary)',
                        fontFamily: "'Inter', sans-serif",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(32,126,131,0.1)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(32,126,131,0.25)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; }}
                    >
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>{item.icon}</div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.15rem' }}>{item.label}</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{item.desc}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ P&L Tab ═══ */}
        {activeTab === 'pl' && loading && <SkeletonLoader />}
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
              {!isGrupo && cxc?.totalSaldo != null && cxp?.totalSaldo != null && (() => {
                const wc = (cxc.totalSaldo || 0) - (cxp.totalSaldo || 0);
                return (
                  <KpiCard
                    label="Capital de Trabajo"
                    value={fmt(wc)}
                    sub="CxC − CxP"
                    signal={wc >= 0 ? 'green' : 'red'}
                  />
                );
              })()}
            </div>

            {/* Vista Grupo: ranking de empresas */}
            {isGrupo && consolidado?.empresas?.length > 0 && (
              <div className="kpi-card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: 700, color: '#F8FAFC', marginBottom: '1rem' }}>Aporte por Empresa</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  {consolidado.empresas
                    .sort((a: any, b: any) => b.ytd.ingresos - a.ytd.ingresos)
                    .map((e: any, i: number) => (
                      <div key={e.codEmpresa} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '0.5rem', padding: '0.75rem', borderLeft: `4px solid ${COLORS_EMPRESA[i % 4]}` }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: COLORS_EMPRESA[i % 4], textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                          {e.shortName} · {e.pctIngresos}% del grupo
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#F8FAFC' }}>{fmt(e.ytd.ingresos)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#8B97A8', marginTop: '0.2rem' }}>
                          EBITDA {pct(e.ytd.ebitdaPct ?? 0)} · Neto {fmt(e.ytd.utilidadNeta)}
                        </div>
                      </div>
                    ))}
                </div>
                {/* Bar chart comparativo */}
                <div style={{ marginTop: '1rem' }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={consolidado.empresas.map((e: any) => ({ name: e.shortName, Ingresos: e.ytd.ingresos, EBITDA: e.ytd.ebitda, Utilidad: e.ytd.utilidadNeta }))} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8B97A8' }} />
                      <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} tick={{ fontSize: 10, fill: '#8B97A8' }} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Bar dataKey="Ingresos" fill="#207E83" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="EBITDA" fill="#F59E0B" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Utilidad" fill="#10B981" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Scorecard comparativo */}
            {isGrupo && scorecard?.companies?.length > 0 && (
              <div className="kpi-card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 700, color: '#F8FAFC' }}>Scorecard Comparativo</div>
                  <ExportBtn onClick={() => {
                    const headers = ['Empresa', 'Ingresos YTD', '% Margen', '% EBITDA', 'DSO (días)', 'DPO (días)', 'Capital de Trabajo', 'Caja Total'];
                    const rows = scorecard.companies.map((c: any) => [
                      c.shortName, c.ingresosYTD,
                      c.margenPct != null ? c.margenPct.toFixed(1) : '',
                      c.ebitdaPct != null ? c.ebitdaPct.toFixed(1) : '',
                      c.dso != null ? Math.round(c.dso) : '',
                      c.dpo != null ? Math.round(c.dpo) : '',
                      c.workingCapital ?? '', c.cajaTotal ?? '',
                    ]);
                    exportCSV(`Scorecard_${selectedYear}.csv`, headers, rows);
                  }} />
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-s10">
                    <thead>
                      <tr>
                        <th>Empresa</th>
                        <th>Ingresos YTD</th>
                        <th>% Margen</th>
                        <th>% EBITDA</th>
                        <th>DSO</th>
                        <th>DPO</th>
                        <th>Capital de Trabajo</th>
                        <th>Caja</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scorecard.companies.map((c: any) => {
                        const wc = c.workingCapital;
                        return (
                          <tr key={c.codEmpresa}>
                            <td style={{ fontWeight: 600, color: '#F8FAFC' }}>{c.shortName}</td>
                            <td style={{ fontWeight: 600 }}>{fmt(c.ingresosYTD)}</td>
                            <td style={{ color: c.margenPct != null ? SIGNAL_COLOR[semaforo('margenBrutoPct', c.margenPct)] : '#8B97A8', fontWeight: 600 }}>
                              {c.margenPct != null ? `${SIGNAL_DOT[semaforo('margenBrutoPct', c.margenPct)]} ${pct(c.margenPct)}` : '—'}
                            </td>
                            <td style={{ color: c.ebitdaPct != null ? SIGNAL_COLOR[semaforo('ebitdaPct', c.ebitdaPct)] : '#8B97A8', fontWeight: 600 }}>
                              {c.ebitdaPct != null ? `${SIGNAL_DOT[semaforo('ebitdaPct', c.ebitdaPct)]} ${pct(c.ebitdaPct)}` : '—'}
                            </td>
                            <td style={{ color: c.dso != null ? SIGNAL_COLOR[semaforo('dso', c.dso)] : '#8B97A8' }}>
                              {c.dso != null ? fmtDays(c.dso) : '—'}
                            </td>
                            <td style={{ color: '#8B97A8' }}>
                              {c.dpo != null ? fmtDays(c.dpo) : '—'}
                            </td>
                            <td style={{ fontWeight: 600, color: wc != null ? (wc >= 0 ? '#10B981' : '#EF4444') : '#8B97A8' }}>
                              {wc != null ? fmt(wc) : '—'}
                            </td>
                            <td style={{ color: c.cajaTotal != null ? (c.cajaTotal >= 0 ? '#10B981' : '#EF4444') : '#8B97A8' }}>
                              {c.cajaTotal != null ? fmt(c.cajaTotal) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Waterfall chart */}
            <div className="kpi-card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 700, color: '#F8FAFC', marginBottom: '0.75rem' }}>
                Cascada P&L — YTD {selectedYear}
              </div>
              <WaterfallChart ytd={ytd} />
            </div>

            {/* Gráfico mensual Ingresos vs EBITDA */}
            {!isGrupo && (
              <div className="kpi-card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: 700, color: '#F8FAFC', marginBottom: '1rem' }}>Ingresos vs EBITDA — Mensual</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={plMonthly.filter((m: any) => m.ingresos > 0)} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="mesLabel" tick={{ fontSize: 12, fill: '#8B97A8' }} />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: '#8B97A8' }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="ingresos" name="Ingresos" fill="#207E83" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="ebitda" name="EBITDA" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tabla Detalle Mensual con YoY */}
            <div className="kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ fontWeight: 700, color: '#F8FAFC' }}>Detalle Mensual</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#8B97A8' }}>
                    {!isGrupo && 'Click en Ingresos, Costo, GAV o Gastos para ver el desglose'}
                  </div>
                  <ExportBtn onClick={() => {
                    const mesesActivos = plMonthly.filter((m: any) => m.ingresos > 0 || m.gav > 0);
                    const headers = ['Concepto', ...mesesActivos.map((m: any) => m.mesLabel), `YTD ${selectedYear}`, ...(prevYear ? [`Ant. ${prevYear.year}`, '∆ YoY%'] : [])];
                    const rows = PL_ROWS.map((row) => {
                      const resolveVal = (obj: any) => obj?.[row.key] !== undefined ? obj[row.key] : (row.key === 'utilidadNetaPct' ? obj?.['margenNetoPct'] : undefined);
                      const currVal = resolveVal(ytd);
                      const prevVal = resolveVal(prevYear?.ytd);
                      const delta = prevVal !== undefined && prevVal !== 0 ? ((currVal - prevVal) / Math.abs(prevVal) * 100) : null;
                      return [row.label, ...mesesActivos.map((m: any) => m[row.key] ?? ''), currVal ?? '', ...(prevYear ? [prevVal ?? '', delta !== null ? `${delta.toFixed(1)}%` : ''] : [])];
                    });
                    exportCSV(`PL_${selectedCompany.shortName}_${selectedYear}.csv`, headers, rows);
                  }} />
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
                      <th style={{ background: 'rgba(32,126,131,0.2)' }}>YTD {selectedYear}</th>
                      {prevYear && (
                        <th style={{ background: 'rgba(255,255,255,0.06)' }}>
                          {prevYear.meses?.length
                            ? `${MESES[prevYear.meses[0]-1]}-${MESES[prevYear.meses[prevYear.meses.length-1]-1]} ${prevYear.year}`
                            : `YTD ${prevYear.year}`}
                        </th>
                      )}
                      {prevYear && <th style={{ background: 'rgba(255,255,255,0.04)' }}>∆ YoY</th>}
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
                              <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: '#2BB4BB' }}>
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
                            <td style={{ color: '#8B97A8', fontStyle: 'italic' }}>
                              {row.fmt === 'pct' ? pct(prevVal ?? 0) : fmt(prevVal ?? 0)}
                            </td>
                          )}
                          {prevYear && (
                            <td style={{ fontWeight: 600, color: delta !== null ? (delta >= 0 ? '#10B981' : '#EF4444') : '#8B97A8', fontSize: '0.85rem' }}>
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
        {activeTab === 'cxc' && loading && <SkeletonLoader />}
        {activeTab === 'cxc' && !cxc && !loading && <NoDataBanner kpi="CxC" />}
        {activeTab === 'cxc' && cxc && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {(cxc.totalSaldoPEN ?? 0) > 0 && <KpiCard label="Cartera PEN" value={fmt(cxc.totalSaldoPEN)} signal="neutral" />}
              {(cxc.totalSaldoUSD ?? 0) > 0 && <KpiCard label="Cartera USD" value={`$ ${Number(cxc.totalSaldoUSD).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} signal="neutral" />}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontWeight: 700, color: '#F8FAFC' }}>Aging por Cliente</div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <SearchInput value={cxcSearch} onChange={setCxcSearch} placeholder="Buscar cliente..." />
                  <ExportBtn onClick={() => {
                    const headers = ['Cliente', 'Moneda', '0-30 días', '31-60 días', '61-90 días', '+90 días', 'Total'];
                    const rows = sortRows(cxc.clientes, cxcSort.col, cxcSort.dir).map((c: any) => [
                      c.cliente, c.moneda ?? 'PEN', c.dias0_30, c.dias31_60, c.dias61_90, c.dias90mas, c.saldoTotal,
                    ]);
                    exportCSV(`CxC_${selectedCompany.shortName}.csv`, headers, rows);
                  }} />
                </div>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#8B97A8', marginBottom: '0.75rem' }}>Click en un cliente para ver los asientos individuales · Montos en moneda original del documento</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table-s10">
                  <thead>
                    <tr>
                      <SortTh label="Cliente" col="cliente" sort={cxcSort} onSort={c => setCxcSort(toggleSort(cxcSort, c))} />
                      <th style={{ width: 54 }}>Mon.</th>
                      <SortTh label="Vigente" col="saldoVigente" sort={cxcSort} onSort={c => setCxcSort(toggleSort(cxcSort, c))} />
                      <SortTh label="0-30 días" col="dias0_30" sort={cxcSort} onSort={c => setCxcSort(toggleSort(cxcSort, c))} />
                      <SortTh label="31-60 días" col="dias31_60" sort={cxcSort} onSort={c => setCxcSort(toggleSort(cxcSort, c))} />
                      <SortTh label="61-90 días" col="dias61_90" sort={cxcSort} onSort={c => setCxcSort(toggleSort(cxcSort, c))} />
                      <SortTh label="+90 días" col="dias90mas" sort={cxcSort} onSort={c => setCxcSort(toggleSort(cxcSort, c))} />
                      <SortTh label="Total" col="saldoTotal" sort={cxcSort} onSort={c => setCxcSort(toggleSort(cxcSort, c))} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortRows(cxc.clientes, cxcSort.col, cxcSort.dir)
                      .filter((c: any) => !cxcSearch || c.cliente?.toLowerCase().includes(cxcSearch.toLowerCase()))
                      .map((c: any, i: number) => {
                        const isUSD = c.moneda === 'USD';
                        const f = (v: number) => isUSD
                          ? `$ ${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                          : fmt(v);
                        return (
                          <tr key={`${c.codCliente}-${c.moneda}-${i}`} data-clickable="1"
                            onClick={() => setCxCTxDrill({ cliente: c.cliente, codCliente: String(c.codCliente) })}
                            title="Ver asientos individuales">
                            <td style={{ color: '#2BB4BB' }}>{c.cliente} <span style={{ fontSize: '0.65rem' }}>▶</span></td>
                            <td>
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                                background: isUSD ? 'rgba(34,197,94,0.15)' : 'rgba(226,92,26,0.15)',
                                color: isUSD ? '#4ade80' : '#E25C1A' }}>
                                {isUSD ? 'USD' : 'PEN'}
                              </span>
                            </td>
                            <td>{f(c.saldoVigente)}</td>
                            <td>{f(c.dias0_30)}</td>
                            <td>{f(c.dias31_60)}</td>
                            <td>{f(c.dias61_90)}</td>
                            <td className={c.dias90mas > 0 ? 'negative' : ''}>{f(c.dias90mas)}</td>
                            <td style={{ fontWeight: 600 }}>{f(c.saldoTotal)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                  <tfoot>
                    <tr className="total-row">
                      <td colSpan={2}>TOTAL ({cxc.clientes?.length} filas)</td>
                      <td>{fmt(cxc.totalVigente)}</td>
                      <td colSpan={3} style={{ color: '#8B97A8', fontSize: '0.7rem' }}>aging en equiv. soles</td>
                      <td className="negative">{fmt(cxc.total90mas)}</td>
                      <td>{(cxc.totalSaldoPEN ?? 0) > 0 && fmt(cxc.totalSaldoPEN)}{(cxc.totalSaldoUSD ?? 0) > 0 && ` + $ ${Number(cxc.totalSaldoUSD).toLocaleString('es-PE',{maximumFractionDigits:0})}`}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ═══ CxP Tab ═══ */}
        {activeTab === 'cxp' && isGrupo && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#8B97A8' }}>
            Selecciona una empresa para ver sus cuentas por pagar.
          </div>
        )}
        {activeTab === 'cxp' && !isGrupo && loading && <SkeletonLoader />}
        {activeTab === 'cxp' && !isGrupo && !cxp && !loading && <NoDataBanner kpi="CxP" />}
        {activeTab === 'cxp' && !isGrupo && cxp && (() => {
          const dpo = (cxp.totalSaldo && ytd?.costoDirecto && Math.abs(ytd.costoDirecto) > 0)
            ? Math.round((cxp.totalSaldo / Math.abs(ytd.costoDirecto)) * 365)
            : null;
          return (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <KpiCard label="Deuda Total Proveedores" value={fmt(cxp.totalSaldo)} signal="neutral" />
                <KpiCard
                  label="+90 días vencido"
                  value={fmt(cxp.total90mas)}
                  sub={pct(cxp.pct90mas)}
                  signal={cxp.pct90mas <= 20 ? 'green' : cxp.pct90mas <= 40 ? 'yellow' : 'red'}
                />
                <KpiCard label="N° Proveedores" value={String(cxp.numProveedores ?? 0)} signal="neutral" />
                {dpo !== null && (
                  <KpiCard
                    label="DPO (Días de Pago)"
                    value={fmtDays(dpo)}
                    sub="Deuda / (Costo Dir. / 365)"
                    signal={dpo <= 60 ? 'green' : dpo <= 90 ? 'yellow' : 'red'}
                  />
                )}
                <KpiCard
                  label="Concentración Top 3"
                  value={pct(cxp.concentracionTop3 ?? 0)}
                  sub="% deuda en 3 principales proveedores"
                  signal={semaforo('concentracion', cxp.concentracionTop3)}
                />
              </div>
              <div className="kpi-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ fontWeight: 700, color: '#F8FAFC' }}>Aging por Proveedor</div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <SearchInput value={cxpSearch} onChange={setCxpSearch} placeholder="Buscar proveedor..." />
                    <ExportBtn onClick={() => {
                      const headers = ['Proveedor', '0-30 días', '31-60 días', '61-90 días', '+90 días', 'Total', '% Deuda'];
                      const rows = sortRows(cxp.proveedores, cxpSort.col, cxpSort.dir).map((p: any) => [
                        p.proveedor, p.dias0_30, p.dias31_60, p.dias61_90, p.dias90mas, p.saldoTotal,
                        cxp.totalSaldo > 0 ? `${((p.saldoTotal / cxp.totalSaldo) * 100).toFixed(1)}%` : '',
                      ]);
                      exportCSV(`CxP_${selectedCompany.shortName}.csv`, headers, rows);
                    }} />
                  </div>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#8B97A8', marginBottom: '0.75rem' }}>Click en un proveedor para ver los asientos individuales · Ordenar por columna</div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-s10">
                    <thead>
                      <tr>
                        <SortTh label="Proveedor" col="proveedor" sort={cxpSort} onSort={c => setCxpSort(toggleSort(cxpSort, c))} />
                        <SortTh label="0-30 días" col="dias0_30" sort={cxpSort} onSort={c => setCxpSort(toggleSort(cxpSort, c))} />
                        <SortTh label="31-60 días" col="dias31_60" sort={cxpSort} onSort={c => setCxpSort(toggleSort(cxpSort, c))} />
                        <SortTh label="61-90 días" col="dias61_90" sort={cxpSort} onSort={c => setCxpSort(toggleSort(cxpSort, c))} />
                        <SortTh label="+90 días" col="dias90mas" sort={cxpSort} onSort={c => setCxpSort(toggleSort(cxpSort, c))} />
                        <SortTh label="Total" col="saldoTotal" sort={cxpSort} onSort={c => setCxpSort(toggleSort(cxpSort, c))} />
                        <th>% Deuda</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortRows(cxp.proveedores, cxpSort.col, cxpSort.dir)
                        .filter((p: any) => !cxpSearch || p.proveedor?.toLowerCase().includes(cxpSearch.toLowerCase()))
                        .map((p: any) => (
                        <tr key={p.codProveedor} data-clickable="1"
                          onClick={() => setCxPTxDrill({ proveedor: p.proveedor, codProveedor: String(p.codProveedor) })}
                          title="Ver asientos individuales">
                          <td style={{ color: '#2BB4BB' }}>{p.proveedor} <span style={{ fontSize: '0.65rem' }}>▶</span></td>
                          <td>{fmt(p.dias0_30)}</td>
                          <td>{fmt(p.dias31_60)}</td>
                          <td>{fmt(p.dias61_90)}</td>
                          <td className={p.dias90mas > 0 ? 'negative' : ''}>{fmt(p.dias90mas)}</td>
                          <td style={{ fontWeight: 600 }}>{fmt(p.saldoTotal)}</td>
                          <td style={{ color: '#8B97A8' }}>{cxp.totalSaldo > 0 ? pct((p.saldoTotal / cxp.totalSaldo) * 100) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="total-row">
                        <td>TOTAL ({cxp.proveedores?.length} proveedores)</td>
                        <td>{fmt(cxp.proveedores?.reduce((s: number, p: any) => s + p.dias0_30, 0))}</td>
                        <td>{fmt(cxp.proveedores?.reduce((s: number, p: any) => s + p.dias31_60, 0))}</td>
                        <td>{fmt(cxp.proveedores?.reduce((s: number, p: any) => s + p.dias61_90, 0))}</td>
                        <td className="negative">{fmt(cxp.total90mas)}</td>
                        <td>{fmt(cxp.totalSaldo)}</td>
                        <td>100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          );
        })()}

        {/* ═══ Caja Tab ═══ */}
        {activeTab === 'caja' && loading && <SkeletonLoader />}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 700, color: '#F8FAFC' }}>Flujo Neto por Banco</div>
                <ExportBtn onClick={() => {
                  const headers = ['Banco', ...MESES, 'Total Año'];
                  const rows = (caja.bancos || []).map((b: any) => {
                    const total = Object.values(b.meses).reduce((s: number, v: any) => s + v, 0) as number;
                    return [b.banco, ...Array.from({ length: 12 }, (_, i) => b.meses[i + 1] || 0), total];
                  });
                  exportCSV(`Caja_${selectedCompany.shortName}_${selectedYear}.csv`, headers, rows);
                }} />
              </div>
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

            {/* ── Posición de Caja Trimestral ── */}
            {(() => {
              const Q_MONTHS_FE: Record<string, number[]> = { Q1:[1,2,3], Q2:[4,5,6], Q3:[7,8,9], Q4:[10,11,12] };
              const MES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
              const fmtCash = (n: number) => n === 0 ? '—' : fmt(n);
              const quarters = ['Q1','Q2','Q3','Q4'] as const;
              const cp = cajaPosicion;

              return (
                <div className="kpi-card" style={{ marginTop: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontWeight: 700, color: '#F8FAFC', fontSize: '1rem' }}>
                      Posición de Caja — {selectedQuarter} {selectedYear}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {quarters.map(q => (
                        <button key={q} onClick={() => setSelectedQuarter(q)}
                          style={{ padding: '0.3rem 0.85rem', borderRadius: '0.375rem', border: '1px solid',
                            borderColor: selectedQuarter === q ? 'rgba(226,92,26,0.6)' : 'rgba(255,255,255,0.12)',
                            background: selectedQuarter === q ? 'rgba(226,92,26,0.15)' : 'transparent',
                            color: selectedQuarter === q ? '#FF8B4D' : '#8B97A8',
                            fontWeight: selectedQuarter === q ? 700 : 400, fontSize: '0.82rem', cursor: 'pointer' }}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  {!cp ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>Cargando...</div>
                  ) : (
                    <>
                      {/* 4 KPI cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                        {[
                          { label: `Saldo Inicial ${selectedQuarter}`, val: cp.saldoInicialQ, color: '#5B86E5' },
                          { label: 'Total Entradas', val: cp.totalEntradas, color: '#10B981' },
                          { label: 'Total Salidas', val: cp.totalSalidas, color: '#EF4444' },
                          { label: `Saldo Final ${selectedQuarter}`, val: cp.saldoFinalQ, color: (cp.saldoFinalQ ?? 0) >= 0 ? '#10B981' : '#EF4444' },
                        ].map(({ label, val, color }) => (
                          <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.08)`, borderTop: `3px solid ${color}`, borderRadius: '0.5rem', padding: '0.75rem 1rem' }}>
                            <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginBottom: '0.35rem' }}>{label}</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color, fontFamily: 'monospace' }}>{fmt(val ?? 0)}</div>
                          </div>
                        ))}
                      </div>

                      {/* Tabla detallada */}
                      <div style={{ overflowX: 'auto' }}>
                        <table className="table-s10" style={{ fontSize: '0.82rem', minWidth: 600 }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', minWidth: 220 }}>Concepto</th>
                              {(cp.meses || []).map((m: any) => <th key={m.mes} style={{ textAlign: 'right' }}>{MES_SHORT[m.mes - 1]}</th>)}
                              <th style={{ textAlign: 'right', fontWeight: 700 }}>{selectedQuarter} Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Saldo inicial */}
                            <tr style={{ fontWeight: 600 }}>
                              <td>Saldo inicial del período</td>
                              {(cp.meses || []).map((m: any) => <td key={m.mes} style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(m.saldoInicial)}</td>)}
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(cp.saldoInicialQ ?? 0)}</td>
                            </tr>
                            {/* Entradas header */}
                            <tr style={{ background: 'rgba(16,185,129,0.18)' }}>
                              <td colSpan={(cp.meses?.length ?? 3) + 2} style={{ fontWeight: 700, color: '#10B981', padding: '0.4rem 0.75rem' }}>ENTRADAS DE CAJA</td>
                            </tr>
                            <tr>
                              <td style={{ paddingLeft: '1.5rem', color: '#8B97A8' }}>Cobros a clientes / facturas y otros</td>
                              {(cp.meses || []).map((m: any) => <td key={m.mes} style={{ textAlign: 'right', fontFamily: 'monospace', color: '#10B981' }}>{fmtCash(m.entradas)}</td>)}
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#10B981', fontWeight: 700 }}>{fmtCash(cp.totalEntradas ?? 0)}</td>
                            </tr>
                            <tr style={{ background: 'rgba(16,185,129,0.07)', fontWeight: 600 }}>
                              <td>Total Entradas</td>
                              {(cp.meses || []).map((m: any) => <td key={m.mes} style={{ textAlign: 'right', fontFamily: 'monospace', color: '#10B981' }}>{fmtCash(m.entradas)}</td>)}
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#10B981', fontWeight: 700 }}>{fmtCash(cp.totalEntradas ?? 0)}</td>
                            </tr>
                            {/* Salidas header */}
                            <tr style={{ background: 'rgba(239,68,68,0.18)' }}>
                              <td colSpan={(cp.meses?.length ?? 3) + 2} style={{ fontWeight: 700, color: '#EF4444', padding: '0.4rem 0.75rem' }}>SALIDAS DE CAJA</td>
                            </tr>
                            <tr>
                              <td style={{ paddingLeft: '1.5rem', color: '#8B97A8' }}>Remuneraciones y honorarios{!cp.hasLaboral ? ' *' : ''}</td>
                              {(cp.meses || []).map((m: any) => <td key={m.mes} style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtCash(m.remuneraciones)}</td>)}
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmtCash(cp.totalRemuneraciones ?? 0)}</td>
                            </tr>
                            <tr>
                              <td style={{ paddingLeft: '1.5rem', color: '#8B97A8' }}>Proveedores, arriendo, servicios y otros</td>
                              {(cp.meses || []).map((m: any) => <td key={m.mes} style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtCash(m.proveedores)}</td>)}
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmtCash(cp.totalProveedores ?? 0)}</td>
                            </tr>
                            <tr>
                              <td style={{ paddingLeft: '1.5rem', color: '#8B97A8' }}>SUNAT / impuestos</td>
                              {(cp.meses || []).map((m: any) => <td key={m.mes} style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtCash(m.sunat)}</td>)}
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmtCash(cp.totalSunat ?? 0)}</td>
                            </tr>
                            <tr style={{ background: 'rgba(239,68,68,0.07)', fontWeight: 600 }}>
                              <td>Total Salidas</td>
                              {(cp.meses || []).map((m: any) => <td key={m.mes} style={{ textAlign: 'right', fontFamily: 'monospace', color: '#EF4444' }}>{fmtCash(m.salidas)}</td>)}
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#EF4444', fontWeight: 700 }}>{fmtCash(cp.totalSalidas ?? 0)}</td>
                            </tr>
                          </tbody>
                          <tfoot>
                            <tr className="total-row">
                              <td style={{ fontWeight: 700 }}>SALDO FINAL</td>
                              {(cp.meses || []).map((m: any) => (
                                <td key={m.mes} style={{ textAlign: 'right', fontFamily: 'monospace', color: m.saldoFinal >= 0 ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                                  {fmt(m.saldoFinal)}
                                </td>
                              ))}
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: (cp.saldoFinalQ ?? 0) >= 0 ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                                {fmt(cp.saldoFinalQ ?? 0)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      {!cp.hasLaboral && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#8B97A8', fontStyle: 'italic' }}>
                          * Remuneraciones requiere sync completo (crontab nocturno sin --fast)
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}
          </>
        )}

        {/* ═══ Documentos Tab ═══ */}
        {activeTab === 'docs' && isGrupo && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#8B97A8' }}>
            Selecciona una empresa para ver sus documentos.
          </div>
        )}
        {activeTab === 'docs' && !isGrupo && !docs && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#8B97A8' }}>Cargando documentos...</div>
        )}
        {activeTab === 'docs' && !isGrupo && docs && (() => {
          // Tipos no tributarios — sin comprobante de pago en sentido fiscal
          const CODTIPOS_OPER = ['060','058','071','048','070','069','073','075','056'];
          const DESC_OPER = ['SIN COMPROBANTE','TRANSFERENCIA BANCARIA','PRESTAMO','ANTICIPO','ENTREGA A RENDIR','FONDO ROTATORIO','DEVOLUCION','PLANILLA','NOTA DE ABONO'];
          const esOperativo = (d: any) => d.CodTipo
            ? CODTIPOS_OPER.includes(String(d.CodTipo))
            : DESC_OPER.some(k => (d.TipoDocumento || '').toUpperCase().includes(k));
          const tributarios = docs.emitidas.filter((d: any) => !esOperativo(d));
          const operativos  = docs.emitidas.filter((d: any) => esOperativo(d));
          const lista = docsTab === 'emitidas' ? tributarios
                      : docsTab === 'recibidas' ? docs.recibidas
                      : docsTab === 'honorarios' ? docs.honorarios
                      : operativos;
          // Sin asiento solo aplica a comprobantes tributarios
          const listaParaAlerta = docsTab === 'emitidas' ? tributarios : docsTab === 'recibidas' ? docs.recibidas : docsTab === 'honorarios' ? docs.honorarios : [];
          const sinAsientoCount = listaParaAlerta.filter((d: any) => d.SinAsiento === 1).length;
          const sinAsientoMonto = listaParaAlerta.filter((d: any) => d.SinAsiento === 1).reduce((s: number, d: any) => s + (d.TotalNeto || 0), 0);
          const duplicadosCount = lista.filter((d: any) => d.EsDuplicado === 1).length;
          const q = docsSearch.toLowerCase();
          const filtrada = lista.filter((d: any) => {
            if (docsOnlySinAsiento && docsTab !== 'operativos' && d.SinAsiento !== 1) return false;
            if (docsOnlyDuplicados && d.EsDuplicado !== 1) return false;
            if (!q) return true;
            const nombre = (docsTab === 'emitidas' || docsTab === 'operativos') ? (d.Cliente || '') : (d.Proveedor || '');
            const num = `${d.Serie || ''}-${d.Numero || ''}`;
            const tipo = d.TipoDocumento || '';
            return nombre.toLowerCase().includes(q) || num.toLowerCase().includes(q) || tipo.toLowerCase().includes(q);
          });
          // NC amounts stored positive in S10 — must subtract to get net
          const ncSign = (d: any) => d.EsNotaCredito ? -1 : 1;
          const totalMonto = filtrada.reduce((s: number, d: any) => s + ncSign(d) * (d.Total || 0), 0);
          const totalNeto  = filtrada.reduce((s: number, d: any) => s + ncSign(d) * (d.TotalNeto || 0), 0);
          const totalSaldo = (docsTab === 'emitidas' || docsTab === 'operativos')
            ? filtrada.reduce((s: number, d: any) => s + ncSign(d) * (d.Saldo || 0), 0)
            : filtrada.reduce((s: number, d: any) => s + ncSign(d) * (d.TotalSaldo || 0), 0);
          const ncCount = filtrada.filter((d: any) => d.EsNotaCredito).length;
          return (
            <div>
              {/* Sub-tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {(['emitidas', 'recibidas', 'honorarios', 'operativos'] as const).map((t) => (
                  <button key={t} onClick={() => { setDocsTab(t); setDocsSearch(''); setDocsOnlySinAsiento(false); setDocsOnlyDuplicados(false); }}
                    style={{ padding: '0.4rem 1.2rem', borderRadius: '0.375rem', border: '1px solid',
                      borderColor: docsTab === t ? (t === 'operativos' ? 'rgba(245,158,11,0.5)' : 'rgba(32,126,131,0.5)') : 'rgba(255,255,255,0.1)',
                      background: docsTab === t ? (t === 'operativos' ? 'rgba(245,158,11,0.15)' : 'rgba(32,126,131,0.2)') : 'rgba(255,255,255,0.04)',
                      color: docsTab === t ? (t === 'operativos' ? '#F59E0B' : '#2BB4BB') : '#8B97A8',
                      fontWeight: docsTab === t ? 700 : 400, fontSize: '0.85rem', cursor: 'pointer' }}>
                    {t === 'emitidas' ? `Facturas Emitidas (${tributarios.length})`
                     : t === 'recibidas' ? `Facturas Recibidas (${docs.recibidas.length})`
                     : t === 'honorarios' ? `Honorarios (${docs.honorarios.length})`
                     : `Operativos (${operativos.length})`}
                  </button>
                ))}
                {sinAsientoCount > 0 && (
                  <button
                    onClick={() => { setDocsOnlySinAsiento(!docsOnlySinAsiento); setDocsOnlyDuplicados(false); setDocsSearch(''); }}
                    style={{ padding: '0.4rem 1rem', borderRadius: '0.375rem', border: '1px solid',
                      borderColor: docsOnlySinAsiento ? '#EF4444' : 'rgba(239,68,68,0.3)',
                      background: docsOnlySinAsiento ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.08)',
                      color: '#EF4444',
                      fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>
                    ⚠ Sin asiento contable ({sinAsientoCount}) · S/ {sinAsientoMonto.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                  </button>
                )}
                {duplicadosCount > 0 && (
                  <button
                    onClick={() => { setDocsOnlyDuplicados(!docsOnlyDuplicados); setDocsOnlySinAsiento(false); setDocsSearch(''); }}
                    style={{ padding: '0.4rem 1rem', borderRadius: '0.375rem', border: '1px solid',
                      borderColor: docsOnlyDuplicados ? '#F59E0B' : 'rgba(245,158,11,0.3)',
                      background: docsOnlyDuplicados ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.08)',
                      color: '#F59E0B',
                      fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>
                    ⚠ Duplicados ({duplicadosCount})
                  </button>
                )}
              </div>
              <div className="kpi-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#F8FAFC' }}>
                      {docsTab === 'emitidas' ? 'Facturas emitidas a clientes'
                       : docsTab === 'recibidas' ? 'Facturas y boletas recibidas'
                       : docsTab === 'honorarios' ? 'Recibos por Honorarios Profesionales'
                       : 'Documentos operativos / sin comprobante tributario'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#8B97A8', marginTop: '0.2rem' }}>
                      {filtrada.length - ncCount} docs{ncCount > 0 ? ` · ${ncCount} NC (restadas)` : ''} · Neto {fmt(totalNeto)} · Total c/IGV {fmt(totalMonto)} · Pendiente {fmt(totalSaldo)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder={(docsTab === 'emitidas' || docsTab === 'operativos') ? 'Buscar cliente o número...' : 'Buscar proveedor o número...'}
                      value={docsSearch}
                      onChange={e => setDocsSearch(e.target.value)}
                      style={{ padding: '0.4rem 0.75rem', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '0.375rem', fontSize: '0.82rem', minWidth: 200, background: 'rgba(255,255,255,0.04)', color: '#F8FAFC', outline: 'none' }}
                    />
                    <ExportBtn onClick={() => {
                      const tab = docsTab;
                      const fname = `Docs_${tab}_${selectedCompany.shortName}_${selectedYear}.csv`;
                      if (tab === 'emitidas' || tab === 'operativos') {
                        const headers = ['Serie-Número', 'Fecha', 'Tipo', 'Cliente', 'Neto', 'IGV', 'Total', 'Pagado', 'Saldo', 'SinAsiento', 'Duplicado'];
                        const rows = filtrada.map((d: any) => [`${d.Serie || ''}-${d.Numero}`, d.FechaDocumento, d.TipoDocumento, d.Cliente, d.TotalNeto, d.TotalImpuesto, d.Total, d.TotalPagado, d.Saldo, d.SinAsiento === 1 ? 'Sí' : 'No', d.EsDuplicado === 1 ? 'Sí' : 'No']);
                        exportCSV(fname, headers, rows);
                      } else {
                        const headers = ['Serie-Número', 'Fecha Doc.', 'Vencimiento', tab === 'recibidas' ? 'Tipo' : '', 'Proveedor', 'Neto', tab === 'recibidas' ? 'IGV' : 'Retención', 'Total', 'Pagado', 'Saldo', 'SinAsiento', 'Duplicado'].filter(Boolean);
                        const rows = filtrada.map((d: any) => [`${d.Serie || ''}-${d.Numero}`, d.FechaDocumento, d.FechaVencimiento, ...(tab === 'recibidas' ? [d.TipoDocumento] : []), d.Proveedor, d.TotalNeto, d.TotalImpuesto, d.Total, d.TotalPagado, d.TotalSaldo, d.SinAsiento === 1 ? 'Sí' : 'No', d.EsDuplicado === 1 ? 'Sí' : 'No']);
                        exportCSV(fname, headers, rows);
                      }
                    }} />
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  {docsTab === 'honorarios' ? (
                    <table className="table-s10" style={{ fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>Serie-Número</th>
                          <th>Fecha Doc.</th>
                          <th>Vencimiento</th>
                          <th style={{ minWidth: 200 }}>Prestador</th>
                          <th>RUC</th>
                          <th>Neto</th>
                          <th>Retención</th>
                          <th>Total</th>
                          <th>Pagado</th>
                          <th>Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtrada.map((d: any, i: number) => {
                          const sinAsiento = d.SinAsiento === 1;
                          const esDuplicado = d.EsDuplicado === 1;
                          return (
                          <tr key={i} style={{ background: esDuplicado ? 'rgba(245,158,11,0.06)' : sinAsiento ? 'rgba(239,68,68,0.06)' : undefined }}>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                              {esDuplicado && <span title="Documento duplicado en S10 — revisar con contabilidad" style={{ color: '#F59E0B', marginRight: '0.3rem', fontSize: '0.8rem' }}>⧉</span>}
                              {sinAsiento && <span title="Sin asiento contable en cuenta de gasto" style={{ color: '#EF4444', marginRight: '0.3rem', fontSize: '0.8rem' }}>⚠</span>}
                              {d.Serie || '—'}-{d.Numero}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>{d.FechaDocumento}</td>
                            <td style={{ whiteSpace: 'nowrap', color: (d.TotalSaldo || 0) > 0 ? '#EF4444' : '#8B97A8' }}>{d.FechaVencimiento}</td>
                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.Proveedor}>{d.Proveedor || '—'}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#8B97A8' }}>{d.RucProveedor || '—'}</td>
                            <td>{fmt(d.TotalNeto)}</td>
                            <td style={{ color: '#8B97A8' }}>{fmt(d.TotalImpuesto)}</td>
                            <td style={{ fontWeight: 600 }}>{fmt(d.Total)}</td>
                            <td style={{ color: '#10B981' }}>{fmt(d.TotalPagado)}</td>
                            <td className={(d.TotalSaldo || 0) > 0 ? 'negative' : ''}>{fmt(d.TotalSaldo)}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="total-row">
                          <td colSpan={5}>TOTAL ({filtrada.length})</td>
                          <td>{fmt(filtrada.reduce((s: number, d: any) => s + (d.TotalNeto || 0), 0))}</td>
                          <td>{fmt(filtrada.reduce((s: number, d: any) => s + (d.TotalImpuesto || 0), 0))}</td>
                          <td>{fmt(totalMonto)}</td>
                          <td>{fmt(filtrada.reduce((s: number, d: any) => s + (d.TotalPagado || 0), 0))}</td>
                          <td>{fmt(totalSaldo)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  ) : (docsTab === 'emitidas' || docsTab === 'operativos') ? (
                    <table className="table-s10" style={{ fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>Serie-Número</th>
                          <th>Fecha</th>
                          <th style={{ minWidth: 140 }}>Tipo</th>
                          <th style={{ minWidth: 200 }}>Cliente</th>
                          <th>Neto</th>
                          <th>IGV</th>
                          <th>Total</th>
                          <th>Pagado</th>
                          <th>Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtrada.map((d: any, i: number) => {
                          const sinAsiento = d.SinAsiento === 1;
                          const esDuplicado = d.EsDuplicado === 1;
                          const esNC = d.EsNotaCredito === 1;
                          return (
                          <tr key={i} style={{ background: esNC ? 'rgba(239,68,68,0.04)' : esDuplicado ? 'rgba(245,158,11,0.06)' : sinAsiento ? 'rgba(239,68,68,0.06)' : undefined }}>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                              {esNC && <span title="Nota de Crédito — resta del total facturado" style={{ color: '#EF4444', marginRight: '0.3rem', fontSize: '0.75rem' }}>NC</span>}
                              {esDuplicado && <span title="Documento duplicado en S10 — revisar con contabilidad" style={{ color: '#F59E0B', marginRight: '0.3rem', fontSize: '0.8rem' }}>⧉</span>}
                              {sinAsiento && <span title="Sin asiento contable en cuenta de ingreso" style={{ color: '#EF4444', marginRight: '0.3rem', fontSize: '0.8rem' }}>⚠</span>}
                              {d.Serie || '—'}-{d.Numero}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>{d.FechaDocumento}</td>
                            <td style={{ fontSize: '0.72rem', color: esNC ? '#EF4444' : '#2BB4BB', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.TipoDocumento}>{d.TipoDocumento || '—'}</td>
                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.Cliente}>{d.Cliente || '—'}</td>
                            <td style={{ color: esNC ? '#EF4444' : undefined }}>{esNC ? '-' : ''}{fmt(d.TotalNeto)}</td>
                            <td style={{ color: '#8B97A8' }}>{fmt(d.TotalImpuesto)}</td>
                            <td style={{ fontWeight: 600, color: esNC ? '#EF4444' : undefined }}>{esNC ? '-' : ''}{fmt(d.Total)}</td>
                            <td style={{ color: '#10B981' }}>{fmt(d.TotalPagado)}</td>
                            <td className={(d.Saldo || 0) > 0 ? 'negative' : ''}>{fmt(d.Saldo)}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="total-row">
                          <td colSpan={4}>NETO ({filtrada.length - ncCount} fact.{ncCount > 0 ? ` − ${ncCount} NC` : ''})</td>
                          <td>{fmt(totalNeto)}</td>
                          <td>{fmt(filtrada.filter((d:any)=>!d.EsNotaCredito).reduce((s: number, d: any) => s + (d.TotalImpuesto || 0), 0))}</td>
                          <td>{fmt(totalMonto)}</td>
                          <td>{fmt(filtrada.reduce((s: number, d: any) => s + (d.TotalPagado || 0), 0))}</td>
                          <td>{fmt(totalSaldo)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  ) : (
                    <table className="table-s10" style={{ fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>Serie-Número</th>
                          <th>Fecha Doc.</th>
                          <th>Vencimiento</th>
                          <th style={{ minWidth: 120 }}>Tipo</th>
                          <th style={{ minWidth: 200 }}>Proveedor</th>
                          <th>Neto</th>
                          <th>IGV</th>
                          <th>Total</th>
                          <th>Pagado</th>
                          <th>Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtrada.map((d: any, i: number) => {
                          const sinAsiento = d.SinAsiento === 1;
                          const esDuplicado = d.EsDuplicado === 1;
                          const esNC = d.EsNotaCredito === 1;
                          return (
                          <tr key={i} style={{ background: esNC ? 'rgba(239,68,68,0.04)' : esDuplicado ? 'rgba(245,158,11,0.06)' : sinAsiento ? 'rgba(239,68,68,0.06)' : undefined }}>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                              {esNC && <span title="Nota de Crédito — resta del total de compras" style={{ color: '#EF4444', marginRight: '0.3rem', fontSize: '0.75rem' }}>NC</span>}
                              {esDuplicado && <span title="Documento duplicado en S10 — revisar con contabilidad" style={{ color: '#F59E0B', marginRight: '0.3rem', fontSize: '0.8rem' }}>⧉</span>}
                              {sinAsiento && <span title="Sin asiento contable en cuenta de costo/gasto" style={{ color: '#EF4444', marginRight: '0.3rem', fontSize: '0.8rem' }}>⚠</span>}
                              {d.Serie || '—'}-{d.Numero}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>{d.FechaDocumento}</td>
                            <td style={{ whiteSpace: 'nowrap', color: (d.TotalSaldo || 0) > 0 ? '#EF4444' : '#8B97A8' }}>{d.FechaVencimiento}</td>
                            <td style={{ fontSize: '0.72rem', color: esNC ? '#EF4444' : '#2BB4BB', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.TipoDocumento}>{d.TipoDocumento || '—'}</td>
                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.Proveedor}>{d.Proveedor || '—'}</td>
                            <td style={{ color: esNC ? '#EF4444' : undefined }}>{esNC ? '-' : ''}{fmt(d.TotalNeto)}</td>
                            <td style={{ color: '#8B97A8' }}>{fmt(d.TotalImpuesto)}</td>
                            <td style={{ fontWeight: 600, color: esNC ? '#EF4444' : undefined }}>{esNC ? '-' : ''}{fmt(d.Total)}</td>
                            <td style={{ color: '#10B981' }}>{fmt(d.TotalPagado)}</td>
                            <td className={(d.TotalSaldo || 0) > 0 ? 'negative' : ''}>{fmt(d.TotalSaldo)}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="total-row">
                          <td colSpan={5}>NETO ({filtrada.length - ncCount} fact.{ncCount > 0 ? ` − ${ncCount} NC` : ''})</td>
                          <td>{fmt(totalNeto)}</td>
                          <td>{fmt(filtrada.filter((d:any)=>!d.EsNotaCredito).reduce((s: number, d: any) => s + (d.TotalImpuesto || 0), 0))}</td>
                          <td>{fmt(totalMonto)}</td>
                          <td>{fmt(filtrada.reduce((s: number, d: any) => s + (d.TotalPagado || 0), 0))}</td>
                          <td>{fmt(totalSaldo)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ═══ GAV Tab ═══ */}
        {activeTab === 'gav' && loading && <SkeletonLoader />}
        {activeTab === 'gav' && !gav && !loading && <NoDataBanner kpi="GAV" />}
        {activeTab === 'gav' && gav && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontWeight: 700, color: '#F8FAFC' }}>GAV por Categoría</div>
                <ExportBtn onClick={() => {
                  const headers = ['Categoría', 'YTD', '% GAV', '% Ingresos'];
                  const rows = sortRows(gav.categorias || [], gavSort.col, gavSort.dir).map((c: any) => [
                    c.descripcion, c.ytd,
                    `${c.pct?.toFixed(1)}%`,
                    ytd?.ingresos > 0 ? `${((c.ytd / ytd.ingresos) * 100).toFixed(1)}%` : '',
                  ]);
                  exportCSV(`GAV_${selectedCompany.shortName}_${selectedYear}.csv`, headers, rows);
                }} />
              </div>
              <div style={{ fontSize: '0.72rem', color: '#8B97A8', marginBottom: '0.75rem' }}>Click en una categoría para ver el detalle mensual y los asientos</div>
              <table className="table-s10">
                <thead>
                  <tr>
                    <SortTh label="Categoría" col="descripcion" sort={gavSort} onSort={c => setGavSort(toggleSort(gavSort, c))} />
                    <SortTh label="YTD" col="ytd" sort={gavSort} onSort={c => setGavSort(toggleSort(gavSort, c))} />
                    <SortTh label="% GAV" col="pct" sort={gavSort} onSort={c => setGavSort(toggleSort(gavSort, c))} />
                    <th>% Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {sortRows(gav.categorias || [], gavSort.col, gavSort.dir).map((c: any) => (
                    <tr key={c.cod} data-clickable="1"
                      onClick={() => setGavDrill({ cod: c.cod, descripcion: c.descripcion, meses: c.meses, ytd: c.ytd })}
                      title="Ver detalle mensual">
                      <td style={{ color: '#2BB4BB' }}>{c.descripcion} <span style={{ fontSize: '0.65rem' }}>▶</span></td>
                      <td>{fmt(c.ytd)}</td>
                      <td>{pct(c.pct)}</td>
                      <td style={{ color: '#8B97A8' }}>
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
                    <td style={{ color: '#8B97A8' }}>
                      {ytd?.ingresos > 0 ? pct((gav.total / ytd.ingresos) * 100) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="kpi-card">
              <div style={{ fontWeight: 700, color: '#F8FAFC', marginBottom: '1rem' }}>Distribución GAV</div>
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

        {/* ═══ Admin Tab ═══ */}
        {activeTab === 'admin' && userRole === 'admin' && (() => {
          const reloadUsers = () => {
            const token = localStorage.getItem('token');
            if (!token) return;
            setAdminLoading(true);
            setAdminUsers([]);
            fetch(`${API}/users`, { headers: { Authorization: `Bearer ${token}` } })
              .then(r => r.json()).then(d => { setAdminUsers(Array.isArray(d) ? d : []); setAdminLoading(false); })
              .catch(() => setAdminLoading(false));
          };

          const openCreate = () => {
            setAdminForm({ email: '', password: '', role: 'viewer', allowedCompanies: [], active: true });
            setAdminError(''); setAdminSuccess('');
            setAdminModal({ mode: 'create' });
          };

          const openEdit = (u: any) => {
            setAdminForm({ email: u.email, password: '', role: u.role, allowedCompanies: u.allowedCompanies ?? [], active: u.active });
            setAdminError(''); setAdminSuccess('');
            setAdminModal({ mode: 'edit', user: u });
          };

          const saveUser = async () => {
            const token = localStorage.getItem('token');
            if (!token) return;
            setAdminError(''); setAdminSuccess('');
            try {
              const isEdit = adminModal?.mode === 'edit';
              const url = isEdit ? `${API}/users/${adminModal!.user.id}` : `${API}/users`;
              const body: any = { role: adminForm.role, allowedCompanies: adminForm.allowedCompanies, active: adminForm.active };
              if (!isEdit) { body.email = adminForm.email; body.password = adminForm.password; }
              else if (adminForm.password) { body.password = adminForm.password; }
              const res = await fetch(url, { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
              if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Error'); }
              setAdminSuccess(isEdit ? 'Usuario actualizado.' : 'Usuario creado.');
              setAdminModal(null);
              reloadUsers();
            } catch (e: any) { setAdminError(e.message); }
          };

          const toggleActive = async (u: any) => {
            const token = localStorage.getItem('token');
            if (!token) return;
            await fetch(`${API}/users/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ active: !u.active }) });
            reloadUsers();
          };

          const COMPANY_OPTIONS = COMPANIES.map(c => ({ value: c.codEmpresa, label: c.shortName }));

          return (
            <div>
              {adminModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
                  onClick={() => setAdminModal(null)}>
                  <div style={{ background: '#0D1A2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', padding: '2rem', width: '100%', maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#F8FAFC', marginBottom: '1.25rem' }}>
                      {adminModal.mode === 'create' ? 'Nuevo usuario' : `Editar: ${adminModal.user?.email}`}
                    </div>

                    {adminModal.mode === 'create' && (
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem', color: '#8B97A8' }}>Email</label>
                        <input type="email" value={adminForm.email} onChange={e => setAdminForm(f => ({ ...f, email: e.target.value }))}
                          style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.375rem', fontSize: '0.9rem', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', color: '#F8FAFC', outline: 'none' }} />
                      </div>
                    )}

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem', color: '#8B97A8' }}>
                        {adminModal.mode === 'edit' ? 'Nueva contraseña (dejar en blanco para no cambiar)' : 'Contraseña'}
                      </label>
                      <input type="password" value={adminForm.password} onChange={e => setAdminForm(f => ({ ...f, password: e.target.value }))}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.375rem', fontSize: '0.9rem', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', color: '#F8FAFC', outline: 'none' }} />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem', color: '#8B97A8' }}>Rol</label>
                      <select value={adminForm.role} onChange={e => setAdminForm(f => ({ ...f, role: e.target.value }))}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.375rem', fontSize: '0.9rem', background: 'rgba(255,255,255,0.04)', color: '#F8FAFC', outline: 'none' }}>
                        <option value="viewer">Viewer — solo lectura</option>
                        <option value="admin">Admin — acceso total</option>
                      </select>
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.5rem', color: '#8B97A8' }}>
                        Empresas permitidas <span style={{ fontWeight: 400, color: '#4B5563' }}>(vacío = todas)</span>
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {COMPANY_OPTIONS.map(co => {
                          const checked = adminForm.allowedCompanies.includes(co.value);
                          return (
                            <label key={co.value} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem', border: `1px solid ${checked ? 'rgba(32,126,131,0.5)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '0.375rem', background: checked ? 'rgba(32,126,131,0.15)' : 'rgba(255,255,255,0.04)', cursor: 'pointer', fontSize: '0.82rem', color: checked ? '#2BB4BB' : '#8B97A8' }}>
                              <input type="checkbox" checked={checked}
                                onChange={() => setAdminForm(f => ({
                                  ...f,
                                  allowedCompanies: checked
                                    ? f.allowedCompanies.filter(x => x !== co.value)
                                    : [...f.allowedCompanies, co.value],
                                }))} />
                              {co.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {adminModal.mode === 'edit' && (
                      <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input type="checkbox" id="active-chk" checked={adminForm.active} onChange={e => setAdminForm(f => ({ ...f, active: e.target.checked }))} />
                        <label htmlFor="active-chk" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#8B97A8' }}>Usuario activo</label>
                      </div>
                    )}

                    {adminError && <div style={{ color: '#EF4444', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{adminError}</div>}

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button onClick={() => setAdminModal(null)}
                        style={{ padding: '0.5rem 1.25rem', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '0.375rem', background: 'rgba(255,255,255,0.06)', color: '#8B97A8', cursor: 'pointer', fontSize: '0.85rem' }}>
                        Cancelar
                      </button>
                      <button onClick={saveUser}
                        style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: '0.375rem', background: 'linear-gradient(135deg, #207E83, #2BB4BB)', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                        {adminModal.mode === 'create' ? 'Crear usuario' : 'Guardar cambios'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="kpi-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#F8FAFC' }}>Usuarios del sistema</div>
                    {adminSuccess && <div style={{ fontSize: '0.78rem', color: '#10B981', marginTop: '0.2rem' }}>{adminSuccess}</div>}
                  </div>
                  <button onClick={openCreate}
                    style={{ padding: '0.4rem 1rem', border: 'none', borderRadius: '0.375rem', background: 'linear-gradient(135deg, #207E83, #2BB4BB)', color: '#fff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                    + Nuevo usuario
                  </button>
                </div>

                {adminLoading ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>Cargando...</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table-s10">
                      <thead>
                        <tr>
                          <th>Email</th><th>Rol</th><th>Empresas</th><th>Último acceso</th><th>Estado</th><th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminUsers.map((u: any) => (
                          <tr key={u.id} style={{ opacity: u.active ? 1 : 0.5 }}>
                            <td style={{ fontWeight: 500 }}>{u.email}</td>
                            <td>
                              <span style={{ padding: '0.15rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 700,
                                background: u.role === 'admin' ? 'rgba(32,126,131,0.2)' : 'rgba(255,255,255,0.06)', color: u.role === 'admin' ? '#2BB4BB' : '#8B97A8' }}>
                                {u.role}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.78rem', color: '#8B97A8' }}>
                              {u.allowedCompanies?.length
                                ? u.allowedCompanies.map((id: string) => COMPANIES.find(c => c.codEmpresa === id)?.shortName || id).join(', ')
                                : 'Todas'}
                            </td>
                            <td style={{ fontSize: '0.78rem', color: '#8B97A8', whiteSpace: 'nowrap' }}>
                              {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—'}
                            </td>
                            <td>
                              <span style={{ padding: '0.15rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 700,
                                background: u.active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: u.active ? '#10B981' : '#EF4444' }}>
                                {u.active ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <button onClick={() => openEdit(u)}
                                style={{ marginRight: '0.5rem', padding: '0.2rem 0.6rem', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '0.25rem', background: 'rgba(255,255,255,0.06)', color: '#8B97A8', fontSize: '0.75rem', cursor: 'pointer' }}>
                                Editar
                              </button>
                              {u.email !== userEmail && (
                                <button onClick={() => toggleActive(u)}
                                  style={{ padding: '0.2rem 0.6rem', border: `1px solid ${u.active ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`, borderRadius: '0.25rem', background: u.active ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', color: u.active ? '#EF4444' : '#10B981', fontSize: '0.75rem', cursor: 'pointer' }}>
                                  {u.active ? 'Desactivar' : 'Activar'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
        {/* ═══ Skeleton para módulos lazy-loaded ═══ */}
        {newTabLoading && <SkeletonLoader />}

        {/* ═══ Balance General ═══ */}
        {activeTab === 'balance' && !newTabLoading && (
          <div className="kpi-card">
            {!balanceData?.rows?.length ? <NoDataBanner kpi="Balance General" /> : (() => {
              const balanceRows = balanceViewMode === 'saldos'
                ? balanceData.rows.filter((r: any) => Math.abs((r.TotalDebe||0) - (r.TotalHaber||0)) > 0.01)
                : balanceData.rows;
              return (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ fontSize: '0.82rem', color: '#8B97A8' }}>{balanceRows.length} cuentas · {selectedYear}</div>
                    <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {(['saldos', 'sumas'] as const).map(mode => (
                        <button key={mode} onClick={() => setBalanceViewMode(mode)} style={{
                          padding: '3px 12px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', border: 'none',
                          background: balanceViewMode === mode ? '#207E83' : 'rgba(255,255,255,0.04)',
                          color: balanceViewMode === mode ? '#fff' : '#8B97A8',
                          transition: 'all 0.15s',
                        }}>
                          {mode === 'saldos' ? 'Saldos' : 'Sumas'}
                        </button>
                      ))}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#4B5563' }}>
                      {balanceViewMode === 'saldos' ? 'Solo cuentas con saldo pendiente' : 'Todas las cuentas con movimiento en el año'}
                    </span>
                  </div>
                  <ExportBtn onClick={() => exportCSV('balance.csv',
                    ['Cuenta','Descripcion','Clase','SaldoIniDebe','SaldoIniHaber','MovDebe','MovHaber','SaldoFinalDebe','SaldoFinalHaber'],
                    balanceRows.map((r: any) => {
                      const finDebe = Math.max(0, (r.TotalDebe||0) - (r.TotalHaber||0));
                      const finHaber = Math.max(0, (r.TotalHaber||0) - (r.TotalDebe||0));
                      return [r.CodCuenta, r.DesCuenta, r.Clase, r.SaldoIniDebe, r.SaldoIniHaber, r.MovDebe, r.MovHaber, finDebe, finHaber];
                    }))} />
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-s10" style={{ fontSize: '0.75rem' }}>
                    <thead>
                      <tr>
                        <th rowSpan={2} style={{ verticalAlign: 'bottom' }}>Cuenta</th>
                        <th rowSpan={2} style={{ minWidth: 220, verticalAlign: 'bottom' }}>Descripción</th>
                        <th colSpan={2} style={{ textAlign: 'center', background: 'rgba(32,126,131,0.12)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Saldo Inicial</th>
                        <th colSpan={2} style={{ textAlign: 'center', background: 'rgba(245,158,11,0.1)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Movimiento {selectedYear}</th>
                        <th colSpan={2} style={{ textAlign: 'center', background: 'rgba(16,185,129,0.1)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Saldo Final</th>
                      </tr>
                      <tr>
                        <th style={{ background: 'rgba(32,126,131,0.08)' }}>Debe</th>
                        <th style={{ background: 'rgba(32,126,131,0.08)' }}>Haber</th>
                        <th style={{ background: 'rgba(245,158,11,0.06)' }}>Debe</th>
                        <th style={{ background: 'rgba(245,158,11,0.06)' }}>Haber</th>
                        <th style={{ background: 'rgba(16,185,129,0.08)' }}>Debe</th>
                        <th style={{ background: 'rgba(16,185,129,0.08)' }}>Haber</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balanceRows.map((r: any, i: number) => {
                        const finDebe  = Math.max(0, (r.TotalDebe||0) - (r.TotalHaber||0));
                        const finHaber = Math.max(0, (r.TotalHaber||0) - (r.TotalDebe||0));
                        const isSaldado = finDebe < 0.01 && finHaber < 0.01;
                        return (
                          <tr key={i} style={isSaldado ? { opacity: 0.55 } : undefined}>
                            <td style={{ fontFamily: 'monospace', color: '#2BB4BB', whiteSpace: 'nowrap' }}>{r.CodCuenta}</td>
                            <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.DesCuenta}>{r.DesCuenta}</td>
                            <td style={{ background: 'rgba(32,126,131,0.04)', color: (r.SaldoIniDebe||0) > 0 ? '#F8FAFC' : '#4B5563' }}>{(r.SaldoIniDebe||0) > 0 ? fmt(r.SaldoIniDebe) : '—'}</td>
                            <td style={{ background: 'rgba(32,126,131,0.04)', color: (r.SaldoIniHaber||0) > 0 ? '#F8FAFC' : '#4B5563' }}>{(r.SaldoIniHaber||0) > 0 ? fmt(r.SaldoIniHaber) : '—'}</td>
                            <td style={{ background: 'rgba(245,158,11,0.04)', color: (r.MovDebe||0) > 0 ? '#F8FAFC' : '#4B5563' }}>{(r.MovDebe||0) > 0 ? fmt(r.MovDebe) : '—'}</td>
                            <td style={{ background: 'rgba(245,158,11,0.04)', color: (r.MovHaber||0) > 0 ? '#F8FAFC' : '#4B5563' }}>{(r.MovHaber||0) > 0 ? fmt(r.MovHaber) : '—'}</td>
                            <td style={{ background: 'rgba(16,185,129,0.06)', fontWeight: 600, color: finDebe > 0 ? '#10B981' : '#4B5563' }}>{finDebe > 0 ? fmt(finDebe) : '—'}</td>
                            <td style={{ background: 'rgba(16,185,129,0.06)', fontWeight: 600, color: finHaber > 0 ? '#EF4444' : '#4B5563' }}>{finHaber > 0 ? fmt(finHaber) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      {(() => {
                        const sumIniD  = balanceRows.reduce((s: number, r: any) => s + (r.SaldoIniDebe||0), 0);
                        const sumIniH  = balanceRows.reduce((s: number, r: any) => s + (r.SaldoIniHaber||0), 0);
                        const sumMovD  = balanceRows.reduce((s: number, r: any) => s + (r.MovDebe||0), 0);
                        const sumMovH  = balanceRows.reduce((s: number, r: any) => s + (r.MovHaber||0), 0);
                        const sumTotD  = balanceRows.reduce((s: number, r: any) => s + (r.TotalDebe||0), 0);
                        const sumTotH  = balanceRows.reduce((s: number, r: any) => s + (r.TotalHaber||0), 0);
                        const netFinD  = balanceRows.reduce((s: number, r: any) => s + Math.max(0,(r.TotalDebe||0)-(r.TotalHaber||0)), 0);
                        const netFinH  = balanceRows.reduce((s: number, r: any) => s + Math.max(0,(r.TotalHaber||0)-(r.TotalDebe||0)), 0);
                        const difD = Math.abs(netFinD - netFinH);
                        const balanced = difD < 1;
                        return (<>
                          <tr className="total-row">
                            <td colSpan={2} style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>SUMAS</td>
                            <td>{fmt(sumIniD)}</td>
                            <td>{fmt(sumIniH)}</td>
                            <td>{fmt(sumMovD)}</td>
                            <td>{fmt(sumMovH)}</td>
                            <td>{fmt(sumTotD)}</td>
                            <td>{fmt(sumTotH)}</td>
                          </tr>
                          <tr className="total-row" style={{ borderTop: '2px solid rgba(255,255,255,0.12)' }}>
                            <td colSpan={2} style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>SALDOS</td>
                            <td style={{ color: sumIniD >= sumIniH ? '#10B981' : '#8B97A8' }}>{sumIniD >= sumIniH ? fmt(sumIniD - sumIniH) : '—'}</td>
                            <td style={{ color: sumIniH > sumIniD  ? '#EF4444' : '#8B97A8' }}>{sumIniH > sumIniD  ? fmt(sumIniH - sumIniD)  : '—'}</td>
                            <td style={{ color: sumMovD >= sumMovH ? '#10B981' : '#8B97A8' }}>{sumMovD >= sumMovH ? fmt(sumMovD - sumMovH) : '—'}</td>
                            <td style={{ color: sumMovH > sumMovD  ? '#EF4444' : '#8B97A8' }}>{sumMovH > sumMovD  ? fmt(sumMovH - sumMovD)  : '—'}</td>
                            <td style={{ color: '#10B981', fontWeight: 700 }}>{fmt(netFinD)}</td>
                            <td style={{ color: '#EF4444', fontWeight: 700 }}>{fmt(netFinH)}</td>
                          </tr>
                          <tr style={{ background: balanced ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.08)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <td colSpan={6} style={{ fontSize: '0.7rem', color: balanced ? '#10B981' : '#EF4444', fontWeight: 600, paddingLeft: '0.75rem' }}>
                              {balanced ? '✓ Balance cuadrado' : `⚠ Descuadre: ${fmt(difD)}`}
                            </td>
                            <td colSpan={2} style={{ fontSize: '0.7rem', color: balanced ? '#10B981' : '#EF4444', fontWeight: 700, textAlign: 'right' }}>
                              {balanced ? fmt(netFinD) : fmt(Math.abs(netFinD - netFinH))}
                            </td>
                          </tr>
                        </>);
                      })()}
                    </tfoot>
                  </table>
                </div>
              </>
              );
            })()}
          </div>
        )}

        {/* ═══ Otras CxC ═══ */}
        {activeTab === 'otras_cxc' && !newTabLoading && (
          <div className="kpi-card">
            {!otrasCxCData?.rows?.length ? <NoDataBanner kpi="Otras CxC" /> : (
              <>
                <div style={{ fontSize: '0.82rem', color: '#8B97A8', marginBottom: '1rem' }}>
                  Clases 13 (cuentas relacionadas), 14 (personal), 16 (anticipos), 17 (entregas), 18 (otros activos)
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-s10" style={{ fontSize: '0.8rem' }}>
                    <thead><tr><th>Cuenta</th><th style={{ minWidth: 180 }}>Descripción Cuenta</th><th style={{ minWidth: 160 }}>Tercero</th><th>0–30 días</th><th>31–60</th><th>61–90</th><th>+90 días</th><th>Total</th></tr></thead>
                    <tbody>
                      {otrasCxCData.rows.map((r: any, i: number) => (
                        <tr key={i} style={{ cursor: 'pointer' }}
                          onClick={() => setAccountTxDrill({
                            codCuenta: r.CodCuenta,
                            descripcion: `${r.DesCuenta || ''}${r.Tercero ? ' · ' + r.Tercero : ''}`,
                            endpoint: 'otras-cxc-transactions',
                            codTercero: r.CodTercero ? String(r.CodTercero) : undefined,
                          })}
                          title="Ver asientos">
                          <td style={{ fontFamily: 'monospace', color: '#2BB4BB' }}>{r.CodCuenta} <span style={{ fontSize: '0.65rem' }}>▶</span></td>
                          <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.DesCuenta}>{r.DesCuenta || '—'}</td>
                          <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.Tercero}>{r.Tercero || '—'}</td>
                          <td style={{ color: '#10B981' }}>{fmt(r.Dias_0_30)}</td>
                          <td style={{ color: '#F59E0B' }}>{fmt(r.Dias_31_60)}</td>
                          <td style={{ color: '#F97316' }}>{fmt(r.Dias_61_90)}</td>
                          <td style={{ color: '#EF4444' }}>{fmt(r.Dias_90_mas)}</td>
                          <td style={{ fontWeight: 600 }}>{fmt(r.SaldoTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="total-row"><td colSpan={7}>TOTAL</td>
                      <td>{fmt(otrasCxCData.rows.reduce((s: number, r: any) => s + (r.SaldoTotal || 0), 0))}</td>
                    </tr></tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ Otras CxP ═══ */}
        {activeTab === 'otras_cxp' && !newTabLoading && (
          <div className="kpi-card">
            {!otrasCxPData?.rows?.length ? <NoDataBanner kpi="Otras CxP" /> : (
              <>
                <div style={{ fontSize: '0.82rem', color: '#8B97A8', marginBottom: '1rem' }}>
                  Clases 43 (comerciales relacionadas), 44 (personal), 45 (tributos), 46 (obligaciones financieras), 47 (beneficios)
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-s10" style={{ fontSize: '0.8rem' }}>
                    <thead><tr><th>Cuenta</th><th style={{ minWidth: 180 }}>Descripción Cuenta</th><th style={{ minWidth: 160 }}>Tercero</th><th>0–30 días</th><th>31–60</th><th>61–90</th><th>+90 días</th><th>Total</th></tr></thead>
                    <tbody>
                      {otrasCxPData.rows.map((r: any, i: number) => (
                        <tr key={i} style={{ cursor: 'pointer' }}
                          onClick={() => setAccountTxDrill({
                            codCuenta: r.CodCuenta,
                            descripcion: `${r.DesCuenta || ''}${r.Tercero ? ' · ' + r.Tercero : ''}`,
                            endpoint: 'otras-cxp-transactions',
                            codTercero: r.CodTercero ? String(r.CodTercero) : undefined,
                          })}
                          title="Ver asientos">
                          <td style={{ fontFamily: 'monospace', color: '#2BB4BB' }}>{r.CodCuenta} <span style={{ fontSize: '0.65rem' }}>▶</span></td>
                          <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.DesCuenta}>{r.DesCuenta || '—'}</td>
                          <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.Tercero}>{r.Tercero || '—'}</td>
                          <td style={{ color: '#10B981' }}>{fmt(r.Dias_0_30)}</td>
                          <td style={{ color: '#F59E0B' }}>{fmt(r.Dias_31_60)}</td>
                          <td style={{ color: '#F97316' }}>{fmt(r.Dias_61_90)}</td>
                          <td style={{ color: '#EF4444' }}>{fmt(r.Dias_90_mas)}</td>
                          <td style={{ fontWeight: 600 }}>{fmt(r.SaldoTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="total-row"><td colSpan={7}>TOTAL</td>
                      <td>{fmt(otrasCxPData.rows.reduce((s: number, r: any) => s + (r.SaldoTotal || 0), 0))}</td>
                    </tr></tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ Préstamos ═══ */}
        {activeTab === 'prestamos' && !newTabLoading && (
          <>
            <div className="kpi-card" style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC', marginBottom: '0.75rem' }}>Préstamos Otorgados (tipo 071 — Activo)</div>
              {!prestamosData?.otorgados?.rows?.length ? (
                <div style={{ color: '#8B97A8', fontSize: '0.85rem', padding: '1rem 0' }}>Sin préstamos otorgados registrados.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-s10" style={{ fontSize: '0.8rem' }}>
                    <thead><tr><th style={{ width: 32 }}></th><th>N°</th><th style={{ minWidth: 200 }}>Deudor</th><th style={{ minWidth: 200 }}>Observación</th><th>Fecha</th><th>Vcto</th><th>Días Vcdo</th><th>Monto</th><th>Saldo Pendiente</th></tr></thead>
                    <tbody>
                      {prestamosData.otorgados.rows.map((r: any, i: number) => (
                        <tr key={i}>
                          <td style={{ textAlign: 'center', padding: '0 0.25rem' }}>
                            {r.NroD
                              ? <button onClick={e => { e.stopPropagation(); setPrestamosDocPreview(String(r.NroD)); }}
                                  title="Ver documento origen"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2BB4BB', fontSize: '0.9rem', padding: 0, lineHeight: 1 }}>🔗</button>
                              : <span style={{ color: '#4B5563', fontSize: '0.75rem' }}>—</span>
                            }
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#8B97A8' }}>{r.Numero}</td>
                          <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.Beneficiario}>{r.Beneficiario || '—'}</td>
                          <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#8B97A8', fontSize: '0.75rem' }} title={r.Observacion}>{r.Observacion || '—'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{r.FechaDocumento}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{r.FechaVencimiento || '—'}</td>
                          <td style={{ color: (r.DiasVencido || 0) > 90 ? '#EF4444' : (r.DiasVencido || 0) > 30 ? '#F59E0B' : '#10B981' }}>{r.DiasVencido ?? '—'}</td>
                          <td>{fmt(r.Monto)}</td>
                          <td style={{ fontWeight: 600, color: r.SaldoPendiente > 0 ? '#F59E0B' : '#10B981' }}>{fmt(r.SaldoPendiente)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="total-row"><td colSpan={8}>TOTAL PENDIENTE</td>
                      <td>{fmt(prestamosData.otorgados.total)}</td>
                    </tr></tfoot>
                  </table>
                </div>
              )}
            </div>
            <div className="kpi-card">
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC', marginBottom: '0.75rem' }}>Préstamos Recibidos (tipo 071 — Pasivo)</div>
              {!prestamosData?.recibidos?.rows?.length ? (
                <div style={{ color: '#8B97A8', fontSize: '0.85rem', padding: '1rem 0' }}>Sin préstamos recibidos registrados.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-s10" style={{ fontSize: '0.8rem' }}>
                    <thead><tr><th style={{ width: 32 }}></th><th>N°</th><th style={{ minWidth: 200 }}>Prestamista</th><th style={{ minWidth: 200 }}>Observación</th><th>Fecha</th><th>Vcto</th><th>Monto</th><th>Saldo Pendiente</th></tr></thead>
                    <tbody>
                      {prestamosData.recibidos.rows.map((r: any, i: number) => (
                        <tr key={i}>
                          <td style={{ textAlign: 'center', padding: '0 0.25rem' }}>
                            {r.NroD
                              ? <button onClick={e => { e.stopPropagation(); setPrestamosDocPreview(String(r.NroD)); }}
                                  title="Ver documento origen"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2BB4BB', fontSize: '0.9rem', padding: 0, lineHeight: 1 }}>🔗</button>
                              : <span style={{ color: '#4B5563', fontSize: '0.75rem' }}>—</span>
                            }
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#8B97A8' }}>{r.Numero}</td>
                          <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.Prestamista}>{r.Prestamista || '—'}</td>
                          <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#8B97A8', fontSize: '0.75rem' }} title={r.Observacion}>{r.Observacion || '—'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{r.FechaDocumento}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{r.FechaVencimiento || '—'}</td>
                          <td>{fmt(r.Monto)}</td>
                          <td style={{ fontWeight: 600, color: r.SaldoPendiente > 0 ? '#EF4444' : '#10B981' }}>{fmt(r.SaldoPendiente)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="total-row"><td colSpan={7}>TOTAL PENDIENTE</td>
                      <td>{fmt(prestamosData.recibidos.total)}</td>
                    </tr></tfoot>
                  </table>
                </div>
              )}
            </div>
            {prestamosDocPreview && <DocPreview companyId={selectedCompany.codEmpresa} nroD={prestamosDocPreview} onClose={() => setPrestamosDocPreview(null)} />}
          </>
        )}

        {/* ═══ Tributos ═══ */}
        {activeTab === 'tributos' && !newTabLoading && (
          <div className="kpi-card">
            {!tributosData?.rows?.length ? <NoDataBanner kpi="Tributos" /> : (
              <>
                <div style={{ fontSize: '0.82rem', color: '#8B97A8', marginBottom: '1rem' }}>
                  Clase 40 — IGV, Renta, ONP, EsSalud, AFP, etc. Saldo acreedor = por pagar.
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-s10" style={{ fontSize: '0.8rem' }}>
                    <thead><tr><th>Cuenta</th><th>Descripción</th><th>Provisionado {selectedYear}</th><th>Pagado {selectedYear}</th><th>Saldo Año</th><th>Saldo Histórico</th><th>Último Mov.</th></tr></thead>
                    <tbody>
                      {tributosData.rows.map((r: any, i: number) => (
                        <tr key={i} style={{ cursor: 'pointer' }} onClick={() => setAccountTxDrill({ codCuenta: r.CodCuenta, descripcion: r.DesTributo, endpoint: 'tributos-transactions' })} title="Ver asientos">
                          <td style={{ fontFamily: 'monospace', color: '#2BB4BB' }}>{r.CodCuenta} <span style={{ fontSize: '0.65rem' }}>▶</span></td>
                          <td>{r.DesTributo}</td>
                          <td>{fmt(r.ProvisionadoAnio)}</td>
                          <td style={{ color: '#10B981' }}>{fmt(r.PagadoAnio)}</td>
                          <td style={{ color: (r.SaldoAnio || 0) > 0 ? '#F59E0B' : '#10B981' }}>{fmt(r.SaldoAnio)}</td>
                          <td style={{ fontWeight: 600, color: (r.SaldoPorPagar || 0) > 0 ? '#F59E0B' : '#10B981' }}>{fmt(r.SaldoPorPagar)}</td>
                          <td style={{ color: '#8B97A8', fontSize: '0.72rem' }}>{r.UltimoMovimiento ? String(r.UltimoMovimiento).slice(0, 10) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="total-row">
                      <td colSpan={2}>TOTAL</td>
                      <td>{fmt(tributosData.rows.reduce((s: number, r: any) => s + (r.ProvisionadoAnio || 0), 0))}</td>
                      <td>{fmt(tributosData.rows.reduce((s: number, r: any) => s + (r.PagadoAnio || 0), 0))}</td>
                      <td>{fmt(tributosData.rows.reduce((s: number, r: any) => s + (r.SaldoAnio || 0), 0))}</td>
                      <td>{fmt(tributosData.rows.reduce((s: number, r: any) => s + (r.SaldoPorPagar || 0), 0))}</td>
                      <td></td>
                    </tr></tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ Laboral ═══ */}
        {activeTab === 'laboral' && !newTabLoading && (
          <div className="kpi-card">
            {!laboralData?.rows?.length ? <NoDataBanner kpi="Laboral" /> : (
              <>
                <div style={{ fontSize: '0.82rem', color: '#8B97A8', marginBottom: '1rem' }}>
                  Clase 41 — Remuneraciones por pagar, CTS, gratificaciones, participaciones.
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-s10" style={{ fontSize: '0.8rem' }}>
                    <thead><tr><th>Cuenta</th><th>Descripción</th><th>Provisionado</th><th>Pagado</th><th>Saldo por Pagar</th><th>Último Mov.</th></tr></thead>
                    <tbody>
                      {laboralData.rows.map((r: any, i: number) => (
                        <tr key={i} style={{ cursor: 'pointer' }} onClick={() => setAccountTxDrill({ codCuenta: r.CodCuenta, descripcion: r.DesConcepto, endpoint: 'laboral-transactions' })} title="Ver asientos">
                          <td style={{ fontFamily: 'monospace', color: '#2BB4BB' }}>{r.CodCuenta} <span style={{ fontSize: '0.65rem' }}>▶</span></td>
                          <td>{r.DesConcepto}</td>
                          <td style={{ color: '#8B97A8' }}>{fmt(r.TotalProvisionado)}</td>
                          <td style={{ color: '#10B981' }}>{fmt(r.TotalPagado)}</td>
                          <td style={{ fontWeight: 600, color: (r.SaldoPorPagar || 0) > 0 ? '#F59E0B' : '#10B981' }}>{fmt(r.SaldoPorPagar)}</td>
                          <td style={{ color: '#8B97A8', fontSize: '0.72rem' }}>{r.UltimoMovimiento ? String(r.UltimoMovimiento).slice(0, 10) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="total-row">
                      <td colSpan={2}>TOTAL</td>
                      <td>{fmt(laboralData.rows.reduce((s: number, r: any) => s + (r.TotalProvisionado || 0), 0))}</td>
                      <td>{fmt(laboralData.rows.reduce((s: number, r: any) => s + (r.TotalPagado || 0), 0))}</td>
                      <td>{fmt(laboralData.rows.reduce((s: number, r: any) => s + (r.SaldoPorPagar || 0), 0))}</td>
                      <td></td>
                    </tr></tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ Activo Fijo ═══ */}
        {activeTab === 'activo_fijo' && !newTabLoading && (
          <div className="kpi-card">
            {!activoFijoData?.rows?.length ? <NoDataBanner kpi="Activo Fijo" /> : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                  <KpiCard label="Valor Bruto" value={fmt(activoFijoData.totalBruto)} signal="neutral" />
                  <KpiCard label="Depreciación Acum." value={fmt(activoFijoData.totalDeprec)} signal="neutral" />
                  <KpiCard label="Valor Neto" value={fmt(activoFijoData.totalNeto)} signal={activoFijoData.totalNeto > 0 ? 'green' : 'neutral'} />
                </div>
                {/* Formato nuevo (post-fix mayo 2026): rows separados por Clase */}
                {activoFijoData.activos ? (
                  <>
                    <div style={{ fontSize: '0.82rem', color: '#8B97A8', marginBottom: '0.75rem' }}>
                      Activo Fijo (clase 33) + Depreciación Acumulada (clase 39) según S10
                    </div>
                    <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#F8FAFC', marginBottom: '0.5rem' }}>
                        Valor Bruto del Activo Fijo (clase 33)
                      </div>
                      <table className="table-s10" style={{ fontSize: '0.8rem' }}>
                        <thead><tr><th>Cuenta</th><th>Descripción</th><th title="Total histórico acumulado — no filtrado por año"># Asientos (hist.)</th><th>Db Acum</th><th>Cr Acum</th><th>Saldo Bruto</th></tr></thead>
                        <tbody>
                          {activoFijoData.activos.map((r: any, i: number) => (
                            <tr key={i} style={{ cursor: 'pointer' }} onClick={() => setAccountTxDrill({ codCuenta: r.CodCuenta, descripcion: r.DesActivo, endpoint: 'activo-fijo-transactions' })} title="Ver asientos del año seleccionado">
                              <td style={{ fontFamily: 'monospace', color: '#2BB4BB' }}>{r.CodCuenta} <span style={{ fontSize: '0.65rem' }}>▶</span></td>
                              <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.DesActivo}</td>
                              <td style={{ color: '#8B97A8', textAlign: 'center' }}>{r.NumAsientos}</td>
                              <td style={{ color: '#8B97A8' }}>{fmt(r.TotalDebito)}</td>
                              <td style={{ color: '#8B97A8' }}>{fmt(r.TotalCredito)}</td>
                              <td style={{ fontWeight: 600, color: (r.Saldo || 0) >= 0 ? '#10B981' : '#EF4444' }}>{fmt(r.Saldo)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot><tr className="total-row"><td colSpan={5}>TOTAL BRUTO</td><td>{fmt(activoFijoData.totalBruto)}</td></tr></tfoot>
                      </table>
                    </div>
                    {activoFijoData.depreciaciones?.length > 0 && (
                      <div style={{ overflowX: 'auto' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#F8FAFC', marginBottom: '0.5rem' }}>
                          Depreciación Acumulada (clase 39)
                        </div>
                        <table className="table-s10" style={{ fontSize: '0.8rem' }}>
                          <thead><tr><th>Cuenta</th><th>Descripción</th><th title="Total histórico acumulado — no filtrado por año"># Asientos (hist.)</th><th>Db Acum</th><th>Cr Acum</th><th>Saldo Depreciación</th></tr></thead>
                          <tbody>
                            {activoFijoData.depreciaciones.map((r: any, i: number) => (
                              <tr key={i} style={{ cursor: 'pointer' }} onClick={() => setAccountTxDrill({ codCuenta: r.CodCuenta, descripcion: r.DesActivo, endpoint: 'activo-fijo-transactions' })} title="Ver asientos">
                                <td style={{ fontFamily: 'monospace', color: '#F59E0B' }}>{r.CodCuenta} <span style={{ fontSize: '0.65rem' }}>▶</span></td>
                                <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.DesActivo}</td>
                                <td style={{ color: '#8B97A8', textAlign: 'center' }}>{r.NumAsientos}</td>
                                <td style={{ color: '#8B97A8' }}>{fmt(r.TotalDebito)}</td>
                                <td style={{ color: '#8B97A8' }}>{fmt(r.TotalCredito)}</td>
                                <td style={{ fontWeight: 600, color: (r.Saldo || 0) >= 0 ? '#F59E0B' : '#EF4444' }} title={r.Saldo < 0 ? 'Saldo INVERSO — depreciación con Db>Cr (error contable)' : ''}>
                                  {fmt(r.Saldo)} {r.Saldo < 0 && '⚠️'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot><tr className="total-row"><td colSpan={5}>TOTAL DEPRECIACIÓN</td><td>{fmt(activoFijoData.totalDeprec)}</td></tr></tfoot>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  /* Formato antiguo - backwards compat */
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table-s10" style={{ fontSize: '0.8rem' }}>
                      <thead><tr><th>Cuenta</th><th>Descripción</th><th>Valor Bruto</th><th>Depreciación</th><th>Valor Neto</th><th>% Depreciado</th></tr></thead>
                      <tbody>
                        {activoFijoData.rows.map((r: any, i: number) => {
                          const pctDep = r.ValorBruto > 0 ? ((r.DepreciacionAcum || 0) / r.ValorBruto * 100) : 0;
                          return (
                            <tr key={i}>
                              <td style={{ fontFamily: 'monospace', color: '#2BB4BB' }}>{r.CodCuenta}</td>
                              <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.DesActivo}</td>
                              <td>{fmt(r.ValorBruto)}</td>
                              <td style={{ color: '#F59E0B' }}>{fmt(r.DepreciacionAcum)}</td>
                              <td style={{ fontWeight: 600, color: r.ValorNeto > 0 ? '#10B981' : '#8B97A8' }}>{fmt(r.ValorNeto)}</td>
                              <td style={{ color: pctDep >= 80 ? '#EF4444' : '#8B97A8' }}>{pctDep.toFixed(0)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══ Tesorería ═══ */}
        {activeTab === 'tesoreria' && !newTabLoading && (
          <div className="kpi-card">
            {!tesoreriaData?.bancos?.length ? <NoDataBanner kpi="Tesorería" /> : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                  <KpiCard label="Saldo Inicial" value={fmt(tesoreriaData.totalSaldoInicial)} signal="neutral" />
                  <KpiCard label={`Entradas ${selectedYear}`} value={fmt(tesoreriaData.totalEntradasAnio)} signal="green" />
                  <KpiCard label={`Salidas ${selectedYear}`} value={fmt(tesoreriaData.totalSalidasAnio)} signal="neutral" />
                  <KpiCard label="Saldo Final" value={fmt(tesoreriaData.totalSaldoFinal)} signal={tesoreriaData.totalSaldoFinal >= 0 ? 'green' : 'red'} />
                </div>
                <div style={{ fontSize: '0.82rem', color: '#8B97A8', marginBottom: '1rem' }}>
                  Clase 10 — Posición bancaria {selectedYear}: saldo antes del año, entradas/salidas del período y saldo neto acumulado.
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-s10" style={{ fontSize: '0.8rem' }}>
                    <thead><tr><th>Cuenta</th><th style={{ minWidth: 240 }}>Banco</th><th>Saldo Inicial</th><th>Entradas {selectedYear}</th><th>Salidas {selectedYear}</th><th>Saldo Final</th><th>Movim.</th><th>Sin Doc.</th></tr></thead>
                    <tbody>
                      {tesoreriaData.bancos.map((r: any, i: number) => (
                        <tr key={i} style={{ cursor: 'pointer' }} onClick={() => setCajaTxDrill({ codBanco: r.CodBanco, desBanco: r.DesBanco })} title="Ver movimientos bancarios">
                          <td style={{ fontFamily: 'monospace', color: '#2BB4BB' }}>{r.CodBanco} <span style={{ fontSize: '0.65rem' }}>▶</span></td>
                          <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.DesBanco}</td>
                          <td style={{ color: '#8B97A8' }}>{fmt(r.SaldoInicial)}</td>
                          <td style={{ color: '#10B981' }}>{fmt(r.EntradasAnio)}</td>
                          <td style={{ color: '#EF4444' }}>{fmt(r.SalidasAnio)}</td>
                          <td style={{ fontWeight: 600, color: (r.SaldoFinal || 0) >= 0 ? '#10B981' : '#EF4444' }}>{fmt(r.SaldoFinal)}</td>
                          <td style={{ color: '#8B97A8' }}>{r.MovimientosAnio || 0}</td>
                          <td style={{ color: (r.SinDocumentoAnio || 0) > 0 ? '#F59E0B' : '#8B97A8' }}>{r.SinDocumentoAnio || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="total-row">
                      <td colSpan={2}>TOTAL</td>
                      <td>{fmt(tesoreriaData.totalSaldoInicial)}</td>
                      <td>{fmt(tesoreriaData.totalEntradasAnio)}</td>
                      <td>{fmt(tesoreriaData.totalSalidasAnio)}</td>
                      <td>{fmt(tesoreriaData.totalSaldoFinal)}</td>
                      <td colSpan={2}></td>
                    </tr></tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ Patrimonio ═══ */}
        {activeTab === 'patrimonio' && !newTabLoading && (
          <div className="kpi-card">
            {!patrimonioData?.rows?.length ? <NoDataBanner kpi="Patrimonio" /> : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.82rem', color: '#8B97A8' }}>
                    Clases 50–59: capital social, reservas, resultados acumulados y del ejercicio.
                  </div>
                  <KpiCard label="Patrimonio Neto" value={fmt(patrimonioData.totalPatrimonio)} signal={patrimonioData.totalPatrimonio >= 0 ? 'green' : 'red'} />
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-s10" style={{ fontSize: '0.8rem' }}>
                    <thead><tr><th>Clase</th><th>Cuenta</th><th style={{ minWidth: 260 }}>Descripción</th><th>Total Débito</th><th>Total Crédito</th><th>Saldo Neto</th><th style={{ textAlign: 'center' }}>Asientos</th></tr></thead>
                    <tbody>
                      {patrimonioData.rows.map((r: any, i: number) => (
                        <tr key={i}>
                          <td style={{ fontFamily: 'monospace', color: '#8B97A8' }}>{r.Clase}</td>
                          <td style={{ fontFamily: 'monospace', color: '#2BB4BB' }}>{r.CodCuenta}</td>
                          <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.DesCuenta}</td>
                          <td style={{ color: '#8B97A8' }}>{fmt(r.TotalDebito)}</td>
                          <td style={{ color: '#8B97A8' }}>{fmt(r.TotalCredito)}</td>
                          <td style={{ fontWeight: 600, color: (r.SaldoNeto || 0) >= 0 ? '#10B981' : '#EF4444' }}>{fmt(r.SaldoNeto)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button onClick={() => setAccountTxDrill({ codCuenta: String(r.CodCuenta), descripcion: r.DesCuenta || r.CodCuenta, endpoint: 'patrimonio-transactions' })}
                              title="Ver asientos individuales"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2BB4BB', fontSize: '0.78rem', padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                              ▶
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="total-row">
                      <td colSpan={6}>PATRIMONIO NETO TOTAL</td>
                      <td>{fmt(patrimonioData.totalPatrimonio)}</td>
                    </tr></tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ Inventarios ═══ */}
        {activeTab === 'inventarios' && !newTabLoading && (
          <div className="kpi-card">
            {!inventariosData?.rows?.length ? <NoDataBanner kpi="Inventarios" /> : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.82rem', color: '#8B97A8' }}>
                    Clases 20–29: mercaderías, materias primas, suministros, existencias por recibir.
                  </div>
                  <KpiCard label="Saldo Inventarios" value={fmt(inventariosData.totalSaldo)} signal={inventariosData.totalSaldo > 0 ? 'green' : 'neutral'} />
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-s10" style={{ fontSize: '0.8rem' }}>
                    <thead><tr><th>Clase</th><th>Cuenta</th><th style={{ minWidth: 240 }}>Descripción</th><th>Saldo Histórico</th><th>Ingreso {selectedYear}</th><th>Salida {selectedYear}</th><th>Último Mov.</th></tr></thead>
                    <tbody>
                      {inventariosData.rows.map((r: any, i: number) => (
                        <tr key={i}>
                          <td style={{ fontFamily: 'monospace', color: '#8B97A8' }}>{r.Clase}</td>
                          <td style={{ fontFamily: 'monospace', color: '#2BB4BB' }}>{r.CodCuenta}</td>
                          <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.DesCuenta}</td>
                          <td style={{ fontWeight: 600 }}>{fmt(r.SaldoHistorico)}</td>
                          <td style={{ color: '#10B981' }}>{fmt(r.IngresoAnio)}</td>
                          <td style={{ color: '#EF4444' }}>{fmt(r.SalidaAnio)}</td>
                          <td style={{ color: '#8B97A8', fontSize: '0.72rem' }}>{r.UltimoMovimiento ? String(r.UltimoMovimiento).slice(0, 10) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="total-row">
                      <td colSpan={3}>TOTAL</td>
                      <td>{fmt(inventariosData.totalSaldo)}</td>
                      <td>{fmt(inventariosData.rows.reduce((s: number, r: any) => s + (r.IngresoAnio || 0), 0))}</td>
                      <td>{fmt(inventariosData.rows.reduce((s: number, r: any) => s + (r.SalidaAnio || 0), 0))}</td>
                      <td></td>
                    </tr></tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ Gastos por Naturaleza ═══ */}
        {activeTab === 'gastos_nat' && !newTabLoading && (
          <div className="kpi-card">
            {!gastosNatData?.rows?.length ? <NoDataBanner kpi="Gastos por Naturaleza" /> : (
              <>
                <div style={{ fontSize: '0.82rem', color: '#8B97A8', marginBottom: '1rem' }}>
                  Clases 60–68: compras, personal, servicios, tributos, provisiones, etc.
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-s10" style={{ fontSize: '0.78rem' }}>
                    <thead>
                      <tr>
                        <th>Grupo</th><th style={{ minWidth: 200 }}>Descripción</th>
                        {MESES.map(m => <th key={m}>{m}</th>)}
                        <th>YTD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const byGrupo: Record<string, { grupo: string; desc: string; meses: Record<number, number>; ytd: number }> = {};
                        for (const r of gastosNatData.rows) {
                          const k = r.GrupoCuenta || String(r.CodCuenta).slice(0, 4);
                          if (!byGrupo[k]) byGrupo[k] = { grupo: k, desc: r.DesCuenta || '', meses: {}, ytd: 0 };
                          byGrupo[k].meses[r.Mes] = (byGrupo[k].meses[r.Mes] || 0) + (r.Monto || 0);
                          byGrupo[k].ytd += r.Monto || 0;
                        }
                        return Object.values(byGrupo).sort((a, b) => b.ytd - a.ytd).map((g, i) => (
                          <tr key={i} style={{ cursor: 'pointer' }} onClick={() => setAccountTxDrill({ codCuenta: g.grupo, descripcion: g.desc, endpoint: 'gastos-nat-transactions' })} title="Ver asientos">
                            <td style={{ fontFamily: 'monospace', color: '#2BB4BB' }}>{g.grupo} <span style={{ fontSize: '0.65rem' }}>▶</span></td>
                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.desc}</td>
                            {Array.from({ length: 12 }, (_, m) => (
                              <td key={m + 1} style={{ color: '#8B97A8' }}>{g.meses[m + 1] ? fmt(g.meses[m + 1]) : '—'}</td>
                            ))}
                            <td style={{ fontWeight: 600 }}>{fmt(g.ytd)}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ Saldos Bancarios Acumulados ═══ */}
        {activeTab === 'caja_saldos' && !newTabLoading && (
          <div className="kpi-card">
            {!cajaSaldosData?.rows?.length ? <NoDataBanner kpi="Saldos Bancarios" /> : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.82rem', color: '#8B97A8' }}>Clase 10 — Saldo acumulado total (sin filtro de año)</div>
                  <KpiCard label="Total Caja" value={fmt(cajaSaldosData.totalSaldo)} signal={cajaSaldosData.totalSaldo >= 0 ? 'green' : 'red'} />
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-s10" style={{ fontSize: '0.8rem' }}>
                    <thead><tr><th>Cuenta</th><th style={{ minWidth: 260 }}>Banco / Descripción</th><th>Saldo</th><th>Sin Doc.</th></tr></thead>
                    <tbody>
                      {cajaSaldosData.rows.map((r: any, i: number) => (
                        <tr key={i}>
                          <td style={{ fontFamily: 'monospace', color: '#2BB4BB' }}>{r.CodBanco}</td>
                          <td>{r.DesBanco}</td>
                          <td style={{ fontWeight: 600, color: (r.SaldoActual || 0) >= 0 ? '#10B981' : '#EF4444' }}>{fmt(r.SaldoActual)}</td>
                          <td style={{ color: (r.SinDocumento || 0) > 0 ? '#F59E0B' : '#8B97A8' }}>{r.SinDocumento || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="total-row"><td colSpan={2}>TOTAL</td><td>{fmt(cajaSaldosData.totalSaldo)}</td><td /></tr></tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ Conciliación Bancaria ═══ */}
        {activeTab === 'conciliacion' && !newTabLoading && (
          <>
            {/* Resumen ejecutivo */}
            <div className="kpi-card" style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC', marginBottom: '0.75rem' }}>
                Estado del módulo OB_EstadoBanco — Conciliación Bancaria
              </div>
              <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginBottom: '1rem' }}>
                Cuántas cuentas bancarias tienen estados de cuenta cargados al sistema vs cuántas no.
                Si una cuenta NO tiene estados cargados, NO se está conciliando contablemente con el banco real.
              </div>
              {!conciliacionData ? <div style={{ color: '#8B97A8' }}>Sin datos disponibles.</div> : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                    <KpiCard label="Cuentas Bancarias" value={String(conciliacionData.totalCuentas || 0)} signal="neutral" />
                    <KpiCard label="Con Estados Cargados" value={String(conciliacionData.cuentasConEstados || 0)} signal={conciliacionData.cuentasConEstados > 0 ? 'green' : 'red'} />
                    <KpiCard label="Sin Conciliación" value={String(conciliacionData.cuentasSinEstados || 0)} signal={conciliacionData.cuentasSinEstados > 0 ? 'red' : 'green'} />
                    <KpiCard label="Movs Sin Conciliar" value={String(conciliacionData.totalMovsSinConc || 0)} signal={conciliacionData.totalMovsSinConc > 0 ? 'yellow' : 'green'} />
                  </div>
                  {!conciliacionData.usaModulo && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '0.75rem', borderRadius: '0.5rem', color: '#EF4444', fontSize: '0.85rem' }}>
                      🚨 <strong>ALERTA:</strong> Esta empresa NO usa el módulo de conciliación bancaria.
                      NINGUNA cuenta tiene estados de cuenta cargados al sistema. Riesgo de control interno crítico.
                    </div>
                  )}
                  {conciliacionData.maxDiasAtraso > 90 && (
                    <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', padding: '0.75rem', borderRadius: '0.5rem', color: '#F59E0B', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                      ⚠️ La conciliación más reciente tiene {conciliacionData.maxDiasAtraso} días de atraso. Política: conciliación mensual obligatoria.
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Detalle por cuenta */}
            <div className="kpi-card" style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC', marginBottom: '0.75rem' }}>
                Detalle por cuenta bancaria
              </div>
              {!conciliacionData?.rows?.length ? <div style={{ color: '#8B97A8' }}>Sin cuentas bancarias en OB_CuentaBanco. La empresa NO usa el módulo de tesorería de S10.</div> : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-s10" style={{ fontSize: '0.78rem' }}>
                    <thead>
                      <tr>
                        <th style={{ minWidth: 200 }}>Cuenta</th>
                        <th>Mon</th>
                        <th>Saldo Contable</th>
                        <th>Saldo Banco</th>
                        <th>Último Estado</th>
                        <th>Días Atraso</th>
                        <th>SF Banco</th>
                        <th>Estados Hist.</th>
                        <th>Movs Últ.</th>
                        <th>Sin Conc.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conciliacionData.rows.map((r: any, i: number) => {
                        const dias = r.DiasDesdeUltimoEstado;
                        const sinEstado = !r.TotalEstadosHistoricos;
                        return (
                          <tr key={i}>
                            <td title={r.NoCuenta}>{r.DesCuenta || '—'}</td>
                            <td style={{ color: '#8B97A8' }}>{r.Moneda}</td>
                            <td style={{ fontWeight: 600, color: (r.BalanceContable || 0) >= 0 ? '#10B981' : '#EF4444' }}>{fmt(r.BalanceContable)}</td>
                            <td style={{ color: '#8B97A8' }}>{fmt(r.BalanceReal)}</td>
                            <td style={{ color: sinEstado ? '#EF4444' : '#8B97A8' }}>{r.UltimoEstadoAl || '🚨 NUNCA'}</td>
                            <td style={{ fontWeight: 600, color: sinEstado ? '#EF4444' : dias > 365 ? '#EF4444' : dias > 90 ? '#F59E0B' : '#10B981' }}>
                              {sinEstado ? '∞' : `${dias}d`}
                            </td>
                            <td>{fmt(r.UltimoSaldoFinalBanco)}</td>
                            <td style={{ color: '#8B97A8', textAlign: 'center' }}>{r.TotalEstadosHistoricos || 0}</td>
                            <td style={{ color: '#8B97A8', textAlign: 'center' }}>{r.NumMovimientos || 0}</td>
                            <td style={{ color: (r.NumSinConciliar || 0) > 0 ? '#F59E0B' : '#10B981', textAlign: 'center' }}>{r.NumSinConciliar || 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Movimientos sin conciliar */}
            {conciliacionData?.movsSinConciliar?.length > 0 && (
              <div className="kpi-card">
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC', marginBottom: '0.75rem' }}>
                  ⚠️ Movimientos bancarios SIN CONCILIAR (top 100 más recientes)
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-s10" style={{ fontSize: '0.75rem' }}>
                    <thead><tr><th>Fecha</th><th>Cuenta</th><th>Mon</th><th style={{ minWidth: 250 }}>Descripción</th><th>Operación</th><th>Cargo</th><th>Abono</th></tr></thead>
                    <tbody>
                      {conciliacionData.movsSinConciliar.map((m: any, i: number) => (
                        <tr key={i}>
                          <td style={{ whiteSpace: 'nowrap' }}>{m.Fecha}</td>
                          <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.DesCuenta}>{m.DesCuenta}</td>
                          <td style={{ color: '#8B97A8' }}>{m.Moneda}</td>
                          <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.DescMovimiento}>{m.DescMovimiento || '—'}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#8B97A8' }}>{m.NumOperacion}</td>
                          <td style={{ color: (m.Cargo || 0) > 0 ? '#EF4444' : '#8B97A8' }}>{m.Cargo > 0 ? fmt(m.Cargo) : '—'}</td>
                          <td style={{ color: (m.Abono || 0) > 0 ? '#10B981' : '#8B97A8' }}>{m.Abono > 0 ? fmt(m.Abono) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ Módulo Auditoría ═══ */}
        {activeTab === 'audit' && !newTabLoading && (
          <>
            {/* Sin documento */}
            <div className="kpi-card" style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC', marginBottom: '0.75rem' }}>
                🔴 Asientos sin documento fuente (NroD = NULL) · {selectedYear}
              </div>
              {!auditData?.sinDoc?.resumen?.length ? (
                <div style={{ color: '#10B981', fontSize: '0.85rem' }}>✓ Sin hallazgos en este período.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-s10" style={{ fontSize: '0.8rem' }}>
                    <thead><tr><th>Clase</th><th style={{ minWidth: 160 }}>Descripción</th><th>Sin Doc</th><th>Total</th><th>% Sin Doc</th><th>Monto Sin Doc</th></tr></thead>
                    <tbody>
                      {auditData.sinDoc.resumen.map((r: any, i: number) => {
                        const pctSD = r.TotalAsientos > 0 ? (r.SinDocumento / r.TotalAsientos * 100) : 0;
                        return (
                          <tr key={i} style={{ cursor: r.SinDocumento > 0 ? 'pointer' : 'default' }}
                            onClick={r.SinDocumento > 0 ? () => setAuditSinDocDrill({ clase: r.Clase, desClase: CLASE_NAMES[r.Clase] || `Clase ${r.Clase}` }) : undefined}
                            title={r.SinDocumento > 0 ? 'Ver asientos sin documento' : undefined}>
                            <td style={{ fontFamily: 'monospace', color: '#2BB4BB' }}>{r.Clase}{r.SinDocumento > 0 && <span style={{ fontSize: '0.65rem', marginLeft: '0.3rem' }}>▶</span>}</td>
                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={CLASE_NAMES[r.Clase] || r.DescClase}>{CLASE_NAMES[r.Clase] || r.DescClase || '—'}</td>
                            <td style={{ color: r.SinDocumento > 0 ? '#F59E0B' : '#10B981' }}>{r.SinDocumento}</td>
                            <td style={{ color: '#8B97A8' }}>{r.TotalAsientos}</td>
                            <td style={{ color: pctSD > 20 ? '#EF4444' : pctSD > 5 ? '#F59E0B' : '#10B981' }}>{pctSD.toFixed(1)}%</td>
                            <td style={{ fontWeight: 600 }}>{fmt(r.MontoSinDoc)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot><tr className="total-row">
                      <td colSpan={2}>TOTAL</td>
                      <td>{auditData.sinDoc.resumen.reduce((s: number, r: any) => s + (r.SinDocumento || 0), 0)}</td>
                      <td>{auditData.sinDoc.resumen.reduce((s: number, r: any) => s + (r.TotalAsientos || 0), 0)}</td>
                      <td></td>
                      <td>{fmt(auditData.sinDoc.resumen.reduce((s: number, r: any) => s + (r.MontoSinDoc || 0), 0))}</td>
                    </tr></tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Descuadres */}
            <div className="kpi-card" style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC', marginBottom: '0.75rem' }}>
                ⚠️ Asientos descuadrados (Débito ≠ Crédito) · {selectedYear}
              </div>
              {!auditData?.descuadres?.rows?.length ? (
                <div style={{ color: '#10B981', fontSize: '0.85rem' }}>✓ Todos los asientos están cuadrados. Sin hallazgos.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-s10" style={{ fontSize: '0.8rem' }}>
                    <thead><tr><th>Fecha</th><th>NroD (doc)</th><th>Líneas</th><th style={{ minWidth: 160 }}>Tercero</th><th>Débito</th><th>Crédito</th><th>Descuadre</th><th style={{ minWidth: 180 }}>Glosa</th></tr></thead>
                    <tbody>
                      {auditData.descuadres.rows.map((r: any, i: number) => (
                        <tr key={i}>
                          <td style={{ whiteSpace: 'nowrap' }}>{r.Fecha}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#2BB4BB' }} title={r.NroD}>{r.NroD ? String(r.NroD).slice(0, 8) + '…' : '—'}</td>
                          <td style={{ color: '#8B97A8', textAlign: 'center' }}>{r.Lineas}</td>
                          <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.Tercero}>{r.Tercero || '—'}</td>
                          <td style={{ color: r.TotalDebito > 0 ? '#10B981' : '#8B97A8' }}>{r.TotalDebito > 0 ? fmt(r.TotalDebito) : '—'}</td>
                          <td style={{ color: r.TotalCredito > 0 ? '#EF4444' : '#8B97A8' }}>{r.TotalCredito > 0 ? fmt(r.TotalCredito) : '—'}</td>
                          <td style={{ fontWeight: 700, color: '#EF4444' }}>{fmt(r.Descuadre)}</td>
                          <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.Glosa}>{r.Glosa || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Atípicos */}
            <div className="kpi-card" style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC', marginBottom: '0.75rem' }}>
                🔶 Asientos atípicos (montos &gt; S/100,000) · {selectedYear}
              </div>
              {!auditData?.atipicos?.rows?.length ? (
                <div style={{ color: '#10B981', fontSize: '0.85rem' }}>✓ Sin asientos atípicos en este período.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-s10" style={{ fontSize: '0.8rem' }}>
                    <thead><tr><th>Fecha</th><th>NroD</th><th>Cuenta</th><th style={{ minWidth: 160 }}>Desc. Cuenta</th><th style={{ minWidth: 160 }}>Glosa</th><th>Débito</th><th>Crédito</th><th style={{ minWidth: 140 }}>Tercero</th></tr></thead>
                    <tbody>
                      {auditData.atipicos.rows.map((r: any, i: number) => (
                        <tr key={i}>
                          <td style={{ whiteSpace: 'nowrap' }}>{r.Fecha}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#8B97A8' }} title={r.NroD}>{r.NroD ? String(r.NroD).slice(0, 8) + '…' : '—'}</td>
                          <td style={{ fontFamily: 'monospace', color: '#2BB4BB', fontSize: '0.72rem' }}>{r.CodCuenta}</td>
                          <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.DesCuenta}>{r.DesCuenta || '—'}</td>
                          <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.Glosa}>{r.Glosa || '—'}</td>
                          <td style={{ color: r.Debito > 0 ? '#10B981' : '#8B97A8' }}>{r.Debito > 0 ? fmt(r.Debito) : '—'}</td>
                          <td style={{ color: r.Credito > 0 ? '#EF4444' : '#8B97A8' }}>{r.Credito > 0 ? fmt(r.Credito) : '—'}</td>
                          <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.Tercero || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Conciliación ingresos */}
            <div className="kpi-card">
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC', marginBottom: '0.75rem' }}>
                📊 Conciliación Ingresos vs Documentos Emitidos · {selectedYear}
              </div>
              {!auditData?.conciliacion?.rows?.length ? (
                <div style={{ color: '#8B97A8', fontSize: '0.85rem' }}>Sin datos de conciliación.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-s10" style={{ fontSize: '0.8rem' }}>
                    <thead><tr><th>Mes</th><th>Ingresos Contables</th><th>Facturas Emitidas</th><th>Notas de Crédito</th><th>Neto Docs</th><th>Diferencia</th></tr></thead>
                    <tbody>
                      {auditData.conciliacion.rows.map((r: any, i: number) => {
                        const diff = (r.IngresosContables || 0) - (r.NetoDocumentos || 0);
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 500 }}>{MESES[(r.Mes || 1) - 1]}</td>
                            <td>{fmt(r.IngresosContables)}</td>
                            <td style={{ color: '#10B981' }}>{fmt(r.FacturasEmitidas)}</td>
                            <td style={{ color: '#EF4444' }}>{fmt(r.NotasCredito)}</td>
                            <td>{fmt(r.NetoDocumentos)}</td>
                            <td style={{ fontWeight: 700, color: Math.abs(diff) < 1 ? '#10B981' : Math.abs(diff) < 10000 ? '#F59E0B' : '#EF4444' }}>
                              {Math.abs(diff) < 1 ? '✓' : fmt(diff)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot><tr className="total-row">
                      <td>TOTAL</td>
                      {(['IngresosContables','FacturasEmitidas','NotasCredito','NetoDocumentos'] as const).map(k => (
                        <td key={k}>{fmt(auditData.conciliacion.rows.reduce((s: number, r: any) => s + (r[k] || 0), 0))}</td>
                      ))}
                      <td style={{ color: (() => {
                        const d = auditData.conciliacion.rows.reduce((s: number, r: any) => s + (r.IngresosContables||0) - (r.NetoDocumentos||0), 0);
                        return Math.abs(d) < 1 ? '#10B981' : Math.abs(d) < 50000 ? '#F59E0B' : '#EF4444';
                      })() }}>
                        {fmt(auditData.conciliacion.rows.reduce((s: number, r: any) => s + (r.IngresosContables||0) - (r.NetoDocumentos||0), 0))}
                      </td>
                    </tr></tfoot>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══ Validación Forense S10 ═══ */}
        {activeTab === 'validation_forense' && !newTabLoading && (() => {
          const VALIDATION_INFO: Record<string, { categoria: string; riesgo: string; norma: string; descripcion: string }> = {
            V01_partida_doble:                { categoria: 'Integridad Contable', riesgo: 'CRÍTICO', norma: 'NIIF / Partida Doble',       descripcion: 'Verifica que Σ Débitos = Σ Créditos en el año seleccionado. HALLAZGO solo si hay diferencia real (Descuadre > 0). Si está en OK, el libro cuadra perfectamente para ese año.' },
            V02_apertura:                     { categoria: 'Integridad Contable', riesgo: 'ALTO',    norma: 'NIC 1',                      descripcion: 'Verifica que el asiento de apertura del año (glosa APERTURA/INICIO, enero-febrero) esté balanceado. HALLAZGO solo si Debe ≠ Haber en la apertura. OK significa que el año abrió correctamente.' },
            V03_patrimonio:                   { categoria: 'Patrimonio',          riesgo: 'CRÍTICO', norma: 'Art. 220 LGS / NIC 1',       descripcion: 'Detecta cuentas de patrimonio (clases 50–59) con saldo DEUDOR acumulado (histórico). Las cuentas patrimoniales deben tener saldo acreedor; un saldo deudor indica pérdidas acumuladas, reducción de capital no registrada, o error de clasificación grave.' },
            V04_facturas_sin_asiento_top:     { categoria: 'Ingresos',            riesgo: 'ALTO',    norma: 'NIIF 15 / Bancarización',    descripcion: 'Top 50 facturas de venta emitidas en el año (y año anterior) que no tienen asiento contable. Ingresos no reconocidos = posible evasión tributaria o desconexión entre área comercial y contabilidad.' },
            V04b_facturas_sin_asiento_resumen:{ categoria: 'Ingresos',            riesgo: 'ALTO',    norma: 'NIIF 15',                    descripcion: 'Resumen por año y tipo de todas las facturas emitidas sin asiento contable. Permite ver el patrón histórico completo (no solo el top 50).' },
            V05_ingresos_sin_doc:             { categoria: 'Ingresos',            riesgo: 'ALTO',    norma: 'NIIF 15 / Art. 24-A LIR',    descripcion: 'Asientos de ingresos (clase ingreso) en el año sin NroD (sin documento de respaldo). Riesgo de ingresos ficticios, anticipos no documentados o asientos manuales sin sustento.' },
            V06_sueldos_aging:                { categoria: 'Laboral',             riesgo: 'ALTO',    norma: 'DL 728',                     descripcion: 'Meses donde los sueldos y remuneraciones (cta 4111) permanecen sin pagar (Provisionado > Pagado > S/100). Muestra los últimos 3 años. HALLAZGO = salarios devengados no cancelados. OK = pagos al día.' },
            V07_cts_depositos:                { categoria: 'Laboral',             riesgo: 'ALTO',    norma: 'DL 650',                     descripcion: 'Detecta períodos donde la CTS (cta 4151) tiene saldo por depositar > S/100 (Provisionado > Pagado). DL 650 exige depósito en mayo y noviembre. HALLAZGO = CTS devengada sin depositar.' },
            V08_participaciones:              { categoria: 'Laboral',             riesgo: 'MEDIO',   norma: 'DL 892',                     descripcion: 'Años donde las participaciones de trabajadores (cta 413x) tienen saldo pendiente > S/100 (Provisionado > Distribuido). HALLAZGO = participaciones devengadas sin pago. OK = sin saldo pendiente.' },
            V09_bancos_detalle:               { categoria: 'Caja y Bancos',       riesgo: 'ALTO',    norma: 'NIIF 7',                     descripcion: 'Detecta cuentas bancarias con saldo NEGATIVO (Haber > Debe) en el histórico acumulado — un descubierto bancario contable. En condiciones normales, una cuenta banco siempre debe tener saldo deudor. HALLAZGO solo en saldo negativo.' },
            V10_ob_cuentas_banco:             { categoria: 'Caja y Bancos',       riesgo: 'MEDIO',   norma: 'Control Interno',            descripcion: 'Cuentas bancarias activas en el módulo OB con problemas: diferencia entre BalanceActual y BalanceReal > S/0.5, sin extractos bancarios cargados, o con extracto desactualizado > 60 días. HALLAZGO = cuenta con problema de reconciliación.' },
            V11_bancarizacion:                { categoria: 'Cumplimiento',        riesgo: 'ALTO',    norma: 'Ley 28194',                  descripcion: 'Detecta pagos sobre el umbral (S/3,500 o $1,000) realizados SIN medio de pago bancarizado en el año seleccionado. HALLAZGO solo si existen pagos no bancarizados reales. OK = todos los pagos materiales cumplieron Ley 28194.' },
            V12_pergola_aging:                { categoria: 'Cuentas por Cobrar',  riesgo: 'ALTO',    norma: 'NIIF 9',                     descripcion: 'Documentos por cobrar de cliente PERGOLA (o PÉRGOLA) con saldo pendiente. Bajo NIIF 9, saldos sin movimiento de cobro requieren evaluación de deterioro. HALLAZGO si hay saldo impago.' },
            V13_cxc_concentracion:            { categoria: 'Cuentas por Cobrar',  riesgo: 'MEDIO',   norma: 'NIIF 9',                     descripcion: 'Top 20 clientes con saldo acumulado en cuentas por cobrar (clase 12) > S/1,000. Alta concentración en pocos clientes genera riesgo crediticio. Revisar antigüedad (Vencido90Mas) para priorizar gestión de cobranza.' },
            V14_intercompany:                 { categoria: 'Intercompañía',       riesgo: 'CRÍTICO', norma: 'Art. 32-A LIR / NIC 24',     descripcion: 'Saldos en clases 14/16/17 con contrapartes vinculadas al grupo CMO. Operaciones entre relacionadas requieren precios de transferencia documentados. HALLAZGO = saldo intercompañía > S/100 sin justificación documentada.' },
            V15_activo_fijo:                  { categoria: 'Activo Fijo',         riesgo: 'MEDIO',   norma: 'NIC 16',                     descripcion: 'Detecta activos fijos (clase 33) con saldo ACREEDOR o depreciación acumulada (clase 39/68) con saldo DEUDOR — dirección contraria a la naturaleza contable. HALLAZGO = balance en dirección incorrecta, posible error de registro.' },
            V16_trazabilidad_pago:            { categoria: 'Caja y Bancos',       riesgo: 'ALTO',    norma: 'Control Interno',            descripcion: 'Pagos en el módulo OB sin asignación a una factura en el mismo año. HALLAZGO solo si existen pagos sin asignación (PagosSinAsignacion > 0). OK = todos los pagos están referenciados a documentos.' },
            V17_reconciliacion_ingr:          { categoria: 'Ingresos',            riesgo: 'ALTO',    norma: 'NIIF 15 / NIIF 9',           descripcion: 'Meses del año donde la diferencia entre ingresos contabilizados y montos facturados supera S/100. HALLAZGO solo en meses con brecha real. OK = ingresos contables y facturación cuadran mes a mes.' },
            V18_tributos:                     { categoria: 'Tributario',          riesgo: 'ALTO',    norma: 'Código Tributario',          descripcion: 'Cuentas tributarias (clase 40) con saldo acreedor neto > S/0.5 en el histórico acumulado (tributos devengados sin pagar). La deuda tributaria genera intereses moratorios y puede derivar en cobranza coactiva de SUNAT.' },
            V19_balance_resumen:              { categoria: 'Balance General',     riesgo: 'CRÍTICO', norma: 'NIC 1',                      descripcion: 'Detecta clases contables con saldo en dirección INCORRECTA: activos/gastos (clases 1,2,3,6,9) con saldo acreedor, o pasivos/patrimonio/ingresos (clases 4,5,7) con saldo deudor > S/1,000. HALLAZGO = error estructural en el balance.' },
            V20_fechas_anomalas:              { categoria: 'Calidad de Datos',    riesgo: 'MEDIO',   norma: 'Control Interno',            descripcion: 'Asientos registrados en domingo o con fecha futura en el año seleccionado. Los sábados y domingos no son días hábiles contables. HALLAZGO = movimientos en días no hábiles o con fecha futura (posible manipulación).' },
            V21_identificadores_dup:          { categoria: 'Calidad de Datos',    riesgo: 'BAJO',    norma: 'Control Interno',            descripcion: 'Identificadores (RUC/DNI) que aparecen con más de un nombre en la base de datos. Puede indicar terceros duplicados, cambios de razón social no actualizados, o identidades falsas. Top 20 casos.' },
            V22_conciliacion_estado:          { categoria: 'Caja y Bancos',       riesgo: 'ALTO',    norma: 'Control Interno',            descripcion: 'Cuentas bancarias activas con problemas reales: diferencia BalanceActual vs BalanceReal > S/0.5, movimientos sin conciliar, o extracto desactualizado > 60 días. HALLAZGO solo en cuentas con brecha concreta.' },
            V23_pl_anual:                     { categoria: 'P&L',                 riesgo: 'MEDIO',   norma: 'NIIF 15 / NIC 1',           descripcion: 'Verifica que la empresa tenga ingresos reconocidos en el año. HALLAZGO solo si los ingresos son cero o negativos (posible falta de cierre contable, año en blanco, o empresa inactiva). OK = empresa tiene ingresos registrados.' },
            V24_ob_vs_contable:               { categoria: 'Coherencia Modular',  riesgo: 'ALTO',    norma: 'Control Interno',            descripcion: 'Meses donde el monto de pagos del módulo OB difiere de los créditos contables en clase 10 en más de S/100. HALLAZGO solo en meses con brecha real. OK = módulo OB y mayor contable cuadran.' },
            V25_pcd_criticas:                 { categoria: 'Calidad de Datos',    riesgo: 'MEDIO',   norma: 'PCGR Perú',                  descripcion: 'Cuentas contables críticas (capital, CTS, sueldos, bancos) que están en el Plan de Cuentas pero NUNCA han tenido movimiento para esta empresa. HALLAZGO = cuenta crítica en plan sin uso — posible omisión de provisión o falta de cierre.' },
            V26_asientos_sin_glosa:           { categoria: 'Calidad de Datos',    riesgo: 'ALTO',    norma: 'Control Interno',            descripcion: 'Años donde más del 5% de los asientos contables tienen glosa vacía o genérica ("VARIOS", "ASIENTO", "S/D"). Alta proporción indica falta de trazabilidad: imposible identificar la operación sin el documento físico.' },
            V27_cxp_concentracion:            { categoria: 'Cuentas por Pagar',   riesgo: 'ALTO',    norma: 'NIC 24 / Art. 32-A LIR',     descripcion: 'Top 15 proveedores con saldo acreedor histórico > S/1,000 en clase 42. Alta concentración en pocos proveedores puede indicar partes vinculadas no declaradas o sobrefacturación. Contrasta con V14 (intercompañía).' },
            V28_nc_sospechosas:               { categoria: 'Ingresos',            riesgo: 'MEDIO',   norma: 'NIIF 15 / SUNAT',            descripcion: 'Años donde las notas de crédito representan más del 3% del total facturado. Porcentaje elevado puede indicar anulaciones masivas post-venta, correcciones retroactivas o ajuste de ingresos no autorizado.' },
            V29_fraccionamiento_pagos:        { categoria: 'Cumplimiento',        riesgo: 'ALTO',    norma: 'Ley 28194',                  descripcion: 'Días con 3 o más pagos en efectivo al mismo banco, cada uno individualmente bajo S/3,500, pero cuya suma supera el umbral. HALLAZGO = patrón de fraccionamiento para evadir obligación de bancarización (Ley 28194).' },
            V30_provisiones_sin_reverso:      { categoria: 'Integridad Contable', riesgo: 'MEDIO',   norma: 'NIC 37 / PCGR Perú',         descripcion: 'Provisiones en diciembre (glosa PROVISIÓN/ESTIMACIÓN) en cuentas de pasivo o gasto > S/100 que no tienen reverso en enero siguiente. HALLAZGO = posibles "provisiones fantasma" para inflar gastos y reducir impuesto a la renta.' },
          };
          const RIESGO_STYLE: Record<string, React.CSSProperties> = {
            CRÍTICO: { background: 'rgba(239,68,68,0.15)',   color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' },
            ALTO:    { background: 'rgba(245,158,11,0.15)',  color: '#FBB040', border: '1px solid rgba(245,158,11,0.3)' },
            MEDIO:   { background: 'rgba(234,179,8,0.12)',   color: '#FACC15', border: '1px solid rgba(234,179,8,0.25)' },
            BAJO:    { background: 'rgba(16,185,129,0.12)',  color: '#34D399', border: '1px solid rgba(16,185,129,0.25)' },
          };
          const vfd = validacionForenseData;
          return (
            <>
              {/* Summary cards */}
              {vfd?.summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="kpi-card" style={{ textAlign: 'center' }}>
                    <div className="kpi-label">Validaciones ejecutadas</div>
                    <div className="kpi-value" style={{ fontSize: '2rem', color: '#F8FAFC' }}>{vfd.summary.total}</div>
                  </div>
                  <div className="kpi-card" style={{ textAlign: 'center' }}>
                    <div className="kpi-label">Sin errores SQL</div>
                    <div className="kpi-value" style={{ fontSize: '2rem', color: '#10B981' }}>{vfd.summary.ok}</div>
                  </div>
                  <div className="kpi-card" style={{ textAlign: 'center' }}>
                    <div className="kpi-label">Con error de ejecución</div>
                    <div className="kpi-value" style={{ fontSize: '2rem', color: vfd.summary.errors > 0 ? '#EF4444' : '#10B981' }}>{vfd.summary.errors}</div>
                  </div>
                </div>
              )}

              {/* No data — fetch error OR no snapshot yet */}
              {(!vfd || (vfd?.message && !vfd?.validations)) && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 280, textAlign: 'center', gap: '0.75rem' }}>
                  <div style={{ fontSize: '2rem' }}>🔬</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F8FAFC' }}>Sin datos de Validación Forense</div>
                  <div style={{ fontSize: '0.82rem', color: '#8B97A8', maxWidth: 380 }}>
                    {vfd?.message || 'Los datos forenses no están disponibles para esta empresa/año.'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#8B97A8' }}>
                    Usa el botón <strong style={{ color: '#207E83' }}>Sincronizar Datos</strong> del sidebar para cargar la información desde S10.
                  </div>
                </div>
              )}

              {/* Matrix */}
              {vfd?.validations && (
                <div className="kpi-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="kpi-label">Matriz de Validación Forense</div>
                      <div style={{ color: '#F8FAFC', fontWeight: 700, fontSize: '0.95rem' }}>
                        {isGrupo ? 'GRUPO CONSOLIDADO' : selectedCompany.shortName} · {selectedYear}
                      </div>
                    </div>
                    {vfd.syncedAt && (
                      <span style={{ fontSize: '0.7rem', color: '#8B97A8' }}>
                        Sync: {new Date(vfd.syncedAt).toLocaleString('es-PE', { timeZone: 'America/Lima' })}
                      </span>
                    )}
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table className="table-s10">
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'center', width: 36 }}>#</th>
                          <th style={{ textAlign: 'left' }}>Validación</th>
                          <th style={{ textAlign: 'left' }}>Categoría</th>
                          <th style={{ textAlign: 'center' }}>Riesgo</th>
                          <th style={{ textAlign: 'left' }}>Norma</th>
                          <th>Registros</th>
                          <th style={{ textAlign: 'center' }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vfd.validations.map((v: any, idx: number) => {
                          const info = VALIDATION_INFO[v.id] ?? { categoria: '—', riesgo: 'MEDIO', norma: '—', descripcion: '' };
                          const isExpanded = validacionForenseExpanded === v.id;
                          const rawRows = vfd.raw?.[v.id]?.rows ?? [];
                          return (
                            <React.Fragment key={v.id}>
                              <tr data-clickable
                                onClick={() => setValidacionForenseExpanded(isExpanded ? null : v.id)}
                                style={{ background: isExpanded ? 'rgba(32,126,131,0.1)' : undefined }}
                              >
                                <td style={{ textAlign: 'center', color: '#8B97A8', fontFamily: 'monospace', fontSize: '0.7rem' }}>{idx + 1}</td>
                                <td style={{ textAlign: 'left' }}>
                                  <span style={{ fontWeight: 600, color: '#F8FAFC' }}>{v.label}</span>
                                </td>
                                <td style={{ textAlign: 'left', color: '#8B97A8', fontSize: '0.78rem' }}>{info.categoria}</td>
                                <td style={{ textAlign: 'center' }}>
                                  {v.rowCount > 0 && !v.error
                                    ? <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, ...RIESGO_STYLE[info.riesgo] }}>{info.riesgo}</span>
                                    : <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 500, background: 'transparent', color: '#4B5563', border: '1px solid transparent' }}>{info.riesgo}</span>
                                  }
                                </td>
                                <td style={{ textAlign: 'left', color: '#8B97A8', fontSize: '0.72rem', fontStyle: 'italic' }}>{info.norma}</td>
                                <td style={{ fontFamily: 'monospace', textAlign: 'center' }}>
                                  {v.rowCount > 0
                                    ? <span style={{ color: '#F59E0B', fontWeight: 700 }}>{v.rowCount.toLocaleString()} {isExpanded ? '▲' : '▼'}</span>
                                    : <span style={{ color: '#10B981' }}>0</span>
                                  }
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {v.error
                                    ? <span style={{ color: '#EF4444', fontWeight: 700, fontSize: '0.7rem' }}>ERROR</span>
                                    : v.rowCount > 0
                                      ? <span style={{ color: '#F59E0B', fontWeight: 700, fontSize: '0.72rem' }}>HALLAZGO</span>
                                      : <span style={{ color: '#10B981', fontWeight: 700 }}>OK</span>
                                  }
                                </td>
                              </tr>

                              {isExpanded && info.descripcion && (
                                <tr>
                                  <td colSpan={7} style={{ padding: '0.6rem 1rem', background: 'rgba(32,126,131,0.08)', borderLeft: '3px solid #2BB4BB', color: '#CBD5E1', fontSize: '0.78rem', lineHeight: 1.5, textAlign: 'left' }}>
                                    <span style={{ fontWeight: 600, color: '#2BB4BB', marginRight: '0.4rem' }}>¿Qué detecta?</span>{info.descripcion}
                                  </td>
                                </tr>
                              )}
                              {isExpanded && rawRows.length > 0 && (() => {
                                const colKeys = Object.keys(rawRows[0]);
                                const isMoney = (k: string) => /monto|importe|totalmonto|totalsaldo|totalimporte|totaldebe|totalhaber|saldo|diferencia|debito|credito|neto|valor|debe|haber|descuadre|brecha|gap|pagado|provisionado|saldopagar|saldodepositar|saldomensual/i.test(k);
                                const isCount = (k: string) => /^(n|cant|count|num|nro_asientos?|qty|docs)/i.test(k);
                                const isV17 = v.id === 'V17_reconciliacion_ingr';
                                const endpointForClase = (clase: string): string | null => {
                                  if (['33','39','68'].includes(clase)) return 'activo-fijo-transactions';
                                  if (clase === '40') return 'tributos-transactions';
                                  if (clase === '41') return 'laboral-transactions';
                                  if (clase === '10') return 'caja-transactions';
                                  if (['60','61','62','63','64','65','66','67'].includes(clase)) return 'gastos-nat-transactions';
                                  if (['12','13','14','16','17','18'].includes(clase)) return 'otras-cxc-transactions';
                                  if (['42','43','44','45','46','47'].includes(clase)) return 'otras-cxp-transactions';
                                  if (['50','51','52','53','54','55','56','57','58','59'].includes(clase)) return 'patrimonio-transactions';
                                  return null;
                                };
                                return (
                                <tr>
                                  <td colSpan={7} style={{ padding: 0 }}>
                                    <div style={{ background: 'rgba(32,126,131,0.06)', borderLeft: '3px solid #207E83', overflowX: 'auto', maxHeight: 320 }}>
                                      <table className="table-s10" style={{ fontSize: '0.72rem' }}>
                                        <thead>
                                          <tr>
                                            {colKeys.map((k) => (
                                              <th key={k} style={{ textAlign: isMoney(k) ? 'right' : 'left' }}>{k}</th>
                                            ))}
                                            {isV17 && <th style={{ textAlign: 'center' }}>Tipo</th>}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {rawRows.slice(0, 50).map((row: any, ri: number) => {
                                            const effectiveCod: string | null = row.CodCuenta
                                              ? String(row.CodCuenta)
                                              : v.id === 'V06_sueldos_aging' ? '4111'
                                              : v.id === 'V07_cts_depositos' ? '4151'
                                              : row.Clase ? String(row.Clase)
                                              : null;
                                            const rowClase = effectiveCod ? effectiveCod.slice(0, 2) : '';
                                            const rowEndpoint = effectiveCod ? endpointForClase(rowClase) : null;
                                            const isV04b = v.id === 'V04b_facturas_sin_asiento_resumen';
                                            const isV28 = v.id === 'V28_nc_sospechosas';
                                            const isMultiYearV = ['V06_sueldos_aging', 'V07_cts_depositos', 'V08_participaciones'].includes(v.id);
                                            const v04bDrillKey = isV04b ? `v04b-${row.Anio}` : isV28 ? `v28-${row.Anio}` : null;
                                            const v04bIsOpen = v04bDrillKey !== null && forenseFacturasDrillKey === v04bDrillKey;
                                            return (
                                            <React.Fragment key={ri}>
                                            <tr>
                                              {colKeys.map((k, vi) => {
                                                const val = row[k];
                                                const money = isMoney(k) && typeof val === 'number';
                                                const cnt   = isCount(k) && typeof val === 'number';
                                                const isNumAsientosCell = (k === 'NumAsientos' || k === 'NumFacturas') && typeof val === 'number' && val > 0 && rowEndpoint && !isV04b && !isV28;
                                                const isV04bFacturas = (isV04b && k === 'NumFacturas') || (isV28 && k === 'NumNC');
                                                const isV04bFacturasActive = isV04bFacturas && typeof val === 'number' && val > 0;
                                                return (
                                                  <td key={vi} style={{ textAlign: money ? 'right' : 'left', whiteSpace: 'nowrap', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis',
                                                    color: money && val < 0 ? '#F87171' : money && val > 0 ? '#F8FAFC' : undefined,
                                                    fontFamily: (money || cnt) ? 'monospace' : undefined,
                                                  }}>
                                                    {val === null || val === undefined ? '—'
                                                      : isV04bFacturasActive
                                                        ? <button onClick={() => setForenseFacturasDrillKey(v04bIsOpen ? null : v04bDrillKey)}
                                                            title={isV28 ? 'Ver notas de crédito individuales' : 'Ver facturas individuales'}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E25C1A', fontFamily: 'monospace', fontSize: '0.72rem', padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                                                            {val} {v04bIsOpen ? '▲' : '▶'}
                                                          </button>
                                                      : isNumAsientosCell
                                                        ? <button onClick={() => setAccountTxDrill({ codCuenta: effectiveCod!, descripcion: String(row.DesCuenta ?? row.DesBanco ?? row.Tipo ?? effectiveCod), endpoint: rowEndpoint!, ...(isMultiYearV && row.Anio ? { yearOverride: Number(row.Anio), ...(row.Mes ? { mesPreset: Number(row.Mes) } : {}) } : {}) })}
                                                            title="Ver asientos individuales"
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2BB4BB', fontFamily: 'monospace', fontSize: '0.72rem', padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                                                            {val} ▶
                                                          </button>
                                                        : money ? fmt(val) : String(val)
                                                    }
                                                  </td>
                                                );
                                              })}
                                              {isV17 && (() => {
                                                const diff = row.Diferencia ?? 0;
                                                return (
                                                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                    {diff > 0
                                                      ? <span style={{ color: '#F59E0B', fontWeight: 700, fontSize: '0.68rem' }}>Tipo B</span>
                                                      : diff < 0
                                                        ? <span style={{ color: '#EF4444', fontWeight: 700, fontSize: '0.68rem' }}>Tipo A</span>
                                                        : <span style={{ color: '#10B981', fontSize: '0.68rem' }}>OK</span>
                                                    }
                                                  </td>
                                                );
                                              })()}
                                            </tr>
                                            {v04bIsOpen && (() => {
                                              const detailRows = isV28
                                                ? (vfd.raw?.V28b_nc_detalle?.rows ?? []).filter((r: any) => r.Anio === row.Anio)
                                                : (vfd.raw?.V04b_facturas_sin_asiento_detalle?.rows ?? vfd.raw?.V04_facturas_sin_asiento_top?.rows ?? []).filter((r: any) => r.Anio === row.Anio && r.Tipo === row.Tipo);
                                              const detailKeys = detailRows.length > 0 ? Object.keys(detailRows[0]) : [];
                                              const totalCount = isV28 ? row.NumNC : row.NumFacturas;
                                              const titulo = isV28
                                                ? `Notas de crédito — ${row.Anio}`
                                                : `Facturas sin asiento — ${row.Anio} · Tipo ${row.Tipo}`;
                                              return (
                                                <tr>
                                                  <td colSpan={colKeys.length} style={{ padding: 0, background: 'rgba(226,92,26,0.06)', borderLeft: '3px solid #E25C1A' }}>
                                                    <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.68rem', color: '#FBB040', fontWeight: 600, marginBottom: '0.25rem' }}>
                                                      {titulo}
                                                      {detailRows.length === 0 && <span style={{ color: '#8B97A8', fontWeight: 400, marginLeft: '0.5rem' }}>Sin datos — ejecuta sync para cargar el detalle</span>}
                                                      {detailRows.length > 0 && <span style={{ color: '#8B97A8', fontWeight: 400, marginLeft: '0.5rem' }}>top {detailRows.length} por monto{totalCount > detailRows.length ? ` de ${totalCount} total` : ''}</span>}
                                                    </div>
                                                    {detailRows.length > 0 && (
                                                      <div style={{ overflowX: 'auto', maxHeight: 280 }}>
                                                        <table className="table-s10" style={{ fontSize: '0.68rem' }}>
                                                          <thead><tr>{detailKeys.map((k: string) => <th key={k}>{k}</th>)}</tr></thead>
                                                          <tbody>
                                                            {detailRows.map((r: any, i: number) => (
                                                              <tr key={i}>{detailKeys.map((k: string) => (
                                                                <td key={k} style={{ whiteSpace: 'nowrap', textAlign: isMoney(k) ? 'right' : 'left' }}>
                                                                  {isMoney(k) && typeof r[k] === 'number' ? fmt(r[k]) : String(r[k] ?? '—')}
                                                                </td>
                                                              ))}</tr>
                                                            ))}
                                                          </tbody>
                                                        </table>
                                                      </div>
                                                    )}
                                                  </td>
                                                </tr>
                                              );
                                            })()}
                                            </React.Fragment>
                                          ); })}
                                          {rawRows.length > 50 && (
                                            <tr><td colSpan={isV17 ? colKeys.length + 1 : colKeys.length} style={{ color: '#8B97A8', fontStyle: 'italic', textAlign: 'left' }}>… y {rawRows.length - 50} registros más</td></tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                                );
                              })()}
                              {isExpanded && v.error && (
                                <tr>
                                  <td colSpan={7} style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.08)', borderLeft: '3px solid #EF4444', color: '#F87171', fontSize: '0.78rem', textAlign: 'left' }}>
                                    Error SQL: {v.error}
                                  </td>
                                </tr>
                              )}
                              {isExpanded && !v.error && rawRows.length === 0 && (
                                <tr>
                                  <td colSpan={7} style={{ padding: '0.75rem 1rem', background: 'rgba(16,185,129,0.06)', borderLeft: '3px solid #10B981', color: '#34D399', fontSize: '0.78rem', textAlign: 'left' }}>
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
                </div>
              )}
            </>
          );
        })()}

        {/* ═══════════════════════════════════════════
            REPORTE DIRECTORIO — Plantilla v2 (Fase 1)
            ═══════════════════════════════════════════ */}
        {activeTab === 'directorio' && !isGrupo && (() => {
          const Q_MONTHS: Record<'Q1'|'Q2'|'Q3'|'Q4', number[]> = {
            Q1: [1,2,3], Q2: [4,5,6], Q3: [7,8,9], Q4: [10,11,12]
          };
          const Q_LABELS: Record<'Q1'|'Q2'|'Q3'|'Q4', string> = {
            Q1: 'Ene – Mar', Q2: 'Abr – Jun', Q3: 'Jul – Sep', Q4: 'Oct – Dic'
          };
          const qMeses = Q_MONTHS[selectedQuarter];
          const qRows = plMonthly.filter((m: any) => qMeses.includes(m.mes));
          const sumField = (rows: any[], field: string) => rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);
          const qData = {
            ingresos: sumField(qRows, 'ingresos'),
            costoDirecto: sumField(qRows, 'costoDirecto'),
            margenBruto: sumField(qRows, 'margenBruto'),
            gav: sumField(qRows, 'gav'),
            ebitda: sumField(qRows, 'ebitda'),
            gastosFinancieros: sumField(qRows, 'gastosFinancieros'),
            utilidadNeta: sumField(qRows, 'utilidadNeta'),
          };
          const ytdData = ytd || { ingresos: 0, costoDirecto: 0, margenBruto: 0, gav: 0, ebitda: 0, gastosFinancieros: 0, utilidadNeta: 0 };
          // % helpers (defensive against div-by-zero / negative ingresos)
          const safePct = (num: number, den: number) => (den && Math.abs(den) > 0.01) ? (num / den) * 100 : 0;
          const qGMpct = safePct(qData.margenBruto, qData.ingresos);
          const qCOGSpct = safePct(Math.abs(qData.costoDirecto), qData.ingresos);
          const qGAVpct = safePct(Math.abs(qData.gav), qData.ingresos);
          const qEBITDApct = safePct(qData.ebitda, qData.ingresos);
          // DSO calculado: usa CxC saldo × días del periodo / ingresos Q
          const qDSO = (cxc?.totalSaldo && qData.ingresos > 0)
            ? Math.round((cxc.totalSaldo / qData.ingresos) * 90)
            : null;

          // Semáforo: better=higher (GM, EBITDA), better=lower (COGS, GAV, DSO)
          const sem = (value: number, target: number, alert: number, betterHigher: boolean): {color: string, bg: string, label: string} => {
            const isGreen = betterHigher ? value >= target : value <= target;
            const isYellow = betterHigher ? value >= alert : value <= alert;
            if (isGreen) return { color: '#10B981', bg: 'rgba(16,185,129,0.12)', label: 'OK' };
            if (isYellow) return { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Atención' };
            return { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'Alerta' };
          };

          const kpis = [
            { code: 'F-03', label: 'Margen Bruto %', value: qGMpct, fmt: 'pct', target: 40, alert: 30, betterHigher: true, hint: 'Target >40% · Alerta <30%',
              tipTitle: 'Margen Bruto %',
              tip: 'Diferencia entre ingresos y costos directos, expresada como porcentaje. Mide cuánto queda después de cubrir el costo de producción del servicio. Es el motor de rentabilidad: de aquí salen los recursos para pagar la estructura fija (GAV), inversión y utilidad.' },
            { code: 'F-02', label: 'COGS %', value: qCOGSpct, fmt: 'pct', target: 60, alert: 65, betterHigher: false, hint: 'Target <60% · Alerta >65%',
              tipTitle: 'Costo de Ventas %',
              tip: 'Porcentaje de los ingresos consumido por costos directos: mano de obra directa, materiales y subcontratos necesarios para ejecutar los proyectos. COGS alto puede indicar exceso de subcontratación, baja productividad o precios de venta insuficientes.' },
            { code: 'F-04', label: 'GAV %', value: qGAVpct, fmt: 'pct', target: 25, alert: 30, betterHigher: false, hint: 'Target <25% · Alerta >30%',
              tipTitle: 'Gastos Adm. y Ventas %',
              tip: 'Porcentaje de los ingresos consumido por la estructura fija: personal administrativo, alquileres, tecnología, marketing. Es un costo fijo: se paga aunque los ingresos bajen. Un GAV creciente con ingresos estancados comprime el EBITDA rápidamente.' },
            { code: 'F-05', label: 'EBITDA %', value: qEBITDApct, fmt: 'pct', target: 15, alert: 8, betterHigher: true, hint: 'Target >15% · Alerta <8%',
              tipTitle: 'EBITDA %',
              tip: 'Resultado operativo antes de depreciación y amortización. Mide la rentabilidad operativa pura del negocio, independiente de decisiones de financiamiento o contables. Es el KPI financiero más importante para el Directorio: determina capacidad de reinversión, pago de deuda y atractivo para inversores.' },
            ...(qDSO !== null ? [{ code: 'O-02', label: 'DSO (días)', value: qDSO, fmt: 'days', target: 60, alert: 90, betterHigher: false, hint: 'Target <60d · Alerta >90d',
              tipTitle: 'Days Sales Outstanding',
              tip: 'Días promedio que tarda la empresa en cobrar sus facturas. Un DSO alto significa que los clientes pagan tarde y el capital de trabajo queda atado a la cobranza. Cada 10 días adicionales comprometen liquidez para operación. Fórmula: (CxC Total / Ingresos del Período) × 90 días.' }] : []),
          ];

          // P&L rows para tabla resumen
          const plDirRows = [
            { key: 'ingresos',          label: 'Ingresos',            bold: true },
            { key: 'costoDirecto',      label: '(−) Costo Directo (COGS)' },
            { key: 'margenBruto',       label: 'Margen Bruto',        bold: true, hl: true },
            { key: 'gav',               label: '(−) GAV' },
            { key: 'ebitda',            label: 'EBITDA',              bold: true, hl: true },
            { key: 'gastosFinancieros', label: '(−) Gastos Financieros' },
            { key: 'utilidadNeta',      label: 'Utilidad Neta',       bold: true, hl: true },
          ];

          return (
            <>
              {/* Selector de Trimestre + Botones Editar/Guardar */}
              <div className="kpi-card" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#8B97A8', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>TRIMESTRE</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#F8FAFC' }}>
                    {selectedQuarter} {selectedYear} <span style={{ color: '#8B97A8', fontWeight: 400, fontSize: '0.85rem' }}>· {Q_LABELS[selectedQuarter]}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  {(['Q1','Q2','Q3','Q4'] as const).map(q => (
                    <button key={q} onClick={() => setSelectedQuarter(q)} disabled={directorioEditing}
                      style={{
                        padding: '0.45rem 1rem', borderRadius: '0.5rem',
                        border: `1px solid ${selectedQuarter === q ? '#E25C1A' : 'rgba(255,255,255,0.1)'}`,
                        background: selectedQuarter === q ? 'rgba(226,92,26,0.15)' : 'transparent',
                        color: selectedQuarter === q ? '#FF8B4D' : '#8B97A8',
                        fontWeight: 600, fontSize: '0.8rem', cursor: directorioEditing ? 'not-allowed' : 'pointer', minWidth: 60,
                        opacity: directorioEditing ? 0.5 : 1,
                      }}>
                      {q}
                    </button>
                  ))}
                  <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)', margin: '0 0.4rem' }} />
                  {!directorioEditing ? (
                    <>
                      <button onClick={async () => {
                        const token = localStorage.getItem('token');
                        try {
                          const res = await fetch(`${API}/kpi/${selectedCompany.codEmpresa}/directorio/export?year=${selectedYear}&quarter=${selectedQuarter}`, {
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          if (!res.ok) { alert(`Error al exportar: ${res.status}`); return; }
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          const cd = res.headers.get('content-disposition') || '';
                          const m = cd.match(/filename="([^"]+)"/);
                          a.download = m ? m[1] : `Directorio_${selectedCompany.codEmpresa}_${selectedQuarter}_${selectedYear}.pptx`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        } catch (e: any) {
                          alert(`Error: ${e.message}`);
                        }
                      }}
                        style={{ padding: '0.45rem 1rem', borderRadius: '0.5rem', border: '1px solid rgba(226,92,26,0.4)', background: 'rgba(226,92,26,0.1)', color: '#FF8B4D', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                        title="Descargar reporte como archivo PowerPoint">
                        📥 Exportar PPTX
                      </button>
                      <button onClick={() => {
                        // Inicializar draft si está vacío (primera vez en este Q/año/empresa)
                        if (!directorioDraft) {
                          setDirectorioDraft({
                            presupuesto: { q: { ingresos: 0, costoDirecto: 0, gav: 0, da: 0 }, ytd: { ingresos: 0, costoDirecto: 0, gav: 0, da: 0 } },
                            productividad: { hhDisponibles: 0, hhFacturadas: 0, hhDisponiblesPpto: 0, nPersonas: 0 },
                            ventasFuente: { referidos: 0, licitacionesPublicas: 0, licitacionesPrivadas: 0, iniciativaDirecta: 0 },
                            backlog: [], pipeline: [], greenFlags: [], redFlags: [], mustWin: [], acuerdos: [],
                            comentarios: { resumenEjecutivo: '', ebitda: '' },
                          });
                        }
                        setDirectorioEditing(true);
                      }}
                        style={{ padding: '0.45rem 1rem', borderRadius: '0.5rem', border: '1px solid rgba(43,180,187,0.3)', background: 'rgba(43,180,187,0.1)', color: '#2BB4BB', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                        ✎ Editar
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setDirectorioDraft(JSON.parse(JSON.stringify(directorioData?.data || {}))); setDirectorioEditing(false); }}
                        disabled={directorioSaving}
                        style={{ padding: '0.45rem 1rem', borderRadius: '0.5rem', border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#F87171', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                        Cancelar
                      </button>
                      <button onClick={async () => {
                        setDirectorioSaving(true);
                        try {
                          const token = localStorage.getItem('token');
                          const res = await fetch(`${API}/kpi/${selectedCompany.codEmpresa}/directorio?year=${selectedYear}&quarter=${selectedQuarter}`, {
                            method: 'PUT',
                            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify(directorioDraft),
                          });
                          if (res.ok) {
                            const saved = await res.json();
                            setDirectorioData(saved);
                            setDirectorioEditing(false);
                          } else {
                            alert(`Error al guardar: ${res.status}`);
                          }
                        } catch (e: any) {
                          alert(`Error: ${e.message}`);
                        } finally { setDirectorioSaving(false); }
                      }} disabled={directorioSaving}
                        style={{ padding: '0.45rem 1rem', borderRadius: '0.5rem', border: 'none', background: '#10B981', color: '#0E1A2E', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                        {directorioSaving ? '⏳ Guardando…' : '💾 Guardar'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Loading state */}
              {loading && <SkeletonLoader />}

              {!loading && !pl && <NoDataBanner kpi="P&L" />}

              {!loading && pl && (
                <>
                  {/* 01 · RESUMEN EJECUTIVO — P&L Q vs YTD (con Ppto si existe) */}
                  {(() => {
                    const pq = directorioData?.data?.presupuesto?.q || {};
                    const py = directorioData?.data?.presupuesto?.ytd || {};
                    const hasPptoQ = Object.values(pq).some((v: any) => Math.abs(Number(v) || 0) > 0);
                    const hasPptoYTD = Object.values(py).some((v: any) => Math.abs(Number(v) || 0) > 0);
                    // Derivar ppto Margen/EBITDA/Utilidad si hay ppto base
                    const buildPpto = (raw: any) => ({
                      ingresos: raw.ingresos || 0,
                      costoDirecto: raw.costoDirecto || 0,
                      margenBruto: (raw.ingresos || 0) - Math.abs(raw.costoDirecto || 0),
                      gav: raw.gav || 0,
                      ebitda: (raw.ingresos || 0) - Math.abs(raw.costoDirecto || 0) - Math.abs(raw.gav || 0),
                      gastosFinancieros: raw.gastosFinancieros || 0,
                      utilidadNeta: (raw.ingresos || 0) - Math.abs(raw.costoDirecto || 0) - Math.abs(raw.gav || 0) - Math.abs(raw.gastosFinancieros || 0) - Math.abs(raw.da || 0),
                    });
                    const pqDerived = buildPpto(pq);
                    const pyDerived = buildPpto(py);
                    const cumpl = (real: number, ppto: number) => (Math.abs(ppto) > 0.01 ? (real / ppto) * 100 : 0);
                    const cumplColor = (real: number, ppto: number, betterHigher: boolean) => {
                      if (Math.abs(ppto) < 0.01) return '#8B97A8';
                      const ratio = real / ppto;
                      if (betterHigher) return ratio >= 0.95 ? '#10B981' : ratio >= 0.85 ? '#F59E0B' : '#EF4444';
                      return ratio <= 1.05 ? '#10B981' : ratio <= 1.15 ? '#F59E0B' : '#EF4444';
                    };
                    const renderRow = (real: any, ppto: any, hasPpto: boolean) => plDirRows.map(r => {
                      const vReal = (real as any)[r.key] || 0;
                      const vPpto = (ppto as any)[r.key] || 0;
                      const betterHigher = !['costoDirecto','gav','gastosFinancieros'].includes(r.key);
                      const cumplVal = cumpl(Math.abs(vReal), Math.abs(vPpto));
                      const col = cumplColor(Math.abs(vReal), Math.abs(vPpto), betterHigher);
                      return (
                        <tr key={r.key} style={r.hl ? { background: 'rgba(226,92,26,0.04)' } : {}}>
                          <td style={{ fontWeight: r.bold ? 700 : 400 }}>{r.label}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: r.bold ? 700 : 400, color: vReal < 0 ? '#F87171' : '#F8FAFC' }}>{fmt(vReal)}</td>
                          {hasPpto && <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#8B97A8' }}>{Math.abs(vPpto) > 0.01 ? fmt(vPpto) : '—'}</td>}
                          {hasPpto && <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: col }}>{Math.abs(vPpto) > 0.01 ? `${cumplVal.toFixed(0)}%` : '—'}</td>}
                        </tr>
                      );
                    });
                    return (
                      <div className="kpi-card" style={{ marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#E25C1A', margin: '0 0 1rem 0', letterSpacing: '0.05em' }}>
                          01 · RESUMEN EJECUTIVO
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
                          <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#8B97A8', letterSpacing: '0.05em', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                              {selectedQuarter} {selectedYear} ({Q_LABELS[selectedQuarter]})
                            </div>
                            <table className="table-s10" style={{ width: '100%' }}>
                              <thead>
                                <tr>
                                  <th style={{ textAlign: 'left' }}>Concepto</th>
                                  <th style={{ textAlign: 'right' }}>Real (S/)</th>
                                  {hasPptoQ && <th style={{ textAlign: 'right' }}>Ppto (S/)</th>}
                                  {hasPptoQ && <th style={{ textAlign: 'right' }}>% Cumpl.</th>}
                                </tr>
                              </thead>
                              <tbody>{renderRow(qData, pqDerived, hasPptoQ)}</tbody>
                            </table>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#8B97A8', letterSpacing: '0.05em', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                              YTD {selectedYear}
                            </div>
                            <table className="table-s10" style={{ width: '100%' }}>
                              <thead>
                                <tr>
                                  <th style={{ textAlign: 'left' }}>Concepto</th>
                                  <th style={{ textAlign: 'right' }}>Real (S/)</th>
                                  {hasPptoYTD && <th style={{ textAlign: 'right' }}>Ppto (S/)</th>}
                                  {hasPptoYTD && <th style={{ textAlign: 'right' }}>% Cumpl.</th>}
                                </tr>
                              </thead>
                              <tbody>{renderRow(ytdData, pyDerived, hasPptoYTD)}</tbody>
                            </table>
                          </div>
                        </div>
                        {!hasPptoQ && !hasPptoYTD && (
                          <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.8rem', background: 'rgba(91,134,229,0.06)', border: '1px solid rgba(91,134,229,0.15)', borderRadius: '0.4rem', fontSize: '0.72rem', color: '#8B97A8' }}>
                            💡 Activa <b>✎ Editar</b> arriba para cargar el presupuesto del trimestre y ver las columnas de cumplimiento.
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* KPIs con semáforo */}
                  <div className="kpi-card kpi-card-tooltips" style={{ marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#E25C1A', margin: '0 0 0.5rem 0', letterSpacing: '0.05em' }}>
                      INDICADORES CLAVE — Umbrales del Directorio
                    </h2>
                    <div style={{ fontSize: '0.7rem', color: '#8B97A8', marginBottom: '1rem' }}>
                      Basado en {selectedQuarter} {selectedYear} · Marco B0 del Libro de Datos · pasa el cursor sobre cada indicador para ver su definición
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                      {kpis.map(k => {
                        const s = sem(k.value, k.target, k.alert, k.betterHigher);
                        return (
                          <div key={k.code} className="info-pill" style={{ background: s.bg, border: `1px solid ${s.color}33`, borderRadius: '0.6rem', padding: '0.9rem 1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3rem' }}>
                              <span style={{ fontSize: '0.65rem', color: '#8B97A8', letterSpacing: '0.05em' }}>
                                {k.code}<span className="info-icon">i</span>
                              </span>
                              <span style={{ fontSize: '0.62rem', fontWeight: 700, color: s.color, padding: '0.1rem 0.5rem', background: `${s.color}1F`, borderRadius: '0.35rem' }}>{s.label}</span>
                            </div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#F8FAFC', marginBottom: '0.2rem' }}>{k.label}</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.color, fontFamily: 'monospace', marginBottom: '0.2rem' }}>
                              {k.fmt === 'pct' ? `${k.value.toFixed(1)}%` : `${Math.round(k.value)}d`}
                            </div>
                            <div style={{ fontSize: '0.6rem', color: '#6B7280' }}>{k.hint}</div>
                            <div className="info-tooltip">
                              <div className="info-tip-title">{k.tipTitle} ({k.code})</div>
                              <div>{k.tip}</div>
                              <div className="info-tip-meta">Umbral: {k.hint}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 05 · GAV detallado */}
                  {gav?.categorias && (gav.categorias as any[]).length > 0 && (
                    <div className="kpi-card" style={{ marginBottom: '1.5rem' }}>
                      <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#E25C1A', margin: '0 0 1rem 0', letterSpacing: '0.05em' }}>
                        05 · GAV POR CATEGORÍA — YTD {selectedYear}
                      </h2>
                      <div style={{ overflowX: 'auto' }}>
                        <table className="table-s10" style={{ width: '100%' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left' }}>Cuenta</th>
                              <th style={{ textAlign: 'left' }}>Descripción</th>
                              <th style={{ textAlign: 'right' }}>YTD (S/)</th>
                              <th style={{ textAlign: 'right' }}>% del total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(gav.categorias as any[]).slice(0, 20).map((c: any, i: number) => (
                              <tr key={i}>
                                <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#8B97A8' }}>{c.cod}</td>
                                <td>{c.descripcion}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(c.ytd || 0)}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#8B97A8' }}>{(c.pct || 0).toFixed(1)}%</td>
                              </tr>
                            ))}
                            <tr style={{ background: 'rgba(226,92,26,0.06)', fontWeight: 700 }}>
                              <td colSpan={2}>TOTAL GAV</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(gav.total || 0)}</td>
                              <td style={{ textAlign: 'right' }}>100%</td>
                            </tr>
                          </tbody>
                        </table>
                        {(gav.categorias as any[]).length > 20 && (
                          <div style={{ fontSize: '0.7rem', color: '#8B97A8', fontStyle: 'italic', padding: '0.5rem 0' }}>
                            Top 20 de {(gav.categorias as any[]).length} cuentas — ver pestaña GAV Detalle para listado completo
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 07 · CxC Aging */}
                  {cxc?.clientes && (cxc.clientes as any[]).length > 0 && (() => {
                    const clientes = cxc.clientes as any[];
                    const sum = (k: string) => clientes.reduce((s, c) => s + Number(c[k] || 0), 0);
                    const tVigente = cxc.totalVigente || sum('saldoVigente');
                    const t0_30 = sum('dias0_30');
                    const t31_60 = sum('dias31_60');
                    const t61_90 = sum('dias61_90');
                    const t90mas = sum('dias90mas');
                    const totalCxC = cxc.totalSaldo || (tVigente + t0_30 + t31_60 + t61_90 + t90mas);
                    const sortedClientes = [...clientes].sort((a, b) => (b.saldoTotal || 0) - (a.saldoTotal || 0));
                    const draft = directorioDraft || {};
                    const isEditing = directorioEditing;
                    const setCxcField = (field: string, value: any) =>
                      setDirectorioDraft((cur: any) => ({ ...cur, [field]: value }));
                    const setCxcComment = (codCliente: string, value: string) =>
                      setDirectorioDraft((cur: any) => ({
                        ...cur,
                        cxcComentarios: { ...(cur?.cxcComentarios || {}), [codCliente]: value },
                      }));
                    return (
                      <div className="kpi-card kpi-card-tooltips" style={{ marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#E25C1A', margin: '0 0 1rem 0', letterSpacing: '0.05em' }}>
                          07 · CUENTAS POR COBRAR — Aging al cierre
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                          {[
                            { label: 'Total CxC',    val: totalCxC,  color: '#F8FAFC',
                              tipTitle: 'Total Cuentas por Cobrar',
                              tip: 'Suma de saldos pendientes de cobro a todos los clientes al cierre del período.' },
                            { label: 'Vigente',      val: tVigente,  color: '#10B981',
                              tipTitle: 'Cartera Vigente',
                              tip: 'Saldos cuya fecha de vencimiento aún no ha llegado. Sin mora.' },
                            { label: '0-30 días',    val: t0_30,     color: '#10B981',
                              tipTitle: 'CxC vencida 0-30 días',
                              tip: 'Saldo vencido en los últimos 30 días. Primer escalón de mora — gestión activa de cobranza.' },
                            { label: '31-60 días',   val: t31_60,    color: '#F59E0B',
                              tipTitle: 'CxC 31-60 días',
                              tip: 'Saldo con primer atraso. Requiere gestión activa de cobranza. Riesgo moderado.' },
                            { label: '61-90 días',   val: t61_90,    color: '#F59E0B',
                              tipTitle: 'CxC 61-90 días',
                              tip: 'Saldo con atraso significativo. Probabilidad de cobro decrece — considerar provisión preventiva.' },
                            { label: '+90 días',     val: t90mas,    color: '#EF4444',
                              tipTitle: 'CxC vencida +90 días',
                              tip: 'Saldo con vencimiento mayor a 90 días. NIIF 9 exige provisión de incobrables. Considerar gestión legal o cesión a factoring.' },
                            { label: 'Concentr. Top 3', val: cxc.concentracionTop3, color: '#5B86E5', isPct: true,
                              tipTitle: 'Concentración Top 3 clientes',
                              tip: 'Porcentaje del total de CxC concentrado en los 3 clientes con mayor saldo. Alta concentración (>50%) implica riesgo de liquidez.' },
                          ].map((b: any, i) => (
                            <div key={i} className="info-pill" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '0.5rem', padding: '0.7rem 0.8rem' }}>
                              <div style={{ fontSize: '0.65rem', color: '#8B97A8', marginBottom: '0.25rem' }}>
                                {b.label}<span className="info-icon">i</span>
                              </div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'monospace', color: b.color }}>
                                {b.isPct ? `${(b.val || 0).toFixed(1)}%` : fmt(b.val || 0)}
                              </div>
                              <div className="info-tooltip">
                                <div className="info-tip-title">{b.tipTitle}</div>
                                <div>{b.tip}</div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Campos manuales para slide — solo visibles en modo edición o cuando tienen valor */}
                        {(isEditing || (draft.cxcCedido || 0) > 0 || (draft.cxcIncobrable || 0) > 0) && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem', padding: '0.75rem', background: 'rgba(226,92,26,0.04)', borderRadius: '0.5rem', border: '1px dashed rgba(226,92,26,0.2)' }}>
                            <div style={{ fontSize: '0.65rem', color: '#E25C1A', fontWeight: 600, letterSpacing: '0.05em', gridColumn: '1/-1', marginBottom: '0.25rem' }}>
                              CAMPOS MANUALES — aparecen en slide 07 del Directorio
                            </div>
                            <div>
                              <label style={{ fontSize: '0.65rem', color: '#8B97A8', display: 'block', marginBottom: '0.25rem' }}>Cedido a Factoring (S/)</label>
                              {isEditing
                                ? <input type="number" value={draft.cxcCedido || ''} onChange={e => setCxcField('cxcCedido', parseFloat(e.target.value) || 0)}
                                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '0.375rem', color: '#F8FAFC', padding: '0.4rem 0.6rem', fontFamily: 'monospace', fontSize: '0.85rem' }} />
                                : <div style={{ fontFamily: 'monospace', color: '#3B82F6', fontWeight: 700 }}>{fmt(draft.cxcCedido || 0)}</div>}
                            </div>
                            <div>
                              <label style={{ fontSize: '0.65rem', color: '#8B97A8', display: 'block', marginBottom: '0.25rem' }}>Incobrable / Provisión (S/)</label>
                              {isEditing
                                ? <input type="number" value={draft.cxcIncobrable || ''} onChange={e => setCxcField('cxcIncobrable', parseFloat(e.target.value) || 0)}
                                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '0.375rem', color: '#F8FAFC', padding: '0.4rem 0.6rem', fontFamily: 'monospace', fontSize: '0.85rem' }} />
                                : <div style={{ fontFamily: 'monospace', color: '#EF4444', fontWeight: 700 }}>{fmt(draft.cxcIncobrable || 0)}</div>}
                            </div>
                          </div>
                        )}

                        <div style={{ overflowX: 'auto' }}>
                          <table className="table-s10" style={{ width: '100%', fontSize: '0.75rem' }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left' }}>Cliente</th>
                                <th style={{ textAlign: 'right' }}>Vigente</th>
                                <th style={{ textAlign: 'right' }}>0-30</th>
                                <th style={{ textAlign: 'right' }}>31-60</th>
                                <th style={{ textAlign: 'right' }}>61-90</th>
                                <th style={{ textAlign: 'right' }}>+90</th>
                                <th style={{ textAlign: 'right' }}>Total</th>
                                <th style={{ textAlign: 'left', minWidth: isEditing ? 160 : undefined }}>Comentario</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedClientes.slice(0, 9).map((c: any, i: number) => (
                                <tr key={i}>
                                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cliente}</td>
                                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: (c.saldoVigente || 0) > 0 ? '#10B981' : undefined }}>{fmt(c.saldoVigente || 0)}</td>
                                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(c.dias0_30 || 0)}</td>
                                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: (c.dias31_60 || 0) > 0 ? '#F59E0B' : undefined }}>{fmt(c.dias31_60 || 0)}</td>
                                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: (c.dias61_90 || 0) > 0 ? '#F59E0B' : undefined }}>{fmt(c.dias61_90 || 0)}</td>
                                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: (c.dias90mas || 0) > 0 ? '#EF4444' : undefined }}>{fmt(c.dias90mas || 0)}</td>
                                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(c.saldoTotal || 0)}</td>
                                  <td>
                                    {isEditing
                                      ? <input value={draft.cxcComentarios?.[c.codCliente] || ''}
                                          onChange={e => setCxcComment(c.codCliente, e.target.value)}
                                          placeholder="comentario…"
                                          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.25rem', color: '#F8FAFC', padding: '0.2rem 0.4rem', fontSize: '0.72rem' }} />
                                      : <span style={{ color: '#8B97A8', fontStyle: 'italic', fontSize: '0.7rem' }}>{draft.cxcComentarios?.[c.codCliente] || ''}</span>}
                                  </td>
                                </tr>
                              ))}
                              <tr style={{ background: 'rgba(226,92,26,0.06)', fontWeight: 700 }}>
                                <td>TOTAL ({clientes.length} clientes)</td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(tVigente)}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(t0_30)}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(t31_60)}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(t61_90)}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(t90mas)}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(totalCxC)}</td>
                                <td></td>
                              </tr>
                            </tbody>
                          </table>
                          {clientes.length > 9 && (
                            <div style={{ fontSize: '0.7rem', color: '#8B97A8', fontStyle: 'italic', padding: '0.5rem 0' }}>
                              Top 9 de {clientes.length} clientes por saldo
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* 08 · Posición de Caja */}
                  {caja && (
                    <div className="kpi-card kpi-card-tooltips" style={{ marginBottom: '1.5rem' }}>
                      <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#E25C1A', margin: '0 0 1rem 0', letterSpacing: '0.05em' }}>
                        08 · POSICIÓN DE CAJA — {selectedQuarter} {selectedYear}
                      </h2>
                      {(() => {
                        const totalPorMes = caja?.totalPorMes || {};
                        const qFlujo = qMeses.map(m => Number(totalPorMes[m] || 0));
                        const qNeto = qFlujo.reduce((s, v) => s + v, 0);
                        const ytdNeto = Object.values(totalPorMes as Record<string, number>).reduce((s, v) => s + (v as number), 0);
                        const mesNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
                        return (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                              <div className="info-pill" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '0.5rem', padding: '0.7rem 0.8rem' }}>
                                <div style={{ fontSize: '0.65rem', color: '#8B97A8', marginBottom: '0.25rem' }}>Flujo Neto {selectedQuarter}<span className="info-icon">i</span></div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'monospace', color: qNeto < 0 ? '#F87171' : '#10B981' }}>{fmt(qNeto)}</div>
                                <div className="info-tooltip">
                                  <div className="info-tip-title">Flujo Neto del Trimestre</div>
                                  <div>Suma de entradas menos salidas de caja durante los 3 meses del trimestre. Si es positivo, la operación genera caja; si es negativo, se está consumiendo reserva.</div>
                                </div>
                              </div>
                              <div className="info-pill" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '0.5rem', padding: '0.7rem 0.8rem' }}>
                                <div style={{ fontSize: '0.65rem', color: '#8B97A8', marginBottom: '0.25rem' }}>Flujo Neto YTD<span className="info-icon">i</span></div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'monospace', color: ytdNeto < 0 ? '#F87171' : '#10B981' }}>{fmt(ytdNeto)}</div>
                                <div className="info-tooltip">
                                  <div className="info-tip-title">Flujo Neto Acumulado del Año</div>
                                  <div>Suma del flujo neto de caja de todos los meses transcurridos del año. Indica la generación/consumo de caja acumulado en el ejercicio.</div>
                                </div>
                              </div>
                              {saldoCaja !== null && saldoCaja !== undefined && (
                                <div className="info-pill" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '0.5rem', padding: '0.7rem 0.8rem' }}>
                                  <div style={{ fontSize: '0.65rem', color: '#8B97A8', marginBottom: '0.25rem' }}>Último mes<span className="info-icon">i</span></div>
                                  <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'monospace', color: (saldoCaja as number) < 0 ? '#F87171' : '#F8FAFC' }}>{fmt(saldoCaja as number)}</div>
                                  <div className="info-tooltip">
                                    <div className="info-tip-title">Saldo del Último Mes</div>
                                    <div>Saldo neto de caja del mes más reciente con movimientos registrados. Refleja la fotografía actual de tesorería.</div>
                                  </div>
                                </div>
                              )}
                              {runway !== null && (
                                <div className="info-pill" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '0.5rem', padding: '0.7rem 0.8rem' }}>
                                  <div style={{ fontSize: '0.65rem', color: '#8B97A8', marginBottom: '0.25rem' }}>Cash Runway<span className="info-icon">i</span></div>
                                  <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'monospace', color: runway < 3 ? '#EF4444' : runway < 6 ? '#F59E0B' : '#10B981' }}>{runway} meses</div>
                                  <div className="info-tooltip">
                                    <div className="info-tip-title">Cash Runway (Pista de Caja)</div>
                                    <div>Meses de operación que puede sostener la empresa con el saldo actual de caja al ritmo del gasto fijo mensual (GAV + Gastos Financieros). Menos de 3 meses = riesgo crítico de liquidez; 3-6 meses = atención; más de 6 meses = posición saludable.</div>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                              <table className="table-s10" style={{ width: '100%' }}>
                                <thead>
                                  <tr>
                                    <th style={{ textAlign: 'left' }}>Mes</th>
                                    <th style={{ textAlign: 'right' }}>Flujo Neto (S/)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {qMeses.map(m => {
                                    const v = Number(totalPorMes[m] || 0);
                                    return (
                                      <tr key={m}>
                                        <td>{mesNames[m-1]} {selectedYear}</td>
                                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: v < 0 ? '#F87171' : v > 0 ? '#10B981' : '#8B97A8' }}>{fmt(v)}</td>
                                      </tr>
                                    );
                                  })}
                                  <tr style={{ background: 'rgba(226,92,26,0.06)', fontWeight: 700 }}>
                                    <td>TOTAL {selectedQuarter}</td>
                                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: qNeto < 0 ? '#F87171' : '#10B981' }}>{fmt(qNeto)}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* ═══════════════════════════════════
                      SECCIONES MANUALES (Fase 2)
                      ═══════════════════════════════════ */}
                  {(() => {
                    // Default vacío si el fetch aún no completó o no hay datos guardados
                    const EMPTY_DIRECTORIO = {
                      presupuesto: { q: { ingresos: 0, costoDirecto: 0, gav: 0, da: 0 }, ytd: { ingresos: 0, costoDirecto: 0, gav: 0, da: 0 } },
                      productividad: { hhDisponibles: 0, hhFacturadas: 0, hhDisponiblesPpto: 0, nPersonas: 0 },
                      ventasFuente: { referidos: 0, licitacionesPublicas: 0, licitacionesPrivadas: 0, iniciativaDirecta: 0 },
                      backlog: [], pipeline: [], greenFlags: [], redFlags: [], mustWin: [], acuerdos: [],
                      comentarios: { resumenEjecutivo: '', ebitda: '' },
                      cxcCedido: 0, cxcIncobrable: 0, cxcComentarios: {},
                    };
                    const d = directorioDraft || EMPTY_DIRECTORIO;
                    const editing = directorioEditing;

                    // Helper para actualizar campos del draft (soporta paths tipo "presupuesto.q.ingresos")
                    const set = (path: string, value: any) => {
                      setDirectorioDraft((cur: any) => {
                        const copy = JSON.parse(JSON.stringify(cur || {}));
                        const parts = path.split('.');
                        let ref: any = copy;
                        for (let i = 0; i < parts.length - 1; i++) {
                          if (ref[parts[i]] == null) ref[parts[i]] = isNaN(Number(parts[i + 1])) ? {} : [];
                          ref = ref[parts[i]];
                        }
                        ref[parts[parts.length - 1]] = value;
                        return copy;
                      });
                    };
                    const addItem = (path: string, item: any) => {
                      setDirectorioDraft((cur: any) => {
                        const copy = JSON.parse(JSON.stringify(cur || {}));
                        const parts = path.split('.');
                        let ref: any = copy;
                        for (let i = 0; i < parts.length; i++) {
                          if (ref[parts[i]] == null) ref[parts[i]] = i === parts.length - 1 ? [] : {};
                          if (i < parts.length - 1) ref = ref[parts[i]];
                        }
                        ref[parts[parts.length - 1]].push(item);
                        return copy;
                      });
                    };
                    const removeItem = (path: string, index: number) => {
                      setDirectorioDraft((cur: any) => {
                        const copy = JSON.parse(JSON.stringify(cur || {}));
                        const parts = path.split('.');
                        let ref: any = copy;
                        for (let i = 0; i < parts.length; i++) ref = ref[parts[i]];
                        ref.splice(index, 1);
                        return copy;
                      });
                    };

                    const labelStyle: React.CSSProperties = {
                      fontSize: '0.65rem', color: '#8B97A8', letterSpacing: '0.03em', marginBottom: '0.25rem', display: 'block',
                    };
                    const sectionTitle: React.CSSProperties = {
                      fontSize: '0.95rem', fontWeight: 700, color: '#E25C1A', margin: '0 0 1rem 0', letterSpacing: '0.05em',
                    };
                    // Alias para reducir verbosidad: los componentes Dir* a nivel módulo
                    // tienen identidad estable (preservan el foco al escribir).
                    const onCh = set;

                    const pptoQ = d.presupuesto?.q || { ingresos: 0, costoDirecto: 0, gav: 0, da: 0 };
                    const pptoY = d.presupuesto?.ytd || { ingresos: 0, costoDirecto: 0, gav: 0, da: 0 };
                    const hasPpto = Math.abs(pptoQ.ingresos) > 0 || Math.abs(pptoQ.gav) > 0;

                    return (
                      <>
                        {/* ── Presupuesto ── */}
                        {(editing || hasPpto) && (
                          <div className="kpi-card" style={{ marginBottom: '1.5rem' }}>
                            <h2 style={sectionTitle}>PRESUPUESTO {selectedQuarter} {selectedYear} (S/)</h2>
                            <div style={{ overflowX: 'auto' }}>
                              <table className="table-s10" style={{ width: '100%' }}>
                                <thead>
                                  <tr>
                                    <th style={{ textAlign: 'left' }}>Concepto</th>
                                    <th style={{ textAlign: 'right' }}>Ppto {selectedQuarter}</th>
                                    <th style={{ textAlign: 'right' }}>Ppto YTD</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[['ingresos','Ingresos'],['costoDirecto','Costo Directo (COGS)'],['gav','GAV'],['da','D&A (Depreciación y Amort.)']].map(([k, label]) => (
                                    <tr key={k}>
                                      <td>{label}</td>
                                      <td style={{ textAlign: 'right' }}>
                                        {editing
                                          ? <DirNumInput onChange={onCh}path={`presupuesto.q.${k}`} value={(pptoQ as any)[k]} />
                                          : <span style={{ fontFamily: 'monospace' }}>{fmt((pptoQ as any)[k] || 0)}</span>}
                                      </td>
                                      <td style={{ textAlign: 'right' }}>
                                        {editing
                                          ? <DirNumInput onChange={onCh}path={`presupuesto.ytd.${k}`} value={(pptoY as any)[k]} />
                                          : <span style={{ fontFamily: 'monospace' }}>{fmt((pptoY as any)[k] || 0)}</span>}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* ── 06 Productividad HH ── */}
                        {(editing || (d.productividad?.hhDisponibles || 0) > 0 || (d.productividad?.hhFacturadas || 0) > 0) && (
                          <div className="kpi-card kpi-card-tooltips" style={{ marginBottom: '1.5rem' }}>
                            <h2 style={sectionTitle}>06 · PRODUCTIVIDAD (HORAS HOMBRE)</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                              {[
                                { k: 'hhDisponibles',     label: 'HH Disponibles',         tip: 'Total de horas-hombre que el equipo puede dedicar a proyectos en el trimestre (jornada legal − vacaciones − feriados).' },
                                { k: 'hhFacturadas',      label: 'HH Facturadas',          tip: 'Horas-hombre efectivamente facturadas a clientes en el trimestre.' },
                                { k: 'hhDisponiblesPpto', label: 'HH Disponibles (Ppto)',  tip: 'Horas presupuestadas para el trimestre. Base para medir cumplimiento.' },
                                { k: 'nPersonas',         label: 'N° Personas',            tip: 'Cantidad de personas del equipo facturable durante el trimestre.' },
                              ].map(({ k, label, tip }) => (
                                <div key={k} className="info-pill" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '0.5rem', padding: '0.7rem 0.8rem' }}>
                                  <div style={labelStyle}>{label}<span className="info-icon">i</span></div>
                                  {editing
                                    ? <DirNumInput onChange={onCh}path={`productividad.${k}`} value={d.productividad?.[k] || 0} />
                                    : <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'monospace', color: '#F8FAFC' }}>{(d.productividad?.[k] || 0).toLocaleString('es-PE')}</div>}
                                  <div className="info-tooltip">
                                    <div className="info-tip-title">{label}</div>
                                    <div>{tip}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {!editing && (d.productividad?.hhDisponibles || 0) > 0 && (
                              <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.8rem', background: 'rgba(43,180,187,0.06)', borderRadius: '0.4rem', fontSize: '0.78rem' }}>
                                <b style={{ color: '#2BB4BB' }}>Tasa de Utilización: </b>
                                <span style={{ fontFamily: 'monospace', color: '#F8FAFC' }}>
                                  {((d.productividad.hhFacturadas / d.productividad.hhDisponibles) * 100).toFixed(1)}%
                                </span>
                                <span style={{ color: '#8B97A8', marginLeft: '0.5rem', fontSize: '0.7rem' }}>(target 70-85%)</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── 09 Backlog ── */}
                        {(editing || (d.backlog?.length || 0) > 0) && (
                          <div className="kpi-card" style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                              <h2 style={sectionTitle}>09 · BACKLOG — Cartera de proyectos en ejecución</h2>
                              {editing && (
                                <button onClick={() => addItem('backlog', { cliente: '', proyecto: '', contrato: 0, inicio: '', termino: '', avance: 0, ingresoQ: 0, estado: 'En curso' })}
                                  style={{ background: '#2BB4BB', color: '#0E1A2E', border: 'none', borderRadius: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                                  + Agregar proyecto
                                </button>
                              )}
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                              <table className="table-s10" style={{ width: '100%', fontSize: '0.72rem' }}>
                                <thead>
                                  <tr>
                                    <th style={{ textAlign: 'left' }}>Cliente</th>
                                    <th style={{ textAlign: 'left' }}>Proyecto</th>
                                    <th style={{ textAlign: 'right' }}>Contrato (S/)</th>
                                    <th style={{ textAlign: 'center' }}>Inicio</th>
                                    <th style={{ textAlign: 'center' }}>Término</th>
                                    <th style={{ textAlign: 'right' }}>% Avance</th>
                                    <th style={{ textAlign: 'right' }}>Ing. {selectedQuarter} (S/)</th>
                                    <th style={{ textAlign: 'center' }}>Estado</th>
                                    {editing && <th></th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(d.backlog || []).map((r: any, i: number) => (
                                    <tr key={i}>
                                      <td>{editing ? <DirTextInput onChange={onCh}path={`backlog.${i}.cliente`} value={r.cliente} /> : r.cliente}</td>
                                      <td>{editing ? <DirTextInput onChange={onCh}path={`backlog.${i}.proyecto`} value={r.proyecto} /> : r.proyecto}</td>
                                      <td style={{ textAlign: 'right' }}>{editing ? <DirNumInput onChange={onCh}path={`backlog.${i}.contrato`} value={r.contrato} /> : <span style={{ fontFamily: 'monospace' }}>{fmt(r.contrato || 0)}</span>}</td>
                                      <td>{editing ? <DirTextInput onChange={onCh}path={`backlog.${i}.inicio`} value={r.inicio} placeholder="dd/mm/aaaa" /> : r.inicio}</td>
                                      <td>{editing ? <DirTextInput onChange={onCh}path={`backlog.${i}.termino`} value={r.termino} placeholder="dd/mm/aaaa" /> : r.termino}</td>
                                      <td style={{ textAlign: 'right' }}>{editing ? <DirNumInput onChange={onCh}path={`backlog.${i}.avance`} value={r.avance} /> : `${(r.avance || 0).toFixed(0)}%`}</td>
                                      <td style={{ textAlign: 'right' }}>{editing ? <DirNumInput onChange={onCh}path={`backlog.${i}.ingresoQ`} value={r.ingresoQ} /> : <span style={{ fontFamily: 'monospace' }}>{fmt(r.ingresoQ || 0)}</span>}</td>
                                      <td>{editing ? <DirSelectInput onChange={onCh}path={`backlog.${i}.estado`} value={r.estado} options={['En curso','En espera','Riesgo','Completado','Suspendido']} /> : r.estado}</td>
                                      {editing && <td><button onClick={() => removeItem('backlog', i)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '1rem' }}>✕</button></td>}
                                    </tr>
                                  ))}
                                  {(d.backlog || []).length === 0 && (
                                    <tr><td colSpan={editing ? 9 : 8} style={{ textAlign: 'center', color: '#8B97A8', fontStyle: 'italic', padding: '1rem' }}>Sin proyectos registrados. {editing && 'Usa "+ Agregar proyecto" para empezar.'}</td></tr>
                                  )}
                                  {(d.backlog || []).length > 0 && (
                                    <tr style={{ background: 'rgba(226,92,26,0.06)', fontWeight: 700 }}>
                                      <td colSpan={2}>TOTAL ({(d.backlog || []).length} proyectos)</td>
                                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt((d.backlog || []).reduce((s: number, r: any) => s + (r.contrato || 0), 0))}</td>
                                      <td colSpan={3}></td>
                                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt((d.backlog || []).reduce((s: number, r: any) => s + (r.ingresoQ || 0), 0))}</td>
                                      <td colSpan={editing ? 2 : 1}></td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* ── 10 Pipeline ── */}
                        {(editing || (d.pipeline?.length || 0) > 0) && (
                          <div className="kpi-card" style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                              <h2 style={sectionTitle}>10 · PIPELINE & VxF — Oportunidades Q+1</h2>
                              {editing && (
                                <button onClick={() => addItem('pipeline', { cliente: '', proyecto: '', monto: 0, qCierre: '', prob: 'B' })}
                                  style={{ background: '#2BB4BB', color: '#0E1A2E', border: 'none', borderRadius: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                                  + Agregar oportunidad
                                </button>
                              )}
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                              <table className="table-s10" style={{ width: '100%', fontSize: '0.72rem' }}>
                                <thead>
                                  <tr>
                                    <th style={{ textAlign: 'left' }}>Cliente</th>
                                    <th style={{ textAlign: 'left' }}>Proyecto / Servicio</th>
                                    <th style={{ textAlign: 'right' }}>Monto (S/)</th>
                                    <th style={{ textAlign: 'center' }}>Q Cierre</th>
                                    <th style={{ textAlign: 'center' }}>Prob.</th>
                                    {editing && <th></th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(d.pipeline || []).map((r: any, i: number) => {
                                    const probColor = r.prob === 'A' ? '#10B981' : r.prob === 'B' ? '#F59E0B' : '#8B97A8';
                                    return (
                                      <tr key={i}>
                                        <td>{editing ? <DirTextInput onChange={onCh}path={`pipeline.${i}.cliente`} value={r.cliente} /> : r.cliente}</td>
                                        <td>{editing ? <DirTextInput onChange={onCh}path={`pipeline.${i}.proyecto`} value={r.proyecto} /> : r.proyecto}</td>
                                        <td style={{ textAlign: 'right' }}>{editing ? <DirNumInput onChange={onCh}path={`pipeline.${i}.monto`} value={r.monto} /> : <span style={{ fontFamily: 'monospace' }}>{fmt(r.monto || 0)}</span>}</td>
                                        <td style={{ textAlign: 'center' }}>{editing ? <DirTextInput onChange={onCh}path={`pipeline.${i}.qCierre`} value={r.qCierre} placeholder="Q2 2026" /> : r.qCierre}</td>
                                        <td style={{ textAlign: 'center' }}>{editing ? <DirSelectInput onChange={onCh}path={`pipeline.${i}.prob`} value={r.prob} options={['A','B','C']} /> : <span style={{ fontWeight: 700, color: probColor }}>{r.prob}</span>}</td>
                                        {editing && <td><button onClick={() => removeItem('pipeline', i)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '1rem' }}>✕</button></td>}
                                      </tr>
                                    );
                                  })}
                                  {(d.pipeline || []).length === 0 && (
                                    <tr><td colSpan={editing ? 6 : 5} style={{ textAlign: 'center', color: '#8B97A8', fontStyle: 'italic', padding: '1rem' }}>Sin oportunidades en pipeline.</td></tr>
                                  )}
                                  {(d.pipeline || []).length > 0 && (
                                    <tr style={{ background: 'rgba(226,92,26,0.06)', fontWeight: 700 }}>
                                      <td colSpan={2}>TOTAL ({(d.pipeline || []).length})</td>
                                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt((d.pipeline || []).reduce((s: number, r: any) => s + (r.monto || 0), 0))}</td>
                                      <td colSpan={editing ? 3 : 2}></td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                            {!editing && (d.pipeline || []).length > 0 && (
                              <div style={{ marginTop: '0.5rem', fontSize: '0.68rem', color: '#8B97A8' }}>
                                <b>Leyenda probabilidad:</b> <span style={{ color: '#10B981' }}>A</span> Alta (&gt;75%) · <span style={{ color: '#F59E0B' }}>B</span> Media (40-75%) · C Baja (&lt;40%)
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── 12 Green Flags ── */}
                        {(editing || (d.greenFlags?.length || 0) > 0) && (
                          <div className="kpi-card" style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                              <h2 style={sectionTitle}>12 · GREEN FLAGS — Logros y avances</h2>
                              {editing && (
                                <button onClick={() => addItem('greenFlags', { titulo: '', descripcion: '' })}
                                  style={{ background: '#10B981', color: '#0E1A2E', border: 'none', borderRadius: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                                  + Agregar logro
                                </button>
                              )}
                            </div>
                            {(d.greenFlags || []).map((g: any, i: number) => (
                              <div key={i} style={{ display: 'grid', gridTemplateColumns: editing ? '1fr 2fr auto' : '1fr 3fr', gap: '0.6rem', marginBottom: '0.6rem', padding: '0.6rem', background: 'rgba(16,185,129,0.05)', borderLeft: '3px solid #10B981', borderRadius: '0.3rem' }}>
                                <div>
                                  {editing ? <DirTextInput onChange={onCh}path={`greenFlags.${i}.titulo`} value={g.titulo} placeholder="Título del logro" /> : <b style={{ color: '#10B981' }}>{g.titulo}</b>}
                                </div>
                                <div>
                                  {editing ? <DirTextArea onChange={onCh}path={`greenFlags.${i}.descripcion`} value={g.descripcion} /> : <span style={{ color: '#CBD5E1', fontSize: '0.8rem' }}>{g.descripcion}</span>}
                                </div>
                                {editing && <button onClick={() => removeItem('greenFlags', i)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '1rem' }}>✕</button>}
                              </div>
                            ))}
                            {(d.greenFlags || []).length === 0 && !editing && (
                              <div style={{ color: '#8B97A8', fontStyle: 'italic', fontSize: '0.78rem' }}>Sin logros registrados para este trimestre.</div>
                            )}
                          </div>
                        )}

                        {/* ── 13 Red Flags ── */}
                        {(editing || (d.redFlags?.length || 0) > 0) && (
                          <div className="kpi-card" style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                              <h2 style={sectionTitle}>13 · RED FLAGS — Riesgos y alertas</h2>
                              {editing && (
                                <button onClick={() => addItem('redFlags', { criticidad: 'MEDIO', titulo: '', descripcion: '', accion: '' })}
                                  style={{ background: '#EF4444', color: '#FFF', border: 'none', borderRadius: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                                  + Agregar riesgo
                                </button>
                              )}
                            </div>
                            {(d.redFlags || []).map((r: any, i: number) => {
                              const critColor = r.criticidad === 'CRÍTICO' || r.criticidad === 'CRITICO' ? '#EF4444' : r.criticidad === 'ALTO' ? '#F59E0B' : '#FBBF24';
                              return (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: editing ? '110px 1fr 1.5fr 1.5fr auto' : '110px 1fr 1.5fr 1.5fr', gap: '0.6rem', marginBottom: '0.6rem', padding: '0.6rem', background: `${critColor}11`, borderLeft: `3px solid ${critColor}`, borderRadius: '0.3rem' }}>
                                  <div>
                                    {editing
                                      ? <DirSelectInput onChange={onCh}path={`redFlags.${i}.criticidad`} value={r.criticidad} options={['CRÍTICO','ALTO','MEDIO']} />
                                      : <span style={{ color: critColor, fontWeight: 700, fontSize: '0.72rem' }}>{r.criticidad}</span>}
                                  </div>
                                  <div>{editing ? <DirTextInput onChange={onCh}path={`redFlags.${i}.titulo`} value={r.titulo} placeholder="Título del riesgo" /> : <b style={{ color: '#F8FAFC', fontSize: '0.8rem' }}>{r.titulo}</b>}</div>
                                  <div>{editing ? <DirTextArea onChange={onCh}path={`redFlags.${i}.descripcion`} value={r.descripcion} /> : <span style={{ color: '#CBD5E1', fontSize: '0.78rem' }}>{r.descripcion}</span>}</div>
                                  <div>{editing ? <DirTextArea onChange={onCh}path={`redFlags.${i}.accion`} value={r.accion} /> : <span style={{ color: '#A5F3FC', fontSize: '0.78rem' }}>→ {r.accion}</span>}</div>
                                  {editing && <button onClick={() => removeItem('redFlags', i)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '1rem' }}>✕</button>}
                                </div>
                              );
                            })}
                            {(d.redFlags || []).length === 0 && !editing && (
                              <div style={{ color: '#8B97A8', fontStyle: 'italic', fontSize: '0.78rem' }}>Sin riesgos registrados para este trimestre.</div>
                            )}
                          </div>
                        )}

                        {/* ── 14 Must Win ── */}
                        {(editing || (d.mustWin?.length || 0) > 0) && (
                          <div className="kpi-card" style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                              <h2 style={sectionTitle}>14 · MUST WIN BATTLES — Hitos críticos Q+1</h2>
                              {editing && (
                                <button onClick={() => {
                                  const next = `MW-${String((d.mustWin?.length || 0) + 1).padStart(2, '0')}`;
                                  addItem('mustWin', { codigo: next, criticidad: 'ALTO', titulo: '', descripcion: '', responsable: '', plazo: '' });
                                }}
                                  style={{ background: '#5B86E5', color: '#FFF', border: 'none', borderRadius: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                                  + Agregar Must Win
                                </button>
                              )}
                            </div>
                            {(d.mustWin || []).map((m: any, i: number) => {
                              const critColor = m.criticidad === 'CRÍTICO' || m.criticidad === 'CRITICO' ? '#EF4444' : m.criticidad === 'ALTO' ? '#F59E0B' : '#FBBF24';
                              return (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: editing ? '80px 110px 1fr 1.5fr 1fr 0.7fr auto' : '80px 110px 1fr 1.5fr 1fr 0.7fr', gap: '0.6rem', marginBottom: '0.6rem', padding: '0.6rem', background: `${critColor}11`, borderLeft: `3px solid ${critColor}`, borderRadius: '0.3rem' }}>
                                  <div>{editing ? <DirTextInput onChange={onCh}path={`mustWin.${i}.codigo`} value={m.codigo} /> : <b style={{ color: '#5B86E5', fontSize: '0.78rem' }}>{m.codigo}</b>}</div>
                                  <div>
                                    {editing
                                      ? <DirSelectInput onChange={onCh}path={`mustWin.${i}.criticidad`} value={m.criticidad} options={['CRÍTICO','ALTO','MEDIO']} />
                                      : <span style={{ color: critColor, fontWeight: 700, fontSize: '0.72rem' }}>{m.criticidad}</span>}
                                  </div>
                                  <div>{editing ? <DirTextInput onChange={onCh}path={`mustWin.${i}.titulo`} value={m.titulo} placeholder="Título del hito" /> : <b style={{ color: '#F8FAFC', fontSize: '0.8rem' }}>{m.titulo}</b>}</div>
                                  <div>{editing ? <DirTextArea onChange={onCh}path={`mustWin.${i}.descripcion`} value={m.descripcion} /> : <span style={{ color: '#CBD5E1', fontSize: '0.78rem' }}>{m.descripcion}</span>}</div>
                                  <div>{editing ? <DirTextInput onChange={onCh}path={`mustWin.${i}.responsable`} value={m.responsable} placeholder="Responsable" /> : <span style={{ color: '#A5F3FC', fontSize: '0.78rem' }}>{m.responsable}</span>}</div>
                                  <div>{editing ? <DirTextInput onChange={onCh}path={`mustWin.${i}.plazo`} value={m.plazo} placeholder="mes/año" /> : <span style={{ color: '#CBD5E1', fontSize: '0.78rem' }}>{m.plazo}</span>}</div>
                                  {editing && <button onClick={() => removeItem('mustWin', i)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '1rem' }}>✕</button>}
                                </div>
                              );
                            })}
                            {(d.mustWin || []).length === 0 && !editing && (
                              <div style={{ color: '#8B97A8', fontStyle: 'italic', fontSize: '0.78rem' }}>Sin Must Win Battles registrados.</div>
                            )}
                          </div>
                        )}

                        {/* ── Acuerdos de Directorio ── */}
                        {(editing || (d.acuerdos?.length || 0) > 0) && (
                          <div className="kpi-card" style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                              <h2 style={sectionTitle}>ACUERDOS DE DIRECTORIO {selectedQuarter} {selectedYear}</h2>
                              {editing && (
                                <button onClick={() => addItem('acuerdos', '')}
                                  style={{ background: '#2BB4BB', color: '#0E1A2E', border: 'none', borderRadius: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                                  + Agregar acuerdo
                                </button>
                              )}
                            </div>
                            {(d.acuerdos || []).map((a: string, i: number) => (
                              <div key={i} style={{ display: 'grid', gridTemplateColumns: editing ? '40px 1fr auto' : '40px 1fr', gap: '0.6rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <div style={{ color: '#2BB4BB', fontWeight: 700, fontSize: '0.85rem' }}>{i + 1}.</div>
                                <div>{editing ? <DirTextArea onChange={onCh}path={`acuerdos.${i}`} value={a} /> : <span style={{ color: '#CBD5E1', fontSize: '0.82rem' }}>{a}</span>}</div>
                                {editing && <button onClick={() => removeItem('acuerdos', i)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '1rem' }}>✕</button>}
                              </div>
                            ))}
                            {(d.acuerdos || []).length === 0 && !editing && (
                              <div style={{ color: '#8B97A8', fontStyle: 'italic', fontSize: '0.78rem' }}>Sin acuerdos registrados.</div>
                            )}
                          </div>
                        )}

                        {/* Footer informativo */}
                        {directorioData?.updatedAt && !editing && (
                          <div style={{ fontSize: '0.68rem', color: '#8B97A8', textAlign: 'center', marginTop: '1rem' }}>
                            Última actualización: {new Date(directorioData.updatedAt).toLocaleString('es-PE')}
                            {directorioData.updatedBy && ` · por ${directorioData.updatedBy}`}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </>
          );
        })()}

        </div>{/* end relative z-1 */}
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="mobile-bottomnav" aria-label="Navegación principal">
        <div className="mobile-bottomnav-inner">
          {([
            { key: 'inicio', icon: '🏠', label: 'Inicio' },
            { key: 'pl',     icon: '📊', label: 'P&L' },
            { key: 'cxc',   icon: '💰', label: 'CxC' },
            { key: 'caja',  icon: '🏦', label: 'Caja' },
          ] as const).map(item => (
            <button
              key={item.key}
              className={`bottomnav-item${activeTab === item.key ? ' active' : ''}`}
              onClick={() => handleTabChange(item.key)}
            >
              <span className="bottomnav-icon">{item.icon}</span>
              <span className="bottomnav-label">{item.label}</span>
            </button>
          ))}
          <button
            className="bottomnav-item"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Más opciones"
          >
            <span className="bottomnav-icon">☰</span>
            <span className="bottomnav-label">Más</span>
          </button>
        </div>
      </nav>

    </div>
  );
}
