'use client';
import React, { useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, BarChart, Cell,
  PieChart, Pie, Sector,
} from 'recharts';
import { fmt } from '../_lib/formatters';

// ── Helpers ────────────────────────────────────────────────────────────────

const MONTH_SHORT = ['', 'Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Set','Oct','Nov','Dic'];

const STATUS_COLOR: Record<string, string> = {
  green:  '#10B981',
  yellow: '#F59E0B',
  red:    '#EF4444',
  gray:   '#4B5563',
};

const ALERT_COLOR: Record<string, string> = {
  danger:  '#EF4444',
  warning: '#F59E0B',
  info:    '#60A5FA',
};

const INSIGHT_ICON: Record<string, string> = {
  opportunity: '🚀',
  risk:        '⚠️',
  info:        'ℹ️',
};

const SEMAFORO_DESC: Record<string, string> = {
  margenBruto:  'Ingresos menos costos directos. Mide eficiencia productiva antes de gastos fijos.',
  ebitda:       'Resultado operativo sin intereses ni depreciaciones. Refleja la rentabilidad del negocio core.',
  margenNeto:   'Porcentaje de ingresos que queda como utilidad final después de todos los gastos.',
  dso:          'Días promedio para cobrar. Menor = mejor gestión de cobranza y menor riesgo de cartera.',
  dpo:          'Días promedio para pagar. Mayor = mejor uso del crédito de proveedores como financiamiento.',
  currentRatio: 'Activo corriente / Pasivo corriente. >1.2 = empresa puede cubrir deudas de corto plazo.',
  cashRunway:   'Meses que puede operar con el efectivo actual sin nuevos ingresos. <3 meses es alerta.',
  vencidoCxC:   'Porcentaje de cartera vencida >90 días. Alto = riesgo de incobrabilidad o clientes en mora.',
};

const SEMAFORO_TAB: Record<string, string> = {
  margenBruto:  'pl',
  ebitda:       'pl',
  margenNeto:   'pl',
  dso:          'cxc',
  dpo:          'cxp',
  currentRatio: 'balance',
  cashRunway:   'tesoreria',
  vencidoCxC:   'cxc',
};

function fmtM(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `S/ ${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000)     return `S/ ${(n / 1_000).toFixed(0)}K`;
  return `S/ ${n.toFixed(0)}`;
}

function pctStr(n: number | null, decimals = 1): string {
  if (n == null) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(decimals)}%`;
}

function numStr(n: number | null, decimals = 1, suffix = ''): string {
  if (n == null) return '—';
  return `${n.toFixed(decimals)}${suffix}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SemaforoCard({ item, onNavigate }: { item: any; onNavigate?: (tab: string) => void }) {
  const color = STATUS_COLOR[item.status] ?? '#4B5563';
  const tab = SEMAFORO_TAB[item.id];
  const desc = SEMAFORO_DESC[item.id] ?? '';
  const vStr = item.value == null ? '—'
    : item.unit === '%'    ? `${item.value.toFixed(1)}%`
    : item.unit === 'días' ? `${item.value.toFixed(0)} d`
    : item.unit === 'mes'  ? `${item.value.toFixed(1)} m`
    : `${item.value.toFixed(2)}x`;
  return (
    <div
      onClick={tab && onNavigate ? () => onNavigate(tab) : undefined}
      style={{
        background: '#0d1825', border: `1px solid ${color}33`,
        borderRadius: 8, padding: '0.85rem 1rem',
        display: 'flex', flexDirection: 'column', gap: '0.2rem',
        position: 'relative', overflow: 'hidden',
        cursor: tab ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => tab && ((e.currentTarget as HTMLElement).style.borderColor = `${color}66`)}
      onMouseLeave={e => tab && ((e.currentTarget as HTMLElement).style.borderColor = `${color}33`)}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: color, borderRadius: '3px 0 0 3px' }} />
      <div style={{ paddingLeft: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '0.66rem', color: '#8B97A8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            {item.label}
          </div>
          {tab && <div style={{ fontSize: '0.6rem', color: '#4B5563' }}>ver →</div>}
        </div>
        <div style={{ fontSize: '1.45rem', fontWeight: 700, color, lineHeight: 1.2, marginTop: '0.1rem' }}>
          {vStr}
        </div>
        <div style={{ fontSize: '0.63rem', color: '#556070', marginTop: '0.1rem' }}>
          Ref: {item.benchmark}
        </div>
        {desc && (
          <div style={{ fontSize: '0.62rem', color: '#3D4F62', marginTop: '0.35rem', lineHeight: 1.4 }}>
            {desc}
          </div>
        )}
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  linkTo?: string;
  onNavigate?: (tab: string) => void;
  children: React.ReactNode;
}

function Section({ title, linkTo, onNavigate, children }: SectionProps) {
  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <div
        onClick={linkTo && onNavigate ? () => onNavigate(linkTo) : undefined}
        style={{
          fontSize: '0.7rem', fontWeight: 700, color: '#E25C1A',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          borderBottom: '1px solid rgba(226,92,26,0.2)', paddingBottom: '0.4rem', marginBottom: '0.85rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: linkTo ? 'pointer' : 'default',
        }}
      >
        <span>{title}</span>
        {linkTo && onNavigate && <span style={{ fontSize: '0.65rem', color: '#4B5563', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>ver detalle →</span>}
      </div>
      {children}
    </div>
  );
}

function KRow({ label, value, sub, color, desc }: { label: string; value: string; sub?: string; color?: string; desc?: string }) {
  return (
    <div style={{ padding: '0.3rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '0.78rem', color: '#8B97A8' }}>{label}</span>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: color ?? '#E8ECF1' }}>
          {value}
          {sub && <span style={{ fontSize: '0.7rem', color: '#6B7A8D', marginLeft: '0.4rem', fontWeight: 400 }}>{sub}</span>}
        </span>
      </div>
      {desc && <div style={{ fontSize: '0.62rem', color: '#3D4F62', marginTop: '0.1rem', lineHeight: 1.35 }}>{desc}</div>}
    </div>
  );
}

function TopList({ items, nameKey = 'nombre', valueKey = 'saldo' }: { items: any[]; nameKey?: string; valueKey?: string }) {
  if (!items?.length) return <div style={{ color: '#4B5563', fontSize: '0.75rem', padding: '0.5rem 0' }}>Sin datos</div>;
  const max = Math.max(...items.map(i => i[valueKey] ?? 0));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      {items.map((item, i) => {
        const v = item[valueKey] ?? 0;
        const barW = max > 0 ? Math.round((v / max) * 100) : 0;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.68rem', color: '#4B5563', width: 14, textAlign: 'right', flexShrink: 0 }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.72rem', color: '#8B97A8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item[nameKey] ?? '—'}</div>
              <div style={{ height: 4, marginTop: 2, borderRadius: 2, background: '#1a2535', overflow: 'hidden' }}>
                <div style={{ width: `${barW}%`, height: '100%', background: '#E25C1A', borderRadius: 2 }} />
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#E8ECF1', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtM(v)}</div>
          </div>
        );
      })}
    </div>
  );
}

// Aging stacked horizontal chart
function AgingChart({ data, label }: { data: { name: string; vigente: number; d30: number; d60: number; d90: number; d90p: number }[]; label: string }) {
  return (
    <div style={{ height: 60 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" hide />
          <Tooltip
            contentStyle={{ background: '#0d1825', border: '1px solid #1e2d3d', borderRadius: 6, fontSize: 11 }}
            formatter={(v: number, name: string) => [fmtM(v), name]}
          />
          <Bar dataKey="vigente"  name="Vigente"   stackId="a" fill="#10B981" radius={[0,0,0,0]} />
          <Bar dataKey="d30"      name="0–30d"     stackId="a" fill="#6EE7B7" />
          <Bar dataKey="d60"      name="31–60d"    stackId="a" fill="#F59E0B" />
          <Bar dataKey="d90"      name="61–90d"    stackId="a" fill="#F97316" />
          <Bar dataKey="d90p"     name="+90d"      stackId="a" fill="#EF4444" radius={[0,2,2,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// CCC timeline chart
function CCCChart({ dso, dpo, ccc }: { dso: number | null; dpo: number | null; ccc: number | null }) {
  if (dso == null || dpo == null) return null;
  const data = [
    { name: 'DSO (cobro)', dias: dso, fill: dso > 45 ? '#EF4444' : '#10B981' },
    { name: 'DPO (pago)',  dias: dpo, fill: dpo < 30 ? '#F59E0B' : '#10B981' },
  ];
  return (
    <div style={{ height: 100 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.05)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: '#6B7A8D' }} unit=" d" />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#8B97A8' }} width={80} />
          <Tooltip
            contentStyle={{ background: '#0d1825', border: '1px solid #1e2d3d', borderRadius: 6, fontSize: 11 }}
            formatter={(v: number) => [`${v.toFixed(0)} días`, '']}
          />
          <Bar dataKey="dias" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Working capital bridge
function WorkingCapitalChart({ cxc, cxp }: { cxc: number; cxp: number }) {
  const wc = cxc - cxp;
  const data = [
    { name: 'CxC (cobrar)', value: cxc, fill: '#207E83' },
    { name: 'CxP (pagar)',  value: cxp, fill: '#E25C1A' },
    { name: 'Capital Trabajo', value: Math.abs(wc), fill: wc >= 0 ? '#10B981' : '#EF4444' },
  ];
  return (
    <div style={{ height: 130 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8B97A8' }} />
          <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: '#6B7A8D' }} />
          <Tooltip
            contentStyle={{ background: '#0d1825', border: '1px solid #1e2d3d', borderRadius: 6, fontSize: 11 }}
            formatter={(v: number) => [fmtM(v), '']}
          />
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface TabGerencialProps {
  gerencialData: any;
  selectedYear: number;
  newTabLoading: boolean;
  onNavigate?: (tab: string) => void;
}

export function TabGerencial({ gerencialData, selectedYear, newTabLoading, onNavigate }: TabGerencialProps) {
  if (newTabLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8B97A8', fontSize: '0.85rem' }}>
        Calculando KPIs gerenciales…
      </div>
    );
  }

  if (!gerencialData) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#8B97A8', fontSize: '0.85rem' }}>
        Sin datos gerenciales para {selectedYear}. Ejecute el sync primero.
      </div>
    );
  }

  const { semaforo, rentabilidad, liquidez, cobros, pagos, eficiencia, alertas, insights } = gerencialData;

  const trendData = (rentabilidad?.trend ?? []).map((r: any) => ({
    mes:         MONTH_SHORT[r.mes] ?? r.mes,
    ingresos:    r.ingresos,
    margenBruto: r.margenBruto,
    utilidadNeta: r.utilidadNeta,
    margenPct:   r.margenBrutoPct,
    ebitdaPct:   r.ebitdaPct,
  }));

  const hasPL = (rentabilidad?.ingresos ?? 0) > 0;
  const yoyIngresos = rentabilidad?.yoyIngresosGrowth;
  const yoyUtilidad = rentabilidad?.yoyUtilidadGrowth;

  const cxcAgingData = [{
    name: 'CxC', vigente: cobros?.vigente ?? 0,
    d30: cobros?.dias30 ?? 0, d60: cobros?.dias60 ?? 0,
    d90: cobros?.dias90 ?? 0, d90p: cobros?.dias90mas ?? 0,
  }];
  const cxpAgingData = [{
    name: 'CxP', vigente: pagos?.vigente ?? 0,
    d30: pagos?.dias30 ?? 0, d60: pagos?.dias60 ?? 0,
    d90: pagos?.dias90 ?? 0, d90p: pagos?.dias90mas ?? 0,
  }];

  return (
    <div style={{ maxWidth: 1100 }}>

      {/* Fecha sync */}
      {gerencialData.syncedAt && (
        <div style={{ fontSize: '0.68rem', color: '#4B5563', marginBottom: '1.25rem' }}>
          Datos al {new Date(gerencialData.syncedAt).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · Año {selectedYear}
        </div>
      )}

      {/* Alertas críticas */}
      {alertas?.length > 0 && (
        <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {alertas.map((a: any, i: number) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              background: `${ALERT_COLOR[a.tipo]}10`, border: `1px solid ${ALERT_COLOR[a.tipo]}40`,
              borderRadius: 6, padding: '0.55rem 0.85rem',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: ALERT_COLOR[a.tipo], flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: '0.78rem', color: '#CBD5E1' }}>{a.mensaje}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: ALERT_COLOR[a.tipo], whiteSpace: 'nowrap' }}>{a.valor}</div>
            </div>
          ))}
        </div>
      )}

      {/* Semáforo */}
      <Section title="Semáforo Ejecutivo">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '0.6rem' }}>
          {(semaforo ?? []).map((s: any) => <SemaforoCard key={s.id} item={s} onNavigate={onNavigate} />)}
        </div>
      </Section>

      {/* Trend de ingresos */}
      {trendData.length > 0 && (
        <Section title={`Evolución Mensual ${selectedYear}`} linkTo="pl" onNavigate={onNavigate}>
          <div style={{ height: 210 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#6B7A8D' }} />
                <YAxis yAxisId="left" tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: '#6B7A8D' }} width={48} />
                <YAxis yAxisId="right" orientation="right" unit="%" tick={{ fontSize: 10, fill: '#6B7A8D' }} width={36} />
                <Tooltip
                  contentStyle={{ background: '#0d1825', border: '1px solid #1e2d3d', borderRadius: 6, fontSize: 11 }}
                  formatter={(v: number, name: string) =>
                    name.endsWith('Pct') ? [`${v?.toFixed(1)}%`, name === 'margenPct' ? 'Margen %' : 'EBITDA %']
                    : [fmt(v), name === 'ingresos' ? 'Ingresos' : name === 'margenBruto' ? 'Margen Bruto' : 'Utilidad']
                  }
                />
                <Bar yAxisId="left" dataKey="ingresos"    name="Ingresos"     fill="#207E83" opacity={0.7} radius={[2,2,0,0]} />
                <Bar yAxisId="left" dataKey="margenBruto" name="Margen Bruto" fill="#10B981" opacity={0.8} radius={[2,2,0,0]} />
                <Line yAxisId="right" type="monotone" dataKey="margenPct"  name="margenPct"  stroke="#F59E0B" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="ebitdaPct"  name="ebitdaPct"  stroke="#E25C1A" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                <Legend
                  formatter={(v: string) => {
                    const labels: Record<string, string> = {
                      ingresos: 'Ingresos', margenBruto: 'Margen Bruto',
                      margenPct: 'Margen %', ebitdaPct: 'EBITDA %',
                    };
                    return labels[v] ?? v;
                  }}
                  iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {/* Grid 2 col: Rentabilidad + Liquidez */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.75rem' }}>

        <Section title="Rentabilidad" linkTo="pl" onNavigate={onNavigate}>
          {!hasPL && (
            <div style={{ fontSize: '0.75rem', color: '#4B5563', marginBottom: '0.75rem', fontStyle: 'italic' }}>
              Sin datos P&L para {selectedYear} — verifique que el sync haya completado correctamente.
            </div>
          )}
          <KRow label="Ingresos YTD"      value={fmtM(rentabilidad?.ingresos ?? 0)}
            desc="Facturación acumulada del año hasta la fecha." />
          <KRow label="Margen Bruto"      value={fmtM(rentabilidad?.margenBruto ?? 0)}   sub={pctStr(rentabilidad?.margenBrutoPct)}
            desc="Ingresos menos costos directos. Mide eficiencia del servicio/producción." />
          <KRow label="GAV"               value={fmtM(rentabilidad?.gav ?? 0)}            sub={pctStr(rentabilidad?.gavPct)}      color="#F59E0B"
            desc="Gastos administrativos y de ventas. Costos fijos de la operación." />
          <KRow label="EBITDA"            value={fmtM(rentabilidad?.ebitda ?? 0)}         sub={pctStr(rentabilidad?.ebitdaPct)}
            color={(rentabilidad?.ebitda ?? 0) < 0 ? '#EF4444' : '#10B981'}
            desc="Resultado operativo. >10% indica negocio rentable antes de deuda e impuestos." />
          <KRow label="Gastos Financ."    value={fmtM(rentabilidad?.gastosFinanc ?? 0)}   color="#F59E0B"
            desc="Intereses y costos de deuda. Alto % sobre ingresos indica sobre-apalancamiento." />
          <KRow label="Utilidad Neta"     value={fmtM(rentabilidad?.utilidadNeta ?? 0)}   sub={pctStr(rentabilidad?.margenNetoPct)}
            color={(rentabilidad?.utilidadNeta ?? 0) < 0 ? '#EF4444' : '#10B981'}
            desc="Resultado final después de todos los gastos e impuestos." />
          {rentabilidad?.cobIntereses != null && (
            <KRow label="Cobertura deuda"  value={`${rentabilidad.cobIntereses.toFixed(2)}x`}
              color={rentabilidad.cobIntereses < 1.5 ? '#EF4444' : '#10B981'}
              desc="EBITDA / Gastos Financieros. <1.5x indica riesgo de no poder cubrir la deuda." />
          )}
          {(yoyIngresos != null || yoyUtilidad != null) && (
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {yoyIngresos != null && (
                <div style={{ background: yoyIngresos >= 0 ? '#10B98118' : '#EF444418', border: `1px solid ${yoyIngresos >= 0 ? '#10B98140' : '#EF444440'}`, borderRadius: 20, padding: '0.2rem 0.65rem', fontSize: '0.72rem', color: yoyIngresos >= 0 ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                  Ingresos YoY {pctStr(yoyIngresos)}
                </div>
              )}
              {yoyUtilidad != null && (
                <div style={{ background: yoyUtilidad >= 0 ? '#10B98118' : '#EF444418', border: `1px solid ${yoyUtilidad >= 0 ? '#10B98140' : '#EF444440'}`, borderRadius: 20, padding: '0.2rem 0.65rem', fontSize: '0.72rem', color: yoyUtilidad >= 0 ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                  Utilidad YoY {pctStr(yoyUtilidad)}
                </div>
              )}
            </div>
          )}
        </Section>

        <Section title="Liquidez & Capital" linkTo="balance" onNavigate={onNavigate}>
          <KRow label="Ratio Corriente"    value={numStr(liquidez?.currentRatio, 2, 'x')}
            color={liquidez?.currentRatio != null ? liquidez.currentRatio < 1 ? '#EF4444' : liquidez.currentRatio < 1.2 ? '#F59E0B' : '#10B981' : undefined}
            desc="Activo corriente / Pasivo corriente. >1.2 = buena cobertura de obligaciones corto plazo." />
          <KRow label="Ratio Rápido"       value={numStr(liquidez?.quickRatio, 2, 'x')}
            desc="Sin inventario. Mide liquidez inmediata para cubrir deudas corrientes." />
          <KRow label="Ratio de Caja"      value={numStr(liquidez?.cashRatio, 2, 'x')}
            desc="Solo efectivo sobre pasivo corriente. El más conservador de los ratios de liquidez." />
          <KRow label="Capital de Trabajo" value={fmtM(liquidez?.workingCapital ?? 0)}
            color={(liquidez?.workingCapital ?? 0) < 0 ? '#EF4444' : '#10B981'}
            desc="CxC total − CxP total. Positivo = la empresa financia más de lo que le financian." />

          {(cobros?.totalCxC ?? 0) + (pagos?.totalCxP ?? 0) > 0 && (
            <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
              <WorkingCapitalChart cxc={cobros?.totalCxC ?? 0} cxp={pagos?.totalCxP ?? 0} />
            </div>
          )}

          <KRow label="Saldo Caja"         value={fmtM(liquidez?.saldoCaja ?? 0)}
            desc="Efectivo disponible en cuentas bancarias según S10." />
          <KRow label="Burn Mensual"       value={fmtM(liquidez?.cashBurnMensual ?? 0)}
            desc="Salidas de caja promedio por mes. Base para calcular el runway." />
          <KRow label="Runway Caja"        value={numStr(liquidez?.cashRunway, 1, ' meses')}
            color={liquidez?.cashRunway != null ? liquidez.cashRunway < 2 ? '#EF4444' : liquidez.cashRunway < 3 ? '#F59E0B' : '#10B981' : undefined}
            desc="Meses de operación con el efectivo actual sin ingresos adicionales." />
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
            <KRow label="Total Activos"    value={fmtM(liquidez?.totalActivos ?? 0)}
              desc="Total de activos registrados en balance." />
            <KRow label="Patrimonio"       value={fmtM(liquidez?.totalPatrimonio ?? 0)}
              desc="Capital propio. Base sobre la que se mide el retorno a los socios." />
            <KRow label="ROE"              value={pctStr(liquidez?.roe)}
              color={liquidez?.roe != null ? liquidez.roe > 0 ? '#10B981' : '#EF4444' : undefined}
              desc="Retorno sobre patrimonio. >15% supera el costo de capital típico." />
            <KRow label="ROA"              value={pctStr(liquidez?.roa)}
              color={liquidez?.roa != null ? liquidez.roa > 0 ? '#10B981' : '#EF4444' : undefined}
              desc="Retorno sobre activos. Mide eficiencia del uso de todos los recursos." />
            {liquidez?.deudaPatrimonio != null && (
              <KRow label="Deuda/Patrimonio" value={`${liquidez.deudaPatrimonio.toFixed(2)}x`}
                desc="Apalancamiento. >2x indica alta dependencia de financiamiento externo." />
            )}
          </div>
        </Section>
      </div>

      {/* CCC */}
      <Section title="Ciclo de Conversión de Caja (CCC)">
        <div style={{ fontSize: '0.72rem', color: '#6B7A8D', marginBottom: '0.75rem', lineHeight: 1.5 }}>
          El CCC mide cuántos días el efectivo está «atrapado» entre pagar a proveedores y cobrar a clientes.
          <strong style={{ color: '#CBD5E1' }}> CCC = DSO − DPO.</strong> Negativo = los proveedores financian la operación.
        </div>
        <CCCChart dso={eficiencia?.dso} dpo={eficiencia?.dpo} ccc={eficiencia?.ccc} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.75rem' }}>
          {[
            { label: 'DSO',           value: eficiencia?.dso,  unit: 'd', color: (eficiencia?.dso ?? 0) > 45 ? '#EF4444' : '#10B981', desc: 'Días promedio de cobro. <45d es la referencia para servicios.' },
            { label: 'DPO',           value: eficiencia?.dpo,  unit: 'd', color: (eficiencia?.dpo ?? 0) < 30 ? '#F59E0B' : '#10B981', desc: 'Días promedio de pago. >30d significa mejor uso del crédito.' },
            { label: 'CCC = DSO−DPO', value: eficiencia?.ccc,  unit: 'd',
              color: eficiencia?.ccc == null ? '#4B5563' : eficiencia.ccc < 0 ? '#10B981' : eficiencia.ccc > 60 ? '#EF4444' : '#F59E0B',
              desc: eficiencia?.ccc != null && eficiencia.ccc < 0 ? `Proveedores financian ${Math.abs(eficiencia.ccc)}d — ventaja de capital sin costo.` : 'Capital propio atrapado en el ciclo operativo.' },
          ].map(k => (
            <div key={k.label} style={{ background: '#0d1825', borderRadius: 8, padding: '0.7rem 0.8rem', border: '1px solid #1e2d3d' }}>
              <div style={{ fontSize: '0.63rem', color: '#8B97A8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: k.color, lineHeight: 1.1, marginTop: '0.15rem' }}>
                {k.value == null ? '—' : `${k.value.toFixed(0)}${k.unit}`}
              </div>
              <div style={{ fontSize: '0.62rem', color: '#3D4F62', marginTop: '0.3rem', lineHeight: 1.4 }}>{k.desc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Cobros & Pagos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.75rem' }}>

        <Section title="Cartera por Cobrar — CxC" linkTo="cxc" onNavigate={onNavigate}>
          <div style={{ fontSize: '0.68rem', color: '#6B7A8D', marginBottom: '0.5rem' }}>
            Distribución de la cartera por antigüedad de vencimiento
          </div>
          {(cobros?.totalCxC ?? 0) > 0 && <AgingChart data={cxcAgingData} label="CxC" />}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem', marginBottom: '0.5rem', fontSize: '0.62rem' }}>
            {[['#10B981','Vigente'],['#6EE7B7','0–30d'],['#F59E0B','31–60d'],['#F97316','61–90d'],['#EF4444','+90d']].map(([c,l]) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#6B7A8D' }}>
                <span style={{ width: 8, height: 8, background: c, borderRadius: 2, display: 'inline-block' }} />{l}
              </span>
            ))}
          </div>
          <KRow label="Total CxC"          value={fmtM(cobros?.totalCxC ?? 0)} />
          <KRow label="Vigente"            value={fmtM(cobros?.vigente ?? 0)} desc="Saldo sin vencer a la fecha." />
          <KRow label="Vencida +90d"       value={fmtM(cobros?.dias90mas ?? 0)} color="#EF4444"
            desc="Alto riesgo de incobrabilidad. Evaluar provisión o gestión de cobranza." />
          <KRow label="% CxC vencida >90d" value={cobros?.pctVencido != null ? `${cobros.pctVencido.toFixed(1)}%` : '—'}
            color={cobros?.pctVencido != null ? cobros.pctVencido > 20 ? '#EF4444' : cobros.pctVencido > 10 ? '#F59E0B' : '#10B981' : undefined}
            desc="Referencia: <10% saludable, 10–20% alerta, >20% crítico." />
          <KRow label="DSO (días cobro)"   value={numStr(eficiencia?.dso, 0, ' días')}
            desc="Días promedio que tarda en hacerse efectiva la cobranza." />
          {cobros?.concTop3 != null && (
            <KRow label="Conc. top 3 clientes" value={`${cobros.concTop3.toFixed(1)}%`}
              color={cobros.concTop3 > 60 ? '#F59E0B' : '#10B981'}
              desc="% de la cartera en los 3 mayores clientes. >60% implica riesgo de concentración." />
          )}
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontSize: '0.68rem', color: '#8B97A8', marginBottom: '0.4rem' }}>Top 5 clientes por saldo</div>
            <TopList items={cobros?.topClientes ?? []} nameKey="nombre" valueKey="saldo" />
          </div>
        </Section>

        <Section title="Cuentas por Pagar — CxP" linkTo="cxp" onNavigate={onNavigate}>
          <div style={{ fontSize: '0.68rem', color: '#6B7A8D', marginBottom: '0.5rem' }}>
            Distribución de obligaciones con proveedores por antigüedad
          </div>
          {pagos?.agingAvailable && <AgingChart data={cxpAgingData} label="CxP" />}
          {!pagos?.agingAvailable && (pagos?.totalCxP ?? 0) > 0 && (
            <div style={{ fontSize: '0.68rem', color: '#8B97A8', padding: '0.35rem 0.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: 4, marginBottom: '0.4rem' }}>
              Detalle de aging disponible tras el próximo sync
            </div>
          )}
          {pagos?.agingAvailable && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem', marginBottom: '0.5rem', fontSize: '0.62rem' }}>
              {[['#10B981','Vigente'],['#6EE7B7','0–30d'],['#F59E0B','31–60d'],['#F97316','61–90d'],['#EF4444','+90d']].map(([c,l]) => (
                <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#6B7A8D' }}>
                  <span style={{ width: 8, height: 8, background: c, borderRadius: 2, display: 'inline-block' }} />{l}
                </span>
              ))}
            </div>
          )}
          <KRow label="Total CxP"          value={fmtM(pagos?.totalCxP ?? 0)} />
          <KRow label="Vigente"            value={pagos?.agingAvailable ? fmtM(pagos.vigente) : '—'} desc="Obligaciones aún no vencidas." />
          <KRow label="Vencida +90d"       value={pagos?.agingAvailable ? fmtM(pagos.dias90mas) : '—'} color={pagos?.agingAvailable && pagos.dias90mas > 0 ? '#EF4444' : undefined}
            desc="Deuda muy vencida. Riesgo de relación con proveedores y penalidades." />
          <KRow label="% CxP vencida"      value={pagos?.pctVencido != null ? `${pagos.pctVencido.toFixed(1)}%` : '—'}
            color={pagos?.pctVencido != null ? pagos.pctVencido > 20 ? '#EF4444' : pagos.pctVencido > 10 ? '#F59E0B' : '#10B981' : undefined}
            desc="% de deuda vencida sobre total CxP. >20% puede dañar la relación con proveedores." />
          <KRow label="DPO (días pago)"    value={numStr(eficiencia?.dpo, 0, ' días')}
            desc="Días promedio de pago. Buena gestión = pagar dentro del plazo acordado." />
          {pagos?.concTop3 != null && (
            <KRow label="Conc. top 3 proveedores" value={`${pagos.concTop3.toFixed(1)}%`}
              color={pagos.concTop3 > 60 ? '#F59E0B' : '#10B981'}
              desc="% de la deuda en los 3 mayores proveedores. Riesgo si son proveedores críticos." />
          )}
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontSize: '0.68rem', color: '#8B97A8', marginBottom: '0.4rem' }}>Top 5 proveedores por saldo</div>
            <TopList items={pagos?.topProveedores ?? []} nameKey="nombre" valueKey="saldo" />
          </div>
        </Section>
      </div>

      {/* Insights estratégicos */}
      {insights?.length > 0 && (
        <Section title="Insights Estratégicos">
          <div style={{ fontSize: '0.7rem', color: '#6B7A8D', marginBottom: '0.75rem' }}>
            Relaciones no obvias identificadas automáticamente a partir de los datos financieros.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
            {insights.map((ins: any, i: number) => (
              <div key={i} style={{ background: '#0a1420', border: '1px solid #1e2d3d', borderRadius: 8, padding: '0.85rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '1rem', lineHeight: 1 }}>{INSIGHT_ICON[ins.tipo]}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1' }}>{ins.titulo}</span>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#6B7A8D', lineHeight: 1.5, margin: 0 }}>{ins.descripcion}</p>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
