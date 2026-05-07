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

// ─── CSV Export ───────────────────────────────
function exportCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const BOM = '﻿';
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [headers.map(esc).join(';'), ...rows.map(r => r.map(esc).join(';'))];
  const blob = new Blob([BOM + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function ExportBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} title="Exportar a CSV (Excel)"
      style={{ padding: '0.3rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
      ⬇ CSV
    </button>
  );
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

function TransactionModal({ companyId, year, codCuenta, descripcion, onClose }: {
  companyId: string; year: number; codCuenta: string; descripcion: string; onClose: () => void;
}) {
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesFilter, setMesFilter] = useState<number | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const params = new URLSearchParams({ year: String(year), codCuenta });
    fetch(`${API}/kpi/${companyId}/transactions?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setTxns(d.transactions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId, year, codCuenta]);

  const filtered = mesFilter ? txns.filter((t: any) => t.Mes === mesFilter) : txns;
  const mesesPresentes = Array.from(new Set(txns.map((t: any) => t.Mes as number))).sort((a, b) => a - b);
  const totalDeb = filtered.reduce((s: number, t: any) => s + (t.Debito || 0), 0);
  const totalCred = filtered.reduce((s: number, t: any) => s + (t.Credito || 0), 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '0.75rem', maxWidth: '95vw', width: 900, maxHeight: '85vh', overflow: 'auto', padding: '1.5rem' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0D3B5E' }}>{codCuenta} — {descripcion}</div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.2rem' }}>Asientos individuales · {filtered.length} movimientos</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => setMesFilter(null)}
            style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', border: '1px solid #d1d5db', background: mesFilter === null ? '#0D3B5E' : '#fff', color: mesFilter === null ? '#fff' : '#374151', fontSize: '0.78rem', cursor: 'pointer' }}>
            Todos
          </button>
          {mesesPresentes.map(m => (
            <button key={m} onClick={() => setMesFilter(m)}
              style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', border: '1px solid #d1d5db', background: mesFilter === m ? '#0D3B5E' : '#fff', color: mesFilter === m ? '#fff' : '#374151', fontSize: '0.78rem', cursor: 'pointer' }}>
              {MESES[m - 1]}
            </button>
          ))}
        </div>
        {loading ? <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Cargando...</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-s10" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Nro. Asiento</th>
                  <th style={{ minWidth: 260 }}>Glosa</th>
                  <th style={{ minWidth: 160 }}>Tercero</th>
                  <th>Débito</th>
                  <th>Crédito</th>
                  <th>Neto</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t: any, i: number) => {
                  const neto = (t.Debito || 0) - (t.Credito || 0);
                  return (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap' }}>{t.Fecha}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{t.NroAsiento}</td>
                      <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.Glosa}>{t.Glosa || '—'}</td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.Tercero}>{t.Tercero || '—'}</td>
                      <td style={{ color: t.Debito > 0 ? '#1E8449' : '#6b7280' }}>{t.Debito > 0 ? fmt(t.Debito) : '—'}</td>
                      <td style={{ color: t.Credito > 0 ? '#C0392B' : '#6b7280' }}>{t.Credito > 0 ? fmt(t.Credito) : '—'}</td>
                      <td style={{ fontWeight: 600, color: neto < 0 ? '#C0392B' : '#1E8449' }}>{fmt(neto)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={4}>TOTAL</td>
                  <td>{fmt(totalDeb)}</td>
                  <td>{fmt(totalCred)}</td>
                  <td style={{ color: (totalDeb - totalCred) < 0 ? '#C0392B' : '#1E8449' }}>{fmt(totalDeb - totalCred)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CxCTransactionModal({ companyId, cliente, codCliente, onClose }: {
  companyId: string; cliente: string; codCliente: string; onClose: () => void;
}) {
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [anioFilter, setAnioFilter] = useState<number | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const params = new URLSearchParams({ codTercero: String(codCliente) });
    fetch(`${API}/kpi/${companyId}/cxc-transactions?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setTxns(d.transactions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId, codCliente]);

  const aniosPresentes = Array.from(new Set(txns.map((t: any) => t.Anio as number))).sort((a, b) => b - a);
  const filtered = anioFilter ? txns.filter((t: any) => t.Anio === anioFilter) : txns;
  const totalDeb = filtered.reduce((s: number, t: any) => s + (t.Debito || 0), 0);
  const totalCred = filtered.reduce((s: number, t: any) => s + (t.Credito || 0), 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '0.75rem', maxWidth: '95vw', width: 960, maxHeight: '85vh', overflow: 'auto', padding: '1.5rem' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0D3B5E' }}>{cliente}</div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.2rem' }}>Movimientos clase 12 (CxC) · {filtered.length} asientos</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => setAnioFilter(null)}
            style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', border: '1px solid #d1d5db', background: anioFilter === null ? '#0D3B5E' : '#fff', color: anioFilter === null ? '#fff' : '#374151', fontSize: '0.78rem', cursor: 'pointer' }}>
            Todos
          </button>
          {aniosPresentes.map(a => (
            <button key={a} onClick={() => setAnioFilter(a)}
              style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', border: '1px solid #d1d5db', background: anioFilter === a ? '#0D3B5E' : '#fff', color: anioFilter === a ? '#fff' : '#374151', fontSize: '0.78rem', cursor: 'pointer' }}>
              {a}
            </button>
          ))}
        </div>
        {loading ? <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Cargando...</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-s10" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Nro. Asiento</th>
                  <th>Cuenta</th>
                  <th style={{ minWidth: 260 }}>Glosa</th>
                  <th>Débito</th>
                  <th>Crédito</th>
                  <th>Neto</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t: any, i: number) => {
                  const neto = (t.Debito || 0) - (t.Credito || 0);
                  return (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap' }}>{t.Fecha}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{t.NroAsiento}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#2874A6' }}>{t.CodCuenta}</td>
                      <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.Glosa}>{t.Glosa || '—'}</td>
                      <td style={{ color: t.Debito > 0 ? '#1E8449' : '#6b7280' }}>{t.Debito > 0 ? fmt(t.Debito) : '—'}</td>
                      <td style={{ color: t.Credito > 0 ? '#C0392B' : '#6b7280' }}>{t.Credito > 0 ? fmt(t.Credito) : '—'}</td>
                      <td style={{ fontWeight: 600, color: neto < 0 ? '#C0392B' : '#1E8449' }}>{fmt(neto)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={4}>TOTAL</td>
                  <td>{fmt(totalDeb)}</td>
                  <td>{fmt(totalCred)}</td>
                  <td style={{ color: (totalDeb - totalCred) < 0 ? '#C0392B' : '#1E8449' }}>{fmt(totalDeb - totalCred)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function DetalleModal({ title, rows, activeMeses, companyId, year, onClose }: {
  title: string; rows: any[]; activeMeses: number[]; companyId: string; year: number; onClose: () => void;
}) {
  const [txDrill, setTxDrill] = useState<{ codCuenta: string; descripcion: string } | null>(null);

  if (!rows?.length) return null;
  return (
    <>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '0.75rem', maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto', padding: '1.5rem', minWidth: 600 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0D3B5E' }}>Detalle: {title}</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.2rem' }}>Click en una cuenta para ver los asientos individuales</div>
          </div>
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
                <tr key={r.codCuenta} style={{ cursor: 'pointer' }}
                  onClick={() => setTxDrill({ codCuenta: r.codCuenta, descripcion: r.descripcion })}
                  title="Ver asientos individuales">
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#2874A6' }}>{r.codCuenta}</td>
                  <td style={{ color: '#2874A6' }}>{r.descripcion} <span style={{ fontSize: '0.65rem' }}>▶</span></td>
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
    {txDrill && (
      <TransactionModal
        companyId={companyId}
        year={year}
        codCuenta={txDrill.codCuenta}
        descripcion={txDrill.descripcion}
        onClose={() => setTxDrill(null)}
      />
    )}
    </>
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
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [pl, setPL] = useState<any>(null);
  const [cxc, setCxC] = useState<any>(null);
  const [caja, setCaja] = useState<any>(null);
  const [gav, setGAV] = useState<any>(null);
  const [consolidado, setConsolidado] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'pl' | 'cxc' | 'cxp' | 'caja' | 'gav' | 'docs'>('pl');
  const [cxp, setCxP] = useState<any>(null);
  const [drillDown, setDrillDown] = useState<{ title: string; rows: any[] } | null>(null);
  const [cxcTxDrill, setCxCTxDrill] = useState<{ cliente: string; codCliente: string } | null>(null);
  const [docs, setDocs] = useState<{ emitidas: any[]; recibidas: any[]; honorarios: any[] } | null>(null);
  const [docsTab, setDocsTab] = useState<'emitidas' | 'recibidas' | 'honorarios'>('emitidas');
  const [docsSearch, setDocsSearch] = useState('');
  const [docsOnlySinAsiento, setDocsOnlySinAsiento] = useState(false);
  const [docsOnlyDuplicados, setDocsOnlyDuplicados] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const isGrupo = selectedCompany.codEmpresa === 'GRUPO';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    setLoading(true);
    setPL(null); setCxC(null); setCxP(null); setCaja(null); setGAV(null); setConsolidado(null);

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
      setLastSync(null);
      Promise.all([
        fetchApi(`/kpi/${id}/dashboard?year=${selectedYear}`, token),
        fetchApi(`/kpi/${id}/cxc`, token),
        fetchApi(`/kpi/${id}/cxp`, token),
        fetchApi(`/kpi/${id}/caja?year=${selectedYear}`, token),
        fetchApi(`/kpi/${id}/gav?year=${selectedYear}`, token),
        fetchApi(`/kpi/${id}/last-sync?year=${selectedYear}`, token),
      ])
        .then(([plData, cxcData, cxpData, cajaData, gavData, syncData]) => {
          setPL(plData?.plMonthly ? plData : null);
          setCxC(cxcData?.clientes ? cxcData : null);
          setCxP(cxpData?.proveedores ? cxpData : null);
          setCaja(cajaData?.bancos ? cajaData : null);
          setGAV(gavData?.categorias ? gavData : null);
          setLastSync(syncData?.lastSync ?? null);
          setLoading(false);
        })
        .catch((err) => {
          if (err.message === 'unauthorized') { router.push('/login'); return; }
          setError(err.message);
          setLoading(false);
        });
    }
  }, [router, selectedCompany, selectedYear]);

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
          companyId={selectedCompany.codEmpresa}
          year={selectedYear}
          onClose={() => setDrillDown(null)}
        />
      )}
      {cxcTxDrill && (
        <CxCTransactionModal
          companyId={selectedCompany.codEmpresa}
          cliente={cxcTxDrill.cliente}
          codCliente={cxcTxDrill.codCliente}
          onClose={() => setCxCTxDrill(null)}
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

        {/* Sync button */}
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            disabled={syncStatus === 'running'}
            onClick={async () => {
              const token = localStorage.getItem('token');
              if (!token) return;
              setSyncStatus('running');
              try {
                await fetch(`${API}/sync/trigger?years=${CURRENT_YEAR},${CURRENT_YEAR - 1}`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}` },
                });
                setSyncStatus('done');
                setTimeout(() => setSyncStatus('idle'), 5000);
              } catch {
                setSyncStatus('error');
                setTimeout(() => setSyncStatus('idle'), 4000);
              }
            }}
            style={{
              width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: 'none',
              background: syncStatus === 'running' ? 'rgba(255,255,255,0.05)'
                        : syncStatus === 'done'    ? '#1E8449'
                        : syncStatus === 'error'   ? '#C0392B'
                        : 'rgba(255,255,255,0.1)',
              color: syncStatus === 'running' ? '#94A3B8' : '#fff',
              fontSize: '0.82rem', fontWeight: 600, cursor: syncStatus === 'running' ? 'default' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {syncStatus === 'running' ? '⏳ Sincronizando...'
           : syncStatus === 'done'    ? '✓ Sync iniciado'
           : syncStatus === 'error'   ? '✗ Error al sincronizar'
           : '↻ Sincronizar datos'}
          </button>
          <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.4rem', textAlign: 'center' }}>
            Auto: Lun-Vie 7am y 6pm
          </div>
        </div>

        {/* Nav tabs */}
        <nav style={{ padding: '0.75rem 0' }}>
          {(['pl', 'cxc', 'cxp', 'caja', 'gav', 'docs'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`sidebar-link ${activeTab === tab ? 'active' : ''}`}
              style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
            >
              {tab === 'pl'   && '📊 P&L'}
              {tab === 'cxc'  && '💰 CxC Aging'}
              {tab === 'cxp'  && '🏪 CxP Aging'}
              {tab === 'caja' && '🏦 Posición Caja'}
              {tab === 'gav'  && '📋 GAV Detalle'}
              {tab === 'docs' && '🧾 Documentos'}
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
              {activeTab === 'pl'   && (isGrupo ? 'Consolidado del Grupo' : 'Estado de Resultados')}
              {activeTab === 'cxc'  && 'Cuentas por Cobrar — Aging'}
              {activeTab === 'cxp'  && 'Cuentas por Pagar — Aging'}
              {activeTab === 'caja' && 'Posición de Caja'}
              {activeTab === 'gav'  && 'Gastos de Admin. y Ventas'}
              {activeTab === 'docs' && 'Documentos del Período'}
            </h1>
            <div style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {selectedCompany.fullName} · YTD {selectedYear} · Fuente: S10 ERP
              {prevYear && <span style={{ marginLeft: '0.5rem', color: '#9ca3af' }}>· vs {prevYear.year}</span>}
              {lastSync && (
                <span style={{ marginLeft: '0.5rem', color: '#9ca3af' }}>
                  · Datos al {new Date(lastSync).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
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
                      <th style={{ background: '#1a5276' }}>YTD {selectedYear}</th>
                      {prevYear && (
                        <th style={{ background: '#2c3e50' }}>
                          {prevYear.meses?.length
                            ? `${MESES[prevYear.meses[0]-1]}-${MESES[prevYear.meses[prevYear.meses.length-1]-1]} ${prevYear.year}`
                            : `YTD ${prevYear.year}`}
                        </th>
                      )}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 700, color: '#0D3B5E' }}>Aging por Cliente</div>
                <ExportBtn onClick={() => {
                  const headers = ['Cliente', '0-30 días', '31-60 días', '61-90 días', '+90 días', 'Total', '% Cartera'];
                  const rows = [...cxc.clientes].sort((a: any, b: any) => b.saldoTotal - a.saldoTotal).map((c: any) => [
                    c.cliente, c.dias0_30, c.dias31_60, c.dias61_90, c.dias90mas, c.saldoTotal,
                    cxc.totalSaldo > 0 ? `${((c.saldoTotal / cxc.totalSaldo) * 100).toFixed(1)}%` : '',
                  ]);
                  exportCSV(`CxC_${selectedCompany.shortName}.csv`, headers, rows);
                }} />
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '1rem' }}>Click en un cliente para ver los asientos individuales</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table-s10">
                  <thead>
                    <tr>
                      <th>Cliente</th><th>0-30 días</th><th>31-60 días</th><th>61-90 días</th><th>+90 días</th><th>Total</th><th>% Cartera</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...cxc.clientes].sort((a: any, b: any) => b.saldoTotal - a.saldoTotal).map((c: any) => (
                      <tr key={c.codCliente} style={{ cursor: 'pointer' }}
                        onClick={() => setCxCTxDrill({ cliente: c.cliente, codCliente: String(c.codCliente) })}
                        title="Ver asientos individuales">
                        <td style={{ color: '#2874A6' }}>{c.cliente} <span style={{ fontSize: '0.65rem' }}>▶</span></td>
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

        {/* ═══ CxP Tab ═══ */}
        {activeTab === 'cxp' && isGrupo && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
            Selecciona una empresa para ver sus cuentas por pagar.
          </div>
        )}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: 700, color: '#0D3B5E' }}>Aging por Proveedor</div>
                  <ExportBtn onClick={() => {
                    const headers = ['Proveedor', '0-30 días', '31-60 días', '61-90 días', '+90 días', 'Total', '% Deuda'];
                    const rows = [...cxp.proveedores].sort((a: any, b: any) => b.saldoTotal - a.saldoTotal).map((p: any) => [
                      p.proveedor, p.dias0_30, p.dias31_60, p.dias61_90, p.dias90mas, p.saldoTotal,
                      cxp.totalSaldo > 0 ? `${((p.saldoTotal / cxp.totalSaldo) * 100).toFixed(1)}%` : '',
                    ]);
                    exportCSV(`CxP_${selectedCompany.shortName}.csv`, headers, rows);
                  }} />
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-s10">
                    <thead>
                      <tr>
                        <th>Proveedor</th><th>0-30 días</th><th>31-60 días</th><th>61-90 días</th><th>+90 días</th><th>Total</th><th>% Deuda</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...cxp.proveedores].sort((a: any, b: any) => b.saldoTotal - a.saldoTotal).map((p: any) => (
                        <tr key={p.codProveedor}>
                          <td>{p.proveedor}</td>
                          <td>{fmt(p.dias0_30)}</td>
                          <td>{fmt(p.dias31_60)}</td>
                          <td>{fmt(p.dias61_90)}</td>
                          <td className={p.dias90mas > 0 ? 'negative' : ''}>{fmt(p.dias90mas)}</td>
                          <td style={{ fontWeight: 600 }}>{fmt(p.saldoTotal)}</td>
                          <td style={{ color: '#6b7280' }}>{cxp.totalSaldo > 0 ? pct((p.saldoTotal / cxp.totalSaldo) * 100) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="total-row">
                        <td>TOTAL</td>
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
                <div style={{ fontWeight: 700, color: '#0D3B5E' }}>Flujo Neto por Banco</div>
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
          </>
        )}

        {/* ═══ Documentos Tab ═══ */}
        {activeTab === 'docs' && isGrupo && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
            Selecciona una empresa para ver sus documentos.
          </div>
        )}
        {activeTab === 'docs' && !isGrupo && !docs && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Cargando documentos...</div>
        )}
        {activeTab === 'docs' && !isGrupo && docs && (() => {
          const lista = docsTab === 'emitidas' ? docs.emitidas : docsTab === 'recibidas' ? docs.recibidas : docs.honorarios;
          const sinAsientoCount = lista.filter((d: any) => d.SinAsiento === 1).length;
          const sinAsientoMonto = lista.filter((d: any) => d.SinAsiento === 1).reduce((s: number, d: any) => s + (d.TotalNeto || 0), 0);
          const duplicadosCount = lista.filter((d: any) => d.EsDuplicado === 1).length;
          const q = docsSearch.toLowerCase();
          const filtrada = lista.filter((d: any) => {
            if (docsOnlySinAsiento && d.SinAsiento !== 1) return false;
            if (docsOnlyDuplicados && d.EsDuplicado !== 1) return false;
            if (!q) return true;
            const nombre = docsTab === 'emitidas' ? (d.Cliente || '') : (d.Proveedor || '');
            const num = `${d.Serie || ''}-${d.Numero || ''}`;
            const tipo = d.TipoDocumento || '';
            return nombre.toLowerCase().includes(q) || num.toLowerCase().includes(q) || tipo.toLowerCase().includes(q);
          });
          const totalMonto = filtrada.reduce((s: number, d: any) => s + (d.Total || 0), 0);
          const totalNeto = filtrada.reduce((s: number, d: any) => s + (d.TotalNeto || 0), 0);
          const totalSaldo = docsTab === 'emitidas'
            ? filtrada.reduce((s: number, d: any) => s + (d.Saldo || 0), 0)
            : filtrada.reduce((s: number, d: any) => s + (d.TotalSaldo || 0), 0);
          return (
            <div>
              {/* Sub-tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {(['emitidas', 'recibidas', 'honorarios'] as const).map((t) => (
                  <button key={t} onClick={() => { setDocsTab(t); setDocsSearch(''); setDocsOnlySinAsiento(false); setDocsOnlyDuplicados(false); }}
                    style={{ padding: '0.4rem 1.2rem', borderRadius: '0.375rem', border: '1px solid',
                      borderColor: docsTab === t ? '#0D3B5E' : '#d1d5db',
                      background: docsTab === t ? '#0D3B5E' : '#fff',
                      color: docsTab === t ? '#fff' : '#374151',
                      fontWeight: docsTab === t ? 700 : 400, fontSize: '0.85rem', cursor: 'pointer' }}>
                    {t === 'emitidas' ? `Facturas Emitidas (${docs.emitidas.length})` : t === 'recibidas' ? `Facturas Recibidas (${docs.recibidas.length})` : `Honorarios (${docs.honorarios.length})`}
                  </button>
                ))}
                {sinAsientoCount > 0 && (
                  <button
                    onClick={() => { setDocsOnlySinAsiento(!docsOnlySinAsiento); setDocsOnlyDuplicados(false); setDocsSearch(''); }}
                    style={{ padding: '0.4rem 1rem', borderRadius: '0.375rem', border: '1px solid',
                      borderColor: docsOnlySinAsiento ? '#C0392B' : '#fca5a5',
                      background: docsOnlySinAsiento ? '#C0392B' : '#fef2f2',
                      color: docsOnlySinAsiento ? '#fff' : '#C0392B',
                      fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>
                    ⚠ Sin asiento contable ({sinAsientoCount}) · S/ {sinAsientoMonto.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                  </button>
                )}
                {duplicadosCount > 0 && (
                  <button
                    onClick={() => { setDocsOnlyDuplicados(!docsOnlyDuplicados); setDocsOnlySinAsiento(false); setDocsSearch(''); }}
                    style={{ padding: '0.4rem 1rem', borderRadius: '0.375rem', border: '1px solid',
                      borderColor: docsOnlyDuplicados ? '#D35400' : '#fed7aa',
                      background: docsOnlyDuplicados ? '#D35400' : '#fff7ed',
                      color: docsOnlyDuplicados ? '#fff' : '#D35400',
                      fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>
                    ⚠ Duplicados ({duplicadosCount})
                  </button>
                )}
              </div>
              <div className="kpi-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0D3B5E' }}>
                      {docsTab === 'emitidas' ? 'Facturas emitidas a clientes' : docsTab === 'recibidas' ? 'Facturas y boletas recibidas' : 'Recibos por Honorarios Profesionales'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.2rem' }}>
                      {filtrada.length} documentos · Neto {fmt(totalNeto)} · Total c/IGV {fmt(totalMonto)} · Pendiente {fmt(totalSaldo)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder={docsTab === 'emitidas' ? 'Buscar cliente o número...' : 'Buscar proveedor o número...'}
                      value={docsSearch}
                      onChange={e => setDocsSearch(e.target.value)}
                      style={{ padding: '0.4rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.82rem', minWidth: 200 }}
                    />
                    <ExportBtn onClick={() => {
                      const tab = docsTab;
                      const fname = `Docs_${tab}_${selectedCompany.shortName}_${selectedYear}.csv`;
                      if (tab === 'emitidas') {
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
                          <tr key={i} style={{ background: esDuplicado ? '#fff7ed' : sinAsiento ? '#fff5f5' : undefined }}>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                              {esDuplicado && <span title="Documento duplicado en S10 — revisar con contabilidad" style={{ color: '#D35400', marginRight: '0.3rem', fontSize: '0.8rem' }}>⧉</span>}
                              {sinAsiento && <span title="Sin asiento contable en cuenta de gasto" style={{ color: '#C0392B', marginRight: '0.3rem', fontSize: '0.8rem' }}>⚠</span>}
                              {d.Serie || '—'}-{d.Numero}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>{d.FechaDocumento}</td>
                            <td style={{ whiteSpace: 'nowrap', color: (d.TotalSaldo || 0) > 0 ? '#C0392B' : '#6b7280' }}>{d.FechaVencimiento}</td>
                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.Proveedor}>{d.Proveedor || '—'}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#6b7280' }}>{d.RucProveedor || '—'}</td>
                            <td>{fmt(d.TotalNeto)}</td>
                            <td style={{ color: '#C0392B' }}>{fmt(d.TotalImpuesto)}</td>
                            <td style={{ fontWeight: 600 }}>{fmt(d.Total)}</td>
                            <td style={{ color: '#1E8449' }}>{fmt(d.TotalPagado)}</td>
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
                  ) : docsTab === 'emitidas' ? (
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
                          return (
                          <tr key={i} style={{ background: esDuplicado ? '#fff7ed' : sinAsiento ? '#fff5f5' : undefined }}>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                              {esDuplicado && <span title="Documento duplicado en S10 — revisar con contabilidad" style={{ color: '#D35400', marginRight: '0.3rem', fontSize: '0.8rem' }}>⧉</span>}
                              {sinAsiento && <span title="Sin asiento contable en cuenta de ingreso" style={{ color: '#C0392B', marginRight: '0.3rem', fontSize: '0.8rem' }}>⚠</span>}
                              {d.Serie || '—'}-{d.Numero}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>{d.FechaDocumento}</td>
                            <td style={{ fontSize: '0.72rem', color: '#2874A6', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.TipoDocumento}>{d.TipoDocumento || '—'}</td>
                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.Cliente}>{d.Cliente || '—'}</td>
                            <td>{fmt(d.TotalNeto)}</td>
                            <td style={{ color: '#6b7280' }}>{fmt(d.TotalImpuesto)}</td>
                            <td style={{ fontWeight: 600 }}>{fmt(d.Total)}</td>
                            <td style={{ color: '#1E8449' }}>{fmt(d.TotalPagado)}</td>
                            <td className={(d.Saldo || 0) > 0 ? 'negative' : ''}>{fmt(d.Saldo)}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="total-row">
                          <td colSpan={4}>TOTAL ({filtrada.length})</td>
                          <td>{fmt(filtrada.reduce((s: number, d: any) => s + (d.TotalNeto || 0), 0))}</td>
                          <td>{fmt(filtrada.reduce((s: number, d: any) => s + (d.TotalImpuesto || 0), 0))}</td>
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
                          return (
                          <tr key={i} style={{ background: esDuplicado ? '#fff7ed' : sinAsiento ? '#fff5f5' : undefined }}>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                              {esDuplicado && <span title="Documento duplicado en S10 — revisar con contabilidad" style={{ color: '#D35400', marginRight: '0.3rem', fontSize: '0.8rem' }}>⧉</span>}
                              {sinAsiento && <span title="Sin asiento contable en cuenta de costo/gasto" style={{ color: '#C0392B', marginRight: '0.3rem', fontSize: '0.8rem' }}>⚠</span>}
                              {d.Serie || '—'}-{d.Numero}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>{d.FechaDocumento}</td>
                            <td style={{ whiteSpace: 'nowrap', color: (d.TotalSaldo || 0) > 0 ? '#C0392B' : '#6b7280' }}>{d.FechaVencimiento}</td>
                            <td style={{ fontSize: '0.72rem', color: '#2874A6', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.TipoDocumento}>{d.TipoDocumento || '—'}</td>
                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.Proveedor}>{d.Proveedor || '—'}</td>
                            <td>{fmt(d.TotalNeto)}</td>
                            <td style={{ color: '#6b7280' }}>{fmt(d.TotalImpuesto)}</td>
                            <td style={{ fontWeight: 600 }}>{fmt(d.Total)}</td>
                            <td style={{ color: '#1E8449' }}>{fmt(d.TotalPagado)}</td>
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
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ═══ GAV Tab ═══ */}
        {activeTab === 'gav' && !gav && !loading && <NoDataBanner kpi="GAV" />}
        {activeTab === 'gav' && gav && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 700, color: '#0D3B5E' }}>GAV por Categoría</div>
                <ExportBtn onClick={() => {
                  const headers = ['Categoría', 'YTD', '% GAV', '% Ingresos'];
                  const rows = (gav.categorias || []).map((c: any) => [
                    c.descripcion, c.ytd,
                    `${c.pct?.toFixed(1)}%`,
                    ytd?.ingresos > 0 ? `${((c.ytd / ytd.ingresos) * 100).toFixed(1)}%` : '',
                  ]);
                  exportCSV(`GAV_${selectedCompany.shortName}_${selectedYear}.csv`, headers, rows);
                }} />
              </div>
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
