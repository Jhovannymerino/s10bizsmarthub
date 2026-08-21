import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S10Service } from '../s10/s10.service';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

// Fecha 'DD/MM/YYYY' (formato CONVERT 103 de S10) → 'YYYY-MM-DD' para comparar rangos.
function fechaDDMMYYYYtoISO(f: string): string {
  if (!f) return '';
  const [d, m, y] = String(f).split('/');
  return y ? `${y}-${m}-${d}` : String(f);
}
// Desplaza el año de una fecha ISO (para comparar el mismo rango del año anterior).
function shiftISOYear(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-');
  return `${parseInt(y, 10) + delta}-${m}-${d}`;
}

// Tipo de cambio PEN/USD de respaldo cuando S10 no registra TC en el documento.
// Actualizar si el TC de referencia cambia significativamente (>5%).
const TC_USD_FALLBACK = 3.80;

@Injectable()
export class KpiService {
  private readonly logger = new Logger(KpiService.name);

  // TTL in-memory cache: avoids repeated DB hits for same snapshot within 5 min
  private readonly snapshotCache = new Map<string, { value: any; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(
    private prisma: PrismaService,
    private s10: S10Service,
  ) {}

  private cacheKey(companyId: string, kpiType: string, period: string): string {
    return `${companyId}|${kpiType}|${period}`;
  }

  private cacheGet(key: string): any | null {
    const entry = this.snapshotCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this.snapshotCache.delete(key); return null; }
    return entry.value;
  }

  private cacheSet(key: string, value: any): void {
    this.snapshotCache.set(key, { value, expiresAt: Date.now() + this.CACHE_TTL_MS });
  }

  // Call after sync to invalidate stale entries for a company
  invalidateSnapshotCache(companyId?: string): void {
    if (!companyId) { this.snapshotCache.clear(); return; }
    for (const key of this.snapshotCache.keys()) {
      if (key.startsWith(`${companyId}|`)) this.snapshotCache.delete(key);
    }
  }

  // ─────────────────────────────────────────────
  // Snapshot helpers
  // ─────────────────────────────────────────────

  async getSnapshot(companyId: string, kpiType: string, period: string) {
    const key = this.cacheKey(companyId, kpiType, period);
    const hit = this.cacheGet(key);
    if (hit !== null) return hit;

    const result = await this.prisma.kpiSnapshot.findUnique({
      where: { companyId_kpiType_period: { companyId, kpiType, period } },
    });
    if (result !== null) this.cacheSet(key, result);
    return result;
  }

  async saveSnapshot(
    companyId: string,
    companyName: string,
    kpiType: string,
    period: string,
    year: number,
    month: number | null,
    data: any,
  ) {
    const result = await this.prisma.kpiSnapshot.upsert({
      where: { companyId_kpiType_period: { companyId, kpiType, period } },
      update: { data, year, syncedAt: new Date(), companyName },
      create: { companyId, companyName, kpiType, period, year, month, data },
    });
    // Keep cache warm with fresh data
    this.cacheSet(this.cacheKey(companyId, kpiType, period), result);
    return result;
  }

  // ─────────────────────────────────────────────
  // Company resolver
  // ─────────────────────────────────────────────

  private async resolveCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { codEmpresa: companyId } });
    if (!company) throw new NotFoundException(`Company ${companyId} not found`);
    return company;
  }

  // ─────────────────────────────────────────────
  // Dashboard (P&L + KPI cards) — incluye prevYear para YoY
  // ─────────────────────────────────────────────

  async getDashboard(companyId: string, year: number) {
    const period = `${year}`;

    // Fetch current + prev year snapshots in parallel to cut latency in half
    const [cached, prevCached] = await Promise.all([
      this.getSnapshot(companyId, 'pl', period),
      this.getSnapshot(companyId, 'pl', `${year - 1}`),
    ]);

    let dashboard: any;

    if (cached) {
      this.logger.debug(`Cache hit: ${companyId}/pl/${period}`);
      dashboard = cached.data;
    } else if (this.s10.isDirectMode) {
      const company = await this.resolveCompany(companyId);
      const rows = await this.s10.getPLCompleto(companyId, company.claseIngreso, year);
      dashboard = this.buildDashboardFromPL(rows, company.claseIngreso);
      await this.saveSnapshot(companyId, company.name, 'pl', period, year, null, dashboard);
    } else {
      return { message: 'No data available. Run sync first.', year };
    }

    // Comparativo YoY: mismo período del año anterior (no año completo)
    let prevYear: any = null;

    const prevCachedData = prevCached?.data as any;
    if (prevCachedData?.plMonthly) {
      // Período definido por el último mes con ingresos (no por costos residuales)
      const lastMonthWithIngresos = Math.max(
        0,
        ...(dashboard.plMonthly as any[])
          .filter((m: any) => m.ingresos > 0)
          .map((m: any) => m.mes as number),
      );
      const activeMonths = new Set(
        lastMonthWithIngresos > 0
          ? Array.from({ length: lastMonthWithIngresos }, (_, i) => i + 1)
          : [],
      );

      const prevMonths = (prevCachedData.plMonthly as any[]).filter((m: any) => activeMonths.has(m.mes));

      if (prevMonths.length > 0) {
        const zero = { ingresos: 0, costoDirecto: 0, margenBruto: 0, gav: 0, ebitda: 0, gastosFinancieros: 0, diferenciaCambio: 0, utilidadNeta: 0 };
        const py = prevMonths.reduce((acc: any, m: any) => ({
          ingresos: acc.ingresos + m.ingresos,
          costoDirecto: acc.costoDirecto + m.costoDirecto,
          margenBruto: acc.margenBruto + m.margenBruto,
          gav: acc.gav + m.gav,
          ebitda: acc.ebitda + m.ebitda,
          gastosFinancieros: acc.gastosFinancieros + m.gastosFinancieros,
          diferenciaCambio: acc.diferenciaCambio + (m.diferenciaCambio ?? 0),
          utilidadNeta: acc.utilidadNeta + m.utilidadNeta,
        }), zero);

        if (py.ingresos !== 0) {
          py.margenBrutoPct = round((py.margenBruto / py.ingresos) * 100);
          py.ebitdaPct = round((py.ebitda / py.ingresos) * 100);
          py.margenNetoPct = round((py.utilidadNeta / py.ingresos) * 100);
          py.utilidadNetaPct = py.margenNetoPct;
          py.gavPct = round((py.gav / py.ingresos) * 100);
        }

        const sortedMonths = [...activeMonths].sort((a, b) => a - b);
        prevYear = { ytd: py, year: year - 1, meses: sortedMonths };
      }
    }

    return { ...dashboard, prevYear };
  }

  // ─────────────────────────────────────────────
  // Build dashboard from raw P&L rows
  // ─────────────────────────────────────────────

  buildDashboardFromPL(rows: any[], claseIngreso: string) {
    // P&L completo por clases contables (PCGE):
    //  70=ingresos oper · 75=otros ingresos · 77=ingresos financieros (incl. 776 ganancia dif.cambio)
    //  79=cargas imputables (contra-asiento de clase 9x, se ignora) · 91=costo · 94=gastos adm ·
    //  95=gastos de ventas (94+95 = GAV) · 97=gastos financieros (incl. 976 perdida dif.cambio).
    // La diferencia de cambio se presenta NETA (ganancia 776 − perdida 976); positivo = ganancia.
    const monthly: Record<number, {
      ingresos: number;
      otrosIngresos: number;
      ingresosFinancieros: number;
      costo: number;
      gav: number;
      gastosFinancieros: number;
      diferenciaCambio: number;
    }> = {};

    for (let m = 1; m <= 12; m++) {
      monthly[m] = { ingresos: 0, otrosIngresos: 0, ingresosFinancieros: 0, costo: 0, gav: 0, gastosFinancieros: 0, diferenciaCambio: 0 };
    }

    const detalleMap: Record<string, Record<string, any>> = {
      ingresos: {},
      otrosIngresos: {},
      ingresosFinancieros: {},
      costoDirecto: {},
      gav: {},
      gastosFinancieros: {},
      diferenciaCambio: {},
    };

    for (const row of rows) {
      const mes = row.Mes as number;
      const debito = parseFloat(row.TotalDebito) || 0;
      const credito = parseFloat(row.TotalCredito) || 0;
      const clase = row.Clase as string;
      const cod = row.CodCuenta as string;
      const des = row.DesCuenta as string;

      let grupo: string | null = null;
      let valor = 0;

      if (clase === claseIngreso) {
        valor = credito - debito; monthly[mes].ingresos += valor; grupo = 'ingresos';
      } else if (clase === '75') {
        valor = credito - debito; monthly[mes].otrosIngresos += valor; grupo = 'otrosIngresos';
      } else if (clase === '77') {
        if (cod.startsWith('776')) {
          // Ganancia por diferencia de cambio → suma a la dif. de cambio NETA
          valor = credito - debito; monthly[mes].diferenciaCambio += valor; grupo = 'diferenciaCambio';
        } else {
          valor = credito - debito; monthly[mes].ingresosFinancieros += valor; grupo = 'ingresosFinancieros';
        }
      } else if (clase === '79') {
        // ignorar — es el contra-asiento de clase 9x, no un costo real
      } else if (clase === '91') {
        valor = debito - credito; monthly[mes].costo += valor; grupo = 'costoDirecto';
      } else if (clase === '94' || clase === '95') {
        // GAV = gastos administrativos (94) + gastos de ventas (95)
        valor = debito - credito; monthly[mes].gav += valor; grupo = 'gav';
      } else if (clase === '97') {
        if (cod.startsWith('976')) {
          // Pérdida por diferencia de cambio → resta de la dif. de cambio NETA (valor negativo)
          valor = -(debito - credito); monthly[mes].diferenciaCambio += valor; grupo = 'diferenciaCambio';
        } else {
          valor = debito - credito; monthly[mes].gastosFinancieros += valor; grupo = 'gastosFinancieros';
        }
      }

      if (grupo && valor !== 0) {
        if (!detalleMap[grupo][cod]) {
          detalleMap[grupo][cod] = { codCuenta: cod, descripcion: des, meses: {}, ytd: 0 };
          for (let m2 = 1; m2 <= 12; m2++) detalleMap[grupo][cod].meses[m2] = 0;
        }
        detalleMap[grupo][cod].meses[mes] = round((detalleMap[grupo][cod].meses[mes] || 0) + valor);
        detalleMap[grupo][cod].ytd = round(detalleMap[grupo][cod].ytd + valor);
      }
    }

    const plMonthly = Object.entries(monthly).map(([mesStr, v]) => {
      const mes = parseInt(mesStr);
      const costoNeto = v.costo;
      const margenBruto = v.ingresos - costoNeto;
      const ebitda = margenBruto - v.gav;
      // Utilidad neta = EBITDA + otros ingresos + ingresos financieros − gastos financieros + dif. cambio NETA
      const utilidadNeta = ebitda + v.otrosIngresos + v.ingresosFinancieros - v.gastosFinancieros + v.diferenciaCambio;

      return {
        mes,
        mesLabel: MONTHS[mes - 1],
        ingresos: round(v.ingresos),
        otrosIngresos: round(v.otrosIngresos),
        ingresosFinancieros: round(v.ingresosFinancieros),
        costoDirecto: round(costoNeto),
        margenBruto: round(margenBruto),
        margenBrutoPct: v.ingresos > 0 ? round((margenBruto / v.ingresos) * 100) : 0,
        gav: round(v.gav),
        ebitda: round(ebitda),
        ebitdaPct: v.ingresos > 0 ? round((ebitda / v.ingresos) * 100) : 0,
        gastosFinancieros: round(v.gastosFinancieros),
        diferenciaCambio: round(v.diferenciaCambio),
        utilidadNeta: round(utilidadNeta),
        utilidadNetaPct: v.ingresos > 0 ? round((utilidadNeta / v.ingresos) * 100) : 0,
      };
    });

    const ytd = plMonthly.reduce(
      (acc, m) => ({
        ingresos: acc.ingresos + m.ingresos,
        otrosIngresos: acc.otrosIngresos + m.otrosIngresos,
        ingresosFinancieros: acc.ingresosFinancieros + m.ingresosFinancieros,
        costoDirecto: acc.costoDirecto + m.costoDirecto,
        margenBruto: acc.margenBruto + m.margenBruto,
        gav: acc.gav + m.gav,
        ebitda: acc.ebitda + m.ebitda,
        gastosFinancieros: acc.gastosFinancieros + m.gastosFinancieros,
        diferenciaCambio: acc.diferenciaCambio + (m.diferenciaCambio ?? 0),
        utilidadNeta: acc.utilidadNeta + m.utilidadNeta,
      }),
      { ingresos: 0, otrosIngresos: 0, ingresosFinancieros: 0, costoDirecto: 0, margenBruto: 0, gav: 0, ebitda: 0, gastosFinancieros: 0, diferenciaCambio: 0, utilidadNeta: 0 },
    );

    ytd['margenBrutoPct'] = ytd.ingresos > 0 ? round((ytd.margenBruto / ytd.ingresos) * 100) : 0;
    ytd['ebitdaPct'] = ytd.ingresos > 0 ? round((ytd.ebitda / ytd.ingresos) * 100) : 0;
    ytd['margenNetoPct'] = ytd.ingresos > 0 ? round((ytd.utilidadNeta / ytd.ingresos) * 100) : 0;
    ytd['utilidadNetaPct'] = ytd['margenNetoPct']; // alias para compatibilidad con PL_ROWS del frontend
    ytd['gavPct'] = ytd.ingresos > 0 ? round((ytd.gav / ytd.ingresos) * 100) : 0;
    ytd['costoPct'] = ytd.ingresos > 0 ? round((ytd.costoDirecto / ytd.ingresos) * 100) : 0;
    // Cobertura de intereses: EBITDA / carga financiera (gastos financieros + pérdida NETA por dif. de cambio si la hubiera)
    const cargaFin = ytd.gastosFinancieros + (ytd.diferenciaCambio < 0 ? -ytd.diferenciaCambio : 0);
    ytd['covIntereses'] = cargaFin > 0 ? round(ytd.ebitda / cargaFin) : null;

    const detalle = {
      ingresos: Object.values(detalleMap.ingresos).sort((a: any, b: any) => b.ytd - a.ytd),
      otrosIngresos: Object.values(detalleMap.otrosIngresos).sort((a: any, b: any) => b.ytd - a.ytd),
      ingresosFinancieros: Object.values(detalleMap.ingresosFinancieros).sort((a: any, b: any) => b.ytd - a.ytd),
      costoDirecto: Object.values(detalleMap.costoDirecto).sort((a: any, b: any) => b.ytd - a.ytd),
      gav: Object.values(detalleMap.gav).sort((a: any, b: any) => b.ytd - a.ytd),
      gastosFinancieros: Object.values(detalleMap.gastosFinancieros).sort((a: any, b: any) => b.ytd - a.ytd),
      diferenciaCambio: Object.values(detalleMap.diferenciaCambio).sort((a: any, b: any) => b.ytd - a.ytd),
    };

    return { plMonthly, ytd, detalle };
  }

  // ─────────────────────────────────────────────
  // P&L por RANGO de fechas (desde/hasta) — derivado del snapshot `transactions`
  // (mismas cuentas y mismo mapeo que el P&L mensual → cuadra al centavo).
  // Default (año completo o sin rango) delega en getDashboard: comportamiento intacto.
  // ─────────────────────────────────────────────
  async getDashboardRange(companyId: string, year: number, desde?: string, hasta?: string) {
    const fullYear =
      (!desde || desde <= `${year}-01-01`) && (!hasta || hasta >= `${year}-12-31`);
    if (fullYear) return this.getDashboard(companyId, year);

    const company = await this.resolveCompany(companyId);
    const claseIngreso = (company as any)?.claseIngreso ?? '70';

    const txSnap = await this.getSnapshot(companyId, 'transactions', `${year}`);
    if (!txSnap) {
      // Sin detalle transaccional para ese año → no se puede acotar por fecha
      const full = await this.getDashboard(companyId, year);
      return { ...full, rango: { desde, hasta }, rangoNoDisponible: true };
    }

    // transactions no trae DesCuenta → mapa codCuenta→descripción del P&L cacheado
    const plSnap = await this.getSnapshot(companyId, 'pl', `${year}`);
    const descMap = this.buildDescMap((plSnap?.data as any)?.detalle);

    const d = desde || `${year}-01-01`;
    const h = hasta || `${year}-12-31`;
    const adapt = (snapRows: any[], withDesc: boolean) =>
      (snapRows || [])
        .filter((r) => {
          const iso = fechaDDMMYYYYtoISO(r.Fecha);
          return iso >= d && iso <= h;
        })
        .map((r) => ({
          Mes: r.Mes,
          Clase: r.Clase,
          CodCuenta: r.CodCuenta,
          DesCuenta: withDesc ? descMap[r.CodCuenta] || r.CodCuenta : r.CodCuenta,
          TotalDebito: r.Debito,
          TotalCredito: r.Credito,
        }));

    const dashboard = this.buildDashboardFromPL(adapt(txSnap.data as any[], true), claseIngreso);

    // Comparativo con el MISMO rango del año anterior (si hay transactions)
    let prevYear: any = null;
    const prevTx = await this.getSnapshot(companyId, 'transactions', `${year - 1}`);
    if (prevTx) {
      const pd = shiftISOYear(d, -1);
      const ph = shiftISOYear(h, -1);
      const prevRows = (prevTx.data as any[]).filter((r) => {
        const iso = fechaDDMMYYYYtoISO(r.Fecha);
        return iso >= pd && iso <= ph;
      }).map((r) => ({
        Mes: r.Mes, Clase: r.Clase, CodCuenta: r.CodCuenta,
        DesCuenta: r.CodCuenta, TotalDebito: r.Debito, TotalCredito: r.Credito,
      }));
      const prevDash = this.buildDashboardFromPL(prevRows, claseIngreso);
      prevYear = { ytd: prevDash.ytd, year: year - 1, rango: { desde: pd, hasta: ph } };
    }

    return { ...dashboard, prevYear, rango: { desde: d, hasta: h } };
  }

  private buildDescMap(detalle: any): Record<string, string> {
    const map: Record<string, string> = {};
    if (!detalle) return map;
    for (const grupo of Object.values(detalle) as any[]) {
      if (Array.isArray(grupo)) {
        for (const c of grupo) if (c?.codCuenta) map[c.codCuenta] = c.descripcion || c.codCuenta;
      }
    }
    return map;
  }

  // ─────────────────────────────────────────────
  // CxC — con métricas de concentración
  // ─────────────────────────────────────────────

  async getCxC(companyId: string, incluirAnulados = false) {
    const period = 'current';
    const cached = await this.getSnapshot(companyId, 'cxc', period);
    let data: any;
    if (cached) {
      data = cached.data;
    } else if (this.s10.isDirectMode) {
      const company = await this.resolveCompany(companyId);
      const rows = await this.s10.getCxC(companyId);
      data = this.buildCxC(rows);
      await this.saveSnapshot(companyId, company.name, 'cxc', period, new Date().getFullYear(), null, data);
    } else {
      return { message: 'No data available. Run sync first.' };
    }

    data = await this.enrichCxCReconciliacion(companyId, data);
    if (incluirAnulados) data = await this.augmentCxCAnulados(companyId, data);
    return data;
  }

  // CxC por RANGO de FECHA DE EMISIÓN (FechaDocumento). Deriva de cxc_docs sin resync: la
  // cartera queda acotada a los documentos emitidos en [desde, hasta]. Sin rango delega en
  // getCxC (comportamiento con reconciliación al Mayor intacto). En modo rango NO se muestra
  // el saldo contable del Mayor (es un saldo puntual, no filtrable por fecha de emisión).
  async getCxCRange(companyId: string, desde?: string, hasta?: string) {
    if (!desde && !hasta) return this.getCxC(companyId);
    const docsSnap = await this.getSnapshot(companyId, 'cxc_docs', 'current');
    if (!docsSnap) return this.getCxC(companyId);
    const d = desde || '0000-01-01';
    const h = hasta || '9999-12-31';
    const map = new Map<string, any>();
    for (const doc of (docsSnap.data as any[])) {
      const iso = fechaDDMMYYYYtoISO(String(doc.FechaDocumento || ''));
      if (!iso || iso < d || iso > h) continue;
      const key = String(doc.CodCliente);
      const esUSD = String(doc.Moneda || '01').trim() === '02';
      const orig = parseFloat(doc.Saldo) || 0;
      const soles = esUSD ? round(orig * TC_USD_FALLBACK) : orig;
      if (!map.has(key)) map.set(key, {
        codCliente: doc.CodCliente, cliente: doc.Cliente || key,
        saldoPEN: 0, saldoUSD: 0, tipoCambioUSD: TC_USD_FALLBACK, saldoTotalSoles: 0,
        saldoVigente: 0, dias0_30: 0, dias31_60: 0, dias61_90: 0, dias90mas: 0, numDocs: 0,
      });
      const c = map.get(key);
      if (esUSD) c.saldoUSD = round(c.saldoUSD + orig); else c.saldoPEN = round(c.saldoPEN + orig);
      c.saldoTotalSoles = round(c.saldoTotalSoles + soles);
      const dv = Number(doc.DiasVencido) || 0;
      if (dv <= 0) c.saldoVigente = round(c.saldoVigente + soles);
      else if (dv <= 30) c.dias0_30 = round(c.dias0_30 + soles);
      else if (dv <= 60) c.dias31_60 = round(c.dias31_60 + soles);
      else if (dv <= 90) c.dias61_90 = round(c.dias61_90 + soles);
      else c.dias90mas = round(c.dias90mas + soles);
      c.numDocs++;
    }
    const clientes = [...map.values()].filter((c) => Math.abs(c.saldoTotalSoles) > 0.01)
      .sort((a, b) => b.saldoTotalSoles - a.saldoTotalSoles);
    const sum = (f: string) => round(clientes.reduce((s, c) => s + (c[f] || 0), 0));
    const totalSaldo = sum('saldoTotalSoles');
    const top3 = clientes.slice(0, 3).reduce((s, c) => s + c.saldoTotalSoles, 0);
    return {
      clientes, clientesVinculados: [], rango: { desde: desde || null, hasta: hasta || null }, rangoModo: true,
      totalSaldo, totalDocs: totalSaldo, totalVinculados: 0, numVinculados: 0,
      totalSaldoPEN: sum('saldoPEN'), totalSaldoUSD: sum('saldoUSD'),
      totalVigente: sum('saldoVigente'), total90mas: sum('dias90mas'),
      pct90mas: totalSaldo > 0 ? round((sum('dias90mas') / totalSaldo) * 100) : 0,
      concentracionTop3: totalSaldo > 0 ? round((top3 / totalSaldo) * 100) : 0,
      numClientes: clientes.length,
    };
  }

  // Saldo CONTABLE de la cartera (cuenta 12) por tercero a una FECHA DE CORTE, desde el Mayor.
  // Milka: "ver el saldo a un determinado periodo". Acumula clase 12 (subcuentas 1211 "por
  // emitir" + 1212 "emitidas", igual que la reconciliación) con fecha <= corte. Excluye el
  // asiento de cierre de ejercicio (revierte saldos para el arrastre entre años); el asiento
  // de apertura SÍ cuenta (es el saldo inicial). Ata al balance de comprobación a esa fecha.
  // No trae aging: el envejecimiento a una fecha pasada exigiría el estado de pago histórico,
  // que el snapshot no guarda.
  //
  // Cierre/apertura: el cierre de cada dic (Cr que lleva a cero) se cancela con la apertura de
  // enero siguiente (Db que reabre). Por eso se incluyen los cierres de años PREVIOS al corte
  // (sus aperturas ya ocurrieron y cancelan) y solo se excluye el cierre del AÑO DEL CORTE (su
  // apertura aún no ocurre → aplicarlo dejaría el saldo en ~0). Verificado: CMO @hoy = 6,315,610.84
  // = reconciliación viva; INTEGRAL @31-dic-2025 pre-cierre = 7,139,078.10.
  async getCxCSaldoAFecha(companyId: string, hasta: string) {
    const grupo = await this.prisma.company.findMany({ select: { codEmpresa: true } });
    const grupoRuc = new Set(
      grupo.map((g) => String(g.codEmpresa)).filter((r) => r !== String(companyId)),
    );
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "codTercero" AS ruc, MAX("tercero") AS nombre, LEFT("codCuenta",4) AS sub,
              SUM("debito" - "credito")::float8 AS saldo
         FROM "LedgerEntry"
        WHERE "companyId" = $1 AND LEFT("codCuenta",2) = '12'
          AND "fecha"::date <= $2::date
          AND NOT (UPPER(COALESCE("glosa",'')) = 'ASIENTO DE CIERRE'
                   AND EXTRACT(YEAR FROM "fecha") = EXTRACT(YEAR FROM $2::date))
        GROUP BY "codTercero", LEFT("codCuenta",4)`,
      companyId, hasta,
    );
    const map = new Map<string, { nombre: string; emitidas: number; porEmitir: number }>();
    for (const r of rows) {
      if (r.ruc == null) continue;
      const ruc = String(r.ruc);
      const e = map.get(ruc) || { nombre: r.nombre || ruc, emitidas: 0, porEmitir: 0 };
      if (r.nombre) e.nombre = r.nombre;
      if (r.sub === '1212') e.emitidas = round(e.emitidas + (Number(r.saldo) || 0));
      else if (r.sub === '1211') e.porEmitir = round(e.porEmitir + (Number(r.saldo) || 0));
      map.set(ruc, e);
    }
    const terceros: any[] = [];
    const vinculados: any[] = [];
    for (const [ruc, l] of map) {
      const saldoLedger = round(l.emitidas + l.porEmitir);
      if (Math.abs(saldoLedger) < 0.01) continue;
      (grupoRuc.has(ruc) ? vinculados : terceros).push({
        codCliente: ruc, cliente: l.nombre, esVinculada: grupoRuc.has(ruc),
        emitidas: l.emitidas, porEmitir: l.porEmitir,
        saldoLedger, saldoTotalSoles: saldoLedger, saldoDocs: saldoLedger, diferencia: 0,
      });
    }
    terceros.sort((a, b) => b.saldoLedger - a.saldoLedger);
    vinculados.sort((a, b) => b.saldoLedger - a.saldoLedger);
    const sum = (arr: any[], f: string) => round(arr.reduce((s, x) => s + (x[f] || 0), 0));
    const totalSaldo = sum(terceros, 'saldoLedger');
    const top3 = terceros.slice(0, 3).reduce((s, c) => s + (c.saldoLedger || 0), 0);
    return {
      modo: 'saldo-a-fecha', fechaCorte: hasta, rangoModo: true,
      clientes: terceros, clientesVinculados: vinculados,
      totalSaldo, totalDocs: totalSaldo,
      totalEmitidas: sum(terceros, 'emitidas'), totalPorEmitir: sum(terceros, 'porEmitir'),
      totalVinculados: sum(vinculados, 'saldoLedger'), numVinculados: vinculados.length,
      concentracionTop3: totalSaldo > 0 ? round((top3 / totalSaldo) * 100) : 0,
      numClientes: terceros.length, totalVigente: 0, total90mas: 0, pct90mas: 0,
    };
  }

  // Saldo CONTABLE de las cuentas por pagar (clase 42) por proveedor a una FECHA DE CORTE.
  // Clase 42 es acreedora → saldo = Σ(crédito − débito). Mismo criterio de cierre/apertura y
  // segregación intercompañía que getCxCSaldoAFecha.
  async getCxPSaldoAFecha(companyId: string, hasta: string) {
    const grupo = await this.prisma.company.findMany({ select: { codEmpresa: true } });
    const grupoRuc = new Set(
      grupo.map((g) => String(g.codEmpresa)).filter((r) => r !== String(companyId)),
    );
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "codTercero" AS ruc, MAX("tercero") AS nombre,
              SUM("credito" - "debito")::float8 AS saldo
         FROM "LedgerEntry"
        WHERE "companyId" = $1 AND LEFT("codCuenta",2) = '42'
          AND "fecha"::date <= $2::date
          AND NOT (UPPER(COALESCE("glosa",'')) = 'ASIENTO DE CIERRE'
                   AND EXTRACT(YEAR FROM "fecha") = EXTRACT(YEAR FROM $2::date))
        GROUP BY "codTercero"`,
      companyId, hasta,
    );
    const proveedores: any[] = [];
    const vinculados: any[] = [];
    for (const r of rows) {
      if (r.ruc == null) continue;
      const ruc = String(r.ruc);
      const saldo = round(Number(r.saldo) || 0);
      if (Math.abs(saldo) < 0.01) continue;
      (grupoRuc.has(ruc) ? vinculados : proveedores).push({
        codProveedor: ruc, proveedor: r.nombre || ruc, esVinculada: grupoRuc.has(ruc),
        saldoTotal: saldo, saldoTotalSoles: saldo,
      });
    }
    proveedores.sort((a, b) => b.saldoTotal - a.saldoTotal);
    vinculados.sort((a, b) => b.saldoTotal - a.saldoTotal);
    const sum = (arr: any[]) => round(arr.reduce((s, x) => s + (x.saldoTotal || 0), 0));
    const total = sum(proveedores);
    return {
      modo: 'saldo-a-fecha', fechaCorte: hasta, rangoModo: true,
      proveedores, proveedoresVinculados: vinculados,
      total, totalSaldo: total, totalVinculados: sum(vinculados),
      numProveedores: proveedores.length, numVinculados: vinculados.length,
      total90mas: 0, pct90mas: 0,
    };
  }

  // ── Saldo a fecha de corte GENÉRICO para rubros de balance (Milka: validar el saldo de
  // cada rubro a un periodo cerrado). Mismo criterio de cierre/apertura que CxC/CxP: acumula
  // la(s) clase(s) del Mayor con fecha <= corte, excluyendo sólo el cierre del año del corte.
  // Signo por naturaleza (deudor = Db−Cr, acreedor = Cr−Db). Agrupa por tercero o por cuenta;
  // para cuenta toma el nombre del snapshot del rubro (el Mayor no guarda descripción de cuenta).
  private readonly RUBRO_SALDO: Record<string, {
    clases: string[]; signo: 'deudor' | 'acreedor'; agrupar: 'tercero' | 'cuenta';
    sub: number; snap?: string; nameFields?: string[];
  }> = {
    laboral:    { clases: ['41'], signo: 'acreedor', agrupar: 'cuenta', sub: 4, snap: 'laboral',    nameFields: ['DesConcepto', 'Descripcion', 'DesCuenta'] },
    tributos:   { clases: ['40'], signo: 'acreedor', agrupar: 'cuenta', sub: 4, snap: 'tributos',   nameFields: ['Descripcion', 'DesConcepto', 'DesCuenta'] },
    patrimonio: { clases: ['50','51','52','53','54','55','56','57','58','59'], signo: 'acreedor', agrupar: 'cuenta', sub: 4, snap: 'patrimonio', nameFields: ['Descripcion', 'DesConcepto', 'DesCuenta'] },
    otras_cxc:  { clases: ['13','14','16','17','18'], signo: 'deudor',   agrupar: 'tercero', sub: 4 },
    otras_cxp:  { clases: ['43','44','45','46','47'], signo: 'acreedor', agrupar: 'tercero', sub: 4 },
  };

  private async loadCuentaNombres(companyId: string, snap: string, sub: number, fields: string[]) {
    const map = new Map<string, string>();
    let cached = await this.getSnapshot(companyId, snap, 'current');
    if (!cached) cached = await this.getSnapshot(companyId, snap, `${new Date().getFullYear()}`);
    if (!cached) return map;
    for (const r of (cached.data as any[]) || []) {
      const cod = String(r.CodCuenta || '').slice(0, sub);
      if (!cod) continue;
      const nombre = fields.map((f) => r[f]).find((v) => v) || cod;
      if (!map.has(cod)) map.set(cod, String(nombre));
    }
    return map;
  }

  async getRubroSaldoAFecha(companyId: string, hasta: string, rubro: string) {
    if (rubro === 'activo_fijo') return this.getActivoFijoSaldoAFecha(companyId, hasta);
    const cfg = this.RUBRO_SALDO[rubro];
    if (!cfg) return { modo: 'saldo-a-fecha', fechaCorte: hasta, items: [], total: 0 };
    const signExpr = cfg.signo === 'deudor' ? 'SUM("debito" - "credito")' : 'SUM("credito" - "debito")';
    const claseList = cfg.clases.map((c) => `'${c}'`).join(',');
    const groupCol = cfg.agrupar === 'tercero' ? '"codTercero"' : `LEFT("codCuenta",${cfg.sub})`;
    const nameSel = cfg.agrupar === 'tercero' ? 'MAX("tercero")' : 'MAX("codCuenta")';
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT ${groupCol} AS cod, ${nameSel} AS nombre, ${signExpr}::float8 AS saldo
         FROM "LedgerEntry"
        WHERE "companyId" = $1 AND LEFT("codCuenta",2) IN (${claseList})
          AND "fecha"::date <= $2::date
          AND NOT (UPPER(COALESCE("glosa",'')) = 'ASIENTO DE CIERRE'
                   AND EXTRACT(YEAR FROM "fecha") = EXTRACT(YEAR FROM $2::date))
        GROUP BY ${groupCol}`,
      companyId, hasta,
    );
    const nameMap = cfg.agrupar === 'cuenta' && cfg.snap
      ? await this.loadCuentaNombres(companyId, cfg.snap, cfg.sub, cfg.nameFields || [])
      : null;
    // No se descartan los asientos sin codTercero: se agrupan como "(Sin tercero)" para que el
    // total cuadre con el balance (si se dejaran fuera, otras CxC/CxP no atarían a la cuenta).
    const items = rows
      .filter((r) => Math.abs(Number(r.saldo) || 0) > 0.01)
      .map((r) => {
        const esNull = r.cod == null || String(r.cod) === '';
        const cod = esNull ? '' : String(r.cod);
        const nombre = (!esNull && nameMap?.get(cod)) || (esNull ? '(Sin tercero asignado)' : String(r.nombre || cod));
        return { cod, nombre, saldo: round(Number(r.saldo) || 0) };
      })
      .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));
    const total = round(items.reduce((s, i) => s + i.saldo, 0));
    return { modo: 'saldo-a-fecha', fechaCorte: hasta, agrupar: cfg.agrupar, items, total };
  }

  // Activo fijo a fecha: bruto (clase 33, deudor) − depreciación acumulada (clase 39, acreedor).
  private async getActivoFijoSaldoAFecha(companyId: string, hasta: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT LEFT("codCuenta",2) AS clase, LEFT("codCuenta",4) AS cod,
              SUM("debito" - "credito")::float8 AS saldodeudor
         FROM "LedgerEntry"
        WHERE "companyId" = $1 AND LEFT("codCuenta",2) IN ('33','39')
          AND "fecha"::date <= $2::date
          AND NOT (UPPER(COALESCE("glosa",'')) = 'ASIENTO DE CIERRE'
                   AND EXTRACT(YEAR FROM "fecha") = EXTRACT(YEAR FROM $2::date))
        GROUP BY LEFT("codCuenta",2), LEFT("codCuenta",4)`,
      companyId, hasta,
    );
    const nameMap = await this.loadCuentaNombres(companyId, 'activo_fijo', 4, ['DesActivo', 'Descripcion', 'DesCuenta']);
    const activos: any[] = [];
    let totalBruto = 0, totalDeprec = 0;
    for (const r of rows) {
      const cod = String(r.cod);
      const val = round(Number(r.saldodeudor) || 0);
      if (r.clase === '33') {
        if (Math.abs(val) > 0.01) { activos.push({ cod, nombre: nameMap.get(cod) || cod, saldo: val }); totalBruto += val; }
      } else {
        totalDeprec += -val; // clase 39 acreedor: deprec = Cr−Db = −(Db−Cr)
      }
    }
    activos.sort((a, b) => b.saldo - a.saldo);
    totalBruto = round(totalBruto); totalDeprec = round(totalDeprec);
    const totalNeto = round(totalBruto - totalDeprec);
    const items = [...activos, { cod: '39', nombre: '(−) Depreciación acumulada', saldo: round(-totalDeprec) }];
    return { modo: 'saldo-a-fecha', fechaCorte: hasta, agrupar: 'cuenta', items, total: totalNeto, totalBruto, totalDeprec, totalNeto };
  }

  // Reconcilia la cartera de DOCUMENTOS (lo que devuelve el aging) con el saldo contable
  // de la cuenta 12 (lo que ve la contadora en el balance de comprobación). Dos ajustes,
  // ambos derivados del Mayor (LedgerEntry) sin resync:
  //  (1) "Facturas por emitir" = provisión de la cuenta 1211 (receivable ya devengado pero
  //      SIN comprobante, por eso no aparece en un aging de documentos), sumada por RUC.
  //  (2) segrega las empresas del grupo (CxC intercompañía) fuera del CxC comercial: la
  //      cuenta 12 de S10 es "TERCEROS" y excluye relacionadas (p.ej. CMO GROUP, cuyo saldo
  //      real vive como préstamo intercompañía en la cuenta 1612, no en el 12).
  // Con esto `totalSaldo` ata a la cuenta 121 del balance (± dif. de cambio en clientes USD).
  private async enrichCxCReconciliacion(companyId: string, data: any) {
    if (!data?.clientes) return data;

    // Empresas del grupo, para segregar intercompañía (se excluye la propia empresa).
    const grupo = await this.prisma.company.findMany({ select: { codEmpresa: true } });
    const grupoRuc = new Set(
      grupo.map((g) => String(g.codEmpresa)).filter((r) => r !== String(companyId)),
    );

    // Saldo CONTABLE de la clase 12 por tercero desde el Mayor (lo que ve la contadora en el
    // balance). 1212 = facturas emitidas en cartera; 1211 = facturas por emitir (provisión sin
    // comprobante). El aging de documentos (`vw_12DocumentosPorCobrar`) puede diferir del mayor
    // a nivel de documento (detracciones ya depositadas, timing) — caso STILER 2026-08: mayor
    // 1,180,000 vs aging 972,320. El mayor es la verdad; se muestran AMBOS.
    const ledgerRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "codTercero" AS ruc, LEFT("codCuenta", 4) AS sub,
              SUM("debito" - "credito")::float8 AS saldo
         FROM "LedgerEntry"
        WHERE "companyId" = $1 AND LEFT("codCuenta", 2) = '12'
          AND NOT (UPPER(COALESCE("glosa", '')) = 'ASIENTO DE CIERRE' AND "fecha"::date > CURRENT_DATE)
        GROUP BY "codTercero", LEFT("codCuenta", 4)`,
      companyId,
    );
    const ledgerMap = new Map<string, { emitidas: number; porEmitir: number }>();
    for (const r of ledgerRows) {
      if (r.ruc == null) continue;
      const ruc = String(r.ruc);
      const e = ledgerMap.get(ruc) || { emitidas: 0, porEmitir: 0 };
      if (r.sub === '1212') e.emitidas = round(e.emitidas + (Number(r.saldo) || 0));
      else if (r.sub === '1211') e.porEmitir = round(e.porEmitir + (Number(r.saldo) || 0));
      ledgerMap.set(ruc, e);
    }
    const saldoLedgerDe = (ruc: string) => {
      const l = ledgerMap.get(ruc);
      return l ? round(l.emitidas + l.porEmitir) : 0; // = cuenta 121 del tercero
    };

    const terceros: any[] = [];
    const vinculados: any[] = [];
    const vistos = new Set<string>();
    for (const c of data.clientes) {
      const ruc = String(c.codCliente);
      vistos.add(ruc);
      const esVinculada = grupoRuc.has(ruc);
      const l = ledgerMap.get(ruc) || { emitidas: 0, porEmitir: 0 };
      const saldoDocs = round(c.saldoTotalSoles || 0);
      const saldoLedger = round(l.emitidas + l.porEmitir);
      const enriched = {
        ...c,
        esVinculada,
        porEmitir: l.porEmitir,
        saldoDocs,
        saldoLedger,
        saldoConEmitir: saldoLedger, // alias retro-compat
        diferencia: round(saldoLedger - saldoDocs),
      };
      (esVinculada ? vinculados : terceros).push(enriched);
    }

    // Terceros con saldo contable (mayor) pero SIN fila en el aging de documentos: se agregan
    // para que el total ate al balance aunque no exista un comprobante que envejecer.
    for (const [ruc, l] of ledgerMap) {
      if (vistos.has(ruc)) continue;
      const saldoLedger = round(l.emitidas + l.porEmitir);
      if (Math.abs(saldoLedger) < 0.01) continue;
      (grupoRuc.has(ruc) ? vinculados : terceros).push({
        codCliente: ruc, cliente: `(Solo contable) ${ruc}`,
        saldoPEN: 0, saldoUSD: 0, tipoCambioUSD: TC_USD_FALLBACK,
        saldoTotalSoles: 0, saldoVigente: 0, dias0_30: 0, dias31_60: 0, dias61_90: 0, dias90mas: 0,
        esVinculada: grupoRuc.has(ruc), porEmitir: l.porEmitir,
        saldoDocs: 0, saldoLedger, saldoConEmitir: saldoLedger, diferencia: saldoLedger,
        soloContable: true,
      });
    }

    terceros.sort((a, b) => b.saldoLedger - a.saldoLedger);
    vinculados.sort((a, b) => b.saldoLedger - a.saldoLedger);

    const sum = (arr: any[], f: string) => round(arr.reduce((s, x) => s + (x[f] || 0), 0));
    const totalDocs      = sum(terceros, 'saldoDocs');       // cartera de documentos (aging)
    const totalEmitidas  = round(terceros.reduce((s, c) => s + ((ledgerMap.get(String(c.codCliente))?.emitidas) || 0), 0));
    const totalPorEmitir = sum(terceros, 'porEmitir');
    const totalSaldo     = sum(terceros, 'saldoLedger');     // = cuenta 121 (contable) → headline
    const total90mas     = sum(terceros, 'dias90mas');
    const top3 = terceros.slice(0, 3).reduce((s, c) => s + (c.saldoLedger || 0), 0);
    const totalVinculados = sum(vinculados, 'saldoLedger');

    return {
      ...data,
      clientes: terceros,
      clientesVinculados: vinculados,
      totalDocs,
      totalEmitidas,
      totalPorEmitir,
      totalSaldo,
      totalVigente:  sum(terceros, 'saldoVigente'),
      total90mas,
      totalSaldoPEN: sum(terceros, 'saldoPEN'),
      totalSaldoUSD: sum(terceros, 'saldoUSD'),
      pct90mas: totalSaldo > 0 ? round((total90mas / totalSaldo) * 100) : 0,
      concentracionTop3: totalSaldo > 0 ? round((top3 / totalSaldo) * 100) : 0,
      numClientes: terceros.filter((c) => !c.soloContable).length,
      totalVinculados,
      numVinculados: vinculados.length,
      reconciliacion: {
        docs: totalDocs,
        emitidas: totalEmitidas,
        porEmitir: totalPorEmitir,
        totalTerceros: totalSaldo,
        diferenciaDocsVsLedger: round(totalSaldo - totalDocs),
        vinculados: totalVinculados,
      },
    };
  }

  // Agrega a la cartera los clientes ANULADOS POR NC (neto ≈ 0 con notas de crédito) que
  // el aging normal oculta (HAVING saldo>0). Se derivan de cxc_docs (sin resync). Aparecen
  // con saldo 0 y bandera anuladoNC para poder abrir su detalle (factura + NC flotantes/aplicadas).
  private async augmentCxCAnulados(companyId: string, data: any) {
    const docsSnap = await this.getSnapshot(companyId, 'cxc_docs', 'current');
    if (!docsSnap) return data;

    const enCartera = new Set((data.clientes || []).map((c: any) => String(c.codCliente)));
    const byClient = new Map<string, any>();
    for (const dd of (docsSnap.data as any[])) {
      const key = String(dd.CodCliente);
      if (!byClient.has(key)) byClient.set(key, { codCliente: dd.CodCliente, cliente: dd.Cliente || key, neto: 0, numNC: 0, numDocs: 0 });
      const e = byClient.get(key);
      e.neto += (dd.Saldo || 0); e.numDocs++;
      if (dd.EsNotaCredito === 1) e.numNC++;
    }

    const anulados: any[] = [];
    for (const e of byClient.values()) {
      if (enCartera.has(String(e.codCliente))) continue; // ya está en la cartera (neto > 0)
      if (Math.abs(e.neto) > 0.01) continue;             // solo neto cero
      if (e.numNC === 0) continue;                        // debe tener NC (anulación), no solo pagos
      anulados.push({
        codCliente: e.codCliente, cliente: e.cliente,
        saldoPEN: 0, saldoUSD: 0, tipoCambioUSD: TC_USD_FALLBACK, saldoTotalSoles: 0,
        saldoVigente: 0, dias0_30: 0, dias31_60: 0, dias61_90: 0, dias90mas: 0,
        anuladoNC: true, numDocs: e.numDocs, numNC: e.numNC,
      });
    }
    anulados.sort((a, b) => String(a.cliente).localeCompare(String(b.cliente)));
    return { ...data, clientes: [...(data.clientes || []), ...anulados], anuladosNC: anulados.length };
  }

  buildCxC(rows: any[]) {
    // Merge rows by client — each client may have one PEN row + one USD row
    const clientMap = new Map<string, any>();

    for (const r of rows) {
      const moneda = r.Moneda === '02' ? 'USD' : 'PEN';
      const tc = parseFloat(r.TipoCambio) || TC_USD_FALLBACK;
      const toSoles = (v: number) => moneda === 'USD' ? round(v * tc) : v;
      const saldo   = round(parseFloat(r.SaldoTotal)   || 0);
      const vigente = round(parseFloat(r.SaldoVigente) || 0);
      const d0_30   = round(parseFloat(r.Dias_0_30)    || 0);
      const d31_60  = round(parseFloat(r.Dias_31_60)   || 0);
      const d61_90  = round(parseFloat(r.Dias_61_90)   || 0);
      const d90mas  = round(parseFloat(r.Dias_90_mas)  || 0);

      const key = String(r.CodCliente);
      if (!clientMap.has(key)) {
        clientMap.set(key, {
          codCliente: r.CodCliente,
          cliente: r.Cliente || r.CodCliente,
          saldoPEN: 0,
          saldoUSD: 0,
          tipoCambioUSD: TC_USD_FALLBACK,
          saldoTotalSoles: 0,
          saldoVigente: 0,
          dias0_30: 0,
          dias31_60: 0,
          dias61_90: 0,
          dias90mas: 0,
        });
      }
      const c = clientMap.get(key)!;
      if (moneda === 'PEN') {
        c.saldoPEN = round(c.saldoPEN + saldo);
      } else {
        c.saldoUSD = round(c.saldoUSD + saldo);
        c.tipoCambioUSD = tc;
      }
      c.saldoTotalSoles = round(c.saldoTotalSoles + toSoles(saldo));
      c.saldoVigente    = round(c.saldoVigente    + toSoles(vigente));
      c.dias0_30        = round(c.dias0_30        + toSoles(d0_30));
      c.dias31_60       = round(c.dias31_60       + toSoles(d31_60));
      c.dias61_90       = round(c.dias61_90       + toSoles(d61_90));
      c.dias90mas       = round(c.dias90mas       + toSoles(d90mas));
    }

    const clientes = [...clientMap.values()].sort((a, b) => b.saldoTotalSoles - a.saldoTotalSoles);

    const totalSaldo    = clientes.reduce((s, c) => s + c.saldoTotalSoles, 0);
    const totalVigente  = clientes.reduce((s, c) => s + c.saldoVigente,    0);
    const total90mas    = clientes.reduce((s, c) => s + c.dias90mas,       0);
    const totalSaldoPEN = clientes.reduce((s, c) => s + c.saldoPEN,        0);
    const totalSaldoUSD = clientes.reduce((s, c) => s + c.saldoUSD,        0);

    const top3Saldo = clientes.slice(0, 3).reduce((s, c) => s + c.saldoTotalSoles, 0);
    const concentracionTop3 = totalSaldo > 0 ? round((top3Saldo / totalSaldo) * 100) : 0;

    return {
      clientes,
      totalSaldo:    round(totalSaldo),
      totalSaldoPEN: round(totalSaldoPEN),
      totalSaldoUSD: round(totalSaldoUSD),
      totalVigente:  round(totalVigente),
      total90mas:    round(total90mas),
      pct90mas: totalSaldo > 0 ? round((total90mas / totalSaldo) * 100) : 0,
      concentracionTop3,
      numClientes: clientes.length,
      syncedAt: new Date().toISOString(),
    };
  }

  async getCxCDocs(companyId: string, codCliente?: string, desde?: string, hasta?: string) {
    const cached = await this.getSnapshot(companyId, 'cxc_docs', 'current');
    if (!cached) return { docs: [], message: 'No data available. Run sync first.' };

    let docs = cached.data as any[];
    if (codCliente) {
      docs = docs.filter((d: any) => String(d.CodCliente) === String(codCliente));
    }
    if (desde || hasta) {
      const d = desde || '0000-01-01';
      const h = hasta || '9999-12-31';
      docs = docs.filter((doc: any) => {
        const iso = fechaDDMMYYYYtoISO(String(doc.FechaDocumento || ''));
        return iso && iso >= d && iso <= h;
      });
    }
    return { docs, syncedAt: cached.syncedAt };
  }

  async getCxPDocs(companyId: string, codProveedor?: string, desde?: string, hasta?: string) {
    const cached = await this.getSnapshot(companyId, 'cxp_docs', 'current');
    if (!cached) return { docs: [], message: 'No data available. Run sync first.' };

    let docs = cached.data as any[];
    if (codProveedor) {
      docs = docs.filter((d: any) => String(d.CodProveedor) === String(codProveedor));
    }
    if (desde || hasta) {
      const d = desde || '0000-01-01';
      const h = hasta || '9999-12-31';
      docs = docs.filter((doc: any) => {
        const iso = fechaDDMMYYYYtoISO(String(doc.FechaDocumento || ''));
        return iso && iso >= d && iso <= h;
      });
    }
    return { docs, syncedAt: cached.syncedAt };
  }

  buildCxCVinculadas(rows: any[]) {
    const clientMap = new Map<string, {
      codCliente: string; cliente: string;
      saldoPEN: number; saldoUSD: number; saldoSoles: number; numDocs: number;
    }>();
    let totalSaldo = 0;
    let totalSaldoPEN = 0;
    let totalSaldoUSD = 0;

    for (const r of rows) {
      const saldoSoles = parseFloat(r.SaldoSoles) || 0;
      const saldo      = parseFloat(r.Saldo)      || 0;
      const moneda     = String(r.Moneda ?? '01');

      totalSaldo += saldoSoles;
      if (moneda === '01') totalSaldoPEN += saldo;
      else                 totalSaldoUSD += saldo;

      const key = String(r.CodCliente);
      if (!clientMap.has(key)) {
        clientMap.set(key, { codCliente: key, cliente: r.Cliente || key, saldoPEN: 0, saldoUSD: 0, saldoSoles: 0, numDocs: 0 });
      }
      const c = clientMap.get(key)!;
      if (moneda === '01') c.saldoPEN = round(c.saldoPEN + saldo);
      else                 c.saldoUSD = round(c.saldoUSD + saldo);
      c.saldoSoles = round(c.saldoSoles + saldoSoles);
      c.numDocs++;
    }

    return {
      docs: rows,
      clientes: [...clientMap.values()].sort((a, b) => b.saldoSoles - a.saldoSoles),
      totalSaldo:    round(totalSaldo),
      totalSaldoPEN: round(totalSaldoPEN),
      totalSaldoUSD: round(totalSaldoUSD),
      numDocs:     rows.length,
      numClientes: clientMap.size,
      syncedAt: new Date().toISOString(),
    };
  }

  async getCxCVinculadas(companyId: string) {
    const cached = await this.getSnapshot(companyId, 'cxc_vinculadas', 'current');
    if (!cached) return { docs: [], clientes: [], totalSaldo: 0, totalSaldoPEN: 0, totalSaldoUSD: 0, numDocs: 0, numClientes: 0 };
    return cached.data;
  }

  // ─────────────────────────────────────────────
  // Caja — con totales consolidados
  // ─────────────────────────────────────────────

  async getCaja(companyId: string, year: number) {
    const period = `${year}`;
    const cached = await this.getSnapshot(companyId, 'caja', period);
    if (cached) return cached.data;

    if (this.s10.isDirectMode) {
      const company = await this.resolveCompany(companyId);
      const rows = await this.s10.getCaja(companyId, year);
      const data = this.buildCaja(rows);
      await this.saveSnapshot(companyId, company.name, 'caja', period, year, null, data);
      return data;
    }

    return { message: 'No data available. Run sync first.', year };
  }

  buildCaja(rows: any[]) {
    const bancos: Record<string, any> = {};

    for (const row of rows) {
      const banco = row.Banco || row.CodBanco;
      if (!bancos[banco]) {
        bancos[banco] = { banco, codBanco: row.CodBanco, saldoInicial: 0, meses: {} };
        for (let m = 1; m <= 12; m++) bancos[banco].meses[m] = 0;
      }
      const val = round(parseFloat(row.FlujoNeto) || 0);
      // Mes 0 = saldo inicial (neto antes del año); 1-12 = flujo del mes
      if (Number(row.Mes) === 0) bancos[banco].saldoInicial = val;
      else bancos[banco].meses[row.Mes] = val;
    }

    const bancosArr: any[] = Object.values(bancos);

    // Saldo de cierre acumulado por mes = saldoInicial + Σ flujos hasta el mes
    for (const b of bancosArr) {
      b.saldos = {};
      let acum = b.saldoInicial || 0;
      for (let m = 1; m <= 12; m++) {
        acum = round(acum + (b.meses[m] || 0));
        b.saldos[m] = acum;
      }
    }

    // Totales por mes (flujo y saldo de cierre)
    const totalPorMes: Record<number, number> = {};
    const totalSaldoPorMes: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) {
      totalPorMes[m] = round(bancosArr.reduce((s: number, b: any) => s + (b.meses[m] || 0), 0));
      totalSaldoPorMes[m] = round(bancosArr.reduce((s: number, b: any) => s + (b.saldos[m] || 0), 0));
    }

    return {
      bancos: bancosArr,
      totalPorMes,
      totalSaldoPorMes,
      syncedAt: new Date().toISOString(),
    };
  }

  // Caja por RANGO (estado de cuenta del período): saldo de apertura al 'desde' +
  // entradas/salidas del período + saldo de cierre al 'hasta', por banco. El flujo
  // y los cortes se derivan del Mayor (LedgerEntry clase 10, fecha diaria, fuente
  // limpia por línea); el saldoInicial del año se toma del snapshot (tiene historia
  // completa, el Mayor puede no cubrir años previos). saldos[m] (cierre acumulado por
  // mes) se reutiliza del snapshot. Default = año completo (delega en getCaja).
  async getCajaRange(companyId: string, year: number, desde?: string, hasta?: string) {
    // Todo se deriva del Mayor (LedgerEntry clase 10). El ASIENTO DE APERTURA (glosa
    // "Asiento de Apertura", enero) es el saldo de arranque del año, NO un flujo — se separa
    // como `opening`. Antes se sumaba además el `saldoInicial` del snapshot `caja` sobre unos
    // flujos que YA incluían la apertura → doble conteo (reporte de Milka 2026-08: Caja Chica
    // salía 3,458.58 = 2,000 real + 1,458.58 del snapshot). Ahora: saldo por mes = opening +
    // Σ flujos-no-apertura → cuadra con el balance de comprobación de S10.
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "codCuenta", "desCuenta", "fecha", "mes",
              "debito"::float8 AS debito, "credito"::float8 AS credito, "glosa"
         FROM "LedgerEntry"
        WHERE "companyId" = $1 AND "anio" = $2 AND "clase" = '10'
          AND "codCuenta" NOT IN ('10300010', '10300011', '10300012')`,
      companyId, year,
    );

    if (!rows.length) {
      const full = await this.getCaja(companyId, year);
      return { ...full, rango: { desde, hasta }, rangoNoDisponible: true };
    }

    const d = desde || `${year}-01-01`;
    const h = hasta || `${year}-12-31`;
    const esApertura = (g: any) => /apertura/i.test(String(g || ''));
    const bancos: Record<string, any> = {};
    const ensure = (cod: string, nom: string) => {
      if (!bancos[cod]) {
        bancos[cod] = {
          banco: nom || cod, codBanco: cod, opening: 0,
          mesNet: {}, meses: {}, entradas: 0, salidas: 0, aperturaAntes: 0,
        };
        for (let mm = 1; mm <= 12; mm++) { bancos[cod].mesNet[mm] = 0; bancos[cod].meses[mm] = 0; }
      }
      return bancos[cod];
    };

    for (const r of rows) {
      const b = ensure(r.codCuenta, r.desCuenta);
      const deb = r.debito || 0, cred = r.credito || 0, flujo = deb - cred;
      if (esApertura(r.glosa)) { b.opening = round(b.opening + flujo); continue; } // arranque, no flujo
      const iso = r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha).slice(0, 10);
      b.mesNet[r.mes] = round((b.mesNet[r.mes] || 0) + flujo);
      if (iso < d) b.aperturaAntes = round(b.aperturaAntes + flujo);
      if (iso >= d && iso <= h) { b.meses[r.mes] = round((b.meses[r.mes] || 0) + flujo); b.entradas += deb; b.salidas += cred; }
    }

    const bancosArr: any[] = Object.values(bancos).map((b: any) => {
      // Saldo de cierre acumulado por mes = opening + Σ flujos-no-apertura hasta el mes.
      const saldos: Record<number, number> = {};
      let acum = b.opening;
      for (let m = 1; m <= 12; m++) { acum = round(acum + (b.mesNet[m] || 0)); saldos[m] = acum; }
      const apertura = round(b.opening + b.aperturaAntes);        // saldo al inicio del período
      const cierre = round(apertura + b.entradas - b.salidas);    // saldo al cierre del período
      return {
        banco: b.banco, codBanco: b.codBanco, saldoInicial: round(b.opening),
        meses: b.meses, saldos, apertura, entradas: round(b.entradas), salidas: round(b.salidas), cierre,
      };
    });

    const totalPorMes: Record<number, number> = {};
    const totalSaldoPorMes: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) {
      totalPorMes[m] = round(bancosArr.reduce((s: number, b: any) => s + (b.meses[m] || 0), 0));
      totalSaldoPorMes[m] = round(bancosArr.reduce((s: number, b: any) => s + (b.saldos?.[m] || 0), 0));
    }
    const periodo = {
      apertura: round(bancosArr.reduce((s, b) => s + b.apertura, 0)),
      entradas: round(bancosArr.reduce((s, b) => s + b.entradas, 0)),
      salidas: round(bancosArr.reduce((s, b) => s + b.salidas, 0)),
      cierre: round(bancosArr.reduce((s, b) => s + b.cierre, 0)),
    };

    return { bancos: bancosArr, totalPorMes, totalSaldoPorMes, periodo, rango: { desde: d, hasta: h }, syncedAt: new Date().toISOString() };
  }

  // ─────────────────────────────────────────────
  // Caja — Posición Trimestral
  // ─────────────────────────────────────────────

  async getCajaPosicion(companyId: string, year: number, quarter: string) {
    const Q_MONTHS: Record<string, number[]> = {
      Q1: [1,2,3], Q2: [4,5,6], Q3: [7,8,9], Q4: [10,11,12],
    };
    const months = Q_MONTHS[quarter] ?? [1,2,3];
    // Universo de caja (definición de la contadora): cuentas bancarias reales. Se EXCLUYE la
    // caja chica (101x, efectivo menor) y las cuentas de tránsito interno (10300010/11/12).
    const TRANSIT = new Set(['10300010','10300011','10300012']);
    const excluir = (cod: string) => TRANSIT.has(cod) || String(cod).startsWith('101');
    // Traspaso interno entre cuentas propias ("TR" = TipoDocumento 'TRANSFERENCIA BANCARIA').
    // Se saca de entradas/salidas (no es cobro ni pago), pero su NETO se conserva en el saldo
    // como diferencia de cambio (las patas soles/dólares no cierran exacto por el TC). Si el
    // snapshot no trae TipoDocumento (histórico), esTraspaso=false → comportamiento anterior.
    const esTraspaso = (t: any) =>
      String(t.TipoDocumento || '').toUpperCase().includes('TRANSFERENCIA BANCARIA');

    const [cajaTxnSnap, tesoreriaSnap, tributosTxnSnap, laboralTxnSnap] = await Promise.all([
      this.getSnapshot(companyId, 'caja_txn', `${year}`),
      this.getSnapshot(companyId, 'tesoreria', `${year}`),
      this.getSnapshot(companyId, 'tributos_txn', `${year}`),
      this.getSnapshot(companyId, 'laboral_txn', `${year}`),
    ]);

    const cajaTxn      = (cajaTxnSnap?.data as any[]) ?? [];
    const tesoreria    = (tesoreriaSnap?.data as any[]) ?? [];
    const tributosTxn  = (tributosTxnSnap?.data as any[]) ?? [];
    const laboralTxn   = (laboralTxnSnap?.data as any[]) ?? [];

    // Saldo inicial del año (balance al 01/01/year) desde tesoreria, excl. tránsito y caja chica
    const saldoInicialAnio = round(
      tesoreria
        .filter(b => !excluir(b.CodBanco))
        .reduce((s, b) => s + (Number(b.SaldoInicial) || 0), 0),
    );

    // Acumular flujos mensuales de caja_txn. entradas/salidas SIN traspasos; `traspasos` = neto
    // (dif. de cambio) que se conserva en el saldo para que cuadre con la contabilidad.
    const txnPorMes: Record<number, { entradas: number; salidas: number; traspasos: number }> = {};
    for (let m = 1; m <= 12; m++) {
      const txns = cajaTxn.filter(t => Number(t.Mes) === m && !excluir(t.CodBanco));
      const flujo = txns.filter(t => !esTraspaso(t));
      const tras  = txns.filter(t => esTraspaso(t));
      txnPorMes[m] = {
        entradas: round(flujo.reduce((s, t) => s + (Number(t.Debito) || 0), 0)),
        salidas:  round(flujo.reduce((s, t) => s + (Number(t.Credito) || 0), 0)),
        traspasos: round(tras.reduce((s, t) => s + (Number(t.Debito) || 0) - (Number(t.Credito) || 0), 0)),
      };
    }

    // Remuneraciones pagadas por mes: debitos en cuenta 411 (Sueldos por Pagar)
    const remuPorMes: Record<number, number> = {};
    for (const t of laboralTxn) {
      const m = Number(t.Mes);
      if (m >= 1 && m <= 12) remuPorMes[m] = round((remuPorMes[m] || 0) + (Number(t.Debito) || 0));
    }

    // Tributos pagados por mes: debitos en cuentas 40x (reducción deuda SUNAT)
    const sunatPorMes: Record<number, number> = {};
    for (const t of tributosTxn) {
      const m = Number(t.Mes);
      if (m >= 1 && m <= 12) sunatPorMes[m] = round((sunatPorMes[m] || 0) + (Number(t.Debito) || 0));
    }

    // Saldo inicial del Q = saldo inicio año + flujos netos (incl. traspasos) de meses previos
    let saldoInicialQ = saldoInicialAnio;
    for (let m = 1; m < months[0]; m++) {
      const d = txnPorMes[m];
      saldoInicialQ += (d?.entradas || 0) - (d?.salidas || 0) + (d?.traspasos || 0);
    }
    saldoInicialQ = round(saldoInicialQ);

    // Datos mes a mes del Q
    let saldoAcum = saldoInicialQ;
    const meses = months.map(m => {
      const ent  = txnPorMes[m]?.entradas ?? 0;
      const sal  = txnPorMes[m]?.salidas  ?? 0;
      const tras = txnPorMes[m]?.traspasos ?? 0;
      const remu = remuPorMes[m] ?? 0;
      const sun  = sunatPorMes[m] ?? 0;
      const prov = round(Math.max(0, sal - remu - sun));
      const saldoInicial = saldoAcum;
      // El saldo incorpora el neto de traspasos (dif. cambio) para cuadrar con la contabilidad.
      saldoAcum = round(saldoAcum + ent - sal + tras);
      return { mes: m, saldoInicial, entradas: ent, salidas: sal, traspasos: tras, remuneraciones: remu, sunat: sun, proveedores: prov, saldoFinal: saldoAcum };
    });

    const totalEntradas     = round(meses.reduce((s, m) => s + m.entradas, 0));
    const totalSalidas      = round(meses.reduce((s, m) => s + m.salidas, 0));
    const totalTraspasos    = round(meses.reduce((s, m) => s + m.traspasos, 0));
    const totalRemuneraciones = round(meses.reduce((s, m) => s + m.remuneraciones, 0));
    const totalSunat        = round(meses.reduce((s, m) => s + m.sunat, 0));
    const totalProveedores  = round(meses.reduce((s, m) => s + m.proveedores, 0));
    const saldoFinalQ       = round(saldoInicialQ + totalEntradas - totalSalidas + totalTraspasos);

    return {
      quarter,
      year,
      saldoInicialQ,
      saldoFinalQ,
      totalEntradas,
      totalSalidas,
      totalTraspasos,
      totalRemuneraciones,
      totalSunat,
      totalProveedores,
      meses,
      hasTraspasos:  cajaTxn.some(t => esTraspaso(t)),
      hasCajaTxn:    cajaTxn.length > 0,
      hasTesoreria:  tesoreria.length > 0,
      hasLaboral:    laboralTxn.length > 0,
    };
  }

  // ─────────────────────────────────────────────
  // GAV
  // ─────────────────────────────────────────────

  async getGAV(companyId: string, year: number) {
    const period = `${year}`;
    const cached = await this.getSnapshot(companyId, 'gav', period);
    if (cached) {
      const data: any = cached.data;
      // Vista por NATURALEZA: se arma en lectura desde `cuentas` (subcuentas completas), para
      // poder afinar el clasificador con un redeploy de backend, sin re-sincronizar.
      if (data?.cuentas?.length && !data.naturaleza) data.naturaleza = this.gavPorNaturaleza(data.cuentas);
      return data;
    }

    if (this.s10.isDirectMode) {
      const company = await this.resolveCompany(companyId);
      const rows = await this.s10.getGAV(companyId, year);
      const data = this.buildGAV(rows);
      await this.saveSnapshot(companyId, company.name, 'gav', period, year, null, data);
      return data;
    }

    return { message: 'No data available. Run sync first.', year };
  }

  buildGAV(rows: any[]) {
    const categorias: Record<string, any> = {}; // por DESTINO (3 díg) — vista actual
    const cuentas: Record<string, any> = {};    // por subcuenta COMPLETA — para naturaleza

    for (const row of rows) {
      const full = String(row.CodCuenta ?? '');
      // CodDestino sólo viene en el formato nuevo (subcuenta completa). Si no está (rango por
      // transacciones, snapshots viejos), el propio CodCuenta ya es el destino de 3 díg.
      const codDestino = row.CodDestino != null ? String(row.CodDestino) : full.slice(0, 3) || full;
      const desDestino = row.DesDestino ?? row.DesCuenta ?? codDestino;
      const val = round(parseFloat(row.GAV) || 0);

      if (!categorias[codDestino]) categorias[codDestino] = { cod: codDestino, descripcion: desDestino, ytd: 0, meses: {} };
      categorias[codDestino].meses[row.Mes] = round((categorias[codDestino].meses[row.Mes] || 0) + val);
      categorias[codDestino].ytd = round(categorias[codDestino].ytd + val);

      if (row.CodDestino != null) {
        if (!cuentas[full]) cuentas[full] = { cod: full, descripcion: row.DesCuenta || full, destino: codDestino, ytd: 0, meses: {} };
        cuentas[full].meses[row.Mes] = round((cuentas[full].meses[row.Mes] || 0) + val);
        cuentas[full].ytd = round(cuentas[full].ytd + val);
      }
    }

    const lista = Object.values(categorias).sort((a: any, b: any) => b.ytd - a.ytd);
    const total = lista.reduce((sum: number, c: any) => sum + c.ytd, 0);
    const listaCuentas = Object.values(cuentas).sort((a: any, b: any) => b.ytd - a.ytd);

    return {
      categorias: lista.map((c: any) => ({ ...c, pct: total > 0 ? round((c.ytd / total) * 100) : 0 })),
      cuentas: listaCuentas, // se clasifica por naturaleza en getGAV (lectura)
      total: round(total),
      syncedAt: new Date().toISOString(),
    };
  }

  // Clasifica una subcuenta de GAV (94/95) en una cubeta de NATURALEZA por palabras clave de su
  // descripción. Aproximación afinable: al ver descripciones reales tras el resync se ajusta acá
  // (sólo redeploy de backend, la clasificación corre en lectura). El total por naturaleza cuadra
  // con el total por destino porque parte de las mismas subcuentas.
  private clasificarNaturalezaGAV(desc: string): string {
    const d = (desc || '').toLowerCase();
    const has = (...ks: string[]) => ks.some((k) => d.includes(k));
    // 'deprec' (no 'deprecia') para cazar la abreviatura real "Prov.Para Deprec.Edificaciones"
    if (has('deprec', 'amortiz')) return 'Depreciación y amortización';
    if (has('sueld', 'salari', 'remunerac', 'gratific', 'vacacion', 'cts', 'planilla', 'essalud',
            'eps', 'senati', 'conafovicer', 'bonific', 'asignacion familiar', 'participacion', 'dietas',
            'compensacion', 'indemnizac', 'personal')) return 'Gastos de personal';
    if (has('tribut', 'impuest', 'arbitri', 'licenci', 'sunat', 'contribuc', 'municipal', 'predial',
            'itan', 'sencico', 'multa', 'sancion')) return 'Tributos';
    if (has('seguro', 'poliza')) return 'Seguros';
    if (has('alquil', 'arrend')) return 'Alquileres';
    if (has('honorari', 'asesor', 'consultor', 'auditor', 'legal', 'notari', 'abogad', 'contab')) return 'Honorarios y asesorías';
    if (has('energ', 'electric', 'agua', 'telefon', 'internet', 'comunicac', 'cable', 'luz')) return 'Servicios básicos';
    if (has('vigilanc', 'seguridad', 'limpiez', 'manteni', 'reparac', 'transport', 'flete', 'courier',
            'mensaj', 'publicidad', 'marketing', 'capacitac', 'viatico', 'viaje', 'pasaje', 'movilidad',
            'combustible', 'peaje', 'tercero', 'servicio')) return 'Servicios de terceros';
    if (has('insumo', 'suministr', 'util', 'materiale', 'papeler', 'fungib', 'repuesto', 'herramient',
            'uniforme', 'implement')) return 'Suministros y materiales';
    return 'Otros gastos de gestión';
  }

  private gavPorNaturaleza(cuentas: any[]) {
    const buckets: Record<string, any> = {};
    for (const c of cuentas || []) {
      const nat = this.clasificarNaturalezaGAV(c.descripcion);
      if (!buckets[nat]) buckets[nat] = { nat, ytd: 0, meses: {}, cuentas: [] };
      buckets[nat].ytd = round(buckets[nat].ytd + (c.ytd || 0));
      for (const [m, v] of Object.entries(c.meses || {})) buckets[nat].meses[m] = round((buckets[nat].meses[m] || 0) + (Number(v) || 0));
      buckets[nat].cuentas.push({ cod: c.cod, descripcion: c.descripcion, ytd: c.ytd });
    }
    const lista = Object.values(buckets).sort((a: any, b: any) => b.ytd - a.ytd);
    const total = lista.reduce((s: number, c: any) => s + c.ytd, 0);
    return lista.map((c: any) => ({
      ...c,
      cuentas: c.cuentas.sort((a: any, b: any) => b.ytd - a.ytd),
      pct: total > 0 ? round((c.ytd / total) * 100) : 0,
    }));
  }

  // GAV por RANGO de fechas — derivado del snapshot `transactions` (clases 94+95, fecha diaria).
  // Mismo origen/agregación que QUERY_GAV → cuadra al centavo. Default = año completo.
  async getGAVRange(companyId: string, year: number, desde?: string, hasta?: string) {
    const fullYear =
      (!desde || desde <= `${year}-01-01`) && (!hasta || hasta >= `${year}-12-31`);
    if (fullYear) return this.getGAV(companyId, year);

    const txSnap = await this.getSnapshot(companyId, 'transactions', `${year}`);
    if (!txSnap) {
      const full = await this.getGAV(companyId, year);
      return { ...full, rango: { desde, hasta }, rangoNoDisponible: true };
    }

    // transactions no trae DesCuenta → mapa subcuenta(3) → descripción del GAV cacheado
    const gavSnap = await this.getSnapshot(companyId, 'gav', `${year}`);
    const descMap: Record<string, string> = {};
    for (const c of ((gavSnap?.data as any)?.categorias ?? [])) if (c?.cod) descMap[c.cod] = c.descripcion;

    const d = desde || `${year}-01-01`;
    const h = hasta || `${year}-12-31`;

    // Pre-agregar por (subcuenta de 3 dígitos, mes) — buildGAV ASIGNA meses[mes], no suma.
    const agg = new Map<string, { CodCuenta: string; DesCuenta: string; Mes: number; GAV: number }>();
    for (const r of (txSnap.data as any[])) {
      if (r.Clase !== '94' && r.Clase !== '95') continue; // GAV = gastos adm (94) + ventas (95)
      const iso = fechaDDMMYYYYtoISO(r.Fecha);
      if (iso < d || iso > h) continue;
      const cod3 = String(r.CodCuenta).slice(0, 3);
      const key = `${cod3}|${r.Mes}`;
      const val = (Number(r.Debito) || 0) - (Number(r.Credito) || 0);
      const ex = agg.get(key);
      if (ex) ex.GAV += val;
      else agg.set(key, { CodCuenta: cod3, DesCuenta: descMap[cod3] || cod3, Mes: r.Mes, GAV: val });
    }

    const data = this.buildGAV([...agg.values()]);
    return { ...data, rango: { desde: d, hasta: h } };
  }

  // ─────────────────────────────────────────────
  // Transacciones — detalle de asientos por cuenta
  // ─────────────────────────────────────────────

  async getTransactions(companyId: string, year: number, codCuenta?: string, mes?: number) {
    const period = `${year}`;
    const cached = await this.getSnapshot(companyId, 'transactions', period);
    if (!cached) return { transactions: [], total: 0 };

    let txns = cached.data as any[];
    if (codCuenta) {
      // prefix match when code is abbreviated (e.g. GAV uses 3-char codes like "916")
      txns = txns.filter((t: any) =>
        codCuenta.length >= 8
          ? t.CodCuenta === codCuenta
          : String(t.CodCuenta).startsWith(codCuenta),
      );
    }
    if (mes) txns = txns.filter((t: any) => t.Mes === mes);

    return { transactions: txns, total: txns.length };
  }

  async getDocumentoByNroD(companyId: string, nroD: string) {
    const nroDUpper = nroD.toUpperCase();
    const years = [new Date().getFullYear(), new Date().getFullYear() - 1];
    const snapTypes = [
      { key: 'facturas_emitidas', tipo: 'emitida' },
      { key: 'facturas_recibidas', tipo: 'recibida' },
      { key: 'honorarios_recibidos', tipo: 'honorario' },
    ];
    const candidates = await Promise.all(
      years.flatMap(year => snapTypes.map(({ key, tipo }) =>
        this.getSnapshot(companyId, key, `${year}`).then(snap => ({ snap, tipo, year }))
      ))
    );
    for (const { snap, tipo, year } of candidates) {
      if (!snap) continue;
      const doc = (snap.data as any[]).find(
        (d: any) => d.NroD && String(d.NroD).toUpperCase() === nroDUpper,
      );
      if (doc) return { tipo, year, doc };
    }
    return null;
  }

  async getCxCTransactions(companyId: string, year: number, codTercero?: string) {
    const cached = await this.getSnapshot(companyId, 'cxc_transactions', `${year}`);
    if (!cached) return { transactions: [], total: 0 };

    let txns = cached.data as any[];
    if (codTercero) txns = txns.filter((t: any) => String(t.CodTercero) === String(codTercero));

    return { transactions: txns, total: txns.length };
  }

  async getCxPTransactions(companyId: string, year: number, codTercero?: string) {
    const cached = await this.getSnapshot(companyId, 'cxp_transactions', `${year}`);
    if (!cached) return { transactions: [], total: 0 };

    let txns = cached.data as any[];
    if (codTercero) txns = txns.filter((t: any) => String(t.CodTercero) === String(codTercero));

    return { transactions: txns, total: txns.length };
  }

  async getFacturasEmitidas(companyId: string, year: number) {
    const cached = await this.getSnapshot(companyId, 'facturas_emitidas', `${year}`);
    if (!cached) return { facturas: [], total: 0, year };
    const facturas = cached.data as any[];
    return { facturas, total: facturas.length, year };
  }

  async getFacturasRecibidas(companyId: string, year: number) {
    const cached = await this.getSnapshot(companyId, 'facturas_recibidas', `${year}`);
    if (!cached) return { facturas: [], total: 0, year };
    const facturas = cached.data as any[];
    return { facturas, total: facturas.length, year };
  }

  async getHonorariosRecibidos(companyId: string, year: number) {
    const cached = await this.getSnapshot(companyId, 'honorarios_recibidos', `${year}`);
    if (!cached) return { facturas: [], total: 0, year };
    const facturas = cached.data as any[];
    return { facturas, total: facturas.length, year };
  }

  async getRankingClientes(companyId: string, year: number) {
    const cached = await this.getSnapshot(companyId, 'facturas_emitidas', `${year}`);
    if (!cached) return { clientes: [], total: 0, year };
    const facturas = cached.data as any[];
    // El snapshot facturas_emitidas trae TODOS los tipos por cobrar (incluye préstamos 071,
    // transferencias bancarias 058, anticipos 070, doc. sin comprobante 060) — NO son ventas.
    // Un ranking de FACTURACIÓN debe contar solo VENTAS comerciales (facturas/boletas + NC),
    // la misma definición del CxC. Si no, aparecen "clientes" como BANCO CONTINENTAL
    // (transferencias) o personas con préstamos, inflando el total.
    const COMERCIAL = new Set(['131', '125', '128', '134']);
    const map = new Map<string, { nombre: string; ruc: string; totalFacturado: number }>();
    for (const f of facturas) {
      if (!COMERCIAL.has(String(f.CodTipo || ''))) continue;
      const key = ((f.RucCliente as string) || (f.Cliente as string) || '').trim();
      if (!map.has(key)) map.set(key, { nombre: f.Cliente ?? '', ruc: f.RucCliente ?? '', totalFacturado: 0 });
      const entry = map.get(key)!;
      // Convertir USD→soles antes de sumar; si no, se mezclan unidades y los clientes en
      // dólares quedan subvaluados ~TC veces (distorsiona total y orden del ranking).
      const esUSD = String(f.Moneda || '01').trim() === '02';
      const totalSoles = esUSD ? Number(f.Total || 0) * TC_USD_FALLBACK : Number(f.Total || 0);
      entry.totalFacturado += f.EsNotaCredito ? -totalSoles : totalSoles;
    }
    const clientes = [...map.values()].filter(c => c.totalFacturado > 0).sort((a, b) => b.totalFacturado - a.totalFacturado);
    const total = clientes.reduce((s, c) => s + c.totalFacturado, 0);
    return { clientes, total, year };
  }

  async getRankingProveedores(companyId: string, year: number) {
    const [factSnap, honSnap] = await Promise.all([
      this.getSnapshot(companyId, 'facturas_recibidas', `${year}`),
      this.getSnapshot(companyId, 'honorarios_recibidos', `${year}`),
    ]);
    const facturas: any[] = [...(factSnap?.data ?? []), ...(honSnap?.data ?? [])];
    const map = new Map<string, { nombre: string; ruc: string; totalFacturado: number }>();
    for (const f of facturas) {
      const nombre = (f.Proveedor as string) ?? '';
      const ruc = (f.RucProveedor as string) ?? '';
      const key = (ruc || nombre).trim();
      if (!map.has(key)) map.set(key, { nombre, ruc, totalFacturado: 0 });
      const entry = map.get(key)!;
      const esUSD = String(f.Moneda || '01').trim() === '02';
      const totalSoles = esUSD ? Number(f.Total || 0) * TC_USD_FALLBACK : Number(f.Total || 0);
      entry.totalFacturado += f.EsNotaCredito ? -totalSoles : totalSoles;
    }
    const proveedores = [...map.values()].filter(p => p.totalFacturado > 0).sort((a, b) => b.totalFacturado - a.totalFacturado);
    const total = proveedores.reduce((s, p) => s + p.totalFacturado, 0);
    return { proveedores, total, year };
  }

  // ─────────────────────────────────────────────
  // CxP — aging por proveedor (clase 42)
  // ─────────────────────────────────────────────

  private classifyCxPDoc(desTipo: string): 'comercial' | 'rrhh' | 'prestamo' | 'anticipo' | 'otro' {
    const t = (desTipo || '').toUpperCase();
    if (t.includes('PRESTAMO') || t.includes('PRÉSTAMO')) return 'prestamo';
    if (t.includes('ANTICIPO')) return 'anticipo';
    if (
      t.includes('REQUERIMIENTO DE PAGOS') ||
      t.includes('PLANILLA DE PAGOS') ||
      t.includes('BENEFICIO SOCIAL') ||
      t.includes('LIQUIDACION DE BENEF')
    ) return 'rrhh';
    if (
      t.includes('TRANSFERENCIA BANCARIA') ||
      t.includes('ENTREGA A RENDIR') ||
      t.includes('COMPROBANTE DE RETEN') ||
      t.includes('AJUSTES POR REDONDEO') ||
      t.includes('FONDO ROTATORIO') ||
      t.includes('RETENCION POR RECUPERAR') ||
      t.includes('DEVOLUCIONES')
    ) return 'otro';
    return 'comercial';
  }

  async getCxP(companyId: string) {
    const [cached, docsSnap, comp42] = await Promise.all([
      this.getSnapshot(companyId, 'cxp', 'current'),
      this.getSnapshot(companyId, 'cxp_docs', 'current'),
      this.composicion42FromLedger(companyId),
    ]);
    if (!cached) return { message: 'No data available. Run sync first.' };
    const result: any = this.buildCxP(cached.data as any[]);
    if (docsSnap) {
      result.breakdown = this.buildCxPBreakdown(docsSnap.data as any[]);
    }
    if (comp42) result.composicion42 = comp42;
    return result;
  }

  // CxP por RANGO de FECHA DE EMISIÓN (FechaDocumento). Deriva de cxp_docs sin resync.
  // Sin rango delega en getCxP (con composición 42 del Mayor). En modo rango se muestra la
  // deuda de los documentos emitidos en el período; sin la composición contable (puntual).
  async getCxPRange(companyId: string, desde?: string, hasta?: string) {
    if (!desde && !hasta) return this.getCxP(companyId);
    const docsSnap = await this.getSnapshot(companyId, 'cxp_docs', 'current');
    if (!docsSnap) return this.getCxP(companyId);
    const d = desde || '0000-01-01';
    const h = hasta || '9999-12-31';
    const map = new Map<string, any>();
    for (const doc of (docsSnap.data as any[])) {
      const iso = fechaDDMMYYYYtoISO(String(doc.FechaDocumento || ''));
      if (!iso || iso < d || iso > h) continue;
      const key = String(doc.CodProveedor);
      const esUSD = String(doc.Moneda || '01').trim() === '02';
      const orig = parseFloat(doc.Saldo) || 0;
      const soles = esUSD ? round(orig * TC_USD_FALLBACK) : orig;
      if (!map.has(key)) map.set(key, {
        codProveedor: doc.CodProveedor, proveedor: doc.Proveedor || key,
        saldoPEN: 0, saldoUSD: 0, saldoTotal: 0,
        saldoVigente: 0, dias0_30: 0, dias31_60: 0, dias61_90: 0, dias90mas: 0, numDocs: 0,
      });
      const p = map.get(key);
      if (esUSD) p.saldoUSD = round(p.saldoUSD + orig); else p.saldoPEN = round(p.saldoPEN + orig);
      p.saldoTotal = round(p.saldoTotal + soles);
      const dv = Number(doc.DiasVencido) || 0;
      if (dv <= 0) p.saldoVigente = round(p.saldoVigente + soles);
      else if (dv <= 30) p.dias0_30 = round(p.dias0_30 + soles);
      else if (dv <= 60) p.dias31_60 = round(p.dias31_60 + soles);
      else if (dv <= 90) p.dias61_90 = round(p.dias61_90 + soles);
      else p.dias90mas = round(p.dias90mas + soles);
      p.numDocs++;
    }
    const proveedores = [...map.values()].filter((p) => Math.abs(p.saldoTotal) > 0.01)
      .sort((a, b) => b.saldoTotal - a.saldoTotal);
    const sum = (f: string) => round(proveedores.reduce((s, p) => s + (p[f] || 0), 0));
    const totalSaldo = sum('saldoTotal');
    const top3 = proveedores.slice(0, 3).reduce((s, p) => s + p.saldoTotal, 0);
    return {
      proveedores, rango: { desde: desde || null, hasta: hasta || null }, rangoModo: true,
      totalSaldo, totalVigente: sum('saldoVigente'), total90mas: sum('dias90mas'),
      pct90mas: totalSaldo > 0 ? round((sum('dias90mas') / totalSaldo) * 100) : 0,
      concentracionTop3: totalSaldo > 0 ? round((top3 / totalSaldo) * 100) : 0,
      numProveedores: proveedores.length,
    };
  }

  // Composición contable de la cuenta 42 (por subcuenta), con signo real: facturas/honorarios/
  // letras (crédito, +) y ANTICIPOS a proveedores (débito, − reduce la deuda). Se deriva del
  // MAYOR (LedgerEntry), no del snapshot de balance: el balance sincronizado difería del mayor
  // en 421/424 por unos miles (reporte de Milka 2026-08), y el mayor es lo que ve la contadora
  // en S10 (cuadra con su balance de comprobación). Saldo = credito − debito acumulado.
  private async composicion42FromLedger(companyId: string) {
    const labels: Record<string, string> = {
      '421': 'Facturas y comprobantes por pagar',
      '422': 'Anticipos a proveedores',
      '423': 'Letras por pagar',
      '424': 'Honorarios por pagar',
      '425': 'Selección de pagos',
      '426': 'Otras cuentas por pagar',
    };
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT LEFT("codCuenta", 3) AS sub, SUM("credito" - "debito")::float8 AS neto
         FROM "LedgerEntry"
        WHERE "companyId" = $1 AND LEFT("codCuenta", 2) = '42'
          AND NOT (UPPER(COALESCE("glosa", '')) = 'ASIENTO DE CIERRE' AND "fecha"::date > CURRENT_DATE)
        GROUP BY LEFT("codCuenta", 3)`,
      companyId,
    );
    const items = (rows || [])
      .map((r) => ({
        sub: String(r.sub),
        descripcion: labels[String(r.sub)] || String(r.sub),
        neto: round(Number(r.neto) || 0),
        esAnticipo: String(r.sub) === '422',
      }))
      .filter((e) => Math.abs(e.neto) > 0.01)
      .sort((a, b) => b.neto - a.neto);
    const total = round(items.reduce((s, e) => s + e.neto, 0));
    const anticipos = round(items.filter((e) => e.sub === '422').reduce((s, e) => s + e.neto, 0));
    return { items, total, anticipos };
  }

  buildCxPBreakdown(docs: any[]) {
    const pen = { comercial: 0, rrhh: 0, prestamo: 0, anticipo: 0, otro: 0 };
    const usd = { comercial: 0, rrhh: 0, prestamo: 0, anticipo: 0, otro: 0 };
    for (const d of docs) {
      const cat = this.classifyCxPDoc(d.DesTipo || '');
      const saldo = parseFloat(d.Saldo) || 0;
      const isUSD = String(d.Moneda || '01').trim() === '02';
      if (isUSD) usd[cat] += saldo;
      else pen[cat] += saldo;
    }
    const totalPEN = Object.values(pen).reduce((a, b) => a + b, 0);
    return {
      comercialPEN: round(pen.comercial),
      rrhhPEN:      round(pen.rrhh),
      prestamoPEN:  round(pen.prestamo),
      anticipoPEN:  round(pen.anticipo),
      otroPEN:      round(pen.otro),
      comercialUSD: round(usd.comercial),
      rrhhUSD:      round(usd.rrhh),
      prestamoUSD:  round(usd.prestamo),
      anticipoUSD:  round(usd.anticipo),
      otroUSD:      round(usd.otro),
      totalPEN:     round(totalPEN),
    };
  }

  buildCxP(rows: any[]) {
    const proveedores = rows
      .map((r) => ({
        proveedor: r.Proveedor || r.CodProveedor,
        codProveedor: r.CodProveedor,
        // saldoTotal ya viene en SOLES (USD convertido por tipo de cambio en la consulta)
        saldoTotal:   round(parseFloat(r.SaldoTotal)   || 0),
        saldoPEN:     round(parseFloat(r.SaldoPEN)     || 0),
        saldoUSD:     round(parseFloat(r.SaldoUSD)     || 0),
        tipoCambioUSD: parseFloat(r.TipoCambio) || TC_USD_FALLBACK,
        saldoVigente: round(parseFloat(r.SaldoVigente) || 0),
        dias0_30:     round(parseFloat(r.Dias_0_30)    || 0),
        dias31_60:    round(parseFloat(r.Dias_31_60)   || 0),
        dias61_90:    round(parseFloat(r.Dias_61_90)   || 0),
        dias90mas:    round(parseFloat(r.Dias_90_mas)  || 0),
      }))
      .filter((p) => p.saldoTotal > 0.01);

    const totalSaldo   = proveedores.reduce((s, p) => s + p.saldoTotal, 0);
    const totalVigente = proveedores.reduce((s, p) => s + p.saldoVigente, 0);
    const total90mas   = proveedores.reduce((s, p) => s + p.dias90mas, 0);
    const sorted       = [...proveedores].sort((a, b) => b.saldoTotal - a.saldoTotal);
    const top3Saldo    = sorted.slice(0, 3).reduce((s, p) => s + p.saldoTotal, 0);

    return {
      proveedores,
      totalSaldo:        round(totalSaldo),
      totalVigente:      round(totalVigente),
      total90mas:        round(total90mas),
      pct90mas:          totalSaldo > 0 ? round((total90mas / totalSaldo) * 100) : 0,
      concentracionTop3: totalSaldo > 0 ? round((top3Saldo / totalSaldo) * 100) : 0,
      numProveedores:    proveedores.length,
    };
  }

  // ─────────────────────────────────────────────
  // Balance General — saldos acumulados por subcuenta (sin filtro de año)
  // ─────────────────────────────────────────────

  async getBalance(companyId: string, year: number) {
    const cached = await this.getSnapshot(companyId, 'balance', `${year}`);
    if (!cached) return { rows: [], message: 'No data. Run sync first.' };
    return { rows: cached.data as any[], syncedAt: cached.syncedAt };
  }

  // ─────────────────────────────────────────────
  // CxC Split — comercial vs otras (por CodTipoDocumento)
  // ─────────────────────────────────────────────

  async getCxCSplit(companyId: string) {
    const [cached, otrasCxCSnap] = await Promise.all([
      this.getSnapshot(companyId, 'cxc_split', 'current'),
      this.getSnapshot(companyId, 'otras_cxc', 'current'),
    ]);
    if (!cached) return { rows: [], comercial: 0, otras: 0, otrasCxCTotal: null };
    const rows = cached.data as any[];
    const comercial = rows.filter((r: any) => r.Grupo === 'comercial').reduce((s: number, r: any) => s + (parseFloat(r.SaldoPendiente) || 0), 0);
    const otras     = rows.filter((r: any) => r.Grupo === 'otras').reduce((s: number, r: any) => s + (parseFloat(r.SaldoPendiente) || 0), 0);
    const otrasCxCTotal = otrasCxCSnap
      ? round((otrasCxCSnap.data as any[]).reduce((s: number, r: any) => s + (parseFloat(r.SaldoTotal) || 0), 0))
      : null;
    return { rows, comercial: round(comercial), otras: round(otras), otrasCxCTotal, syncedAt: cached.syncedAt };
  }

  // ─────────────────────────────────────────────
  // Otras CxC — clases 13,14,16,17,18 aging + detalle
  // ─────────────────────────────────────────────

  async getOtrasCxC(companyId: string) {
    const cached = await this.getSnapshot(companyId, 'otras_cxc', 'current');
    if (!cached) return { rows: [], message: 'No data. Run sync first.' };
    return { rows: cached.data as any[], syncedAt: cached.syncedAt };
  }

  async getOtrasCxCTransactions(companyId: string, year: number, codCuenta?: string, codTercero?: string) {
    const cached = await this.getSnapshot(companyId, 'otras_cxc_txn', `${year}`);
    if (!cached) return { transactions: [], total: 0 };
    let txns = cached.data as any[];
    if (codCuenta) txns = txns.filter((t: any) => String(t.CodCuenta).startsWith(codCuenta));
    if (codTercero) txns = txns.filter((t: any) => String(t.CodTercero) === codTercero);
    return { transactions: txns, total: txns.length };
  }

  // ─────────────────────────────────────────────
  // Otras CxP — clases 43,44,45,46,47 aging + detalle
  // ─────────────────────────────────────────────

  async getOtrasCxP(companyId: string) {
    const cached = await this.getSnapshot(companyId, 'otras_cxp', 'current');
    if (!cached) return { rows: [], message: 'No data. Run sync first.' };
    return { rows: cached.data as any[], syncedAt: cached.syncedAt };
  }

  async getOtrasCxPTransactions(companyId: string, year: number, codCuenta?: string, codTercero?: string) {
    const cached = await this.getSnapshot(companyId, 'otras_cxp_txn', `${year}`);
    if (!cached) return { transactions: [], total: 0 };
    let txns = cached.data as any[];
    if (codCuenta) txns = txns.filter((t: any) => String(t.CodCuenta).startsWith(codCuenta));
    if (codTercero) txns = txns.filter((t: any) => String(t.CodTercero) === codTercero);
    return { transactions: txns, total: txns.length };
  }

  // ─────────────────────────────────────────────
  // Tributos — clase 40 saldos + detalle
  // ─────────────────────────────────────────────

  async getTributos(companyId: string, year?: number) {
    // Try year-specific snapshot first; fall back to 'current' for backwards compat
    const period = year ? `${year}` : 'current';
    let cached = await this.getSnapshot(companyId, 'tributos', period);
    if (!cached && period !== 'current') cached = await this.getSnapshot(companyId, 'tributos', 'current');
    if (!cached) return { rows: [], message: 'No data. Run sync first.' };
    return { rows: cached.data as any[], year, syncedAt: cached.syncedAt };
  }

  async getTributosTxn(companyId: string, year: number, codCuenta?: string) {
    const cached = await this.getSnapshot(companyId, 'tributos_txn', `${year}`);
    if (!cached) return { transactions: [], total: 0 };
    let txns = cached.data as any[];
    if (codCuenta) txns = txns.filter((t: any) => String(t.CodCuenta).startsWith(codCuenta));
    return { transactions: txns, total: txns.length };
  }

  // ─────────────────────────────────────────────
  // Laboral — clase 41 (CTS, remuneraciones)
  // ─────────────────────────────────────────────

  async getLaboral(companyId: string) {
    const cached = await this.getSnapshot(companyId, 'laboral', 'current');
    if (!cached) return { rows: [], message: 'No data. Run sync first.' };
    return { rows: cached.data as any[], syncedAt: cached.syncedAt };
  }

  // ─────────────────────────────────────────────
  // Activo Fijo — clase 33 vs 39 (valor bruto, depreciación, valor neto)
  // ─────────────────────────────────────────────

  async getActivoFijo(companyId: string) {
    const cached = await this.getSnapshot(companyId, 'activo_fijo', 'current');
    if (!cached) return { rows: [], message: 'No data. Run sync first.' };
    const rows = cached.data as any[];

    // Formato nuevo (mayo 2026): rows con campo Clase ('33' o '39')
    // y Saldo en naturaleza (positivo). Compatible con formato antiguo
    // por si quedan snapshots viejos en BD.
    const hasNewFormat = rows.some((r: any) => r.Clase === '33' || r.Clase === '39');

    if (hasNewFormat) {
      const activos = rows.filter((r: any) => r.Clase === '33');
      const depreciaciones = rows.filter((r: any) => r.Clase === '39');
      const totalBruto = activos.reduce((s: number, r: any) => s + (parseFloat(r.Saldo) || 0), 0);
      const totalDeprec = depreciaciones.reduce((s: number, r: any) => s + (parseFloat(r.Saldo) || 0), 0);
      const totalNeto = totalBruto - totalDeprec;
      return {
        rows, activos, depreciaciones,
        totalBruto: round(totalBruto),
        totalDeprec: round(totalDeprec),
        totalNeto: round(totalNeto),
        syncedAt: cached.syncedAt,
      };
    }

    // Formato antiguo (será reemplazado tras el próximo sync)
    const totalBruto = rows.reduce((s: number, r: any) => s + (parseFloat(r.ValorBruto) || 0), 0);
    const totalDeprec = rows.reduce((s: number, r: any) => s + (parseFloat(r.DepreciacionAcum) || 0), 0);
    const totalNeto = rows.reduce((s: number, r: any) => s + (parseFloat(r.ValorNeto) || 0), 0);
    return {
      rows,
      totalBruto: round(totalBruto),
      totalDeprec: round(totalDeprec),
      totalNeto: round(totalNeto),
      syncedAt: cached.syncedAt,
    };
  }

  async getActivoFijoTxn(companyId: string, year: number, codCuenta?: string) {
    // Activo fijo es histórico acumulado — guardado sin filtro de año en período 'all'
    const cached = await this.getSnapshot(companyId, 'activo_fijo_txn', 'all');
    if (!cached) return { transactions: [], total: 0 };
    let txns = cached.data as any[];
    if (codCuenta) txns = txns.filter((t: any) => String(t.CodCuenta).startsWith(codCuenta));
    return { transactions: txns, total: txns.length };
  }

  async getGastosNatTxn(companyId: string, year: number, codCuenta?: string) {
    const cached = await this.getSnapshot(companyId, 'gastos_nat_txn', `${year}`);
    if (!cached) return { transactions: [], total: 0 };
    let txns = cached.data as any[];
    if (codCuenta) txns = txns.filter((t: any) => String(t.CodCuenta).startsWith(codCuenta));
    return { transactions: txns, total: txns.length };
  }

  async getAuditoriaLaboral(companyId: string, year: number) {
    // Fase C: auditoría laboral integral
    const [metricasSnap, trabajadoresSnap, ctsSnap] = await Promise.all([
      this.getSnapshot(companyId, 'laboral_metricas', `${year}`),
      this.getSnapshot(companyId, 'pagos_trabajadores', `${year}`),
      this.getSnapshot(companyId, 'cts_depositos', 'current'),
    ]);

    const metricasArr = (metricasSnap?.data as any[]) ?? [];
    const m = metricasArr[0] ?? {};
    const trabajadores = (trabajadoresSnap?.data as any[]) ?? [];
    const ctsDepositos = (ctsSnap?.data as any[]) ?? [];

    // Validación CTS: depósitos deben ser en mayo y noviembre (DL 650)
    const ctsConViolacion = ctsDepositos.filter((c: any) =>
      parseFloat(c.MontoDepositado) > 100 && c.ClasificacionLegal === 'Fuera de plazo'
    );
    const ctsEnPlazo = ctsDepositos.filter((c: any) =>
      parseFloat(c.MontoDepositado) > 100 && c.ClasificacionLegal === 'En plazo (DL 650)'
    );

    return {
      metricas: m,
      trabajadores,
      ctsDepositos,
      numTrabajadoresRecurrentes: trabajadores.filter((t: any) => t.PatronPago === 'Recurrente').length,
      totalPagadoTrabajadores: round(trabajadores.reduce((s: number, t: any) => s + (parseFloat(t.MontoTotal) || 0), 0)),
      ctsConViolacion,
      ctsEnPlazo,
      cumplimientoCTS: ctsConViolacion.length === 0 && ctsEnPlazo.length > 0
        ? 'CUMPLIMIENTO'
        : ctsConViolacion.length > 0
          ? 'INCUMPLIMIENTO (depósitos fuera de plazo)'
          : 'SIN DATOS',
      syncedAt: metricasSnap?.syncedAt,
    };
  }

  async getBancarizacion(companyId: string, year: number) {
    // Fase B: auditoría de Bancarización Ley 28194
    const [metricasSnap, pagosNoBancSnap, benefSinCtaSnap] = await Promise.all([
      this.getSnapshot(companyId, 'bancarizacion_metricas', `${year}`),
      this.getSnapshot(companyId, 'pagos_no_bancarizados', `${year}`),
      this.getSnapshot(companyId, 'beneficiarios_sin_cuenta', `${year}`),
    ]);

    const metricasArr = (metricasSnap?.data as any[]) ?? [];
    const m = metricasArr[0] ?? {};
    const pagosNoBancarizados = (pagosNoBancSnap?.data as any[]) ?? [];
    const beneficiariosSinCuenta = (benefSinCtaSnap?.data as any[]) ?? [];

    const montoNoBancarizado = parseFloat(m.MontoNoBancarizado) || 0;
    // Pérdida fiscal estimada: 18% IGV + 29.5% IR = 47.5% del monto no bancarizado
    const perdidaIGV = round(montoNoBancarizado * 0.18);
    const perdidaIR = round(montoNoBancarizado * 0.295);
    const perdidaTotal = round(perdidaIGV + perdidaIR);

    const pctBancarizado = m.PagosMateriales > 0
      ? round(((parseInt(m.PagosBancarizados) || 0) / parseInt(m.PagosMateriales)) * 100)
      : 100;

    return {
      metricas: m,
      pagosNoBancarizados,
      beneficiariosSinCuenta,
      pctBancarizado,
      perdidaIGV,
      perdidaIR,
      perdidaTotal,
      contingenciaTributaria: perdidaTotal,
      syncedAt: metricasSnap?.syncedAt,
    };
  }

  async getCajaBancoCompleto(companyId: string, year: number) {
    // Fase A.5: visión 360° del módulo caja-banco completo
    const [
      librosCajaSnap, cajaSnap, asignMetricasSnap, pagosSinAsignSnap, compensacionesSnap,
    ] = await Promise.all([
      this.getSnapshot(companyId, 'ob_libros_caja', 'current'),
      this.getSnapshot(companyId, 'ob_caja', `${year}`),
      this.getSnapshot(companyId, 'ob_asignaciones_metricas', `${year}`),
      this.getSnapshot(companyId, 'pagos_sin_asignacion', `${year}`),
      this.getSnapshot(companyId, 'compensaciones', 'current'),
    ]);

    const libros = (librosCajaSnap?.data as any[]) ?? [];
    const cajas = (cajaSnap?.data as any[]) ?? [];
    const asignMetricasArr = (asignMetricasSnap?.data as any[]) ?? [];
    const metricas = asignMetricasArr[0] ?? {};
    const pagosSinAsign = (pagosSinAsignSnap?.data as any[]) ?? [];
    const compensaciones = (compensacionesSnap?.data as any[]) ?? [];

    const librosActivos = libros.filter(l => l.Activo).length;
    const librosConOperaciones = libros.filter(l => l.NumOperaciones > 0).length;
    const totalMontoCajas = cajas.reduce((s, c) => s + (parseFloat(c.MontoTotal) || 0), 0);
    const totalMontoPagosSinAsign = pagosSinAsign.reduce((s, p) => s + (parseFloat(p.Monto) || 0), 0);
    const totalMontoCompensaciones = compensaciones.reduce((s, c) => s + (parseFloat(c.Monto) || 0), 0);

    return {
      libros,
      cajas,
      metricas,
      pagosSinAsign,
      compensaciones,
      librosActivos,
      librosConOperaciones,
      totalLibros: libros.length,
      totalCajas: cajas.length,
      totalMontoCajas: round(totalMontoCajas),
      totalCompensaciones: compensaciones.length,
      totalMontoCompensaciones: round(totalMontoCompensaciones),
      totalPagosSinAsignacion: pagosSinAsign.length,
      totalMontoPagosSinAsign: round(totalMontoPagosSinAsign),
      syncedAt: (cajaSnap?.syncedAt ?? librosCajaSnap?.syncedAt) ?? null,
    };
  }

  async getObPagos(companyId: string, year: number) {
    const cached = await this.getSnapshot(companyId, 'ob_pagos', `${year}`);
    if (!cached) return { rows: [], total: 0, totalMonto: 0 };
    const rows = cached.data as any[];
    const totalMonto = rows.reduce((s, r) => s + (parseFloat(r.Monto) || 0), 0);
    const conCheque = rows.filter(r => r.NoCheque && r.NoCheque.trim()).length;
    const electronicos = rows.filter(r => r.EsElectronico).length;
    const anulados = rows.filter(r => r.Estado === 'A' || r.Estado === 'a').length;
    return {
      rows,
      total: rows.length,
      totalMonto: round(totalMonto),
      conCheque,
      electronicos,
      anulados,
      syncedAt: cached.syncedAt,
    };
  }

  async getConciliacionBancaria(companyId: string) {
    const cached = await this.getSnapshot(companyId, 'conciliacion_bancaria', 'current');
    const movsCached = await this.getSnapshot(companyId, 'movs_sin_conciliar', 'current');
    const rows = (cached?.data as any[]) ?? [];
    const movsSinConciliar = (movsCached?.data as any[]) ?? [];

    // Métricas agregadas
    const cuentasConEstados = rows.filter(r => r.TotalEstadosHistoricos > 0).length;
    const cuentasSinEstados = rows.filter(r => !r.TotalEstadosHistoricos || r.TotalEstadosHistoricos === 0).length;
    const cuentasConcAlDia = rows.filter(r => r.DiasDesdeUltimoEstado != null && r.DiasDesdeUltimoEstado <= 60).length;
    const cuentasConcAtrasada = rows.filter(r => r.DiasDesdeUltimoEstado != null && r.DiasDesdeUltimoEstado > 60).length;
    const diasAtraso = rows
      .map(r => r.DiasDesdeUltimoEstado)
      .filter(d => d != null);
    const maxDiasAtraso = diasAtraso.length ? Math.max(...diasAtraso) : null;
    const minDiasAtraso = diasAtraso.length ? Math.min(...diasAtraso) : null;
    const totalMovsSinConc = rows.reduce((s, r) => s + (parseInt(r.NumSinConciliar) || 0), 0);

    return {
      rows,
      movsSinConciliar,
      cuentasConEstados,
      cuentasSinEstados,
      cuentasConcAlDia,
      cuentasConcAtrasada,
      maxDiasAtraso,
      minDiasAtraso,
      totalMovsSinConc,
      totalCuentas: rows.length,
      usaModulo: cuentasConEstados > 0,
      syncedAt: cached?.syncedAt,
    };
  }

  async getObSaldosBanco(companyId: string) {
    const cached = await this.getSnapshot(companyId, 'ob_saldos_banco', 'current');
    if (!cached) return { rows: [], message: 'No data. Run sync first.' };
    const rows = cached.data as any[];
    const totalBalanceActual = rows.reduce((s: number, r: any) => s + (parseFloat(r.BalanceActual) || 0), 0);
    const totalBalanceReal = rows.reduce((s: number, r: any) => s + (parseFloat(r.BalanceReal) || 0), 0);
    const totalSaldoInicial = rows.reduce((s: number, r: any) => s + (parseFloat(r.SaldoInicialPeriodo) || 0), 0);
    return {
      rows,
      totalBalanceActual: round(totalBalanceActual),
      totalBalanceReal: round(totalBalanceReal),
      totalSaldoInicial: round(totalSaldoInicial),
      discrepanciaTotal: round(totalBalanceActual - totalBalanceReal),
      syncedAt: cached.syncedAt,
    };
  }

  // ─────────────────────────────────────────────
  // Préstamos — otorgados (tipo 071 CxC) y recibidos (tipo 071 CxP)
  // ─────────────────────────────────────────────

  async getPrestamosOtorgados(companyId: string) {
    const cached = await this.getSnapshot(companyId, 'prestamos_otorgados', 'current');
    if (!cached) return { rows: [], total: 0 };
    const rows = cached.data as any[];
    const total = rows.reduce((s: number, r: any) => s + (parseFloat(r.SaldoPendiente) || 0), 0);
    return { rows, total: round(total), syncedAt: cached.syncedAt };
  }

  async getPrestamosRecibidos(companyId: string) {
    const cached = await this.getSnapshot(companyId, 'prestamos_recibidos', 'current');
    if (!cached) return { rows: [], total: 0 };
    const rows = cached.data as any[];
    const total = rows.reduce((s: number, r: any) => s + (parseFloat(r.SaldoPendiente) || 0), 0);
    return { rows, total: round(total), syncedAt: cached.syncedAt };
  }

  // ─────────────────────────────────────────────
  // Transferencias — tipo 058 inter-empresa / bancos
  // ─────────────────────────────────────────────

  async getTransferencias(companyId: string) {
    const cached = await this.getSnapshot(companyId, 'transferencias', 'current');
    if (!cached) return { rows: [], total: 0 };
    const rows = cached.data as any[];
    return { rows, total: rows.length, syncedAt: cached.syncedAt };
  }

  // ─────────────────────────────────────────────
  // Caja Saldos — saldos bancarios acumulados (sin filtro año)
  // ─────────────────────────────────────────────

  async getCajaSaldos(companyId: string) {
    const cached = await this.getSnapshot(companyId, 'caja_saldos', 'current');
    if (!cached) return { rows: [], totalSaldo: 0 };
    const rows = cached.data as any[];
    const totalSaldo = rows.reduce((s: number, r: any) => s + (parseFloat(r.SaldoActual) || 0), 0);
    return { rows, totalSaldo: round(totalSaldo), syncedAt: cached.syncedAt };
  }

  async getCajaTxn(companyId: string, year: number, codCuenta?: string, desde?: string, hasta?: string) {
    const cached = await this.getSnapshot(companyId, 'caja_txn', `${year}`);
    if (!cached) return { transactions: [], total: 0 };
    let txns = cached.data as any[];
    if (codCuenta) txns = txns.filter((t: any) => String(t.CodBanco ?? t.CodCuenta).startsWith(codCuenta));
    if (desde || hasta) {
      const d = desde || '0000-01-01';
      const h = hasta || '9999-12-31';
      txns = txns.filter((t: any) => {
        const iso = fechaDDMMYYYYtoISO(String(t.Fecha || ''));
        return iso && iso >= d && iso <= h;
      });
    }
    return { transactions: txns, total: txns.length };
  }

  async getDocumentPayments(companyId: string, nroD: string) {
    if (!nroD) return { payments: [] };
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: currentYear - 2021 }, (_, i) => 2022 + i);
    const snapshots = await Promise.all(
      years.map(y => this.getSnapshot(companyId, 'caja_txn', `${y}`)),
    );
    const payments: any[] = [];
    for (const snap of snapshots) {
      if (!snap) continue;
      const matches = (snap.data as any[]).filter(
        (t: any) => t.NroD && String(t.NroD).toUpperCase() === String(nroD).toUpperCase(),
      );
      payments.push(...matches);
    }
    payments.sort((a, b) => (a.Fecha > b.Fecha ? 1 : -1));

    // Monto de detracción del documento (para etiquetar el movimiento correspondiente)
    const detraccion = await this.lookupDetraccion(companyId, nroD, years);

    // Etiquetar cada movimiento: Detracción (el que coincide con MontoDetraccion) / Cobro / Pago
    let detracTagged = false;
    for (const p of payments) {
      const deb = Number(p.Debito) || 0;
      const cred = Number(p.Credito) || 0;
      if (!detracTagged && detraccion > 0.01 && Math.abs(deb - detraccion) < 0.01) {
        p.tipo = 'Detracción';
        detracTagged = true;
      } else {
        p.tipo = deb >= cred ? 'Cobro' : 'Pago';
      }
    }

    return { payments, detraccion: round(detraccion), detraccionCobrada: detracTagged };
  }

  // ─────────────────────────────────────────────
  // Reporte de DETRACCIONES — sin resync (deriva de facturas_emitidas/recibidas + caja_txn).
  // lado: 'cobradas' (facturas emitidas / CxC) | 'pagadas' (facturas recibidas / CxP).
  // Identifica el movimiento de detracción con la máxima precisión disponible: (1) cuenta
  // "Banco Nación - Cta Detracción" (autoritativo), (2) glosa con "DETRAC", (3) monto =
  // MontoDetraccion del documento (fallback, p.ej. movimientos por "Caja en Tránsito").
  // ─────────────────────────────────────────────
  async getDetracciones(companyId: string, year: number, lado: 'cobradas' | 'pagadas' = 'cobradas') {
    // Fuente por lado:
    //  - cobradas: facturas_emitidas (por año, trae Detraccion).
    //  - pagadas: cxp_docs (snapshot 'current'; facturas_recibidas NO trae Detraccion),
    //    filtrado por el año de la fecha del documento.
    const yrOf = (f: any) => Number(String(f || '').split('/')[2]) || 0;
    let docs: any[];
    if (lado === 'pagadas') {
      const snap = await this.getSnapshot(companyId, 'cxp_docs', 'current');
      if (!snap) return { detracciones: [], year, lado, total: 0 };
      docs = (snap.data as any[]).filter(
        (d) => (Number(d.Detraccion) || 0) > 0.01 && yrOf(d.FechaDocumento) === year,
      );
    } else {
      const snap = await this.getSnapshot(companyId, 'facturas_emitidas', `${year}`);
      if (!snap) return { detracciones: [], year, lado, total: 0 };
      docs = (snap.data as any[]).filter((d) => (Number(d.Detraccion) || 0) > 0.01);
    }
    if (!docs.length) return { detracciones: [], year, lado, total: 0 };

    // Indexar caja_txn por NroD (año + adyacentes, por cobros/pagos a caballo de año)
    const curY = new Date().getFullYear();
    const yrs = [year - 1, year, year + 1].filter((y) => y >= 2022 && y <= curY);
    const txByNroD = new Map<string, any[]>();
    for (const y of yrs) {
      const snap = await this.getSnapshot(companyId, 'caja_txn', `${y}`);
      if (!snap) continue;
      for (const t of (snap.data as any[])) {
        if (!t.NroD) continue;
        const k = String(t.NroD).toUpperCase();
        if (!txByNroD.has(k)) txByNroD.set(k, []);
        txByNroD.get(k)!.push(t);
      }
    }

    const esDetracMov = (t: any, monto: number) => {
      const banco = String(t.DesBanco || '').toUpperCase();
      const glosa = String(t.Glosa || '').toUpperCase();
      const amt = Math.abs((Number(t.Debito) || 0) - (Number(t.Credito) || 0));
      if (banco.includes('DETRACCION') || banco.includes('NACION')) return true;
      if (glosa.includes('DETRAC')) return true;
      if (monto > 0.01 && Math.abs(amt - monto) < 0.01) return true;
      return false;
    };
    const metodoDetrac = (t: any) => {
      const banco = String(t.DesBanco || '').toUpperCase();
      const glosa = String(t.Glosa || '').toUpperCase();
      if (banco.includes('DETRACCION') || banco.includes('NACION')) return 'cuenta BN';
      if (glosa.includes('DETRAC')) return 'glosa';
      return 'monto';
    };

    const detracciones = docs.map((d: any) => {
      const movs = txByNroD.get(String(d.NroD).toUpperCase()) || [];
      const monto = round(Number(d.Detraccion) || 0);
      const dm = movs.find((t) => esDetracMov(t, monto));
      const pagos = movs.filter((t) => t !== dm);
      // El pago NETO de un documento con detracción es SIEMPRE Total − Detracción: en el
      // régimen SPOT la contraparte retiene la detracción (la deposita en la cta. BN aparte)
      // y paga el resto. NO se suman los movimientos de caja por NroD: eso sobrecuenta cuando
      // un pago en lote cubre varias facturas (cobro CxC salía > documento) o cuando hay dos
      // movimientos de detracción (CxP "Completo" restaba la detracción dos veces). Los
      // movimientos solo sirven para la FECHA de pago y el estado (pagado / no pagado).
      const pagado = pagos.length > 0;
      const montoPago = pagado ? round((Number(d.Total) || 0) - monto) : 0;
      return {
        doc: `${d.Serie || ''}-${d.Numero || ''}`,
        serie: d.Serie || '', numero: d.Numero || '',
        fechaDocumento: d.FechaDocumento || '',
        tercero: d.Cliente || d.Proveedor || '',
        ruc: d.RucCliente || d.RucProveedor || d.CodProveedor || d.CodCliente || '',
        total: round(Number(d.Total) || 0),
        montoDetraccion: monto,
        fechaDetraccion: dm ? dm.Fecha : null,
        metodoDetraccion: dm ? metodoDetrac(dm) : null,
        montoPago,
        fechaPago: pagos.length ? pagos[pagos.length - 1].Fecha : null,
        estado: dm ? (pagos.length ? 'Completo' : 'Solo detracción') : (pagos.length ? 'Solo pago' : 'Pendiente'),
      };
    });

    detracciones.sort((a, b) => (a.fechaDocumento < b.fechaDocumento ? 1 : -1));
    return {
      detracciones, year, lado, total: detracciones.length,
      totalDetraccion: round(detracciones.reduce((s, r) => s + r.montoDetraccion, 0)),
      syncedAt: new Date().toISOString(),
    };
  }

  // Busca el MontoDetraccion de un documento por su NroD en las facturas emitidas/recibidas.
  private async lookupDetraccion(companyId: string, nroD: string, years: number[]): Promise<number> {
    const key = String(nroD).toUpperCase();
    for (const kpiType of ['facturas_emitidas', 'facturas_recibidas']) {
      for (const y of years) {
        const snap = await this.getSnapshot(companyId, kpiType, `${y}`);
        if (!snap) continue;
        const hit = (snap.data as any[]).find(
          (d: any) => d.NroD && String(d.NroD).toUpperCase() === key,
        );
        if (hit) return Number(hit.Detraccion) || 0;
      }
    }
    return 0;
  }

  async getCajaAsientoLineas(companyId: string, year: number, nroAsiento: string) {
    const cached = await this.getSnapshot(companyId, 'caja_asiento_full', `${year}`);
    if (!cached) return { lineas: [] };
    const lineas = (cached.data as any[]).filter((t: any) => String(t.NroAsiento) === nroAsiento);
    return { lineas };
  }

  // ─────────────────────────────────────────────
  // Tesorería — posición bancaria con apertura/cierre por año
  // ─────────────────────────────────────────────

  async getTesoreria(companyId: string, year: number) {
    const cached = await this.getSnapshot(companyId, 'tesoreria', `${year}`);
    if (!cached) return { bancos: [], totalSaldoFinal: 0, year };
    const bancos = cached.data as any[];
    const totalSaldoFinal = bancos.reduce((s: number, r: any) => s + (parseFloat(r.SaldoFinal) || 0), 0);
    const totalEntradasAnio = bancos.reduce((s: number, r: any) => s + (parseFloat(r.EntradasAnio) || 0), 0);
    const totalSalidasAnio = bancos.reduce((s: number, r: any) => s + (parseFloat(r.SalidasAnio) || 0), 0);
    const totalSaldoInicial = bancos.reduce((s: number, r: any) => s + (parseFloat(r.SaldoInicial) || 0), 0);
    return {
      bancos,
      totalSaldoInicial: round(totalSaldoInicial),
      totalEntradasAnio: round(totalEntradasAnio),
      totalSalidasAnio: round(totalSalidasAnio),
      totalSaldoFinal: round(totalSaldoFinal),
      year,
      syncedAt: cached.syncedAt,
    };
  }

  // ─────────────────────────────────────────────
  // Patrimonio — clases 50-59 (capital, reservas, resultados)
  // ─────────────────────────────────────────────

  async getPatrimonio(companyId: string) {
    const cached = await this.getSnapshot(companyId, 'patrimonio', 'current');
    if (!cached) return { rows: [], totalPatrimonio: 0 };
    const rows = cached.data as any[];
    const totalPatrimonio = rows.reduce((s: number, r: any) => s + (parseFloat(r.SaldoNeto) || 0), 0);
    return { rows, totalPatrimonio: round(totalPatrimonio), syncedAt: cached.syncedAt };
  }

  async getPatrimonioTransactions(companyId: string, year: number, codCuenta?: string) {
    const cached = await this.getSnapshot(companyId, 'patrimonio_txn', `${year}`);
    if (!cached) return { transactions: [], total: 0 };
    let txns = cached.data as any[];
    if (codCuenta) txns = txns.filter((t: any) => String(t.CodCuenta).startsWith(codCuenta));
    return { transactions: txns, total: txns.length };
  }

  // ─────────────────────────────────────────────
  // Inventarios — clases 20-29 con saldo histórico y movimiento del año
  // ─────────────────────────────────────────────

  async getInventarios(companyId: string, year: number) {
    const cached = await this.getSnapshot(companyId, 'inventarios', `${year}`);
    if (!cached) return { rows: [], totalSaldo: 0, year };
    const rows = cached.data as any[];
    const totalSaldo = rows.reduce((s: number, r: any) => s + (parseFloat(r.SaldoHistorico) || 0), 0);
    return { rows, totalSaldo: round(totalSaldo), year, syncedAt: cached.syncedAt };
  }

  // ─────────────────────────────────────────────
  // Laboral TXN — detalle de transacciones clase 41
  // ─────────────────────────────────────────────

  async getLaboralTxn(companyId: string, year: number, codCuenta?: string) {
    const cached = await this.getSnapshot(companyId, 'laboral_txn', `${year}`);
    if (!cached) return { transactions: [], total: 0 };
    let txns = cached.data as any[];
    if (codCuenta) txns = txns.filter((t: any) => String(t.CodCuenta).startsWith(codCuenta));
    return { transactions: txns, total: txns.length };
  }

  // ─────────────────────────────────────────────
  // Gastos por Naturaleza — clases 60-68 por mes
  // ─────────────────────────────────────────────

  async getGastosNaturaleza(companyId: string, year: number) {
    const cached = await this.getSnapshot(companyId, 'gastos_naturaleza', `${year}`);
    if (!cached) return { rows: [], year };
    return { rows: cached.data as any[], year, syncedAt: cached.syncedAt };
  }

  // Gastos por naturaleza por RANGO — derivado de `gastos_nat_txn` (trae Fecha y DesCuenta).
  // Monto = débito − crédito, agregado por (CodCuenta, Mes). Cuadra al centavo. Default = año.
  async getGastosNaturalezaRange(companyId: string, year: number, desde?: string, hasta?: string) {
    const fullYear =
      (!desde || desde <= `${year}-01-01`) && (!hasta || hasta >= `${year}-12-31`);
    if (fullYear) return this.getGastosNaturaleza(companyId, year);

    const txSnap = await this.getSnapshot(companyId, 'gastos_nat_txn', `${year}`);
    if (!txSnap) {
      const full = await this.getGastosNaturaleza(companyId, year);
      return { ...full, rango: { desde, hasta }, rangoNoDisponible: true };
    }

    const d = desde || `${year}-01-01`;
    const h = hasta || `${year}-12-31`;
    const agg = new Map<string, any>();
    for (const r of (txSnap.data as any[])) {
      const iso = fechaDDMMYYYYtoISO(r.Fecha);
      if (iso < d || iso > h) continue;
      const key = `${r.CodCuenta}|${r.Mes}`;
      const val = (Number(r.Debito) || 0) - (Number(r.Credito) || 0);
      const ex = agg.get(key);
      if (ex) ex.Monto = round(ex.Monto + val);
      else agg.set(key, {
        Mes: r.Mes, Clase: r.Clase, Monto: round(val),
        CodCuenta: r.CodCuenta, DesCuenta: r.DesCuenta, GrupoCuenta: r.GrupoCuenta,
      });
    }
    return { rows: [...agg.values()], year, rango: { desde: d, hasta: h } };
  }

  // ─────────────────────────────────────────────
  // Auditoría — sin documento, descuadres, atípicos, conciliación
  // ─────────────────────────────────────────────

  // Glosas que por naturaleza no tienen documento fuente y se controlan por otra vía
  private static readonly GLOSAS_SIN_DOC_EXCLUIR = [
    'asiento de apertura',
    'asiento de cierre',
    'diferencia de cambio',
  ];

  private filterSinDoc(txns: any[]): any[] {
    return txns.filter((t: any) => {
      const glosa = String(t.Glosa || '').trim().toLowerCase();
      return !KpiService.GLOSAS_SIN_DOC_EXCLUIR.some(exc => glosa.startsWith(exc));
    });
  }

  async getAuditSinDoc(companyId: string, year: number) {
    const [cached, txnCached] = await Promise.all([
      this.getSnapshot(companyId, 'audit_sin_doc', `${year}`),
      this.getSnapshot(companyId, 'audit_sin_doc_txn', `${year}`),
    ]);
    if (!cached) return { resumen: [], year };

    if (txnCached) {
      // Recompute SinDocumento counts and amounts from filtered transaction data
      const filtered = this.filterSinDoc(txnCached.data as any[]);
      const countPerClase: Record<string, number> = {};
      const montoPerClase: Record<string, number> = {};
      for (const t of filtered) {
        const clase = String(t.CodCuenta || '').slice(0, 2);
        countPerClase[clase] = (countPerClase[clase] || 0) + 1;
        montoPerClase[clase] = (montoPerClase[clase] || 0) + (t.Monto || 0);
      }
      const resumen = (cached.data as any[])
        .map((r: any) => ({ ...r, SinDocumento: countPerClase[r.Clase] ?? 0, MontoSinDoc: montoPerClase[r.Clase] ?? 0 }))
        .filter((r: any) => r.SinDocumento > 0 || r.TotalAsientos > 0);
      return { resumen, year, syncedAt: cached.syncedAt };
    }

    return { resumen: cached.data as any[], year, syncedAt: cached.syncedAt };
  }

  async getAuditSinDocTxn(companyId: string, year: number, clase?: string) {
    const cached = await this.getSnapshot(companyId, 'audit_sin_doc_txn', `${year}`);
    if (!cached) return { transactions: [], total: 0 };
    let txns = this.filterSinDoc(cached.data as any[]);
    if (clase) txns = txns.filter((t: any) => String(t.CodCuenta).startsWith(clase));
    return { transactions: txns, total: txns.length };
  }

  async getAuditDescuadres(companyId: string, year: number) {
    const [cached, acCached] = await Promise.all([
      this.getSnapshot(companyId, 'audit_descuadres', `${year}`),
      this.getSnapshot(companyId, 'audit_apertura_cierre', `${year}`),
    ]);
    if (!cached) return { rows: [], aperturaCierre: null, year };

    const all = cached.data as any[];
    const glosaOf = (r: any) => String(r.Glosa || '').trim().toLowerCase();
    const isApertura = (r: any) => glosaOf(r).startsWith('asiento de apertura');
    const isCierre   = (r: any) => glosaOf(r).startsWith('asiento de cierre');

    const rows = all.filter(r => !isApertura(r) && !isCierre(r));

    const summarize = (entries: any[]) => {
      if (!entries.length) return null;
      const totalDebito  = entries.reduce((s, r) => s + (r.TotalDebito  || 0), 0);
      const totalCredito = entries.reduce((s, r) => s + (r.TotalCredito || 0), 0);
      const descuadre    = Math.abs(totalDebito - totalCredito);
      return { nroDs: entries.length, totalDebito, totalCredito, descuadre, cuadrado: descuadre < 1, fecha: entries[0]?.Fecha ?? null };
    };

    // Prefer dedicated snapshot (captures balanced apertura entries too).
    // Fall back to searching within descuadres if snapshot not yet synced.
    const acSource = acCached ? (acCached.data as any[]) : all;
    const aperturaCierre = {
      apertura: summarize(acSource.filter(isApertura)),
      cierre:   summarize(acSource.filter(isCierre)),
    };

    return { rows, count: rows.length, aperturaCierre, year, syncedAt: cached.syncedAt };
  }

  async getAuditAtipicos(companyId: string, year: number) {
    const cached = await this.getSnapshot(companyId, 'audit_atipicos', `${year}`);
    if (!cached) return { rows: [], year };
    return { rows: cached.data as any[], year, syncedAt: cached.syncedAt };
  }

  async getAuditConciliacion(companyId: string, year: number) {
    const cached = await this.getSnapshot(companyId, 'audit_conciliacion', `${year}`);
    if (!cached) return { rows: [], year };
    return { rows: cached.data as any[], year, syncedAt: cached.syncedAt };
  }

  async getAuditClasificacion(companyId: string) {
    const [cxpDocsSnap, otrasCxpSnap, otrasCxcSnap] = await Promise.all([
      this.getSnapshot(companyId, 'cxp_docs', 'current'),
      this.getSnapshot(companyId, 'otras_cxp', 'current'),
      this.getSnapshot(companyId, 'otras_cxc', 'current'),
    ]);

    // ── Items en cuenta 42 que no son deuda comercial ni planilla ──
    const cxpDocs = (cxpDocsSnap?.data as any[]) ?? [];
    const malClasificados: any[] = [];
    for (const d of cxpDocs) {
      const cat = this.classifyCxPDoc(d.DesTipo || '');
      if (cat === 'comercial' || cat === 'rrhh') continue;
      const pagado = parseFloat(d.Pagado) || 0;
      let cuentaSugerida = '';
      let motivo = '';
      if (cat === 'prestamo') {
        cuentaSugerida = '45 — Obligaciones Financieras';
        motivo = 'Préstamo financiero registrado como CxP comercial';
      } else if (cat === 'anticipo') {
        cuentaSugerida = pagado > 0 ? '162 — Anticipos a Proveedores' : '42 o 162 — verificar si hay entrega pendiente';
        motivo = pagado > 0
          ? 'Anticipo ya abonado — el dinero ya salió, debería ser activo en cuenta 162'
          : 'Anticipo sin pago registrado — verificar naturaleza con contador';
      } else {
        cuentaSugerida = 'Revisar con contador';
        motivo = 'Documento no estándar en módulo CxP';
      }
      malClasificados.push({
        categoria: cat,
        cuentaActual: '42',
        cuentaSugerida,
        motivo,
        proveedor: d.Proveedor || d.CodProveedor,
        codProveedor: d.CodProveedor,
        nroD: d.NroD,
        serie: d.Serie || '',
        numero: d.Numero || '',
        tipo: d.DesTipo || d.TipoDoc,
        fechaDocumento: d.FechaDocumento,
        fechaVencimiento: d.FechaVencimiento,
        moneda: d.Moneda,
        total: round(parseFloat(d.Total) || 0),
        pagado: round(pagado),
        saldo: round(parseFloat(d.Saldo) || 0),
      });
    }

    // ── Lo que SÍ está correctamente en cuenta 45 ──
    const otrasCxp = (otrasCxpSnap?.data as any[]) ?? [];
    const en45 = otrasCxp
      .filter((r: any) => r.Clase === '45')
      .map((r: any) => ({
        cuenta: r.CodCuenta,
        desCuenta: r.DesCuenta,
        tercero: r.Tercero,
        codTercero: r.CodTercero,
        saldoTotal: round(parseFloat(r.SaldoTotal) || 0),
      }))
      .filter((r: any) => r.saldoTotal > 0.01);

    // ── Lo que SÍ está correctamente en cuenta 16x (anticipos a proveedores) ──
    const otrasCxc = (otrasCxcSnap?.data as any[]) ?? [];
    const en16 = otrasCxc
      .filter((r: any) => r.Clase === '16')
      .map((r: any) => ({
        cuenta: r.CodCuenta,
        desCuenta: r.DesCuenta,
        tercero: r.Tercero,
        codTercero: r.CodTercero,
        saldoTotal: round(parseFloat(r.SaldoTotal) || 0),
      }))
      .filter((r: any) => Math.abs(r.saldoTotal) > 0.01);

    // ── Resumen por categoría ──
    const resumen42: Record<string, { count: number; saldo: number }> = {};
    for (const d of malClasificados) {
      if (!resumen42[d.categoria]) resumen42[d.categoria] = { count: 0, saldo: 0 };
      resumen42[d.categoria].count++;
      resumen42[d.categoria].saldo = round(resumen42[d.categoria].saldo + d.saldo);
    }

    return {
      malClasificados,
      resumen42,
      total42Revision: round(malClasificados.reduce((s, d) => s + d.saldo, 0)),
      en45,
      total45: round(en45.reduce((s, r) => s + r.saldoTotal, 0)),
      en16,
      total16: round(en16.reduce((s, r) => s + r.saldoTotal, 0)),
    };
  }

  async getAvailableYears(companyId: string) {
    const rows = await this.prisma.kpiSnapshot.findMany({
      where: { companyId, kpiType: 'pl' },
      select: { year: true },
      distinct: ['year'],
      orderBy: { year: 'desc' },
    });
    return { years: rows.map((r) => r.year) };
  }

  async getLastSync(companyId: string, year: number) {
    const snaps = await this.prisma.kpiSnapshot.findMany({
      where: { companyId, year },
      select: { kpiType: true, syncedAt: true },
      orderBy: { syncedAt: 'desc' },
    });
    const lastSync = snaps[0]?.syncedAt ?? null;
    return { lastSync, types: snaps.map((s) => ({ kpiType: s.kpiType, syncedAt: s.syncedAt })) };
  }

  // ─────────────────────────────────────────────
  // Consolidado Grupo — suma todas las empresas activas
  // ─────────────────────────────────────────────

  async getConsolidado(year: number) {
    const companies = await this.prisma.company.findMany({ where: { active: true } });

    const snapshots = await Promise.all(
      companies.map(async (co) => {
        const snap = await this.getSnapshot(co.codEmpresa, 'pl', `${year}`);
        return { company: co, data: snap?.data || null };
      }),
    );

    const zeroYtd = () => ({
      ingresos: 0, otrosIngresos: 0, ingresosFinancieros: 0, costoDirecto: 0, margenBruto: 0,
      gav: 0, ebitda: 0, gastosFinancieros: 0, diferenciaCambio: 0, utilidadNeta: 0,
    });

    const ytdTotal = zeroYtd();
    const empresas: any[] = [];

    // Monthly consolidado (12 meses)
    const monthlyTotal: Record<number, any> = {};
    for (let m = 1; m <= 12; m++) {
      monthlyTotal[m] = { mes: m, mesLabel: MONTHS[m - 1], ingresos: 0, otrosIngresos: 0, ingresosFinancieros: 0, costoDirecto: 0, margenBruto: 0, gav: 0, ebitda: 0, gastosFinancieros: 0, diferenciaCambio: 0, utilidadNeta: 0 };
    }

    for (const { company, data } of snapshots) {
      const d = data as any;
      if (!d?.ytd) continue;
      const y = d.ytd;

      ytdTotal.ingresos += y.ingresos || 0;
      ytdTotal.otrosIngresos += y.otrosIngresos || 0;
      ytdTotal.ingresosFinancieros += y.ingresosFinancieros || 0;
      ytdTotal.costoDirecto += y.costoDirecto || 0;
      ytdTotal.margenBruto += y.margenBruto || 0;
      ytdTotal.gav += y.gav || 0;
      ytdTotal.ebitda += y.ebitda || 0;
      ytdTotal.gastosFinancieros += y.gastosFinancieros || 0;
      ytdTotal.diferenciaCambio += y.diferenciaCambio || 0;
      ytdTotal.utilidadNeta += y.utilidadNeta || 0;

      empresas.push({
        codEmpresa: company.codEmpresa,
        name: company.name,
        shortName: company.name.split(' ')[0],
        ytd: y,
        pctIngresos: 0, // calculado después
      });

      if (d.plMonthly) {
        for (const m of d.plMonthly) {
          monthlyTotal[m.mes].ingresos += m.ingresos || 0;
          monthlyTotal[m.mes].otrosIngresos += m.otrosIngresos || 0;
          monthlyTotal[m.mes].ingresosFinancieros += m.ingresosFinancieros || 0;
          monthlyTotal[m.mes].costoDirecto += m.costoDirecto || 0;
          monthlyTotal[m.mes].margenBruto += m.margenBruto || 0;
          monthlyTotal[m.mes].gav += m.gav || 0;
          monthlyTotal[m.mes].ebitda += m.ebitda || 0;
          monthlyTotal[m.mes].gastosFinancieros += m.gastosFinancieros || 0;
          monthlyTotal[m.mes].diferenciaCambio += m.diferenciaCambio || 0;
          monthlyTotal[m.mes].utilidadNeta += m.utilidadNeta || 0;
        }
      }
    }

    // Porcentaje de ingresos por empresa
    for (const e of empresas) {
      e.pctIngresos = ytdTotal.ingresos > 0
        ? round((e.ytd.ingresos / ytdTotal.ingresos) * 100)
        : 0;
    }

    // Ratios consolidados
    const ytd: any = { ...ytdTotal };
    ytd.margenBrutoPct = ytd.ingresos > 0 ? round((ytd.margenBruto / ytd.ingresos) * 100) : 0;
    ytd.ebitdaPct = ytd.ingresos > 0 ? round((ytd.ebitda / ytd.ingresos) * 100) : 0;
    ytd.margenNetoPct = ytd.ingresos > 0 ? round((ytd.utilidadNeta / ytd.ingresos) * 100) : 0;
    ytd.gavPct = ytd.ingresos > 0 ? round((ytd.gav / ytd.ingresos) * 100) : 0;
    const cargaFinCons = ytd.gastosFinancieros + (ytd.diferenciaCambio < 0 ? -ytd.diferenciaCambio : 0);
    ytd.covIntereses = cargaFinCons > 0 ? round(ytd.ebitda / cargaFinCons) : null;

    const plMonthly = Object.values(monthlyTotal).map((m: any) => ({
      ...m,
      ingresos: round(m.ingresos),
      costoDirecto: round(m.costoDirecto),
      margenBruto: round(m.margenBruto),
      margenBrutoPct: m.ingresos > 0 ? round((m.margenBruto / m.ingresos) * 100) : 0,
      gav: round(m.gav),
      ebitda: round(m.ebitda),
      ebitdaPct: m.ingresos > 0 ? round((m.ebitda / m.ingresos) * 100) : 0,
      gastosFinancieros: round(m.gastosFinancieros),
      diferenciaCambio: round(m.diferenciaCambio),
      utilidadNeta: round(m.utilidadNeta),
    }));

    return { ytd, plMonthly, empresas, year };
  }

  // ─────────────────────────────────────────────
  // Scorecard — KPIs clave de todas las empresas
  // ─────────────────────────────────────────────

  async getScorecard(year: number) {
    const companies = await this.prisma.company.findMany({ where: { active: true } });

    const results = await Promise.all(
      companies.map(async (co) => {
        const [plSnap, cxcSnap, cxpSnap, cajaSnap] = await Promise.all([
          this.getSnapshot(co.codEmpresa, 'pl', `${year}`),
          this.getSnapshot(co.codEmpresa, 'cxc', 'current'),
          this.getSnapshot(co.codEmpresa, 'cxp', 'current'),
          this.getSnapshot(co.codEmpresa, 'caja', `${year}`),
        ]);

        const pl      = plSnap?.data    as any;
        const cxcData = cxcSnap?.data   as any;
        const cxpData = cxpSnap?.data   as any;
        const cajaData= cajaSnap?.data  as any;

        const ytd      = pl?.ytd ?? null;
        const cxcSaldo = cxcData?.totalSaldo  ?? null;
        const cxpSaldo = cxpData?.totalSaldo  ?? null;

        const dso = (cxcSaldo !== null && ytd?.ingresos > 0)
          ? Math.round((cxcSaldo / ytd.ingresos) * 365) : null;
        const dpo = (cxpSaldo !== null && ytd?.costoDirecto && Math.abs(ytd.costoDirecto) > 0)
          ? Math.round((cxpSaldo / Math.abs(ytd.costoDirecto)) * 365) : null;
        const workingCapital = (cxcSaldo !== null && cxpSaldo !== null)
          ? round(cxcSaldo - cxpSaldo) : null;
        const cashCycle = (dso !== null && dpo !== null) ? dso - dpo : null;

        const cajaTotal = cajaData?.totalPorMes
          ? round(Object.values(cajaData.totalPorMes as Record<string, number>).reduce((s, v) => s + (v as number), 0))
          : null;

        return {
          codEmpresa: co.codEmpresa,
          name: co.name,
          ytd,
          cxcSaldo,
          cxpSaldo,
          dso,
          dpo,
          workingCapital,
          cashCycle,
          cajaTotal,
        };
      }),
    );

    return { year, companies: results };
  }

  // ─────────────────────────────────────────────
  // Dashboard Gerencial — KPIs ejecutivos integrados
  // ─────────────────────────────────────────────

  async getGerencial(companyId: string, year: number) {
    const prevYear = year - 1;

    const [
      dashSnap, prevDashSnap,
      cxcSnap, cxpSnap,
      tesoSnap, balSnap, patriSnap,
      cajaSnap,
      facturasEmitSnap, facturasRecibSnap, honorariosSnap,
    ] = await Promise.all([
      this.getSnapshot(companyId, 'pl', `${year}`),
      this.getSnapshot(companyId, 'pl', `${prevYear}`),
      this.getSnapshot(companyId, 'cxc', 'current'),
      this.getSnapshot(companyId, 'cxp', 'current'),
      this.getSnapshot(companyId, 'tesoreria', `${year}`),
      this.getSnapshot(companyId, 'balance', `${year}`),
      this.getSnapshot(companyId, 'patrimonio', 'current'),
      this.getSnapshot(companyId, 'caja_asiento_full', `${year}`),
      this.getSnapshot(companyId, 'facturas_emitidas', `${year}`),
      this.getSnapshot(companyId, 'facturas_recibidas', `${year}`),
      this.getSnapshot(companyId, 'honorarios_recibidos', `${year}`),
    ]);

    // ── helpers ──────────────────────────────────────────────
    const sumF = (arr: any, f: string) =>
      (Array.isArray(arr) ? arr : []).reduce((s: number, r: any) => s + (Number(r[f]) || 0), 0);
    const pct = (n: number, d: number) => (d !== 0 ? Math.round((n / d) * 1000) / 10 : null);
    const round2 = (v: number) => Math.round(v * 100) / 100;

    // ── P&L actual ───────────────────────────────────────────
    // pl snapshot data = { plMonthly: [...], ytd: {...}, detalle: {...} }
    const plData: any = (dashSnap?.data && typeof dashSnap.data === 'object' && !Array.isArray(dashSnap.data))
      ? dashSnap.data : {};
    const plMonthly: any[] = Array.isArray(plData.plMonthly) ? plData.plMonthly : [];
    const ytdRow   = plData.ytd ?? {};
    const ingresos       = Number(ytdRow.ingresos ?? 0);
    const costoDirecto   = Number(ytdRow.costoDirecto ?? 0);
    const margenBruto    = Number(ytdRow.margenBruto ?? 0);
    const gav            = Number(ytdRow.gav ?? 0);
    const ebitda         = Number(ytdRow.ebitda ?? 0);
    const gastosFinanc   = Number(ytdRow.gastosFinancieros ?? 0);
    const utilidadNeta   = Number(ytdRow.utilidadNeta ?? 0);

    // ── P&L año anterior ─────────────────────────────────────
    const plPrevData: any = (prevDashSnap?.data && typeof prevDashSnap.data === 'object' && !Array.isArray(prevDashSnap.data))
      ? prevDashSnap.data : {};
    const prevYTD = plPrevData.ytd ?? {};
    const prevIngresos     = Number(prevYTD.ingresos ?? 0);
    const prevUtilidad     = Number(prevYTD.utilidadNeta ?? 0);
    const yoyIngresosGrowth = prevIngresos > 0 ? round2((ingresos - prevIngresos) / prevIngresos * 100) : null;
    const yoyUtilidadGrowth = prevUtilidad !== 0 ? round2((utilidadNeta - prevUtilidad) / Math.abs(prevUtilidad) * 100) : null;

    // ── Trend mensual (últimos meses con datos) ───────────────
    const currentMonth = new Date().getFullYear() === year ? new Date().getMonth() + 1 : 12;
    const trend = plMonthly
      .filter((r: any) => Number(r.mes) <= currentMonth && Number(r.ingresos) !== 0)
      .map((r: any) => ({
        mes: Number(r.mes),
        ingresos:     Number(r.ingresos    ?? 0),
        margenBruto:  Number(r.margenBruto ?? 0),
        ebitda:       Number(r.ebitda      ?? 0),
        utilidadNeta: Number(r.utilidadNeta ?? 0),
        margenBrutoPct: Number(r.margenBrutoPct ?? 0),
        ebitdaPct:      Number(r.ebitdaPct      ?? 0),
      }));

    // ── CxC ──────────────────────────────────────────────────
    // cxcSnap.data is the buildCxC() processed object, not a flat array
    const cxcObj: any    = (cxcSnap?.data && typeof cxcSnap.data === 'object' && !Array.isArray(cxcSnap.data))
      ? cxcSnap.data : {};
    const cxcClientes: any[] = Array.isArray(cxcObj.clientes) ? cxcObj.clientes : [];
    const totalCxC       = Number(cxcObj.totalSaldo ?? 0);
    const cxcVig         = Number(cxcObj.totalVigente ?? 0);
    const cxcD30         = cxcClientes.reduce((s: number, r: any) => s + (Number(r.dias0_30)  || 0), 0);
    const cxcD60         = cxcClientes.reduce((s: number, r: any) => s + (Number(r.dias31_60) || 0), 0);
    const cxcD90         = cxcClientes.reduce((s: number, r: any) => s + (Number(r.dias61_90) || 0), 0);
    const cxcD90mas      = Number(cxcObj.total90mas ?? 0);
    const pctVencidoCxC  = totalCxC > 0 ? round2((cxcD90mas / totalCxC) * 100) : null;
    // DSO = (CxC / ingresos YTD) * días transcurridos en el año
    const diasAnio       = currentMonth === 12 ? 365 : currentMonth * 30;
    const ingresosAnnual = diasAnio < 365 && ingresos > 0 ? ingresos / diasAnio * 365 : ingresos;
    const dso            = ingresosAnnual > 0 ? round2(totalCxC / ingresosAnnual * 365) : null;
    // Concentración top 3 clientes
    const sortedCxC = [...cxcClientes].sort((a, b) => (b.saldoTotalSoles ?? 0) - (a.saldoTotalSoles ?? 0));
    const top3CxC   = sortedCxC.slice(0, 3).reduce((s: number, r: any) => s + (Number(r.saldoTotalSoles) || 0), 0);
    const concTop3CxC = totalCxC > 0 ? round2((top3CxC / totalCxC) * 100) : null;

    // ── CxP ──────────────────────────────────────────────────
    // cxpSnap.data is raw SQL rows with underscore field names (Dias_0_30, etc.)
    const cxpRows: any[] = Array.isArray(cxpSnap?.data) ? (cxpSnap!.data as any[]) : [];
    const totalCxP       = sumF(cxpRows, 'SaldoTotal');
    const cxpVig         = sumF(cxpRows, 'SaldoVigente');
    const cxpD30         = sumF(cxpRows, 'Dias_0_30');
    const cxpD60         = sumF(cxpRows, 'Dias_31_60');
    const cxpD90         = sumF(cxpRows, 'Dias_61_90');
    const cxpD90mas      = sumF(cxpRows, 'Dias_90_mas');
    // true once the new QUERY_CXP (with aging columns) has been synced
    const cxpAgingAvailable = totalCxP > 0 && (cxpVig + cxpD30 + cxpD60 + cxpD90 + cxpD90mas) > 0;
    const pctVencidoCxP  = cxpAgingAvailable && totalCxP > 0 ? round2(((cxpD90 + cxpD90mas) / totalCxP) * 100) : null;
    const costoAnual     = diasAnio < 365 && costoDirecto > 0 ? costoDirecto / diasAnio * 365 : costoDirecto;
    const dpo            = costoAnual > 0 ? round2(totalCxP / costoAnual * 365) : null;
    const sortedCxP = [...cxpRows].sort((a, b) => (b.SaldoTotal ?? 0) - (a.SaldoTotal ?? 0));
    const top3CxP   = sumF(sortedCxP.slice(0, 3), 'SaldoTotal');
    const concTop3CxP = totalCxP > 0 ? round2((top3CxP / totalCxP) * 100) : null;

    // Cash Conversion Cycle = DSO − DPO (positivo = financiamos a clientes)
    const ccc = dso != null && dpo != null ? round2(dso - dpo) : null;

    // ── Tesorería (saldo de caja) ─────────────────────────────
    const tesoRows: any[] = (tesoSnap?.data as any[]) ?? [];
    // Exclude clearing/transit accounts — they double-count internal transfers
    const TRANSIT_RE = /transito|transferencia/i;
    const realTesoRows = tesoRows.filter((r: any) => !TRANSIT_RE.test(r.DesBanco ?? ''));
    const saldoCaja      = sumF(realTesoRows, 'SaldoFinal');
    const salidasAnio    = sumF(realTesoRows, 'SalidasAnio');
    // Divide by months elapsed in year (not 12) to get actual monthly burn rate
    const mesesTranscurridos = currentMonth;
    const cashBurnMensual = salidasAnio > 0 ? round2(salidasAnio / mesesTranscurridos) : 0;
    const cashRunway     = cashBurnMensual > 0 ? round2(saldoCaja / cashBurnMensual) : null;

    // ── Balance — ratios de liquidez ─────────────────────────
    const balRows: any[] = (balSnap?.data as any[]) ?? [];
    // balance snapshot stores TotalDebe/TotalHaber; compute net balance
    const balSaldo = (r: any): number =>
      r.SaldoFinal !== undefined
        ? (Number(r.SaldoFinal) || 0)
        : (Number(r.TotalDebe) || 0) - (Number(r.TotalHaber) || 0);
    const balSum = (clases: string[]) =>
      balRows.filter((r: any) => clases.includes(String(r.Clase)))
             .reduce((s: number, r: any) => s + balSaldo(r), 0);
    const activoCorr   = balSum(['10','12','20']);   // caja + cxc + inventario
    const pasivoCorr   = Math.abs(balSum(['40','42'])); // tributos + cxp (saldo acreedor)
    const currentRatio = pasivoCorr > 0 ? round2(activoCorr / pasivoCorr) : null;
    const quickRatio   = pasivoCorr > 0 ? round2((activoCorr - Math.abs(balSum(['20']))) / pasivoCorr) : null;
    const cashRatioV   = pasivoCorr > 0 ? round2(Math.abs(balSum(['10'])) / pasivoCorr) : null;
    const totalActivos = balRows
      .filter((r: any) => { const c = Number(r.Clase); return c >= 10 && c <= 39; })
      .reduce((s: number, r: any) => s + balSaldo(r), 0);

    // ── Patrimonio ───────────────────────────────────────────
    const patriRows: any[] = (patriSnap?.data as any[]) ?? [];
    const totalPatrimonio = Math.abs(sumF(patriRows, 'SaldoNeto'));
    const roe = totalPatrimonio > 0 ? round2(utilidadNeta / totalPatrimonio * 100) : null;
    const roa = totalActivos > 0 ? round2(utilidadNeta / totalActivos * 100) : null;
    const deudaPatrimonio = totalPatrimonio > 0 ? round2((pasivoCorr) / totalPatrimonio) : null;

    // ── Semáforo (thresholds orientativos para servicios/construcción) ──
    const semaforo = [
      { id: 'margenBruto',  label: 'Margen Bruto',      value: pct(margenBruto, ingresos),  unit: '%',   bench: '>25%',  r: [0,15],   y: [15,25]  },
      { id: 'ebitda',       label: 'EBITDA',             value: pct(ebitda, ingresos),       unit: '%',   bench: '>10%',  r: [null,5], y: [5,10]   },
      { id: 'margenNeto',   label: 'Margen Neto',        value: pct(utilidadNeta, ingresos), unit: '%',   bench: '>5%',   r: [null,2], y: [2,5]    },
      { id: 'dso',          label: 'DSO (días cobro)',   value: dso,                         unit: 'días',bench: '<45d',  r: [60,null],y: [45,60]  },
      { id: 'dpo',          label: 'DPO (días pago)',    value: dpo,                         unit: 'días',bench: '>30d',  r: [null,15],y: [15,30]  },
      { id: 'currentRatio', label: 'Ratio Corriente',    value: currentRatio,                unit: 'x',   bench: '>1.2', r: [null,1], y: [1,1.2]  },
      { id: 'cashRunway',   label: 'Runway de Caja',     value: cashRunway,                  unit: 'mes', bench: '>3m',  r: [null,1], y: [1,3]    },
      { id: 'vencidoCxC',   label: 'CxC Vencida >90d',  value: pctVencidoCxC,               unit: '%',   bench: '<10%', r: [20,null],y: [10,20]  },
    ].map(s => {
      const v = s.value;
      let status: 'green' | 'yellow' | 'red' | 'gray' = 'gray';
      if (v != null) {
        const isHighBad = ['dso', 'vencidoCxC'].includes(s.id);
        const isLowBad  = !isHighBad;
        if (isHighBad) {
          status = s.r[0] != null && v >= s.r[0] ? 'red' : s.y[1] != null && v >= s.y[0] ? 'yellow' : 'green';
        } else {
          status = s.r[1] != null && v < s.r[1] ? 'red' : s.y[0] != null && v < s.y[1] ? 'yellow' : 'green';
        }
        if (s.id === 'dpo') {
          status = v < s.r[1] ? 'red' : v < s.y[1] ? 'yellow' : 'green';
        }
      }
      return { id: s.id, label: s.label, value: v, unit: s.unit, benchmark: s.bench, status };
    });

    // ── Alertas ejecutivas ────────────────────────────────────
    const alertas: { tipo: 'danger' | 'warning' | 'info'; mensaje: string; valor: string }[] = [];
    const fmtM = (n: number) => `S/ ${(n / 1000).toFixed(0)}k`;
    if (pctVencidoCxC != null && pctVencidoCxC > 15)
      alertas.push({ tipo: 'danger',  mensaje: 'CxC vencida >90 días excede umbral crítico', valor: `${pctVencidoCxC}% de la cartera` });
    if (pctVencidoCxP != null && pctVencidoCxP > 20)
      alertas.push({ tipo: 'danger',  mensaje: 'CxP vencida >90 días — riesgo de proveedores', valor: `${pctVencidoCxP}% de deuda vencida` });
    if (cashRunway != null && cashRunway < 2)
      alertas.push({ tipo: 'danger',  mensaje: 'Caja crítica — menos de 2 meses de runway', valor: `${cashRunway.toFixed(1)} meses` });
    if (ebitda < 0)
      alertas.push({ tipo: 'danger',  mensaje: 'EBITDA negativo — pérdida operativa', valor: fmtM(ebitda) });
    if (currentRatio != null && currentRatio < 1)
      alertas.push({ tipo: 'danger',  mensaje: 'Ratio corriente < 1 — pasivo supera activo corriente', valor: `${currentRatio}x` });
    if (concTop3CxC != null && concTop3CxC > 60)
      alertas.push({ tipo: 'warning', mensaje: 'Alta concentración de cartera — top 3 clientes', valor: `${concTop3CxC}% del total CxC` });
    if (ccc != null && ccc > 60)
      alertas.push({ tipo: 'warning', mensaje: 'Ciclo de conversión alto — financiando a clientes', valor: `${ccc} días` });
    if (yoyIngresosGrowth != null && yoyIngresosGrowth < -10)
      alertas.push({ tipo: 'warning', mensaje: 'Caída de ingresos vs año anterior', valor: `${yoyIngresosGrowth}% YoY` });
    if (gastosFinanc > 0 && ebitda > 0 && ebitda / gastosFinanc < 1.5)
      alertas.push({ tipo: 'warning', mensaje: 'Cobertura de intereses ajustada', valor: `${round2(ebitda / gastosFinanc)}x (mín 1.5x recomendado)` });
    if (cashRunway != null && cashRunway >= 2 && cashRunway < 3)
      alertas.push({ tipo: 'warning', mensaje: 'Caja con menos de 3 meses de runway', valor: `${cashRunway.toFixed(1)} meses` });

    // ── Insights no obvios ────────────────────────────────────
    const insights: { titulo: string; descripcion: string; tipo: 'opportunity' | 'risk' | 'info' }[] = [];
    if (ccc != null) {
      if (ccc < 0) insights.push({ tipo: 'opportunity', titulo: 'Proveedores financian tu operación', descripcion: `El ciclo de conversión es ${Math.abs(ccc)} días negativo — cobras antes de pagar, lo que libera capital de trabajo sin costo financiero.` });
      else if (ccc > 30) insights.push({ tipo: 'risk', titulo: 'Capital atrapado en el ciclo operativo', descripcion: `${ccc} días de capital financiando a clientes antes de recuperar. Reducir DSO o ampliar DPO liberaría liquidez.` });
    }
    if (gastosFinanc > 0 && ingresos > 0) {
      const gastFinPct = pct(gastosFinanc, ingresos);
      if (gastFinPct != null && gastFinPct > 5) insights.push({ tipo: 'risk', titulo: 'Carga financiera elevada', descripcion: `Los gastos financieros representan ${gastFinPct}% de los ingresos. Refinanciar deuda o reducir apalancamiento mejoraría el margen neto.` });
    }
    if (dso != null && dpo != null && dso > dpo * 1.5) insights.push({ tipo: 'risk', titulo: 'Asimetría cobro-pago', descripcion: `Cobras en promedio ${dso} días pero pagas en ${dpo} días. Negociar plazos de cobro más cortos o plazos de pago más largos reduciría el requerimiento de capital.` });
    if (concTop3CxC != null && concTop3CxC < 30 && totalCxC > 0) insights.push({ tipo: 'opportunity', titulo: 'Cartera diversificada', descripcion: `Los top 3 clientes representan solo ${concTop3CxC}% de la cartera — bajo riesgo de concentración, base de clientes saludable.` });
    if (roe != null && roe > 20) insights.push({ tipo: 'opportunity', titulo: 'ROE superior al mercado', descripcion: `El retorno sobre patrimonio es ${roe}%, por encima del costo de capital típico. El negocio genera valor para los socios.` });
    if (yoyIngresosGrowth != null && yoyIngresosGrowth > 15) insights.push({ tipo: 'opportunity', titulo: 'Crecimiento acelerado de ingresos', descripcion: `Ingresos creciendo ${yoyIngresosGrowth}% vs el año anterior. Revisar si la estructura de costos acompaña el crecimiento.` });
    const gavPctV = pct(gav, ingresos);
    if (gavPctV != null && gavPctV < 15 && ingresos > 0) insights.push({ tipo: 'opportunity', titulo: 'Estructura de costos fijos eficiente', descripcion: `GAV representa solo ${gavPctV}% de ingresos — buena palanca operativa para crecer sin proporcional aumento de costos fijos.` });

    const syncedAt = dashSnap?.syncedAt ?? cxcSnap?.syncedAt ?? tesoSnap?.syncedAt ?? null;

    return {
      year, syncedAt,
      semaforo,
      rentabilidad: {
        ingresos, costoDirecto, margenBruto, gav, ebitda, gastosFinanc, utilidadNeta,
        margenBrutoPct: pct(margenBruto, ingresos),
        ebitdaPct:      pct(ebitda, ingresos),
        margenNetoPct:  pct(utilidadNeta, ingresos),
        gavPct:         pct(gav, ingresos),
        yoyIngresosGrowth, yoyUtilidadGrowth,
        prevIngresos, prevUtilidad,
        cobIntereses:   gastosFinanc > 0 ? round2(ebitda / gastosFinanc) : null,
        trend,
      },
      liquidez: {
        currentRatio, quickRatio, cashRatio: cashRatioV,
        workingCapital: round2(totalCxC - totalCxP),
        saldoCaja, cashBurnMensual, cashRunway,
        totalActivos, totalPatrimonio,
        roe, roa, deudaPatrimonio,
      },
      cobros: {
        totalCxC, dso,
        vigente: cxcVig, dias30: cxcD30, dias60: cxcD60, dias90: cxcD90, dias90mas: cxcD90mas,
        pctVencido: pctVencidoCxC, concTop3: concTop3CxC,
        numClientes: cxcObj.numClientes ?? cxcClientes.length,
        topClientes: (() => {
          const rows: any[] = facturasEmitSnap?.data ?? [];
          const map = new Map<string, { nombre: string; saldo: number }>();
          for (const f of rows) {
            const key = ((f.RucCliente as string) || (f.Cliente as string) || '').trim();
            if (!map.has(key)) map.set(key, { nombre: f.Cliente ?? '—', saldo: 0 });
            map.get(key)!.saldo += f.EsNotaCredito ? -Number(f.Total || 0) : Number(f.Total || 0);
          }
          return [...map.values()].filter(c => c.saldo > 0).sort((a, b) => b.saldo - a.saldo).slice(0, 5);
        })(),
      },
      pagos: {
        totalCxP, dpo,
        vigente: cxpVig, dias30: cxpD30, dias60: cxpD60, dias90: cxpD90, dias90mas: cxpD90mas,
        pctVencido: pctVencidoCxP, concTop3: concTop3CxP, agingAvailable: cxpAgingAvailable,
        numProveedores: cxpRows.length,
        topProveedores: (() => {
          const rows: any[] = [...(facturasRecibSnap?.data ?? []), ...(honorariosSnap?.data ?? [])];
          const map = new Map<string, { nombre: string; saldo: number }>();
          for (const f of rows) {
            const key = ((f.RucProveedor as string) || (f.Proveedor as string) || '').trim();
            if (!map.has(key)) map.set(key, { nombre: f.Proveedor ?? '—', saldo: 0 });
            map.get(key)!.saldo += f.EsNotaCredito ? -Number(f.Total || 0) : Number(f.Total || 0);
          }
          return [...map.values()].filter(p => p.saldo > 0).sort((a, b) => b.saldo - a.saldo).slice(0, 5);
        })(),
      },
      eficiencia: { ccc, dso, dpo },
      alertas, insights,
    };
  }

  // ─────────────────────────────────────────────
  // Validación Forense — 25 validaciones por empresa
  // ─────────────────────────────────────────────

  async getValidacionForense(companyId: string, year: number) {
    const period = `${year}`;
    const snap = await this.getSnapshot(companyId, 'validation_forense', period);
    if (!snap) {
      return { syncedAt: null, year, data: null, message: 'No hay datos de validación forense. Ejecute el sync primero.' };
    }

    const raw = snap.data as Record<string, any>;

    const LABELS: Record<string, string> = {
      V01_partida_doble: 'V01 — Partida doble (Σ Débito = Σ Crédito)',
      V02_apertura: 'V02 — Asientos de apertura por año',
      V03_patrimonio: 'V03 — Saldos patrimonio (clases 50-59)',
      V04_facturas_sin_asiento_top: 'V04 — Facturas emitidas sin asiento (top 50, año actual y anterior, excluye NC/ND)',
      V04b_facturas_sin_asiento_resumen: 'V04b — Facturas sin asiento resumen histórico por año/tipo (excluye NC/ND, monto en PEN)',
      V05_ingresos_sin_doc: 'V05 — Ingresos contables sin NroD',
      V06_sueldos_aging: 'V06 — Sueldos por pagar (cta 4111) — aging',
      V07_cts_depositos: 'V07 — CTS depósitos (cta 4151) — may/nov',
      V08_participaciones: 'V08 — Participaciones DL 892 (cta 413x)',
      V09_bancos_detalle: 'V09 — Saldos bancarios contables (clase 10) multi-año',
      V10_ob_cuentas_banco: 'V10 — Cuentas bancarias módulo OB',
      V11_bancarizacion: 'V11 — Bancarización Ley 28194 / DL 1529 (umbral S/2,000 / US$500)',
      V12_pergola_aging: 'V12 — CxC cliente PERGOLA (aging)',
      V13_cxc_concentracion: 'V13 — Concentración CxC top 20 clientes (aging por FechaVencimiento)',
      V14_intercompany: 'V14 — Intercompañía (clases 14/16/17 activo + 42 pasivo grupo)',
      V15_activo_fijo: 'V15 — Activo fijo coherencia (33/39/68)',
      V16_trazabilidad_pago: 'V16 — Trazabilidad OB_Pago ↔ DetalleAsignación',
      V17_reconciliacion_ingr: 'V17 — Reconciliación ingresos contables vs facturas (tolerancia S/500)',
      V18_tributos: 'V18 — Tributos por pagar (clase 40)',
      V19_balance_resumen: 'V19 — Balance resumen por clase (NumAsientos y montos filtrados al año seleccionado)',
      V20_fechas_anomalas: 'V20 — Asientos con fechas anómalas (excluye cierres de fin de mes)',
      V21_identificadores_dup: 'V21 — Identificadores con 3+ nombres distintos (excluye cambios de razón social)',
      V22_conciliacion_estado: 'V22 — Estado de conciliación bancaria OB',
      V23_pl_anual: 'V23 — P&L anual (ingresos, gastos, utilidad)',
      V24_ob_vs_contable: 'V24 — Coherencia OB_Pago vs Contable clase 10 (umbral S/1,000 y >5%)',
      V25_pcd_criticas: 'V25 — Cuentas críticas en PlanContableDetalle',
      V26_asientos_sin_glosa: 'V26 — Asientos sin descripción (glosa vacía o genérica)',
      V27_cxp_concentracion: 'V27 — Concentración CxP comercial top 15 (excluye préstamos/anticipos)',
      V28_nc_sospechosas: 'V28 — Notas de crédito sospechosas por año (>3% de facturación)',
      V28b_nc_detalle: 'V28b — Detalle NC sospechosas (top 50 por monto)',
      V29_fraccionamiento_pagos: 'V29 — Fraccionamiento de pagos (evasión DL 1529, rango 500–1,999)',
      V30_provisiones_sin_reverso: 'V30 — Provisiones diciembre sin reverso en Q1 siguiente (ene-mar)',
    };

    const summary = Object.entries(LABELS).map(([id, label]) => {
      const v = raw[id];
      return {
        id,
        label,
        ok: v?.ok ?? false,
        rowCount: v?.rows?.length ?? 0,
        error: v?.error ?? null,
      };
    });

    const okCount = summary.filter((s) => s.ok).length;
    const errorCount = summary.filter((s) => !s.ok).length;

    return {
      syncedAt: snap.syncedAt,
      year,
      summary: { total: summary.length, ok: okCount, errors: errorCount },
      validations: summary,
      raw,
    };
  }

  async getValidacionForenseConsolidado(year: number) {
    const companies = await this.prisma.company.findMany({ where: { active: true } });
    const results = await Promise.all(
      companies.map((co) => this.getValidacionForense(co.codEmpresa, year).then((r) => ({ ...r, companyId: co.codEmpresa, companyName: co.name }))),
    );
    return { year, companies: results };
  }

  // ─────────────────────────────────────────────
  // Directorio — datos manuales (Ppto, HH, Backlog, Pipeline, Flags, Must Win)
  // ─────────────────────────────────────────────

  private directorioDefault() {
    return {
      presupuesto: {
        q:   { ingresos: 0, costoDirecto: 0, gav: 0, da: 0 },
        ytd: { ingresos: 0, costoDirecto: 0, gav: 0, da: 0 },
      },
      productividad: {
        hhDisponibles: 0,
        hhFacturadas: 0,
        hhDisponiblesPpto: 0,
        nPersonas: 0,
      },
      ventasFuente: {
        referidos: 0,
        licitacionesPublicas: 0,
        licitacionesPrivadas: 0,
        iniciativaDirecta: 0,
      },
      backlog: [] as any[],     // [{ cliente, proyecto, contrato, inicio, termino, avance, ingresoQ, estado }]
      pipeline: [] as any[],    // [{ cliente, proyecto, monto, qCierre, prob }]
      greenFlags: [] as any[],  // [{ titulo, descripcion }]
      redFlags: [] as any[],    // [{ criticidad, titulo, descripcion, accion }]
      mustWin: [] as any[],     // [{ codigo, criticidad, titulo, descripcion, responsable, plazo }]
      acuerdos: [] as string[],
      comentarios: {
        resumenEjecutivo: '',
        ebitda: '',
      },
    };
  }

  async getDirectorio(companyId: string, year: number, quarter: string) {
    const row = await this.prisma.directorioData.findUnique({
      where: { companyId_year_quarter: { companyId, year, quarter } },
    });
    if (!row) {
      return { companyId, year, quarter, data: this.directorioDefault(), updatedAt: null, updatedBy: null };
    }
    return {
      companyId: row.companyId, year: row.year, quarter: row.quarter,
      data: { ...this.directorioDefault(), ...(row.data as object) },
      updatedAt: row.updatedAt, updatedBy: row.updatedBy,
    };
  }

  async saveDirectorio(companyId: string, year: number, quarter: string, data: any, updatedBy: string | null) {
    if (!['Q1','Q2','Q3','Q4'].includes(quarter)) throw new Error('Invalid quarter');
    const row = await this.prisma.directorioData.upsert({
      where: { companyId_year_quarter: { companyId, year, quarter } },
      create: { companyId, year, quarter, data, updatedBy },
      update: { data, updatedBy },
    });
    return { companyId: row.companyId, year: row.year, quarter: row.quarter, data: row.data, updatedAt: row.updatedAt, updatedBy: row.updatedBy };
  }
}

function round(n: number, decimals = 2): number {
  return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
}
