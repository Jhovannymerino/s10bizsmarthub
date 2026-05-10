'use client';
import React, { useEffect, useRef, useState } from 'react';
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
const MIN_YEAR = 2025;
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
const COLORS_PIE = ['#207E83', '#F59E0B', '#10B981', '#2BB4BB', '#8E44AD', '#F97316', '#148F77', '#EF4444'];
const COLORS_EMPRESA = ['#207E83', '#F59E0B', '#10B981', '#2BB4BB'];

// ─── Formatters ───────────────────────────────
function fmt(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return '—';
  const rounded = Math.round(n);
  const abs = Math.abs(rounded).toLocaleString('en-US');
  return rounded < 0 ? `-S/ ${abs}` : `S/ ${abs}`;
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
      style={{ padding: '0.3rem 0.75rem', borderRadius: '0.375rem', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#8B97A8', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
      ⬇ CSV
    </button>
  );
}

// ─── Sort helpers ─────────────────────────────
type SortState = { col: string; dir: 'asc' | 'desc' };
function sortRows<T extends Record<string, any>>(arr: T[], col: string, dir: 'asc' | 'desc'): T[] {
  return [...arr].sort((a, b) => {
    const av = a[col] ?? 0, bv = b[col] ?? 0;
    const cmp = typeof av === 'string' ? av.localeCompare(bv, 'es') : (av as number) - (bv as number);
    return dir === 'asc' ? cmp : -cmp;
  });
}
function toggleSort(cur: SortState, col: string): SortState {
  return cur.col === col ? { col, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' };
}

function SortTh({ label, col, sort, onSort, style }: {
  label: string; col: string; sort: SortState; onSort: (col: string) => void; style?: React.CSSProperties;
}) {
  const active = sort.col === col;
  return (
    <th onClick={() => onSort(col)} style={{ cursor: 'pointer', userSelect: 'none', ...style }}>
      {label}{' '}
      <span style={{ fontSize: '0.6rem', opacity: active ? 0.9 : 0.28 }}>
        {active ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </th>
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
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
  green: '#10B981', yellow: '#F59E0B', red: '#EF4444', neutral: '#8B97A8',
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
      {sub && <div style={{ fontSize: '0.8rem', color: '#8B97A8', marginTop: '0.25rem' }}>{sub}</div>}
      {hint && <div style={{ fontSize: '0.7rem', color: '#8B97A8', marginTop: '0.25rem' }}>{hint}</div>}
    </div>
  );
}

function NoDataBanner({ kpi }: { kpi: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, color: '#8B97A8', textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📭</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#F8FAFC', marginBottom: '0.5rem' }}>Sin datos de {kpi}</div>
      <div style={{ fontSize: '0.875rem', maxWidth: 380 }}>
        Ejecuta <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>node sync-agent.js</code> desde la red CMO para cargar los datos.
      </div>
    </div>
  );
}

function DocPreview({ companyId, nroD, onClose }: { companyId: string; nroD: string; onClose: () => void }) {
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API}/kpi/${companyId}/documento?nroD=${encodeURIComponent(nroD)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setDoc(d && d.tipo ? d : null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId, nroD]);

  const TIPO_LABEL: Record<string, string> = { emitida: 'Factura Emitida', recibida: 'Factura Recibida', honorario: 'Honorario' };
  const found = doc && doc.tipo;
  const d = doc?.doc;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={onClose}>
      <div style={{ background: '#0D1A2D', border: '1px solid rgba(43,180,187,0.3)', borderRadius: '0.75rem', width: 520, padding: '1.5rem', maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 700, color: '#2BB4BB', fontSize: '0.9rem' }}>
            {loading ? 'Cargando documento...' : found ? `${TIPO_LABEL[doc.tipo] || doc.tipo} · ${String(nroD).slice(-8).toUpperCase()}` : `Sin documento fuente`}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8B97A8', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>
        {!loading && found && d && (() => {
          const rows = [
            ['Serie-Número', `${d.Serie || '—'}-${d.Numero}`],
            ['Fecha', d.FechaDocumento],
            ['Vencimiento', d.FechaVencimiento],
            ['Tipo', d.TipoDocumento],
            ['Cliente / Proveedor', d.Cliente || d.Proveedor || '—'],
            ['RUC', d.RucCliente || d.RucProveedor || '—'],
            ['Neto', fmt(d.TotalNeto)],
            ['IGV', fmt(d.TotalImpuesto)],
            ['Total', fmt(d.Total)],
            ['Pagado', fmt(d.TotalPagado)],
            ['Saldo', fmt(d.Saldo ?? d.TotalSaldo)],
            ['Estado', d.Estado],
            ...(d.Observacion ? [['Observación', d.Observacion]] : []),
            ...(d.Categoria ? [['Categoría', d.Categoria]] : []),
          ];
          return (
            <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
              <tbody>
                {rows.map(([k, v]) => v && v !== '—' && v !== fmt(0) ? (
                  <tr key={k} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '0.4rem 0.5rem', color: '#8B97A8', fontWeight: 600, whiteSpace: 'nowrap', width: '40%' }}>{k}</td>
                    <td style={{ padding: '0.4rem 0.5rem', color: '#F8FAFC' }}>{v}</td>
                  </tr>
                ) : null)}
              </tbody>
            </table>
          );
        })()}
        {!loading && !found && (
          <div style={{ color: '#8B97A8', fontSize: '0.82rem' }}>Este asiento no tiene documento fuente registrado (asiento manual, planilla, ajuste o depreciación).</div>
        )}
      </div>
    </div>
  );
}

function TransactionModal({ companyId, year, codCuenta, descripcion, onClose }: {
  companyId: string; year: number; codCuenta: string; descripcion: string; onClose: () => void;
}) {
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [mesFilter, setMesFilter] = useState<number | null>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setFetchError(false);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const params = new URLSearchParams({ year: String(year), codCuenta });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    fetch(`${API}/kpi/${companyId}/transactions?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    })
      .then(r => r.json())
      .then(d => { setTxns(d.transactions || []); setLoading(false); })
      .catch(() => { setFetchError(true); setLoading(false); })
      .finally(() => clearTimeout(timer));
  }, [companyId, year, codCuenta, retryCount]);

  const filtered = mesFilter ? txns.filter((t: any) => t.Mes === mesFilter) : txns;
  const mesesPresentes = Array.from(new Set(txns.map((t: any) => t.Mes as number))).sort((a, b) => a - b);
  const totalDeb = filtered.reduce((s: number, t: any) => s + (t.Debito || 0), 0);
  const totalCred = filtered.reduce((s: number, t: any) => s + (t.Credito || 0), 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div style={{ background: '#0D1A2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', maxWidth: '95vw', width: 900, maxHeight: '85vh', overflow: 'auto', padding: '1.5rem' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#F8FAFC' }}>{codCuenta} — {descripcion}</div>
            <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginTop: '0.2rem' }}>Asientos individuales · {filtered.length} movimientos</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#8B97A8' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => setMesFilter(null)}
            style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', border: mesFilter === null ? '1px solid rgba(32,126,131,0.5)' : '1px solid rgba(255,255,255,0.1)', background: mesFilter === null ? 'rgba(32,126,131,0.2)' : 'rgba(255,255,255,0.04)', color: mesFilter === null ? '#2BB4BB' : '#8B97A8', fontSize: '0.78rem', cursor: 'pointer' }}>
            Todos
          </button>
          {mesesPresentes.map(m => (
            <button key={m} onClick={() => setMesFilter(m)}
              style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', border: mesFilter === m ? '1px solid rgba(32,126,131,0.5)' : '1px solid rgba(255,255,255,0.1)', background: mesFilter === m ? 'rgba(32,126,131,0.2)' : 'rgba(255,255,255,0.04)', color: mesFilter === m ? '#2BB4BB' : '#8B97A8', fontSize: '0.78rem', cursor: 'pointer' }}>
              {MESES[m - 1]}
            </button>
          ))}
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#8B97A8' }}>Cargando asientos...</div>
        ) : fetchError ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ color: '#EF4444', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Error al cargar los datos. El servidor puede estar ocupado.
            </div>
            <button onClick={() => setRetryCount(c => c + 1)}
              style={{ padding: '0.45rem 1.25rem', background: 'rgba(32,126,131,0.15)', border: '1px solid rgba(32,126,131,0.3)', borderRadius: '0.5rem', color: '#2BB4BB', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
              ↻ Reintentar
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#8B97A8', fontSize: '0.85rem' }}>
            Sin asientos para esta cuenta en {year}. Ejecuta una sincronización para cargar los movimientos.
          </div>
        ) : (
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
                  <th>Documento</th>
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
                      <td style={{ color: t.Debito > 0 ? '#10B981' : '#8B97A8' }}>{t.Debito > 0 ? fmt(t.Debito) : '—'}</td>
                      <td style={{ color: t.Credito > 0 ? '#EF4444' : '#8B97A8' }}>{t.Credito > 0 ? fmt(t.Credito) : '—'}</td>
                      <td style={{ fontWeight: 600, color: neto < 0 ? '#EF4444' : '#10B981' }}>{fmt(neto)}</td>
                      <td>
                        {t.NroD ? (
                          <button onClick={() => setDocPreview(String(t.NroD))}
                            title={String(t.NroD)}
                            style={{ padding: '0.15rem 0.55rem', borderRadius: '0.75rem', border: '1px solid rgba(43,180,187,0.35)', background: 'rgba(43,180,187,0.08)', color: '#2BB4BB', fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                            🔗 {String(t.NroD).slice(-8)}
                          </button>
                        ) : <span style={{ color: '#4B5563', fontSize: '0.7rem' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={4}>TOTAL</td>
                  <td>{fmt(totalDeb)}</td>
                  <td>{fmt(totalCred)}</td>
                  <td style={{ color: (totalDeb - totalCred) < 0 ? '#EF4444' : '#10B981' }}>{fmt(totalDeb - totalCred)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {docPreview !== null && (
          <DocPreview companyId={companyId} nroD={docPreview} onClose={() => setDocPreview(null)} />
        )}
      </div>
    </div>
  );
}

function CxCTransactionModal({ companyId, year, cliente, codCliente, onClose }: {
  companyId: string; year: number; cliente: string; codCliente: string; onClose: () => void;
}) {
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [anioFilter, setAnioFilter] = useState<number | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const params = new URLSearchParams({ year: String(year), codTercero: String(codCliente) });
    fetch(`${API}/kpi/${companyId}/cxc-transactions?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setTxns(d.transactions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId, year, codCliente]);

  const aniosPresentes = Array.from(new Set(txns.map((t: any) => t.Anio as number))).sort((a, b) => b - a);
  const filtered = anioFilter ? txns.filter((t: any) => t.Anio === anioFilter) : txns;
  const totalDeb = filtered.reduce((s: number, t: any) => s + (t.Debito || 0), 0);
  const totalCred = filtered.reduce((s: number, t: any) => s + (t.Credito || 0), 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div style={{ background: '#0D1A2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', maxWidth: '95vw', width: 960, maxHeight: '85vh', overflow: 'auto', padding: '1.5rem' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#F8FAFC' }}>{cliente}</div>
            <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginTop: '0.2rem' }}>Movimientos clase 12 (CxC) · {filtered.length} asientos</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#8B97A8' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => setAnioFilter(null)}
            style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', border: anioFilter === null ? '1px solid rgba(32,126,131,0.5)' : '1px solid rgba(255,255,255,0.1)', background: anioFilter === null ? 'rgba(32,126,131,0.2)' : 'rgba(255,255,255,0.04)', color: anioFilter === null ? '#2BB4BB' : '#8B97A8', fontSize: '0.78rem', cursor: 'pointer' }}>
            Todos
          </button>
          {aniosPresentes.map(a => (
            <button key={a} onClick={() => setAnioFilter(a)}
              style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', border: anioFilter === a ? '1px solid rgba(32,126,131,0.5)' : '1px solid rgba(255,255,255,0.1)', background: anioFilter === a ? 'rgba(32,126,131,0.2)' : 'rgba(255,255,255,0.04)', color: anioFilter === a ? '#2BB4BB' : '#8B97A8', fontSize: '0.78rem', cursor: 'pointer' }}>
              {a}
            </button>
          ))}
        </div>
        {loading ? <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>Cargando...</div> : (
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
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#2BB4BB' }}>{t.CodCuenta}</td>
                      <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.Glosa}>{t.Glosa || '—'}</td>
                      <td style={{ color: t.Debito > 0 ? '#10B981' : '#8B97A8' }}>{t.Debito > 0 ? fmt(t.Debito) : '—'}</td>
                      <td style={{ color: t.Credito > 0 ? '#EF4444' : '#8B97A8' }}>{t.Credito > 0 ? fmt(t.Credito) : '—'}</td>
                      <td style={{ fontWeight: 600, color: neto < 0 ? '#EF4444' : '#10B981' }}>{fmt(neto)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={4}>TOTAL</td>
                  <td>{fmt(totalDeb)}</td>
                  <td>{fmt(totalCred)}</td>
                  <td style={{ color: (totalDeb - totalCred) < 0 ? '#EF4444' : '#10B981' }}>{fmt(totalDeb - totalCred)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CxPTransactionModal({ companyId, year, proveedor, codProveedor, onClose }: {
  companyId: string; year: number; proveedor: string; codProveedor: string; onClose: () => void;
}) {
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [anioFilter, setAnioFilter] = useState<number | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const params = new URLSearchParams({ year: String(year), codTercero: String(codProveedor) });
    fetch(`${API}/kpi/${companyId}/cxp-transactions?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setTxns(d.transactions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId, year, codProveedor]);

  const aniosPresentes = Array.from(new Set(txns.map((t: any) => t.Anio as number))).sort((a, b) => b - a);
  const filtered = anioFilter ? txns.filter((t: any) => t.Anio === anioFilter) : txns;
  const totalDeb = filtered.reduce((s: number, t: any) => s + (t.Debito || 0), 0);
  const totalCred = filtered.reduce((s: number, t: any) => s + (t.Credito || 0), 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div style={{ background: '#0D1A2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', maxWidth: '95vw', width: 960, maxHeight: '85vh', overflow: 'auto', padding: '1.5rem' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#F8FAFC' }}>{proveedor}</div>
            <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginTop: '0.2rem' }}>Movimientos clase 42 (CxP) · {filtered.length} asientos</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#8B97A8' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => setAnioFilter(null)}
            style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', border: anioFilter === null ? '1px solid rgba(32,126,131,0.5)' : '1px solid rgba(255,255,255,0.1)', background: anioFilter === null ? 'rgba(32,126,131,0.2)' : 'rgba(255,255,255,0.04)', color: anioFilter === null ? '#2BB4BB' : '#8B97A8', fontSize: '0.78rem', cursor: 'pointer' }}>
            Todos
          </button>
          {aniosPresentes.map(a => (
            <button key={a} onClick={() => setAnioFilter(a)}
              style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', border: anioFilter === a ? '1px solid rgba(32,126,131,0.5)' : '1px solid rgba(255,255,255,0.1)', background: anioFilter === a ? 'rgba(32,126,131,0.2)' : 'rgba(255,255,255,0.04)', color: anioFilter === a ? '#2BB4BB' : '#8B97A8', fontSize: '0.78rem', cursor: 'pointer' }}>
              {a}
            </button>
          ))}
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>📭</div>
            <div>Sin asientos disponibles. Ejecuta una sincronización completa para cargar los movimientos de CxP.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-s10" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th>Fecha</th><th>Nro. Asiento</th><th>Cuenta</th>
                  <th style={{ minWidth: 260 }}>Glosa</th>
                  <th>Débito</th><th>Crédito</th><th>Neto</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t: any, i: number) => {
                  const neto = (t.Credito || 0) - (t.Debito || 0);
                  return (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap' }}>{t.Fecha}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{t.NroAsiento}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#2BB4BB' }}>{t.CodCuenta}</td>
                      <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.Glosa}>{t.Glosa || '—'}</td>
                      <td style={{ color: t.Debito > 0 ? '#10B981' : '#8B97A8' }}>{t.Debito > 0 ? fmt(t.Debito) : '—'}</td>
                      <td style={{ color: t.Credito > 0 ? '#EF4444' : '#8B97A8' }}>{t.Credito > 0 ? fmt(t.Credito) : '—'}</td>
                      <td style={{ fontWeight: 600, color: neto > 0 ? '#EF4444' : '#10B981' }}>{fmt(Math.abs(neto))}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={4}>TOTAL</td>
                  <td>{fmt(totalDeb)}</td>
                  <td>{fmt(totalCred)}</td>
                  <td style={{ color: (totalCred - totalDeb) > 0 ? '#EF4444' : '#10B981' }}>{fmt(Math.abs(totalCred - totalDeb))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function GavCategoryModal({ companyId, year, cat, onClose }: {
  companyId: string; year: number;
  cat: { cod: string; descripcion: string; meses: Record<number, number>; ytd: number };
  onClose: () => void;
}) {
  const [txDrill, setTxDrill] = useState(false);
  const mesesConDatos = Object.entries(cat.meses)
    .filter(([, v]) => (v as number) !== 0)
    .map(([k]) => parseInt(k))
    .sort((a, b) => a - b);
  const chartData = mesesConDatos.map(m => ({ mes: MESES[m - 1], value: cat.meses[m] || 0 }));

  if (txDrill) {
    return <TransactionModal companyId={companyId} year={year} codCuenta={cat.cod} descripcion={cat.descripcion} onClose={() => setTxDrill(false)} />;
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div style={{ background: '#0D1A2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', maxWidth: '95vw', width: 720, maxHeight: '85vh', overflow: 'auto', padding: '1.5rem' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#F8FAFC' }}>{cat.cod} — {cat.descripcion}</div>
            <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginTop: '0.2rem' }}>GAV mensual · YTD: {fmt(cat.ytd)}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#8B97A8' }}>✕</button>
        </div>
        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#8B97A8' }} />
              <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: '#8B97A8' }} />
              <Tooltip formatter={(v: number) => [fmt(v), 'GAV']} />
              <Bar dataKey="value" fill="#207E83" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <table className="table-s10" style={{ marginTop: '1rem' }}>
          <thead>
            <tr><th>Mes</th><th>Importe</th><th>% YTD</th></tr>
          </thead>
          <tbody>
            {mesesConDatos.map(m => (
              <tr key={m}>
                <td>{MESES[m - 1]}</td>
                <td>{fmt(cat.meses[m] || 0)}</td>
                <td style={{ color: '#8B97A8' }}>{cat.ytd > 0 ? pct(((cat.meses[m] || 0) / cat.ytd) * 100) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total-row"><td>TOTAL YTD</td><td>{fmt(cat.ytd)}</td><td>100%</td></tr>
          </tfoot>
        </table>
        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
          <button onClick={() => setTxDrill(true)}
            style={{ padding: '0.45rem 1rem', background: 'rgba(32,126,131,0.15)', border: '1px solid rgba(32,126,131,0.3)', borderRadius: '0.5rem', color: '#2BB4BB', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
            Ver asientos individuales ▶
          </button>
        </div>
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
      <div style={{ background: '#0D1A2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto', padding: '1.5rem', minWidth: 600 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#F8FAFC' }}>Detalle: {title}</div>
            <div style={{ fontSize: '0.75rem', color: '#8B97A8', marginTop: '0.2rem' }}>Click en una cuenta para ver los asientos individuales</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#8B97A8' }}>✕</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table-s10" style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th style={{ minWidth: 60 }}>Cuenta</th>
                <th style={{ minWidth: 200 }}>Descripción</th>
                {activeMeses.map(m => <th key={m}>{MESES[m - 1]}</th>)}
                <th style={{ background: 'rgba(32,126,131,0.2)' }}>YTD</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.codCuenta} style={{ cursor: 'pointer' }}
                  onClick={() => setTxDrill({ codCuenta: r.codCuenta, descripcion: r.descripcion })}
                  title="Ver asientos individuales">
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#2BB4BB' }}>{r.codCuenta}</td>
                  <td style={{ color: '#2BB4BB' }}>{r.descripcion} <span style={{ fontSize: '0.65rem' }}>▶</span></td>
                  {activeMeses.map(m => (
                    <td key={m} style={{ color: (r.meses[m] || 0) < 0 ? '#EF4444' : undefined }}>
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
    if (type === 'total') return value >= 0 ? '#10B981' : '#EF4444';
    if (type === 'expense') return '#EF4444';
    return '#207E83';
  };

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
  const color = delta >= 0 ? '#10B981' : '#EF4444';
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
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'done' | 'unavailable' | 'error'>('idle');
  const [syncMsg, setSyncMsg] = useState('');
  const [pl, setPL] = useState<any>(null);
  const [cxc, setCxC] = useState<any>(null);
  const [caja, setCaja] = useState<any>(null);
  const [gav, setGAV] = useState<any>(null);
  const [consolidado, setConsolidado] = useState<any>(null);
  const [scorecard, setScorecard] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'pl' | 'cxc' | 'cxp' | 'caja' | 'gav' | 'docs' | 'admin' | 'balance' | 'otras_cxc' | 'otras_cxp' | 'prestamos' | 'tributos' | 'laboral' | 'activo_fijo' | 'tesoreria' | 'patrimonio' | 'inventarios' | 'gastos_nat' | 'caja_saldos' | 'audit'>('pl');
  const [userRole, setUserRole] = useState<string>('viewer');
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
  const [gavDrill, setGavDrill] = useState<{ cod: string; descripcion: string; meses: Record<number, number>; ytd: number } | null>(null);
  const [cxcSearch, setCxcSearch] = useState('');
  const [cxpSearch, setCxpSearch] = useState('');
  const [cxcSort, setCxcSort] = useState<SortState>({ col: 'saldoTotal', dir: 'desc' });
  const [cxpSort, setCxpSort] = useState<SortState>({ col: 'saldoTotal', dir: 'desc' });
  const [gavSort, setGavSort] = useState<SortState>({ col: 'ytd', dir: 'desc' });
  const [docs, setDocs] = useState<{ emitidas: any[]; recibidas: any[]; honorarios: any[] } | null>(null);
  const [docsTab, setDocsTab] = useState<'emitidas' | 'recibidas' | 'honorarios'>('emitidas');
  const [docsSearch, setDocsSearch] = useState('');
  const [docsOnlySinAsiento, setDocsOnlySinAsiento] = useState(false);
  const [docsOnlyDuplicados, setDocsOnlyDuplicados] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  // ── Nuevos módulos (lazy-loaded al seleccionar el tab) ──
  const [balanceData, setBalanceData] = useState<any>(null);
  const [otrasCxCData, setOtrasCxCData] = useState<any>(null);
  const [otrasCxPData, setOtrasCxPData] = useState<any>(null);
  const [prestamosData, setPrestamosData] = useState<{ otorgados: any; recibidos: any } | null>(null);
  const [tributosData, setTributosData] = useState<any>(null);
  const [laboralData, setLaboralData] = useState<any>(null);
  const [activoFijoData, setActivoFijoData] = useState<any>(null);
  const [gastosNatData, setGastosNatData] = useState<any>(null);
  const [cajaSaldosData, setCajaSaldosData] = useState<any>(null);
  const [auditData, setAuditData] = useState<any>(null);
  const [tesoreriaData, setTesoreriaData] = useState<any>(null);
  const [patrimonioData, setPatrimonioData] = useState<any>(null);
  const [inventariosData, setInventariosData] = useState<any>(null);
  const [newTabLoading, setNewTabLoading] = useState(false);
  // Cache key: tabName → `${companyId}:${year}` (year-dependent) or `${companyId}` (static)
  const loadedRef = useRef<Record<string, string>>({});

  const isGrupo = selectedCompany.codEmpresa === 'GRUPO';

  useEffect(() => {
    const info = localStorage.getItem('userInfo');
    if (info) {
      try {
        const parsed = JSON.parse(info);
        setUserRole(parsed.role ?? 'viewer');
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

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    loadedRef.current = {};
    setLoading(true);
    setPL(null); setCxC(null); setCxP(null); setCaja(null); setGAV(null); setConsolidado(null); setScorecard(null);
    setBalanceData(null); setOtrasCxCData(null); setOtrasCxPData(null); setPrestamosData(null);
    setTributosData(null); setLaboralData(null); setActivoFijoData(null); setGastosNatData(null);
    setCajaSaldosData(null); setAuditData(null); setTesoreriaData(null); setPatrimonioData(null); setInventariosData(null);

    if (isGrupo) {
      Promise.all([
        fetchApi(`/kpi/consolidado?year=${selectedYear}`, token),
        fetchApi(`/kpi/scorecard?year=${selectedYear}`, token),
        fetchApi(`/kpi/${COMPANIES[0].codEmpresa}/cxc`, token),
      ])
        .then(([conData, scData, cxcData]) => {
          setConsolidado(conData?.ytd ? conData : null);
          setScorecard(scData?.companies ? scData : null);
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

  // ── Lazy load nuevos módulos ──────────────────
  useEffect(() => {
    const NEW_TABS = ['balance','otras_cxc','otras_cxp','prestamos','tributos','laboral','activo_fijo','tesoreria','patrimonio','inventarios','gastos_nat','caja_saldos','audit'];
    if (!NEW_TABS.includes(activeTab) || isGrupo) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    const id = selectedCompany.codEmpresa;

    // Year-dependent tabs: cache key includes year; static tabs: cache key is company only
    const yearDependent = new Set(['gastos_nat','audit','tesoreria','inventarios','tributos']);
    const cacheKey = yearDependent.has(activeTab) ? `${id}:${selectedYear}` : id;
    if (loadedRef.current[activeTab] === cacheKey) return;

    setNewTabLoading(true);
    const done = (setter: () => void) => { setter(); loadedRef.current[activeTab] = cacheKey; setNewTabLoading(false); };

    if (activeTab === 'balance') {
      fetchApi(`/kpi/${id}/balance`, token)
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
    } else if (activeTab === 'audit') {
      Promise.all([
        fetchApi(`/kpi/${id}/audit/sin-doc?year=${selectedYear}`, token),
        fetchApi(`/kpi/${id}/audit/descuadres?year=${selectedYear}`, token),
        fetchApi(`/kpi/${id}/audit/atipicos?year=${selectedYear}`, token),
        fetchApi(`/kpi/${id}/audit/conciliacion?year=${selectedYear}`, token),
      ]).then(([sd, desc, at, conc]) => done(() => setAuditData({ sinDoc: sd, descuadres: desc, atipicos: at, conciliacion: conc })))
        .catch(() => done(() => setAuditData({})));
    }
  }, [activeTab, selectedCompany, selectedYear, isGrupo]);

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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#050a12' }}>
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

      {/* ── Sidebar ── */}
      <div className="sidebar">
        <div className="sidebar-inner">

        {/* Logo */}
        <div style={{ padding: '1.25rem 1rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #207E83, #2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 900, color: '#fff', flexShrink: 0, boxShadow: '0 0 0 2px rgba(255,255,255,0.08), 0 8px 20px rgba(32,126,131,0.3)' }}>S</div>
            <div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '0.95rem', color: '#F8FAFC', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                S10 <span style={{ color: '#2BB4BB' }}>BizSmartHub</span>
              </div>
              <div style={{ fontSize: '0.52rem', color: '#8B97A8', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '0.1rem' }}>Dashboard Financiero</div>
            </div>
          </div>
          {/* Sync badge */}
          <div className={`sync-badge${syncStatus === 'error' || syncStatus === 'unavailable' ? ' offline' : ''}`} style={{ width: '100%', justifyContent: 'center' }}>
            {syncStatus === 'running'     ? '⏳ Sincronizando...'
           : syncStatus === 'done'        ? '✓ Datos actualizados'
           : syncStatus === 'error'       ? '✗ Error de sync'
           : syncStatus === 'unavailable' ? '⚠ Sync manual'
           : '● Sistema online'}
          </div>
        </div>

        {/* Empresa section */}
        <div style={{ padding: '0.75rem 0.625rem 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="sidebar-section-label">Empresa</div>
          <button
            onClick={() => { setSelectedCompany(GRUPO); setActiveTab('pl'); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: isGrupo ? 'linear-gradient(135deg, #2563EB, #4F46E5)' : 'none',
              border: 'none',
              borderRadius: '0.625rem',
              color: isGrupo ? '#fff' : '#8B97A8',
              padding: '0.5rem 0.875rem', marginBottom: '0.2rem',
              cursor: 'pointer', fontSize: '0.8rem', fontWeight: isGrupo ? 600 : 400,
              boxShadow: isGrupo ? '0 0 15px rgba(79,70,229,0.3)' : 'none',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            🏢 GRUPO Consolidado
          </button>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '0.25rem 0.5rem' }} />
          {COMPANIES.map((co) => {
            const active = !isGrupo && selectedCompany.codEmpresa === co.codEmpresa;
            return (
              <button key={co.codEmpresa}
                onClick={() => { setSelectedCompany(co); setActiveTab('pl'); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: active ? 'linear-gradient(135deg, #2563EB, #4F46E5)' : 'none',
                  border: 'none',
                  borderRadius: '0.625rem',
                  color: active ? '#fff' : '#8B97A8',
                  padding: '0.4rem 0.875rem', marginBottom: '0.1rem',
                  cursor: 'pointer', fontSize: '0.8rem', fontWeight: active ? 600 : 400,
                  boxShadow: active ? '0 0 12px rgba(79,70,229,0.3)' : 'none',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {co.shortName}
              </button>
            );
          })}
        </div>

        {/* Año section */}
        <div style={{ padding: '0.625rem 0.625rem 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="sidebar-section-label">Período</div>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            {availableYears.map((y) => (
              <button key={y} onClick={() => setSelectedYear(y)}
                style={{
                  flex: 1,
                  background: selectedYear === y ? 'linear-gradient(135deg, #2563EB, #4F46E5)' : 'rgba(255,255,255,0.03)',
                  border: '1px solid ' + (selectedYear === y ? 'transparent' : 'rgba(255,255,255,0.05)'),
                  borderRadius: '0.5rem',
                  color: selectedYear === y ? '#fff' : '#8B97A8',
                  padding: '0.35rem 0',
                  cursor: 'pointer', fontSize: '0.75rem', fontWeight: selectedYear === y ? 700 : 400,
                  boxShadow: selectedYear === y ? '0 0 10px rgba(79,70,229,0.25)' : 'none',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Sincronizar */}
        <div style={{ padding: '0.75rem 0.75rem 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            disabled={syncStatus === 'running'}
            onClick={async () => {
              const token = localStorage.getItem('token');
              if (!token) return;
              setSyncStatus('running');
              setSyncMsg('Iniciando sincronización...');
              try {
                const res = await fetch(`${API}/sync/trigger?years=${CURRENT_YEAR},${CURRENT_YEAR - 1}`, {
                  method: 'POST', headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.status === 'unavailable') {
                  setSyncStatus('unavailable');
                  setSyncMsg(data.message || 'Servicio no disponible');
                  setTimeout(() => { setSyncStatus('idle'); setSyncMsg(''); }, 10000);
                  return;
                }
                if (data.status === 'busy') {
                  setSyncMsg('Ya hay un sync en progreso...');
                } else {
                  setSyncMsg('Conectando a S10 vía VPN...');
                }
                // Poll status hasta que termine
                const poll = setInterval(async () => {
                  try {
                    const st = await fetch(`${API}/sync/status`, { headers: { Authorization: `Bearer ${token}` } });
                    const s = await st.json();
                    if (!s.running) {
                      clearInterval(poll);
                      setSyncStatus('done');
                      setSyncMsg('');
                      setTimeout(() => setSyncStatus('idle'), 8000);
                    }
                  } catch { clearInterval(poll); setSyncStatus('idle'); setSyncMsg(''); }
                }, 8000);
                // Safety timeout 10 min
                setTimeout(() => { clearInterval(poll); setSyncStatus('idle'); setSyncMsg(''); }, 600000);
              } catch {
                setSyncStatus('error');
                setSyncMsg('No se pudo conectar al servidor.');
                setTimeout(() => { setSyncStatus('idle'); setSyncMsg(''); }, 6000);
              }
            }}
            style={{
              width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.625rem',
              border: '1px solid rgba(32,126,131,0.25)',
              background: syncStatus === 'running'     ? 'rgba(245,158,11,0.1)'
                        : syncStatus === 'done'        ? 'rgba(16,185,129,0.15)'
                        : syncStatus === 'unavailable' ? 'rgba(239,68,68,0.1)'
                        : syncStatus === 'error'       ? 'rgba(239,68,68,0.15)'
                        : 'rgba(32,126,131,0.1)',
              color: syncStatus === 'done'        ? '#10B981'
                   : syncStatus === 'error'       ? '#EF4444'
                   : syncStatus === 'unavailable' ? '#F59E0B'
                   : syncStatus === 'running'     ? '#F59E0B'
                   : '#2BB4BB',
              fontSize: '0.78rem', fontWeight: 700, cursor: syncStatus === 'running' ? 'default' : 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'all 0.2s',
            }}
          >
            {syncStatus === 'running'     ? '⏳ Sincronizando...'
           : syncStatus === 'done'        ? '✓ Datos actualizados'
           : syncStatus === 'error'       ? '✗ Error — reintentar'
           : syncStatus === 'unavailable' ? '⚠ No disponible'
           : '↻ Sincronizar datos'}
          </button>
          {syncMsg && (
            <div style={{ fontSize: '0.65rem', color: syncStatus === 'unavailable' ? '#F59E0B' : '#8B97A8', marginTop: '0.4rem', lineHeight: 1.4, padding: '0 0.1rem' }}>
              {syncMsg}
            </div>
          )}
        </div>

        {/* Nav principal */}
        <nav style={{ flex: 1, padding: '0.5rem 0', overflow: 'auto' }}>
          <div className="sidebar-section-label">Paneles</div>
          {(['pl', 'cxc', 'cxp', 'caja', 'gav', 'docs'] as const).map((tab) => (
            <button key={tab}
              onClick={() => setActiveTab(tab)}
              className={`sidebar-link ${activeTab === tab ? 'active' : ''}`}
              style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
            >
              {tab === 'pl'   && '📊  P&L'}
              {tab === 'cxc'  && '💰  CxC Aging'}
              {tab === 'cxp'  && '🏪  CxP Aging'}
              {tab === 'caja' && '🏦  Posición Caja'}
              {tab === 'gav'  && '📋  GAV Detalle'}
              {tab === 'docs' && '🧾  Documentos'}
            </button>
          ))}
          {!isGrupo && (
            <>
              <div className="sidebar-section-label" style={{ marginTop: '0.75rem' }}>Balance Sheet</div>
              {(['balance','otras_cxc','otras_cxp','prestamos','tributos','laboral','activo_fijo','tesoreria','patrimonio','inventarios','caja_saldos','gastos_nat'] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`sidebar-link ${activeTab === tab ? 'active' : ''}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                  {tab === 'balance'    && '⚖️  Balance General'}
                  {tab === 'otras_cxc' && '📌  Otras CxC'}
                  {tab === 'otras_cxp' && '📋  Otras CxP'}
                  {tab === 'prestamos' && '💳  Préstamos'}
                  {tab === 'tributos'  && '🏛️  Tributos'}
                  {tab === 'laboral'   && '👷  Laboral'}
                  {tab === 'activo_fijo' && '🏗️  Activo Fijo'}
                  {tab === 'tesoreria'   && '🏦  Tesorería'}
                  {tab === 'patrimonio'  && '🏛️  Patrimonio'}
                  {tab === 'inventarios' && '📦  Inventarios'}
                  {tab === 'caja_saldos' && '🏦  Saldos Banco'}
                  {tab === 'gastos_nat'  && '📊  Gastos Naturaleza'}
                </button>
              ))}
              <div className="sidebar-section-label" style={{ marginTop: '0.75rem' }}>Auditoría</div>
              <button onClick={() => setActiveTab('audit')}
                className={`sidebar-link ${activeTab === 'audit' ? 'active' : ''}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                🔍  Módulo Auditoría
              </button>
            </>
          )}
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
                style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
              >
                ⚙  Administración
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
      <div className="main-content" style={{ width: 'calc(100% - 272px)', position: 'relative' }}>
        {/* Decorative background blurs */}
        <div className="bg-blur-primary" />
        <div className="bg-blur-indigo" />
        <div style={{ position: 'relative', zIndex: 1 }}>
        {/* ── Sync running banner ── */}
        {syncStatus === 'running' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#F59E0B' }}>
            <span style={{ fontSize: '1rem', animation: 'spin 2s linear infinite' }}>⟳</span>
            <span style={{ fontWeight: 600 }}>Sincronización en progreso</span>
            <span style={{ color: '#8B97A8', fontSize: '0.75rem' }}>Los datos se actualizarán al completar. Puedes seguir navegando.</span>
          </div>
        )}
        <div style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="page-section-label">
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
              {activeTab === 'audit'      && 'Control Interno'}
            </div>
            <h1 className="page-title">
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
              {activeTab === 'audit'      && 'Módulo de Auditoría'}
            </h1>
            <div style={{ color: '#8B97A8', fontSize: '0.8rem', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span>{selectedCompany.fullName}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>YTD {selectedYear}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>Fuente: S10 ERP</span>
              {prevYear && <><span style={{ opacity: 0.4 }}>·</span><span>vs {prevYear.year}</span></>}
              {lastSync && (
                <>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span style={{ color: '#10B981', fontWeight: 600 }}>
                    ● Datos al {new Date(lastSync).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </>
              )}
            </div>
          </div>
          {loading && (
            <div style={{ padding: '0.4rem 0.875rem', background: 'rgba(32,126,131,0.1)', border: '1px solid rgba(32,126,131,0.2)', borderRadius: '2rem', fontSize: '0.72rem', color: '#2BB4BB', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>
              ⏳ Cargando...
            </div>
          )}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontWeight: 700, color: '#F8FAFC' }}>Aging por Cliente</div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <SearchInput value={cxcSearch} onChange={setCxcSearch} placeholder="Buscar cliente..." />
                  <ExportBtn onClick={() => {
                    const headers = ['Cliente', '0-30 días', '31-60 días', '61-90 días', '+90 días', 'Total', '% Cartera'];
                    const rows = sortRows(cxc.clientes, cxcSort.col, cxcSort.dir).map((c: any) => [
                      c.cliente, c.dias0_30, c.dias31_60, c.dias61_90, c.dias90mas, c.saldoTotal,
                      cxc.totalSaldo > 0 ? `${((c.saldoTotal / cxc.totalSaldo) * 100).toFixed(1)}%` : '',
                    ]);
                    exportCSV(`CxC_${selectedCompany.shortName}.csv`, headers, rows);
                  }} />
                </div>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#8B97A8', marginBottom: '0.75rem' }}>Click en un cliente para ver los asientos individuales · Ordenar por columna</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table-s10">
                  <thead>
                    <tr>
                      <SortTh label="Cliente" col="cliente" sort={cxcSort} onSort={c => setCxcSort(toggleSort(cxcSort, c))} />
                      <SortTh label="0-30 días" col="dias0_30" sort={cxcSort} onSort={c => setCxcSort(toggleSort(cxcSort, c))} />
                      <SortTh label="31-60 días" col="dias31_60" sort={cxcSort} onSort={c => setCxcSort(toggleSort(cxcSort, c))} />
                      <SortTh label="61-90 días" col="dias61_90" sort={cxcSort} onSort={c => setCxcSort(toggleSort(cxcSort, c))} />
                      <SortTh label="+90 días" col="dias90mas" sort={cxcSort} onSort={c => setCxcSort(toggleSort(cxcSort, c))} />
                      <SortTh label="Total" col="saldoTotal" sort={cxcSort} onSort={c => setCxcSort(toggleSort(cxcSort, c))} />
                      <th>% Cartera</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortRows(cxc.clientes, cxcSort.col, cxcSort.dir)
                      .filter((c: any) => !cxcSearch || c.cliente?.toLowerCase().includes(cxcSearch.toLowerCase()))
                      .map((c: any) => (
                      <tr key={c.codCliente} data-clickable="1"
                        onClick={() => setCxCTxDrill({ cliente: c.cliente, codCliente: String(c.codCliente) })}
                        title="Ver asientos individuales">
                        <td style={{ color: '#2BB4BB' }}>{c.cliente} <span style={{ fontSize: '0.65rem' }}>▶</span></td>
                        <td>{fmt(c.dias0_30)}</td>
                        <td>{fmt(c.dias31_60)}</td>
                        <td>{fmt(c.dias61_90)}</td>
                        <td className={c.dias90mas > 0 ? 'negative' : ''}>{fmt(c.dias90mas)}</td>
                        <td style={{ fontWeight: 600 }}>{fmt(c.saldoTotal)}</td>
                        <td style={{ color: '#8B97A8' }}>{cxc.totalSaldo > 0 ? pct((c.saldoTotal / cxc.totalSaldo) * 100) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="total-row">
                      <td>TOTAL ({cxc.clientes?.length} clientes)</td>
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
          <div style={{ textAlign: 'center', padding: '3rem', color: '#8B97A8' }}>
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
          // NC amounts stored positive in S10 — must subtract to get net
          const ncSign = (d: any) => d.EsNotaCredito ? -1 : 1;
          const totalMonto = filtrada.reduce((s: number, d: any) => s + ncSign(d) * (d.Total || 0), 0);
          const totalNeto  = filtrada.reduce((s: number, d: any) => s + ncSign(d) * (d.TotalNeto || 0), 0);
          const totalSaldo = docsTab === 'emitidas'
            ? filtrada.reduce((s: number, d: any) => s + ncSign(d) * (d.Saldo || 0), 0)
            : filtrada.reduce((s: number, d: any) => s + ncSign(d) * (d.TotalSaldo || 0), 0);
          const ncCount = filtrada.filter((d: any) => d.EsNotaCredito).length;
          return (
            <div>
              {/* Sub-tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {(['emitidas', 'recibidas', 'honorarios'] as const).map((t) => (
                  <button key={t} onClick={() => { setDocsTab(t); setDocsSearch(''); setDocsOnlySinAsiento(false); setDocsOnlyDuplicados(false); }}
                    style={{ padding: '0.4rem 1.2rem', borderRadius: '0.375rem', border: '1px solid',
                      borderColor: docsTab === t ? 'rgba(32,126,131,0.5)' : 'rgba(255,255,255,0.1)',
                      background: docsTab === t ? 'rgba(32,126,131,0.2)' : 'rgba(255,255,255,0.04)',
                      color: docsTab === t ? '#2BB4BB' : '#8B97A8',
                      fontWeight: docsTab === t ? 700 : 400, fontSize: '0.85rem', cursor: 'pointer' }}>
                    {t === 'emitidas' ? `Facturas Emitidas (${docs.emitidas.length})` : t === 'recibidas' ? `Facturas Recibidas (${docs.recibidas.length})` : `Honorarios (${docs.honorarios.length})`}
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
                      {docsTab === 'emitidas' ? 'Facturas emitidas a clientes' : docsTab === 'recibidas' ? 'Facturas y boletas recibidas' : 'Recibos por Honorarios Profesionales'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#8B97A8', marginTop: '0.2rem' }}>
                      {filtrada.length - ncCount} docs{ncCount > 0 ? ` · ${ncCount} NC (restadas)` : ''} · Neto {fmt(totalNeto)} · Total c/IGV {fmt(totalMonto)} · Pendiente {fmt(totalSaldo)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder={docsTab === 'emitidas' ? 'Buscar cliente o número...' : 'Buscar proveedor o número...'}
                      value={docsSearch}
                      onChange={e => setDocsSearch(e.target.value)}
                      style={{ padding: '0.4rem 0.75rem', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '0.375rem', fontSize: '0.82rem', minWidth: 200, background: 'rgba(255,255,255,0.04)', color: '#F8FAFC', outline: 'none' }}
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
        {/* ═══ Loading banner para nuevos módulos ═══ */}
        {newTabLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '2rem', color: '#8B97A8' }}>
            <span style={{ fontSize: '1.2rem', animation: 'spin 1.5s linear infinite' }}>⟳</span>
            Cargando datos...
          </div>
        )}

        {/* ═══ Balance General ═══ */}
        {activeTab === 'balance' && !newTabLoading && (
          <div className="kpi-card">
            {!balanceData?.rows?.length ? <NoDataBanner kpi="Balance General" /> : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.82rem', color: '#8B97A8' }}>{balanceData.rows.length} cuentas con saldo · Acumulado histórico</div>
                  <ExportBtn onClick={() => exportCSV('balance.csv',
                    ['CodCuenta','DesCuenta','Clase','SaldoNeto'],
                    balanceData.rows.map((r: any) => [r.CodCuenta, r.DesCuenta, r.Clase, r.SaldoNeto]))} />
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-s10" style={{ fontSize: '0.8rem' }}>
                    <thead><tr><th>Cuenta</th><th style={{ minWidth: 280 }}>Descripción</th><th>Clase</th><th>Saldo Neto</th></tr></thead>
                    <tbody>
                      {balanceData.rows.map((r: any, i: number) => (
                        <tr key={i}>
                          <td style={{ fontFamily: 'monospace', color: '#2BB4BB' }}>{r.CodCuenta}</td>
                          <td>{r.DesCuenta}</td>
                          <td style={{ color: '#8B97A8' }}>{r.Clase}</td>
                          <td style={{ fontWeight: 600, color: (r.SaldoNeto || 0) < 0 ? '#EF4444' : '#10B981' }}>{fmt(r.SaldoNeto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
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
                    <thead><tr><th>Cuenta</th><th>Tercero</th><th>0–30 días</th><th>31–60</th><th>61–90</th><th>+90 días</th><th>Total</th></tr></thead>
                    <tbody>
                      {otrasCxCData.rows.map((r: any, i: number) => (
                        <tr key={i}>
                          <td style={{ fontFamily: 'monospace', color: '#2BB4BB' }}>{r.CodCuenta}</td>
                          <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.Tercero}>{r.Tercero || '—'}</td>
                          <td style={{ color: '#10B981' }}>{fmt(r.Dias_0_30)}</td>
                          <td style={{ color: '#F59E0B' }}>{fmt(r.Dias_31_60)}</td>
                          <td style={{ color: '#F97316' }}>{fmt(r.Dias_61_90)}</td>
                          <td style={{ color: '#EF4444' }}>{fmt(r.Dias_90_mas)}</td>
                          <td style={{ fontWeight: 600 }}>{fmt(r.SaldoTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="total-row"><td colSpan={6}>TOTAL</td>
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
                    <thead><tr><th>Cuenta</th><th>Tercero</th><th>0–30 días</th><th>31–60</th><th>61–90</th><th>+90 días</th><th>Total</th></tr></thead>
                    <tbody>
                      {otrasCxPData.rows.map((r: any, i: number) => (
                        <tr key={i}>
                          <td style={{ fontFamily: 'monospace', color: '#2BB4BB' }}>{r.CodCuenta}</td>
                          <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.Tercero}>{r.Tercero || '—'}</td>
                          <td style={{ color: '#10B981' }}>{fmt(r.Dias_0_30)}</td>
                          <td style={{ color: '#F59E0B' }}>{fmt(r.Dias_31_60)}</td>
                          <td style={{ color: '#F97316' }}>{fmt(r.Dias_61_90)}</td>
                          <td style={{ color: '#EF4444' }}>{fmt(r.Dias_90_mas)}</td>
                          <td style={{ fontWeight: 600 }}>{fmt(r.SaldoTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="total-row"><td colSpan={6}>TOTAL</td>
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
                    <thead><tr><th>Tipo Doc</th><th>Serie/Número</th><th>Deudor</th><th>Fecha</th><th>Vcto</th><th>Días Vcdo</th><th>Total</th><th>Saldo Pendiente</th></tr></thead>
                    <tbody>
                      {prestamosData.otorgados.rows.map((r: any, i: number) => (
                        <tr key={i}>
                          <td style={{ color: '#8B97A8' }}>{r.CodTipoDoc}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{r.SerieDocumento}-{r.NroDocumento}</td>
                          <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.Tercero}>{r.Tercero || '—'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{r.FechaDocumento}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{r.FechaVencimiento || '—'}</td>
                          <td style={{ color: (r.DiasVencido || 0) > 90 ? '#EF4444' : (r.DiasVencido || 0) > 30 ? '#F59E0B' : '#10B981' }}>{r.DiasVencido ?? '—'}</td>
                          <td>{fmt(r.Total)}</td>
                          <td style={{ fontWeight: 600, color: '#F59E0B' }}>{fmt(r.SaldoPendiente)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="total-row"><td colSpan={7}>TOTAL PENDIENTE</td>
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
                    <thead><tr><th>Tipo Doc</th><th>Serie/Número</th><th>Acreedor</th><th>Fecha</th><th>Vcto</th><th>Total</th><th>Saldo Pendiente</th></tr></thead>
                    <tbody>
                      {prestamosData.recibidos.rows.map((r: any, i: number) => (
                        <tr key={i}>
                          <td style={{ color: '#8B97A8' }}>{r.CodTipoDoc}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{r.SerieDocumento}-{r.NroDocumento}</td>
                          <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.Tercero}>{r.Tercero || '—'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{r.FechaDocumento}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{r.FechaVencimiento || '—'}</td>
                          <td>{fmt(r.Total)}</td>
                          <td style={{ fontWeight: 600, color: '#EF4444' }}>{fmt(r.SaldoPendiente)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="total-row"><td colSpan={6}>TOTAL PENDIENTE</td>
                      <td>{fmt(prestamosData.recibidos.total)}</td>
                    </tr></tfoot>
                  </table>
                </div>
              )}
            </div>
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
                        <tr key={i}>
                          <td style={{ fontFamily: 'monospace', color: '#2BB4BB' }}>{r.CodCuenta}</td>
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
                        <tr key={i}>
                          <td style={{ fontFamily: 'monospace', color: '#2BB4BB' }}>{r.CodCuenta}</td>
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
                        <tr key={i}>
                          <td style={{ fontFamily: 'monospace', color: '#2BB4BB' }}>{r.CodBanco}</td>
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
                    <thead><tr><th>Clase</th><th>Cuenta</th><th style={{ minWidth: 260 }}>Descripción</th><th>Total Débito</th><th>Total Crédito</th><th>Saldo Neto</th></tr></thead>
                    <tbody>
                      {patrimonioData.rows.map((r: any, i: number) => (
                        <tr key={i}>
                          <td style={{ fontFamily: 'monospace', color: '#8B97A8' }}>{r.Clase}</td>
                          <td style={{ fontFamily: 'monospace', color: '#2BB4BB' }}>{r.CodCuenta}</td>
                          <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.DesCuenta}</td>
                          <td style={{ color: '#8B97A8' }}>{fmt(r.TotalDebito)}</td>
                          <td style={{ color: '#8B97A8' }}>{fmt(r.TotalCredito)}</td>
                          <td style={{ fontWeight: 600, color: (r.SaldoNeto || 0) >= 0 ? '#10B981' : '#EF4444' }}>{fmt(r.SaldoNeto)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="total-row">
                      <td colSpan={5}>PATRIMONIO NETO TOTAL</td>
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
                          const k = r.CodGrupo || r.CodCuenta;
                          if (!byGrupo[k]) byGrupo[k] = { grupo: k, desc: r.DesCuenta || r.Descripcion, meses: {}, ytd: 0 };
                          byGrupo[k].meses[r.Mes] = (byGrupo[k].meses[r.Mes] || 0) + (r.Monto || 0);
                          byGrupo[k].ytd += r.Monto || 0;
                        }
                        return Object.values(byGrupo).sort((a, b) => b.ytd - a.ytd).map((g, i) => (
                          <tr key={i}>
                            <td style={{ fontFamily: 'monospace', color: '#2BB4BB' }}>{g.grupo}</td>
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
                    <thead><tr><th>Clase</th><th>Sin Doc</th><th>Total</th><th>% Sin Doc</th><th>Monto Sin Doc</th></tr></thead>
                    <tbody>
                      {auditData.sinDoc.resumen.map((r: any, i: number) => {
                        const pctSD = r.TotalAsientos > 0 ? (r.SinDocumento / r.TotalAsientos * 100) : 0;
                        return (
                          <tr key={i}>
                            <td style={{ fontFamily: 'monospace', color: '#2BB4BB' }}>{r.Clase}</td>
                            <td style={{ color: r.SinDocumento > 0 ? '#F59E0B' : '#10B981' }}>{r.SinDocumento}</td>
                            <td style={{ color: '#8B97A8' }}>{r.TotalAsientos}</td>
                            <td style={{ color: pctSD > 20 ? '#EF4444' : pctSD > 5 ? '#F59E0B' : '#10B981' }}>{pctSD.toFixed(1)}%</td>
                            <td style={{ fontWeight: 600 }}>{fmt(r.MontoSinDoc)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot><tr className="total-row">
                      <td>TOTAL</td>
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
                    <thead><tr><th>Fecha</th><th>Nro. Asiento</th><th>Débito</th><th>Crédito</th><th>Descuadre</th><th>Glosa</th></tr></thead>
                    <tbody>
                      {auditData.descuadres.rows.map((r: any, i: number) => (
                        <tr key={i}>
                          <td style={{ whiteSpace: 'nowrap' }}>{r.Fecha}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{r.NroAsientoContable}</td>
                          <td>{fmt(r.TotalDebito)}</td>
                          <td>{fmt(r.TotalCredito)}</td>
                          <td style={{ fontWeight: 700, color: '#EF4444' }}>{fmt(r.Descuadre)}</td>
                          <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.Glosa}>{r.Glosa || '—'}</td>
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
                    <thead><tr><th>Fecha</th><th>Cuenta</th><th>Glosa</th><th>Débito</th><th>Crédito</th><th>Tercero</th></tr></thead>
                    <tbody>
                      {auditData.atipicos.rows.map((r: any, i: number) => (
                        <tr key={i}>
                          <td style={{ whiteSpace: 'nowrap' }}>{r.Fecha}</td>
                          <td style={{ fontFamily: 'monospace', color: '#2BB4BB', fontSize: '0.72rem' }}>{r.CodCuenta}</td>
                          <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.Glosa}>{r.Glosa || '—'}</td>
                          <td style={{ color: r.Debito > 0 ? '#10B981' : '#8B97A8' }}>{r.Debito > 0 ? fmt(r.Debito) : '—'}</td>
                          <td style={{ color: r.Credito > 0 ? '#EF4444' : '#8B97A8' }}>{r.Credito > 0 ? fmt(r.Credito) : '—'}</td>
                          <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.Tercero || '—'}</td>
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

        </div>{/* end relative z-1 */}
      </div>
    </div>
  );
}
