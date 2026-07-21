import { Injectable, Logger } from '@nestjs/common';
import PptxGenJS from 'pptxgenjs';

// Brand colors S10
const NAVY = '0D3B5E';
const ORANGE = 'E25C1A';
const TEAL = '2BB4BB';
const RED = 'EF4444';
const GREEN = '10B981';
const YELLOW = 'F59E0B';
const BLUE = '5B86E5';
const TEXT = '0E1A2E';
const SUBTLE = '8B97A8';
const BG_DARK = '0F1C2E';

type Severity = 'CRÍTICO' | 'CRITICO' | 'ALTO' | 'MEDIO';
const sevColor = (s: string) => (s === 'CRÍTICO' || s === 'CRITICO') ? RED : s === 'ALTO' ? ORANGE : YELLOW;

const Q_LABELS: Record<string, string> = {
  Q1: 'Ene – Mar', Q2: 'Abr – Jun', Q3: 'Jul – Sep', Q4: 'Oct – Dic',
};
const Q_MONTHS: Record<string, number[]> = {
  Q1: [1, 2, 3], Q2: [4, 5, 6], Q3: [7, 8, 9], Q4: [10, 11, 12],
};
const MES_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Set','Oct','Nov','Dic'];

function fmt(n: number): string {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n));
}
function fmtPct(n: number, decimals = 1): string {
  if (n == null || isNaN(n)) return '—';
  return `${n.toFixed(decimals)}%`;
}
function safePct(num: number, den: number): number {
  return den && Math.abs(den) > 0.01 ? (num / den) * 100 : 0;
}

@Injectable()
export class DirectorioPptxService {
  private readonly logger = new Logger(DirectorioPptxService.name);

  /**
   * Genera el PPTX del Reporte Directorio.
   * @param ctx Datos del trimestre: empresa, P&L del Q, YTD, GAV, CxC, Caja, y el draft manual
   */
  async generate(ctx: {
    empresa: string;
    quarter: string;
    year: number;
    qData: any;        // P&L trimestral
    ytdData: any;      // P&L YTD
    pptoQ: any;        // Presupuesto Q
    pptoYTD: any;      // Presupuesto YTD
    gav: any;          // { categorias: [], total }
    cxc: any;          // { clientes: [], totalSaldo, concentracionTop3 }
    caja: any;         // { totalPorMes }
    cajaPosicion: any; // { saldoInicialQ, saldoFinalQ, totalEntradas, totalSalidas, meses[] }
    directorio: any;   // draft manual
  }): Promise<Buffer> {
    const { empresa, quarter, year, qData, ytdData, pptoQ, pptoYTD, gav, cxc, caja, cajaPosicion, directorio } = ctx;
    const d = directorio || {};
    const qLabel = Q_LABELS[quarter] || quarter;
    // El YTD del reporte llega recortado a ene..cierre del trimestre; el rótulo lo dice.
    const ultimoMesQ = ({ Q1: 3, Q2: 6, Q3: 9, Q4: 12 } as Record<string, number>)[quarter] || 12;
    const ytdLabel = `YTD ${year} (Ene – ${MES_NAMES[ultimoMesQ - 1]})`;

    const pres: any = new PptxGenJS();
    pres.author = 'S10 BizSmartHub';
    pres.title = `${empresa} · Directorio ${quarter} ${year}`;
    pres.layout = 'LAYOUT_WIDE'; // 13.33 × 7.5 inches

    // Helper: footer común a slides de contenido
    const addFooter = (slide: any, sectionNumber: string | null = null) => {
      slide.addText(
        [
          { text: 'Sesión Confidencial de Directorio · ', options: { color: SUBTLE, fontSize: 8 } },
          { text: empresa, options: { color: SUBTLE, fontSize: 8, bold: true } },
          { text: ` · ${quarter} ${year}`, options: { color: SUBTLE, fontSize: 8 } },
        ],
        { x: 0.4, y: 7.1, w: 12.5, h: 0.3, align: 'left' }
      );
      if (sectionNumber) {
        slide.addText(sectionNumber, { x: 12, y: 7.1, w: 0.9, h: 0.3, align: 'right', color: TEAL, fontSize: 9, bold: true });
      }
    };

    const addTitle = (slide: any, sectionNum: string, title: string) => {
      slide.background = { color: 'F8FAFC' };
      slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.6, fill: { color: NAVY } });
      slide.addText(`${sectionNum} · ${title}`, { x: 0.4, y: 0.1, w: 12.5, h: 0.4, color: 'FFFFFF', fontSize: 14, bold: true });
      slide.addText(`${empresa} · Directorio ${quarter} ${year}`, { x: 0.4, y: 0.7, w: 12.5, h: 0.3, color: SUBTLE, fontSize: 9 });
    };

    // ═══════════════════════════════════════
    // SLIDE 1 — Portada
    // ═══════════════════════════════════════
    {
      const s = pres.addSlide();
      s.background = { color: NAVY };
      s.addText(empresa, { x: 0.5, y: 2.2, w: 12.3, h: 0.9, color: 'FFFFFF', fontSize: 36, bold: true, align: 'left' });
      s.addText('DIRECTORIO', { x: 0.5, y: 3.2, w: 12.3, h: 0.6, color: ORANGE, fontSize: 28, bold: true });
      s.addText(`${quarter} ${year}`, { x: 0.5, y: 3.85, w: 12.3, h: 0.5, color: 'FFFFFF', fontSize: 22 });
      s.addText(`Business Review · ${qLabel} ${year}`, { x: 0.5, y: 4.4, w: 12.3, h: 0.4, color: TEAL, fontSize: 13 });
      s.addText('CMO Group · Infraestructura hospitalaria · Excelencia operativa', { x: 0.5, y: 6.3, w: 12.3, h: 0.3, color: SUBTLE, fontSize: 11 });
      s.addText('Sesión Confidencial de Directorio', { x: 0.5, y: 6.7, w: 12.3, h: 0.3, color: SUBTLE, fontSize: 9, italic: true });
    }

    // ═══════════════════════════════════════
    // SLIDE 2 — Agenda
    // ═══════════════════════════════════════
    {
      const s = pres.addSlide();
      addTitle(s, '', 'AGENDA');
      const agendaItems = [
        ['01', 'Resumen Ejecutivo', 'P&L: Ingreso, Margen, GAV, EBITDA — Q y YTD'],
        ['02', 'Indicadores Clave', 'KPIs con umbrales del Directorio (semáforo)'],
        ['03', 'Análisis de GAV', 'Gastos administrativos por categoría'],
        ['04', 'Productividad (Horas Hombre)', 'HH disponibles, facturadas y utilización %'],
        ['05', 'Cuentas por Cobrar', 'Aging y concentración de cartera'],
        ['06', 'Posición de Caja', 'Flujo neto del trimestre y YTD'],
        ['07', 'Backlog', 'Cartera de proyectos en ejecución'],
        ['08', 'Pipeline & VxF', 'Oportunidades del próximo trimestre'],
        ['09', 'Green Flags', 'Logros y avances del trimestre'],
        ['10', 'Red Flags', 'Riesgos, alertas y plan de mitigación'],
        ['11', 'Must Win Battles', 'Hitos críticos del próximo trimestre'],
        ['12', 'Acuerdos del Directorio', 'Compromisos y próximos pasos'],
      ];
      const rows = agendaItems.map(([n, t, sub]) => [
        { text: n, options: { color: ORANGE, fontSize: 13, bold: true, align: 'center' as const } },
        { text: t, options: { color: TEXT, fontSize: 12, bold: true } },
        { text: sub, options: { color: SUBTLE, fontSize: 10 } },
      ]);
      s.addTable(rows, { x: 0.4, y: 1.2, w: 12.5, colW: [0.7, 4.5, 7.3], fontFace: 'Inter', rowH: 0.42, border: { type: 'solid', pt: 0.5, color: 'E5E7EB' } });
      addFooter(s);
    }

    // ═══════════════════════════════════════
    // SLIDE 3 — Resumen Ejecutivo P&L
    // ═══════════════════════════════════════
    {
      const s = pres.addSlide();
      addTitle(s, '01', `RESUMEN EJECUTIVO ${quarter} ${year}`);
      // La depreciación va como línea propia DEBAJO del EBITDA (el GAV ya llega sin
      // ella) y lo financiero en una sola línea neta, de modo que los renglones
      // visibles sumen exactamente la utilidad neta.
      const rows = [
        ['ingresos', 'Ingresos'],
        ['costoDirecto', '(−) Costo Directo (COGS)'],
        ['margenBruto', 'Margen Bruto'],
        ['gav', '(−) GAV'],
        ['ebitda', 'EBITDA'],
        ['depreciacion', '(−) Depreciación'],
        ['finNeto', 'Ingresos / Gastos Financieros (neto)'],
        ['utilidadNeta', 'Utilidad Neta'],
      ];
      const buildPpto = (raw: any) => {
        const ing = raw?.ingresos || 0;
        const cos = Math.abs(raw?.costoDirecto || 0);
        const g = Math.abs(raw?.gav || 0);
        const da = Math.abs(raw?.da || 0);
        const gf = Math.abs(raw?.gastosFinancieros || 0);
        return {
          ingresos: ing,
          costoDirecto: raw?.costoDirecto || 0,
          margenBruto: ing - cos,
          gav: g,
          ebitda: ing - cos - g,
          depreciacion: da,
          finNeto: -gf,
          utilidadNeta: ing - cos - g - da - gf,
        };
      };
      const pq = buildPpto(pptoQ);
      const py = buildPpto(pptoYTD);
      const hasPptoQ = Math.abs(pq.ingresos) + Math.abs(pq.gav) > 1;
      const hasPptoYTD = Math.abs(py.ingresos) + Math.abs(py.gav) > 1;

      const renderTable = (title: string, real: any, ppto: any, showPpto: boolean, x: number) => {
        s.addText(title, { x, y: 1.15, w: 6.1, h: 0.3, color: TEXT, fontSize: 11, bold: true });
        const header = showPpto
          ? [{ text: 'Concepto' }, { text: 'Real (S/)', options: { align: 'right' as const } }, { text: 'Ppto (S/)', options: { align: 'right' as const } }, { text: '% Cumpl.', options: { align: 'right' as const } }]
          : [{ text: 'Concepto' }, { text: 'Real (S/)', options: { align: 'right' as const } }];
        const dataRows = rows.map(([k, label]) => {
          const vReal = real?.[k] || 0;
          const vPpto = ppto?.[k] || 0;
          const isTotal = ['margenBruto', 'ebitda', 'utilidadNeta'].includes(k as string);
          const cumpl = Math.abs(vPpto) > 0.01 ? `${((vReal / vPpto) * 100).toFixed(0)}%` : '—';
          const baseStyle = { bold: isTotal, fill: isTotal ? { color: 'FFF7ED' } : undefined };
          if (showPpto) {
            return [
              { text: label as string, options: { ...baseStyle, fontSize: 10 } },
              { text: fmt(vReal), options: { ...baseStyle, fontSize: 10, align: 'right' as const, color: vReal < 0 ? RED : TEXT, fontFace: 'Consolas' } },
              { text: Math.abs(vPpto) > 0.01 ? fmt(vPpto) : '—', options: { ...baseStyle, fontSize: 10, align: 'right' as const, color: SUBTLE, fontFace: 'Consolas' } },
              { text: cumpl, options: { ...baseStyle, fontSize: 10, align: 'right' as const, fontFace: 'Consolas' } },
            ];
          }
          return [
            { text: label as string, options: { ...baseStyle, fontSize: 10 } },
            { text: fmt(vReal), options: { ...baseStyle, fontSize: 10, align: 'right' as const, color: vReal < 0 ? RED : TEXT, fontFace: 'Consolas' } },
          ];
        });
        const headerRow = header.map(h => ({ text: h.text as string, options: { ...(h.options || {}), bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 10 } }));
        s.addTable([headerRow, ...dataRows], {
          x, y: 1.5, w: 6.1,
          colW: showPpto ? [2.3, 1.3, 1.3, 1.2] : [3.7, 2.4],
          rowH: 0.32,
          fontFace: 'Inter',
          border: { type: 'solid', pt: 0.4, color: 'E5E7EB' },
        });
      };
      renderTable(`${quarter} ${year} (${qLabel})`, qData, pq, hasPptoQ, 0.4);
      renderTable(ytdLabel, ytdData, py, hasPptoYTD, 6.85);
      addFooter(s);
    }

    // ═══════════════════════════════════════
    // SLIDE 4 — KPIs con semáforo
    // ═══════════════════════════════════════
    {
      const s = pres.addSlide();
      // Los indicadores se leen sobre el ACUMULADO del año hasta el cierre del
      // trimestre (definición del Directorio), no sobre el trimestre aislado.
      addTitle(s, '02', `INDICADORES CLAVE — ${ytdLabel}`);
      const qGMpct = safePct(ytdData?.margenBruto || 0, ytdData?.ingresos || 0);
      const qCOGSpct = safePct(Math.abs(ytdData?.costoDirecto || 0), ytdData?.ingresos || 0);
      const qGAVpct = safePct(Math.abs(ytdData?.gav || 0), ytdData?.ingresos || 0);
      const qEBITDApct = safePct(ytdData?.ebitda || 0, ytdData?.ingresos || 0);
      const qDSO = cxc?.totalSaldo && (ytdData?.ingresos || 0) > 0
        ? Math.round((cxc.totalSaldo / ytdData.ingresos) * (ultimoMesQ * 30)) : null;

      const semaforo = (value: number, target: number, alert: number, betterHigher: boolean) => {
        const ok = betterHigher ? value >= target : value <= target;
        const warn = betterHigher ? value >= alert : value <= alert;
        if (ok) return { color: GREEN, label: 'OK' };
        if (warn) return { color: YELLOW, label: 'Atención' };
        return { color: RED, label: 'Alerta' };
      };

      const kpis: any[] = [
        { code: 'F-03', label: 'Margen Bruto %', val: qGMpct, fmt: 'pct', target: 40, alert: 30, higher: true, hint: 'Target >40% · Alerta <30%' },
        { code: 'F-02', label: 'COGS %',         val: qCOGSpct, fmt: 'pct', target: 60, alert: 65, higher: false, hint: 'Target <60% · Alerta >65%' },
        { code: 'F-04', label: 'GAV %',          val: qGAVpct,  fmt: 'pct', target: 25, alert: 30, higher: false, hint: 'Target <25% · Alerta >30%' },
        { code: 'F-05', label: 'EBITDA %',       val: qEBITDApct, fmt: 'pct', target: 15, alert: 8, higher: true,  hint: 'Target >15% · Alerta <8%' },
      ];
      if (qDSO !== null) kpis.push({ code: 'O-02', label: 'DSO (días)', val: qDSO, fmt: 'days', target: 60, alert: 90, higher: false, hint: 'Target <60d · Alerta >90d' });

      const cols = Math.min(kpis.length, 5);
      const cardW = (12.5 - 0.2 * (cols - 1)) / cols;
      kpis.forEach((k, i) => {
        const sem = semaforo(k.val, k.target, k.alert, k.higher);
        const x = 0.4 + i * (cardW + 0.2);
        const y = 1.5;
        s.addShape('rect', { x, y, w: cardW, h: 2.2, fill: { color: 'FFFFFF' }, line: { color: sem.color, width: 1.5 } });
        s.addText(k.code, { x: x + 0.1, y: y + 0.1, w: cardW - 0.2, h: 0.25, color: SUBTLE, fontSize: 9 });
        s.addShape('rect', { x: x + cardW - 1.05, y: y + 0.1, w: 0.95, h: 0.25, fill: { color: sem.color } });
        s.addText(sem.label, { x: x + cardW - 1.05, y: y + 0.1, w: 0.95, h: 0.25, color: 'FFFFFF', fontSize: 9, bold: true, align: 'center' });
        s.addText(k.label, { x: x + 0.1, y: y + 0.45, w: cardW - 0.2, h: 0.3, color: TEXT, fontSize: 11, bold: true });
        const valueText = k.fmt === 'pct' ? `${k.val.toFixed(1)}%` : `${Math.round(k.val)}d`;
        s.addText(valueText, { x: x + 0.1, y: y + 0.85, w: cardW - 0.2, h: 0.7, color: sem.color, fontSize: 28, bold: true, align: 'center', fontFace: 'Consolas' });
        s.addText(k.hint, { x: x + 0.1, y: y + 1.7, w: cardW - 0.2, h: 0.35, color: SUBTLE, fontSize: 8, align: 'center' });
      });
      addFooter(s, '02');
    }

    // ═══════════════════════════════════════
    // SLIDE 5 — GAV detallado
    // ═══════════════════════════════════════
    if (gav?.categorias && gav.categorias.length > 0) {
      const s = pres.addSlide();
      addTitle(s, '03', `ANÁLISIS DE GAV — ${ytdLabel}`);
      const top = gav.categorias.slice(0, 15);
      const header = [
        { text: 'Cuenta', options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 10 } },
        { text: 'Descripción', options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 10 } },
        { text: 'YTD (S/)', options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 10, align: 'right' as const } },
        { text: '% Total', options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 10, align: 'right' as const } },
      ];
      const dataRows = top.map((c: any) => [
        { text: c.cod || '', options: { fontSize: 10, fontFace: 'Consolas', color: SUBTLE } },
        { text: c.descripcion || '', options: { fontSize: 10 } },
        { text: fmt(c.ytd || 0), options: { fontSize: 10, align: 'right' as const, fontFace: 'Consolas' } },
        { text: fmtPct(c.pct || 0), options: { fontSize: 10, align: 'right' as const, fontFace: 'Consolas', color: SUBTLE } },
      ]);
      const totalRow = [
        { text: '', options: { fontSize: 10 } },
        { text: 'TOTAL GAV', options: { bold: true, fill: { color: 'FFF7ED' }, fontSize: 10 } },
        { text: fmt(gav.total || 0), options: { bold: true, fill: { color: 'FFF7ED' }, fontSize: 10, align: 'right' as const, fontFace: 'Consolas' } },
        { text: '100.0%', options: { bold: true, fill: { color: 'FFF7ED' }, fontSize: 10, align: 'right' as const, fontFace: 'Consolas' } },
      ];
      s.addTable([header, ...dataRows, totalRow], {
        x: 0.4, y: 1.2, w: 12.5,
        colW: [1.5, 7.0, 2.0, 2.0],
        rowH: 0.32,
        fontFace: 'Inter',
        border: { type: 'solid', pt: 0.4, color: 'E5E7EB' },
      });
      if (gav.categorias.length > 15) {
        s.addText(`Top 15 de ${gav.categorias.length} cuentas`, { x: 0.4, y: 6.7, w: 12.5, h: 0.3, color: SUBTLE, fontSize: 9, italic: true });
      }
      addFooter(s, '03');
    }

    // ═══════════════════════════════════════
    // SLIDE 6 — Productividad HH
    // ═══════════════════════════════════════
    const hh = d.productividad || {};
    if ((hh.hhDisponibles || 0) > 0 || (hh.hhFacturadas || 0) > 0) {
      const s = pres.addSlide();
      addTitle(s, '04', 'ANÁLISIS DE PRODUCTIVIDAD (Horas Hombre)');
      const tasaUt = hh.hhDisponibles > 0 ? (hh.hhFacturadas / hh.hhDisponibles) * 100 : 0;
      const utColor = tasaUt >= 70 && tasaUt <= 85 ? GREEN : tasaUt < 60 || tasaUt > 90 ? RED : YELLOW;

      const cards = [
        { label: 'HH Disponibles', val: hh.hhDisponibles || 0, color: TEXT },
        { label: 'HH Facturadas', val: hh.hhFacturadas || 0, color: TEAL },
        { label: 'HH Ppto', val: hh.hhDisponiblesPpto || 0, color: SUBTLE },
        { label: 'N° Personas', val: hh.nPersonas || 0, color: TEXT },
      ];
      const cardW = (12.5 - 0.6) / 4;
      cards.forEach((c, i) => {
        const x = 0.4 + i * (cardW + 0.2);
        s.addShape('rect', { x, y: 1.4, w: cardW, h: 1.6, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB', width: 1 } });
        s.addText(c.label, { x: x + 0.1, y: 1.5, w: cardW - 0.2, h: 0.3, color: SUBTLE, fontSize: 10 });
        s.addText(c.val.toLocaleString('es-PE'), { x: x + 0.1, y: 1.9, w: cardW - 0.2, h: 0.8, color: c.color, fontSize: 26, bold: true, align: 'center', fontFace: 'Consolas' });
      });

      // Big card: Utilización %
      s.addShape('rect', { x: 0.4, y: 3.3, w: 12.5, h: 2.5, fill: { color: BG_DARK } });
      s.addText('TASA DE UTILIZACIÓN', { x: 0.4, y: 3.5, w: 12.5, h: 0.3, color: TEAL, fontSize: 11, bold: true, align: 'center' });
      s.addText(`${tasaUt.toFixed(1)}%`, { x: 0.4, y: 3.85, w: 12.5, h: 1.5, color: utColor, fontSize: 80, bold: true, align: 'center', fontFace: 'Consolas' });
      s.addText('Rango saludable: 70-85% · Bajo: equipo subutilizado · Alto: riesgo de burnout', { x: 0.4, y: 5.4, w: 12.5, h: 0.3, color: SUBTLE, fontSize: 10, align: 'center' });
      addFooter(s, '04');
    }

    // ═══════════════════════════════════════
    // SLIDE 7 — CxC Aging por FechaVencimiento
    // ═══════════════════════════════════════
    if (cxc?.clientes && cxc.clientes.length > 0) {
      const s = pres.addSlide();
      addTitle(s, '07', `ANÁLISIS DE CUENTAS x COBRAR (CxC) — Al cierre  ${quarter} ${year}`);

      const sumF = (k: string) => (cxc.clientes as any[]).reduce((sum, c) => sum + Number(c[k] || 0), 0);
      const totalCxC     = cxc.totalSaldo   || 0;
      const totalVigente = cxc.totalVigente  || sumF('saldoVigente');
      const totalCedido  = Number(d.cxcCedido   || 0);
      const totalIncobrabe = Number(d.cxcIncobrable || 0);

      // 4 KPI cards
      const kCards = [
        { label: 'Total CxC',              val: totalCxC,     color: NAVY   },
        { label: 'Total Vigente',           val: totalVigente, color: GREEN  },
        { label: 'Total Cedido (Factoring)',val: totalCedido,  color: BLUE   },
        { label: 'Total Incobrable',        val: totalIncobrabe, color: RED  },
      ];
      const cardW = (12.5 - 0.6) / 4;
      kCards.forEach((c, i) => {
        const x = 0.4 + i * (cardW + 0.2);
        s.addShape('rect', { x, y: 1.1, w: cardW, h: 0.18, fill: { color: c.color } });
        s.addShape('rect', { x, y: 1.28, w: cardW, h: 1.15, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB', width: 1 } });
        s.addText(c.label, { x: x + 0.1, y: 1.33, w: cardW - 0.2, h: 0.3, color: SUBTLE, fontSize: 9.5, align: 'center' });
        s.addText(`S/ ${fmt(c.val)}`, { x: x + 0.05, y: 1.65, w: cardW - 0.1, h: 0.65, color: c.color, fontSize: 18, bold: true, align: 'center', fontFace: 'Consolas' });
      });

      // Tabla aging por cliente
      // El snapshot emite `saldoTotalSoles`; `saldoTotal` no existe y hacía que la
      // columna TOTAL imprimiera 0 en todos los clientes.
      const saldoCli = (c: any) => Number(c?.saldoTotalSoles ?? c?.saldoTotal ?? 0);
      const sortedCli = [...cxc.clientes].sort((a, b) => saldoCli(b) - saldoCli(a)).slice(0, 9);
      const comentarios: Record<string, string> = d.cxcComentarios || {};
      const colHeaders = [
        { text: 'Cliente',    fill: NAVY,     w: 3.5 },
        { text: 'Vigente',    fill: '1A6B30', w: 1.35 },
        { text: '0–30 días',  fill: '1E5FAD', w: 1.35 },
        { text: '30–60 días', fill: 'B45309', w: 1.35 },
        { text: '60–90 días', fill: 'C2410C', w: 1.35 },
        { text: '+90 días',   fill: 'B91C1C', w: 1.35 },
        { text: 'TOTAL',      fill: NAVY,     w: 1.35 },
        { text: 'Comentario', fill: '374151', w: 1.35 },
      ];
      const colW = colHeaders.map(c => c.w);
      const header = colHeaders.map(c => ({
        text: c.text,
        options: { bold: true, fill: { color: c.fill }, color: 'FFFFFF', fontSize: 9, align: c.text === 'Cliente' || c.text === 'Comentario' ? ('left' as const) : ('right' as const) },
      }));

      const agingColor = (v: number, warn: string, alert: string) => v > 0 ? (v > 1000 ? alert : warn) : TEXT;
      const rows = sortedCli.map((c: any) => {
        const cod = String(c.codCliente || c.cliente || '').slice(0, 10);
        const nota = comentarios[cod] || comentarios[c.cliente] || '';
        return [
          { text: (c.cliente || '').substring(0, 42), options: { fontSize: 9 } },
          { text: (c.saldoVigente || 0) > 0 ? fmt(c.saldoVigente) : '—', options: { fontSize: 9, align: 'right' as const, fontFace: 'Consolas', color: GREEN } },
          { text: (c.dias0_30 || 0) > 0 ? fmt(c.dias0_30) : '—', options: { fontSize: 9, align: 'right' as const, fontFace: 'Consolas', color: BLUE } },
          { text: (c.dias31_60 || 0) > 0 ? fmt(c.dias31_60) : '—', options: { fontSize: 9, align: 'right' as const, fontFace: 'Consolas', color: agingColor(c.dias31_60, YELLOW, ORANGE) } },
          { text: (c.dias61_90 || 0) > 0 ? fmt(c.dias61_90) : '—', options: { fontSize: 9, align: 'right' as const, fontFace: 'Consolas', color: agingColor(c.dias61_90, ORANGE, RED) } },
          { text: (c.dias90mas || 0) > 0 ? fmt(c.dias90mas) : '—', options: { fontSize: 9, align: 'right' as const, fontFace: 'Consolas', color: (c.dias90mas || 0) > 0 ? RED : TEXT, bold: (c.dias90mas || 0) > 0 } },
          { text: fmt(saldoCli(c)), options: { fontSize: 9, align: 'right' as const, fontFace: 'Consolas', bold: true } },
          { text: nota || '—', options: { fontSize: 8, color: SUBTLE, italic: !nota } },
        ];
      });

      // Fila TOTAL
      const totalRow = [
        { text: 'TOTAL', options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 9 } },
        { text: fmt(totalVigente), options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 9, align: 'right' as const, fontFace: 'Consolas' } },
        { text: fmt(sumF('dias0_30')), options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 9, align: 'right' as const, fontFace: 'Consolas' } },
        { text: fmt(sumF('dias31_60')), options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 9, align: 'right' as const, fontFace: 'Consolas' } },
        { text: fmt(sumF('dias61_90')), options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 9, align: 'right' as const, fontFace: 'Consolas' } },
        { text: fmt(sumF('dias90mas')), options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 9, align: 'right' as const, fontFace: 'Consolas' } },
        { text: fmt(totalCxC), options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 9, align: 'right' as const, fontFace: 'Consolas' } },
        { text: '', options: { fill: { color: NAVY } } },
      ];

      s.addTable([header, ...rows, totalRow as any], {
        x: 0.4, y: 2.6, w: 12.5,
        colW,
        rowH: 0.315,
        fontFace: 'Inter',
        border: { type: 'solid', pt: 0.4, color: 'E5E7EB' },
      });

      if (cxc.clientes.length > 9) {
        s.addText(`Top 9 de ${cxc.clientes.length} clientes · Aging por FechaVencimiento del documento`, { x: 0.4, y: 7.05, w: 12.5, h: 0.25, color: SUBTLE, fontSize: 8, italic: true });
      }
      addFooter(s, '07');
    }

    // ═══════════════════════════════════════
    // SLIDE 8 — Posición de Caja (detallado)
    // ═══════════════════════════════════════
    {
      const s = pres.addSlide();
      addTitle(s, '06', `POSICIÓN DE CAJA  ${quarter} ${year}`);
      const cp = cajaPosicion || {};
      const qMeses: number[] = Q_MONTHS[quarter] || [1,2,3];
      const meses: any[] = cp.meses || qMeses.map(m => ({ mes: m, saldoInicial: 0, entradas: 0, salidas: 0, remuneraciones: 0, sunat: 0, proveedores: 0, saldoFinal: 0 }));

      const si  = cp.saldoInicialQ    ?? 0;
      const ent = cp.totalEntradas    ?? 0;
      const sal = cp.totalSalidas     ?? 0;
      const sf  = cp.saldoFinalQ      ?? 0;

      // 4 KPI cards
      const kCards = [
        { label: `Saldo Inicial ${quarter}`, val: si,  color: BLUE   },
        { label: 'Total Entradas',           val: ent, color: GREEN  },
        { label: 'Total Salidas',            val: sal, color: RED    },
        { label: `Saldo Final ${quarter}`,   val: sf,  color: sf >= 0 ? GREEN : RED },
      ];
      const cardW = (12.5 - 0.6) / 4;
      kCards.forEach((c, i) => {
        const x = 0.4 + i * (cardW + 0.2);
        s.addShape('rect', { x, y: 1.15, w: cardW, h: 0.18, fill: { color: c.color } });
        s.addShape('rect', { x, y: 1.33, w: cardW, h: 1.2, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB', width: 1 } });
        s.addText(c.label, { x: x + 0.1, y: 1.38, w: cardW - 0.2, h: 0.3, color: SUBTLE, fontSize: 9.5, align: 'center' });
        s.addText(`S/ ${fmt(c.val)}`, { x: x + 0.05, y: 1.72, w: cardW - 0.1, h: 0.7, color: c.color, fontSize: 18, bold: true, align: 'center', fontFace: 'Consolas' });
      });

      // Tabla flujo detallado
      const mesHeaders = meses.map(m => ({
        text: MES_NAMES[m.mes - 1],
        options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 10, align: 'right' as const },
      }));
      const header = [
        { text: 'Concepto', options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 10 } },
        ...mesHeaders,
        { text: `${quarter} Total`, options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 10, align: 'right' as const } },
      ];

      const totalCols = meses.length + 2; // concepto + N meses + Q Total
      const conceptW = 3.8;
      const mesW = (12.5 - conceptW) / (meses.length + 1);
      const colW = [conceptW, ...Array(meses.length + 1).fill(mesW)];

      const makeRow = (
        label: string,
        getter: (m: any) => number,
        total: number,
        opts: { bold?: boolean; fill?: string; headerFill?: string; color?: string; indent?: boolean } = {},
      ) => {
        const { bold = false, fill, color, indent = false } = opts;
        const labelText = indent ? `  ${label}` : label;
        const baseOpts = { fontSize: 10, ...(bold ? { bold: true } : {}), ...(fill ? { fill: { color: fill } } : {}) };
        return [
          { text: labelText, options: { ...baseOpts, color: color || TEXT } },
          ...meses.map(m => {
            const v = getter(m);
            return { text: v !== 0 ? fmt(v) : '—', options: { ...baseOpts, fontSize: 10, align: 'right' as const, fontFace: 'Consolas', color: v < 0 ? RED : (color || TEXT) } };
          }),
          { text: total !== 0 ? fmt(total) : '—', options: { ...baseOpts, fontSize: 10, align: 'right' as const, fontFace: 'Consolas', bold: true, color: total < 0 ? RED : (color || TEXT) } },
        ];
      };

      const saldoInicialRow = makeRow('Saldo inicial del período', m => m.saldoInicial, si, { bold: true });
      const entHeaderRow = [
        { text: 'ENTRADAS DE CAJA', options: { bold: true, fill: { color: '1A6B30' }, color: 'FFFFFF', fontSize: 10 } },
        ...Array(meses.length + 1).fill({ text: '', options: { fill: { color: '1A6B30' } } }),
      ];
      const cobrosRow   = makeRow('Cobros a clientes / facturas', m => m.entradas, ent, { indent: true, color: '1A6B30' });
      const totalEntRow = makeRow('Total Entradas', m => m.entradas, ent, { bold: true, fill: 'E8F5E9', color: '1A6B30' });
      const salHeaderRow = [
        { text: 'SALIDAS DE CAJA', options: { bold: true, fill: { color: 'B91C1C' }, color: 'FFFFFF', fontSize: 10 } },
        ...Array(meses.length + 1).fill({ text: '', options: { fill: { color: 'B91C1C' } } }),
      ];
      const remuRow     = makeRow('Remuneraciones y honorarios', m => m.remuneraciones, cp.totalRemuneraciones ?? 0, { indent: true });
      const provRow     = makeRow('Proveedores, arriendo, servicios y otros', m => m.proveedores, cp.totalProveedores ?? 0, { indent: true });
      const sunatRow    = makeRow('SUNAT / impuestos', m => m.sunat, cp.totalSunat ?? 0, { indent: true });
      const totalSalRow = makeRow('Total Salidas', m => m.salidas, sal, { bold: true, fill: 'FEE2E2', color: RED });
      const saldoFinalRow = makeRow('SALDO FINAL', m => m.saldoFinal, sf, { bold: true, fill: '1E3A5F', color: sf >= 0 ? GREEN : RED });
      // Override fill on SALDO FINAL to navy bg
      (saldoFinalRow[0] as any).options = { ...((saldoFinalRow[0] as any).options), fill: { color: NAVY }, color: 'FFFFFF', bold: true, fontSize: 10 };
      for (let i = 1; i < saldoFinalRow.length; i++) {
        const v = i < meses.length + 1 ? meses[i-1]?.saldoFinal : sf;
        (saldoFinalRow[i] as any).options = { fontSize: 10, align: 'right', fontFace: 'Consolas', bold: true, fill: { color: NAVY }, color: (v ?? 0) >= 0 ? '86EFAC' : 'FCA5A5' };
      }

      s.addTable([
        header,
        saldoInicialRow,
        entHeaderRow as any,
        cobrosRow,
        totalEntRow,
        salHeaderRow as any,
        remuRow,
        provRow,
        sunatRow,
        totalSalRow,
        saldoFinalRow,
      ], {
        x: 0.4, y: 2.65, w: 12.5,
        colW,
        rowH: 0.31,
        fontFace: 'Inter',
        border: { type: 'solid', pt: 0.4, color: 'E5E7EB' },
      });

      if (!cp.hasLaboral) {
        s.addText('* Remuneraciones: requiere sync con Batch 3 (crontab nocturno)', { x: 0.4, y: 7.05, w: 12.5, h: 0.25, color: SUBTLE, fontSize: 8, italic: true });
      }
      addFooter(s, '06');
    }

    // ═══════════════════════════════════════
    // SLIDE 9 — Backlog
    // ═══════════════════════════════════════
    if (d.backlog && d.backlog.length > 0) {
      const s = pres.addSlide();
      addTitle(s, '07', 'BACKLOG — Cartera de proyectos en ejecución');
      const totalContrato = d.backlog.reduce((sum: number, r: any) => sum + (Number(r.contrato) || 0), 0);
      const totalIngresoQ = d.backlog.reduce((sum: number, r: any) => sum + (Number(r.ingresoQ) || 0), 0);
      s.addText(`Cartera total: S/ ${fmt(totalContrato)} · ${d.backlog.length} proyectos · Proyección ingreso ${quarter}: S/ ${fmt(totalIngresoQ)}`,
        { x: 0.4, y: 1.15, w: 12.5, h: 0.3, color: ORANGE, fontSize: 11, bold: true });

      const header = [
        { text: 'Cliente / Proyecto', options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 9 } },
        { text: 'Contrato (S/)', options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 9, align: 'right' as const } },
        { text: 'Inicio', options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 9, align: 'center' as const } },
        { text: 'Término', options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 9, align: 'center' as const } },
        { text: '% Avance', options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 9, align: 'right' as const } },
        { text: `Ing. ${quarter} (S/)`, options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 9, align: 'right' as const } },
        { text: 'Estado', options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 9, align: 'center' as const } },
      ];
      const rows = d.backlog.slice(0, 12).map((r: any) => [
        { text: `${r.cliente || ''}\n${r.proyecto || ''}`, options: { fontSize: 9 } },
        { text: fmt(Number(r.contrato) || 0), options: { fontSize: 9, align: 'right' as const, fontFace: 'Consolas' } },
        { text: r.inicio || '—', options: { fontSize: 9, align: 'center' as const } },
        { text: r.termino || '—', options: { fontSize: 9, align: 'center' as const } },
        { text: `${Number(r.avance) || 0}%`, options: { fontSize: 9, align: 'right' as const, fontFace: 'Consolas' } },
        { text: fmt(Number(r.ingresoQ) || 0), options: { fontSize: 9, align: 'right' as const, fontFace: 'Consolas' } },
        { text: r.estado || '—', options: { fontSize: 9, align: 'center' as const } },
      ]);
      s.addTable([header, ...rows], {
        x: 0.4, y: 1.5, w: 12.5,
        colW: [4.5, 1.6, 1.2, 1.2, 1.1, 1.5, 1.4],
        rowH: 0.32,
        fontFace: 'Inter',
        border: { type: 'solid', pt: 0.4, color: 'E5E7EB' },
      });
      addFooter(s, '07');
    }

    // ═══════════════════════════════════════
    // SLIDE 10 — Pipeline
    // ═══════════════════════════════════════
    if (d.pipeline && d.pipeline.length > 0) {
      const s = pres.addSlide();
      addTitle(s, '08', `PIPELINE & VxF — Oportunidades del próximo trimestre`);
      const totalPipe = d.pipeline.reduce((sum: number, r: any) => sum + (Number(r.monto) || 0), 0);
      s.addText(`Total pipeline: S/ ${fmt(totalPipe)} · ${d.pipeline.length} oportunidades`,
        { x: 0.4, y: 1.15, w: 12.5, h: 0.3, color: ORANGE, fontSize: 11, bold: true });

      const header = [
        { text: 'Cliente', options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 10 } },
        { text: 'Proyecto / Servicio', options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 10 } },
        { text: 'Monto (S/)', options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 10, align: 'right' as const } },
        { text: 'Q Cierre', options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 10, align: 'center' as const } },
        { text: 'Prob.', options: { bold: true, fill: { color: NAVY }, color: 'FFFFFF', fontSize: 10, align: 'center' as const } },
      ];
      const rows = d.pipeline.slice(0, 12).map((r: any) => {
        const probColor = r.prob === 'A' ? GREEN : r.prob === 'B' ? YELLOW : SUBTLE;
        return [
          { text: r.cliente || '', options: { fontSize: 10 } },
          { text: r.proyecto || '', options: { fontSize: 10 } },
          { text: fmt(Number(r.monto) || 0), options: { fontSize: 10, align: 'right' as const, fontFace: 'Consolas' } },
          { text: r.qCierre || '—', options: { fontSize: 10, align: 'center' as const } },
          { text: r.prob || '—', options: { fontSize: 10, align: 'center' as const, bold: true, color: probColor } },
        ];
      });
      s.addTable([header, ...rows], {
        x: 0.4, y: 1.55, w: 12.5,
        colW: [3.5, 5.0, 2.0, 1.2, 0.8],
        rowH: 0.32,
        fontFace: 'Inter',
        border: { type: 'solid', pt: 0.4, color: 'E5E7EB' },
      });
      s.addText('Probabilidad: A Alta (>75%) · B Media (40-75%) · C Baja (<40%)',
        { x: 0.4, y: 6.7, w: 12.5, h: 0.3, color: SUBTLE, fontSize: 9, italic: true });
      addFooter(s, '08');
    }

    // ═══════════════════════════════════════
    // SLIDE 11 — Green Flags
    // ═══════════════════════════════════════
    if (d.greenFlags && d.greenFlags.length > 0) {
      const s = pres.addSlide();
      addTitle(s, '09', 'GREEN FLAGS — Logros y avances del trimestre');
      d.greenFlags.slice(0, 6).forEach((g: any, i: number) => {
        const row = i;
        const y = 1.3 + row * 0.85;
        s.addShape('rect', { x: 0.4, y, w: 12.5, h: 0.75, fill: { color: 'F0FDF4' }, line: { color: GREEN, width: 2 } });
        s.addText(g.titulo || `Logro ${i+1}`, { x: 0.6, y: y + 0.05, w: 12.1, h: 0.3, color: GREEN, fontSize: 12, bold: true });
        s.addText(g.descripcion || '', { x: 0.6, y: y + 0.38, w: 12.1, h: 0.35, color: TEXT, fontSize: 10 });
      });
      addFooter(s, '09');
    }

    // ═══════════════════════════════════════
    // SLIDE 12 — Red Flags
    // ═══════════════════════════════════════
    if (d.redFlags && d.redFlags.length > 0) {
      const s = pres.addSlide();
      addTitle(s, '10', 'RED FLAGS — Riesgos y alertas');
      d.redFlags.slice(0, 5).forEach((r: any, i: number) => {
        const col = sevColor(r.criticidad);
        const y = 1.3 + i * 1.05;
        s.addShape('rect', { x: 0.4, y, w: 12.5, h: 0.95, fill: { color: 'FFFBFB' }, line: { color: col, width: 2 } });
        s.addShape('rect', { x: 0.4, y, w: 1.2, h: 0.3, fill: { color: col } });
        s.addText(r.criticidad || 'MEDIO', { x: 0.4, y, w: 1.2, h: 0.3, color: 'FFFFFF', fontSize: 9, bold: true, align: 'center' });
        s.addText(r.titulo || `Riesgo ${i+1}`, { x: 1.7, y: y + 0.05, w: 11.0, h: 0.3, color: TEXT, fontSize: 12, bold: true });
        s.addText(r.descripcion || '', { x: 0.6, y: y + 0.35, w: 12.1, h: 0.3, color: TEXT, fontSize: 10 });
        s.addText(`→ Acción: ${r.accion || ''}`, { x: 0.6, y: y + 0.65, w: 12.1, h: 0.3, color: BLUE, fontSize: 10, italic: true });
      });
      addFooter(s, '10');
    }

    // ═══════════════════════════════════════
    // SLIDE 13 — Must Win Battles
    // ═══════════════════════════════════════
    if (d.mustWin && d.mustWin.length > 0) {
      const s = pres.addSlide();
      addTitle(s, '11', `MUST WIN BATTLES — Hitos críticos próximo trimestre`);
      d.mustWin.slice(0, 5).forEach((m: any, i: number) => {
        const col = sevColor(m.criticidad);
        const y = 1.3 + i * 1.05;
        s.addShape('rect', { x: 0.4, y, w: 12.5, h: 0.95, fill: { color: 'FFFFFF' }, line: { color: col, width: 2 } });
        s.addShape('rect', { x: 0.4, y, w: 1.2, h: 0.95, fill: { color: BG_DARK } });
        s.addText(m.codigo || `MW-${String(i+1).padStart(2, '0')}`, { x: 0.4, y: y + 0.15, w: 1.2, h: 0.3, color: 'FFFFFF', fontSize: 12, bold: true, align: 'center', fontFace: 'Consolas' });
        s.addText(m.criticidad || 'MEDIO', { x: 0.4, y: y + 0.55, w: 1.2, h: 0.3, color: col, fontSize: 9, bold: true, align: 'center' });
        s.addText(m.titulo || `Hito ${i+1}`, { x: 1.7, y: y + 0.05, w: 11.0, h: 0.3, color: TEXT, fontSize: 12, bold: true });
        s.addText(m.descripcion || '', { x: 1.7, y: y + 0.35, w: 11.0, h: 0.3, color: TEXT, fontSize: 10 });
        s.addText(`Responsable: ${m.responsable || '—'} · Plazo: ${m.plazo || '—'}`, { x: 1.7, y: y + 0.65, w: 11.0, h: 0.3, color: SUBTLE, fontSize: 10, italic: true });
      });
      addFooter(s, '11');
    }

    // ═══════════════════════════════════════
    // SLIDE 14 — Acuerdos del Directorio
    // ═══════════════════════════════════════
    if (d.acuerdos && d.acuerdos.length > 0) {
      const s = pres.addSlide();
      addTitle(s, '12', `ACUERDOS DEL DIRECTORIO ${quarter} ${year}`);
      d.acuerdos.slice(0, 8).forEach((a: string, i: number) => {
        const y = 1.3 + i * 0.6;
        s.addText(`${i + 1}.`, { x: 0.4, y, w: 0.5, h: 0.5, color: TEAL, fontSize: 16, bold: true });
        s.addText(a, { x: 1.0, y: y + 0.05, w: 11.8, h: 0.5, color: TEXT, fontSize: 11 });
      });
      addFooter(s, '12');
    }

    // Generar el buffer
    const buf = await pres.write({ outputType: 'nodebuffer' });
    return buf as Buffer;
  }
}
