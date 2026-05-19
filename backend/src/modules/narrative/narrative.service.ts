import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { KpiService } from '../kpi/kpi.service';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1200;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

@Injectable()
export class NarrativeService {
  private readonly logger = new Logger(NarrativeService.name);
  private readonly client: Anthropic | null;
  private readonly cache = new Map<string, { text: string; generatedAt: number }>();

  constructor(private kpi: KpiService) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    if (!this.client) this.logger.warn('ANTHROPIC_API_KEY no configurada — narrativa IA desactivada');
  }

  async getNarrative(companyId: string, year: number, force = false): Promise<{ text: string; generatedAt: number; cached: boolean }> {
    const cacheKey = `${companyId}|${year}`;
    if (!force) {
      const hit = this.cache.get(cacheKey);
      if (hit && Date.now() - hit.generatedAt < CACHE_TTL_MS) {
        return { ...hit, cached: true };
      }
    }

    if (!this.client) {
      return { text: 'ANTHROPIC_API_KEY no configurada.', generatedAt: Date.now(), cached: false };
    }

    const prompt = companyId === 'GRUPO'
      ? await this.buildGrupoPrompt(year)
      : await this.buildCompanyPrompt(companyId, year);

    const msg = await this.client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const entry = { text, generatedAt: Date.now() };
    this.cache.set(cacheKey, entry);
    return { ...entry, cached: false };
  }

  private async buildCompanyPrompt(companyId: string, year: number): Promise<string> {
    const [dashboard, cxc, cxp, caja] = await Promise.all([
      this.kpi.getDashboard(companyId, year).catch(() => null),
      this.kpi.getCxC(companyId).catch(() => null),
      this.kpi.getCxP(companyId).catch(() => null),
      this.kpi.getCaja(companyId, year).catch(() => null),
    ]);
    return buildCompanyPrompt(companyId, year, dashboard, cxc, cxp, caja);
  }

  private async buildGrupoPrompt(year: number): Promise<string> {
    const [consolidado, scorecard] = await Promise.all([
      this.kpi.getConsolidado(year).catch(() => null),
      this.kpi.getScorecard(year).catch(() => null),
    ]);
    return buildGrupoPrompt(year, consolidado, scorecard);
  }
}

// Formatea un valor en soles como millones sin separadores de miles (sin ambigüedad para el modelo IA).
// Usa punto como decimal, "M" como sufijo. Ej: 8250000 → "S/ 8.25M"
function fmtM(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return 'N/D';
  const m = n / 1_000_000;
  const sign = m < 0 ? '-' : '';
  return `${sign}S/ ${Math.abs(m).toFixed(2)}M`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return 'N/D';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function buildCompanyPrompt(companyId: string, year: number, dashboard: any, cxc: any, cxp: any, caja: any): string {
  const ytd = dashboard?.ytd ?? {};
  const prevYear = year - 1;

  const ventas      = ytd.ventas      ?? ytd.ingresos ?? null;
  const ventasPrev  = ytd.ventasPrevYear ?? null;
  const varVentas   = ventas && ventasPrev ? ((ventas - ventasPrev) / Math.abs(ventasPrev)) * 100 : null;

  const ebitda      = ytd.ebitda      ?? null;
  const ebitdaPrev  = ytd.ebitdaPrevYear ?? null;
  const margenEbitda     = ventas && ebitda != null      ? (ebitda / ventas) * 100      : null;
  const margenEbitdaPrev = ventasPrev && ebitdaPrev != null ? (ebitdaPrev / ventasPrev) * 100 : null;
  const utilidadNeta     = ytd.utilidadNeta ?? null;
  const margenBruto      = ventas && ytd.utilidadBruta ? (ytd.utilidadBruta / ventas) * 100 : null;

  // CxC — totalSaldo y total90mas están en soles
  const cxcTotal  = cxc?.totalSaldo  ?? null;
  const cxcVenc90 = cxc?.total90mas  ?? null;
  const cxcPct90  = cxcTotal && cxcVenc90 ? (cxcVenc90 / cxcTotal) * 100 : null;
  const topClientes = (cxc?.clientes ?? []).slice(0, 3)
    .map((c: any) => `${c.cliente || c.nombre || c.codCliente}: ${fmtM(c.saldoTotalSoles)}`)
    .join(', ');

  // CxP — totalSaldo y total90mas están en soles
  const cxpTotal  = cxp?.totalSaldo  ?? null;
  const cxpVenc90 = cxp?.total90mas  ?? null;
  const cxpPct90  = cxpTotal && cxpVenc90 ? (cxpVenc90 / cxpTotal) * 100 : null;

  // Caja — saldoActual en soles
  const cajaActual  = caja?.saldoActual  ?? null;
  const cajaRunway  = caja?.runwayMeses  ?? null;

  return `Eres un analista financiero senior con estilo McKinsey. Redacta un análisis ejecutivo en español en EXACTAMENTE 4 párrafos cortos y directos, sin títulos, sin bullets, sin markdown. Solo prosa ejecutiva concisa.

DATOS FINANCIEROS — ${companyId} | Año ${year} (YTD acumulado):
Todos los montos están expresados en millones de soles (M = millones).

P&L:
- Ventas: ${fmtM(ventas)}${varVentas != null ? ` (${fmtPct(varVentas)} vs ${prevYear})` : ''}
- EBITDA: ${fmtM(ebitda)}${margenEbitda != null ? ` | Margen EBITDA: ${margenEbitda.toFixed(1)}%` : ''}${margenEbitdaPrev != null ? ` (${prevYear}: ${margenEbitdaPrev.toFixed(1)}%)` : ''}
- Margen bruto: ${margenBruto != null ? `${margenBruto.toFixed(1)}%` : 'N/D'}
- Utilidad neta: ${fmtM(utilidadNeta)}

Cuentas por Cobrar (CxC):
- Saldo total: ${fmtM(cxcTotal)}
- Vencida >90 días: ${fmtM(cxcVenc90)}${cxcPct90 != null ? ` (${cxcPct90.toFixed(1)}% del total)` : ''}
- Top 3 clientes por saldo pendiente: ${topClientes || 'N/D'}

Cuentas por Pagar (CxP):
- Saldo total: ${fmtM(cxpTotal)}
- Vencida >90 días: ${fmtM(cxpVenc90)}${cxpPct90 != null ? ` (${cxpPct90.toFixed(1)}% del total)` : ''}

Posición de caja:
- Saldo actual: ${fmtM(cajaActual)}
- Runway estimado: ${cajaRunway != null ? `${cajaRunway.toFixed(1)} meses` : 'N/D'}

INSTRUCCIONES:
Párrafo 1: Situación de resultados — ventas y márgenes, qué mejoró o deterioró vs año anterior.
Párrafo 2: Riesgo de cartera — estado de la CxC, concentración y vencimientos críticos.
Párrafo 3: Liquidez y obligaciones — posición de caja, runway, presión de CxP vencida.
Párrafo 4: Recomendación ejecutiva — 2 o 3 acciones concretas, priorizadas, con sentido de urgencia.

Sé directo. Si un número es negativo o preocupante, dilo claramente. Usa las cifras exactas del análisis en formato millones (M).`;
}

function buildGrupoPrompt(year: number, consolidado: any, scorecard: any): string {
  const prevYear = year - 1;
  const ytd = consolidado?.ytd ?? {};

  const ventas       = ytd.ingresos    ?? null;
  const ebitda       = ytd.ebitda      ?? null;
  const margenEbitda = ventas && ebitda != null ? (ebitda / ventas) * 100 : null;
  const margenBruto  = ventas && ytd.margenBruto ? (ytd.margenBruto / ventas) * 100 : null;
  const utilidadNeta = ytd.utilidadNeta ?? null;

  const empresas: any[] = consolidado?.empresas ?? [];
  const empresasLines = empresas.map((e: any) => {
    const ing = e.ytd?.ingresos ?? null;
    const ebt = e.ytd?.ebitda   ?? null;
    const mg  = ing && ebt != null ? (ebt / ing * 100).toFixed(1) + '%' : 'N/D';
    return `  • ${e.shortName || e.name}: ${fmtM(ing)} ingresos | EBITDA ${mg}`;
  }).join('\n');

  const companies: any[] = scorecard?.companies ?? [];
  const cxcGrupo      = companies.reduce((s: number, c: any) => s + (c.cxcSaldo  ?? 0), 0);
  const cxpGrupo      = companies.reduce((s: number, c: any) => s + (c.cxpSaldo  ?? 0), 0);
  const cajaTotal     = companies.reduce((s: number, c: any) => s + (c.cajaTotal ?? 0), 0);
  const workingCapital = cxcGrupo - cxpGrupo;

  const dsoLines = companies
    .filter((c: any) => c.dso != null)
    .map((c: any) => `  • ${c.name?.split(' ')[0]}: DSO ${c.dso}d / DPO ${c.dpo ?? 'N/D'}d`)
    .join('\n');

  return `Eres un analista financiero senior con estilo McKinsey. Redacta un análisis ejecutivo consolidado del GRUPO en español en EXACTAMENTE 4 párrafos cortos y directos, sin títulos, sin bullets, sin markdown. Solo prosa ejecutiva concisa.

DATOS FINANCIEROS CONSOLIDADOS — GRUPO | Año ${year} (YTD acumulado):
Todos los montos están expresados en millones de soles (M = millones).

P&L Consolidado:
- Ingresos totales: ${fmtM(ventas)}
- EBITDA consolidado: ${fmtM(ebitda)}${margenEbitda != null ? ` | Margen: ${margenEbitda.toFixed(1)}%` : ''}
- Margen bruto: ${margenBruto != null ? `${margenBruto.toFixed(1)}%` : 'N/D'}
- Utilidad neta: ${fmtM(utilidadNeta)}

Desempeño por empresa:
${empresasLines || '  N/D'}

Capital de trabajo del Grupo:
- CxC total: ${fmtM(cxcGrupo)}
- CxP total: ${fmtM(cxpGrupo)}
- Working capital neto: ${fmtM(workingCapital)}
- Caja consolidada: ${fmtM(cajaTotal)}

Eficiencia de cobro y pago por empresa:
${dsoLines || '  N/D'}

INSTRUCCIONES:
Párrafo 1: Resultados del grupo — ingresos, EBITDA consolidado y qué empresa lidera o arrastra el desempeño.
Párrafo 2: Diversificación y riesgo — concentración de ingresos entre empresas, fortalezas y vulnerabilidades del portafolio.
Párrafo 3: Capital de trabajo y liquidez — working capital, eficiencia de cobro/pago (DSO/DPO), presión de caja.
Párrafo 4: Recomendación estratégica — 2 o 3 acciones a nivel grupo, priorizadas, con foco en sinergias o riesgos sistémicos.

Sé directo. Menciona empresas por nombre cuando sea relevante. Usa las cifras exactas en formato millones (M).`;
}
