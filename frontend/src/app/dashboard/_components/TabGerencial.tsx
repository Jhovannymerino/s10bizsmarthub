'use client';
import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
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

function SemaforoCard({ item }: { item: any }) {
  const color = STATUS_COLOR[item.status] ?? '#4B5563';
  const vStr = item.value == null ? '—'
    : item.unit === '%'   ? `${item.value.toFixed(1)}%`
    : item.unit === 'días' ? `${item.value.toFixed(0)} d`
    : item.unit === 'mes'  ? `${item.value.toFixed(1)} m`
    : `${item.value.toFixed(2)}x`;
  return (
    <div style={{
      background: '#0d1825', border: `1px solid ${color}33`,
      borderRadius: 8, padding: '0.9rem 1rem',
      display: 'flex', flexDirection: 'column', gap: '0.25rem',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, width: 3,
        background: color, borderRadius: '3px 0 0 3px',
      }} />
      <div style={{ paddingLeft: 8 }}>
        <div style={{ fontSize: '0.68rem', color: '#8B97A8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
          {item.label}
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color, lineHeight: 1.2, marginTop: '0.15rem' }}>
          {vStr}
        </div>
        <div style={{ fontSize: '0.65rem', color: '#556070', marginTop: '0.2rem' }}>
          Referencia: {item.benchmark}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{
        fontSize: '0.7rem', fontWeight: 700, color: '#E25C1A',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        borderBottom: '1px solid rgba(226,92,26,0.2)', paddingBottom: '0.4rem', marginBottom: '1rem',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function KRow({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.35rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: '0.78rem', color: '#8B97A8' }}>{label}</span>
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: color ?? '#E8ECF1' }}>
        {value}
        {sub && <span style={{ fontSize: '0.7rem', color: '#6B7A8D', marginLeft: '0.4rem', fontWeight: 400 }}>{sub}</span>}
      </span>
    </div>
  );
}

function AgingBar({ v30, v60, v90, v90p, total }: { v30: number; v60: number; v90: number; v90p: number; total: number }) {
  if (!total) return null;
  const bar = (val: number, color: string, label: string) => {
    const w = Math.round((val / total) * 100);
    if (w < 1) return null;
    const sharePct = ((val / total) * 100).toFixed(1);
    return (
      <div style={{ width: `${w}%`, height: 8, background: color, position: 'relative' }} title={`${label}: ${sharePct}%`} />
    );
  };
  return (
    <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', marginTop: '0.5rem' }}>
      {bar(v30,  '#10B981', '0-30d')}
      {bar(v60,  '#F59E0B', '31-60d')}
      {bar(v90,  '#F97316', '61-90d')}
      {bar(v90p, '#EF4444', '+90d')}
    </div>
  );
}

function TopList({ items, valueKey = 'saldo' }: { items: any[]; valueKey?: string }) {
  if (!items?.length) return <div style={{ color: '#4B5563', fontSize: '0.75rem', padding: '0.5rem 0' }}>Sin datos</div>;
  const max = Math.max(...items.map(i => i[valueKey] ?? 0));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      {items.map((item, i) => {
        const v = item[valueKey] ?? 0;
        const barW = max > 0 ? Math.round((v / max) * 100) : 0;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.68rem', color: '#4B5563', width: 14, textAlign: 'right' }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.72rem', color: '#8B97A8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nombre ?? item.name}</div>
              <div style={{ height: 4, marginTop: 2, borderRadius: 2, background: '#1a2535', overflow: 'hidden' }}>
                <div style={{ width: `${barW}%`, height: '100%', background: '#E25C1A', borderRadius: 2 }} />
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#E8ECF1', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtM(v)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface TabGerencialProps {
  gerencialData: any;
  selectedYear: number;
  newTabLoading: boolean;
}

export function TabGerencial({ gerencialData, selectedYear, newTabLoading }: TabGerencialProps) {
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

  // Trend chart data
  const trendData = (rentabilidad?.trend ?? []).map((r: any) => ({
    mes:    MONTH_SHORT[r.mes] ?? r.mes,
    ingresos:    r.ingresos,
    margenBruto: r.margenBruto,
    utilidadNeta: r.utilidadNeta,
    margenPct:   r.margenBrutoPct,
    ebitdaPct:   r.ebitdaPct,
  }));

  // CCC donut (simplified)
  const cccData = eficiencia?.dso != null && eficiencia?.dpo != null
    ? [
        { name: 'DSO (cobro)', value: eficiencia.dso },
        { name: 'DPO (pago)',  value: eficiencia.dpo },
      ]
    : [];

  const yoyIngresos = rentabilidad?.yoyIngresosGrowth;
  const yoyUtilidad = rentabilidad?.yoyUtilidadGrowth;

  return (
    <div style={{ maxWidth: 1100 }}>

      {/* ── Encabezado KPI fecha ────────────── */}
      {gerencialData.syncedAt && (
        <div style={{ fontSize: '0.68rem', color: '#4B5563', marginBottom: '1.25rem' }}>
          Datos al {new Date(gerencialData.syncedAt).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · Año {selectedYear}
        </div>
      )}

      {/* ── Alertas críticas (si hay) ──────── */}
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

      {/* ── Semáforo 8 KPIs ───────────────── */}
      <Section title="Semáforo Ejecutivo">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.65rem' }}>
          {(semaforo ?? []).map((s: any) => <SemaforoCard key={s.id} item={s} />)}
        </div>
      </Section>

      {/* ── Trend de ingresos ─────────────── */}
      {trendData.length > 0 && (
        <Section title={`Evolución Mensual ${selectedYear}`}>
          <div style={{ height: 220 }}>
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
                <Bar yAxisId="left" dataKey="ingresos"    name="Ingresos"    fill="#207E83" opacity={0.7} radius={[2,2,0,0]} />
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
                  iconSize={8}
                  wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {/* ── Grid 2 columnas: Rentabilidad + Liquidez ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>

        {/* Rentabilidad */}
        <Section title="Rentabilidad">
          <KRow label="Ingresos YTD"     value={fmtM(rentabilidad?.ingresos ?? 0)} />
          <KRow label="Margen Bruto"     value={fmtM(rentabilidad?.margenBruto ?? 0)} sub={pctStr(rentabilidad?.margenBrutoPct)} />
          <KRow label="GAV"             value={fmtM(rentabilidad?.gav ?? 0)} sub={pctStr(rentabilidad?.gavPct)} color="#EF4444" />
          <KRow label="EBITDA"          value={fmtM(rentabilidad?.ebitda ?? 0)} sub={pctStr(rentabilidad?.ebitdaPct)}
            color={(rentabilidad?.ebitda ?? 0) < 0 ? '#EF4444' : '#10B981'} />
          <KRow label="Gastos Financ."  value={fmtM(rentabilidad?.gastosFinanc ?? 0)} color="#F59E0B" />
          <KRow label="Utilidad Neta"   value={fmtM(rentabilidad?.utilidadNeta ?? 0)} sub={pctStr(rentabilidad?.margenNetoPct)}
            color={(rentabilidad?.utilidadNeta ?? 0) < 0 ? '#EF4444' : '#10B981'} />
          {rentabilidad?.cobIntereses != null && (
            <KRow label="Cobertura intereses" value={`${rentabilidad.cobIntereses.toFixed(2)}x`}
              color={rentabilidad.cobIntereses < 1.5 ? '#EF4444' : '#10B981'} />
          )}
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
        </Section>

        {/* Liquidez */}
        <Section title="Liquidez & Capital">
          <KRow label="Ratio Corriente"   value={numStr(liquidez?.currentRatio, 2, 'x')}
            color={liquidez?.currentRatio != null ? liquidez.currentRatio < 1 ? '#EF4444' : liquidez.currentRatio < 1.2 ? '#F59E0B' : '#10B981' : undefined} />
          <KRow label="Ratio Rápido"      value={numStr(liquidez?.quickRatio, 2, 'x')} />
          <KRow label="Ratio de Caja"     value={numStr(liquidez?.cashRatio, 2, 'x')} />
          <KRow label="Capital de Trabajo" value={fmtM(liquidez?.workingCapital ?? 0)}
            color={(liquidez?.workingCapital ?? 0) < 0 ? '#EF4444' : '#10B981'} />
          <KRow label="Saldo Caja"        value={fmtM(liquidez?.saldoCaja ?? 0)} />
          <KRow label="Burn Mensual"      value={fmtM(liquidez?.cashBurnMensual ?? 0)} />
          <KRow label="Runway Caja"       value={numStr(liquidez?.cashRunway, 1, ' meses')}
            color={liquidez?.cashRunway != null ? liquidez.cashRunway < 2 ? '#EF4444' : liquidez.cashRunway < 3 ? '#F59E0B' : '#10B981' : undefined} />
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
            <KRow label="Total Activos"   value={fmtM(liquidez?.totalActivos ?? 0)} />
            <KRow label="Patrimonio"      value={fmtM(liquidez?.totalPatrimonio ?? 0)} />
            <KRow label="ROE"             value={pctStr(liquidez?.roe)}
              color={liquidez?.roe != null ? liquidez.roe > 0 ? '#10B981' : '#EF4444' : undefined} />
            <KRow label="ROA"             value={pctStr(liquidez?.roa)}
              color={liquidez?.roa != null ? liquidez.roa > 0 ? '#10B981' : '#EF4444' : undefined} />
            {liquidez?.deudaPatrimonio != null && (
              <KRow label="Deuda/Patrimonio" value={`${liquidez.deudaPatrimonio.toFixed(2)}x`} />
            )}
          </div>
        </Section>
      </div>

      {/* ── Ciclo de Conversión de Caja ───── */}
      <Section title="Ciclo de Conversión de Caja (CCC)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
          {[
            { label: 'DSO — Días Cobro',   value: eficiencia?.dso,  unit: 'días', color: eficiencia?.dso > 45 ? '#EF4444' : '#10B981' },
            { label: 'DPO — Días Pago',    value: eficiencia?.dpo,  unit: 'días', color: eficiencia?.dpo < 30 ? '#F59E0B' : '#10B981' },
            { label: 'CCC = DSO − DPO',    value: eficiencia?.ccc,  unit: 'días',
              color: eficiencia?.ccc == null ? '#4B5563' : eficiencia.ccc < 0 ? '#10B981' : eficiencia.ccc > 60 ? '#EF4444' : '#F59E0B' },
          ].map(k => (
            <div key={k.label} style={{ background: '#0d1825', borderRadius: 8, padding: '0.8rem 1rem', border: '1px solid #1e2d3d' }}>
              <div style={{ fontSize: '0.66rem', color: '#8B97A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: k.color, lineHeight: 1.1, marginTop: '0.2rem' }}>
                {k.value == null ? '—' : `${k.value.toFixed(0)} d`}
              </div>
            </div>
          ))}
        </div>
        {eficiencia?.ccc != null && (
          <div style={{ fontSize: '0.76rem', color: '#6B7A8D', background: '#0a1420', borderRadius: 6, padding: '0.5rem 0.75rem', borderLeft: '3px solid #1e3050' }}>
            {eficiencia.ccc < 0
              ? `✅ CCC negativo: los proveedores te financian ${Math.abs(eficiencia.ccc)} días — capital de trabajo liberado sin costo.`
              : eficiencia.ccc > 60
              ? `⚠️ CCC de ${eficiencia.ccc} días: capital operativo elevado inmovilizado. Acortar DSO o ampliar DPO liberaría liquidez.`
              : `ℹ️ CCC de ${eficiencia.ccc} días: dentro de rango razonable. Monitorear.`}
          </div>
        )}
      </Section>

      {/* ── Cobros & Pagos lado a lado ────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>

        {/* Cobros (CxC) */}
        <Section title="Cartera por Cobrar (CxC)">
          <KRow label="Total CxC"        value={fmtM(cobros?.totalCxC ?? 0)} />
          <KRow label="Vigente"          value={fmtM(cobros?.vigente ?? 0)} />
          <KRow label="Vencida 31-60d"   value={fmtM(cobros?.dias60 ?? 0)} color="#F59E0B" />
          <KRow label="Vencida 61-90d"   value={fmtM(cobros?.dias90 ?? 0)} color="#F97316" />
          <KRow label="Vencida +90d"     value={fmtM(cobros?.dias90mas ?? 0)} color="#EF4444" />
          <KRow label="% Vencida"        value={pctStr(cobros?.pctVencido)}
            color={cobros?.pctVencido != null ? cobros.pctVencido > 20 ? '#EF4444' : cobros.pctVencido > 10 ? '#F59E0B' : '#10B981' : undefined} />
          {cobros?.totalCxC > 0 && (
            <AgingBar v30={cobros?.dias30 ?? 0} v60={cobros?.dias60 ?? 0} v90={cobros?.dias90 ?? 0} v90p={cobros?.dias90mas ?? 0} total={cobros?.totalCxC ?? 0} />
          )}
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontSize: '0.68rem', color: '#8B97A8', marginBottom: '0.4rem' }}>Top 5 clientes por saldo</div>
            <TopList items={cobros?.topClientes ?? []} valueKey="saldo" />
          </div>
          {cobros?.concTop3 != null && (
            <KRow label="Concentración top 3" value={pctStr(cobros.concTop3)}
              color={cobros.concTop3 > 60 ? '#F59E0B' : '#10B981'} />
          )}
        </Section>

        {/* Pagos (CxP) */}
        <Section title="Cuentas por Pagar (CxP)">
          <KRow label="Total CxP"        value={fmtM(pagos?.totalCxP ?? 0)} />
          <KRow label="Vigente"          value={fmtM(pagos?.vigente ?? 0)} />
          <KRow label="Vencida 31-60d"   value={fmtM(pagos?.dias60 ?? 0)} color="#F59E0B" />
          <KRow label="Vencida 61-90d"   value={fmtM(pagos?.dias90 ?? 0)} color="#F97316" />
          <KRow label="Vencida +90d"     value={fmtM(pagos?.dias90mas ?? 0)} color="#EF4444" />
          <KRow label="% Vencida"        value={pctStr(pagos?.pctVencido)}
            color={pagos?.pctVencido != null ? pagos.pctVencido > 20 ? '#EF4444' : pagos.pctVencido > 10 ? '#F59E0B' : '#10B981' : undefined} />
          {pagos?.totalCxP > 0 && (
            <AgingBar v30={pagos?.dias30 ?? 0} v60={pagos?.dias60 ?? 0} v90={pagos?.dias90 ?? 0} v90p={pagos?.dias90mas ?? 0} total={pagos?.totalCxP ?? 0} />
          )}
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontSize: '0.68rem', color: '#8B97A8', marginBottom: '0.4rem' }}>Top 5 proveedores por saldo</div>
            <TopList items={pagos?.topProveedores ?? []} valueKey="saldo" />
          </div>
          {pagos?.concTop3 != null && (
            <KRow label="Concentración top 3" value={pctStr(pagos.concTop3)}
              color={pagos.concTop3 > 60 ? '#F59E0B' : '#10B981'} />
          )}
        </Section>
      </div>

      {/* ── Insights ejecutivos ───────────── */}
      {insights?.length > 0 && (
        <Section title="Insights Estratégicos">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
            {insights.map((ins: any, i: number) => (
              <div key={i} style={{
                background: '#0a1420', border: '1px solid #1e2d3d',
                borderRadius: 8, padding: '0.85rem 1rem',
              }}>
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
