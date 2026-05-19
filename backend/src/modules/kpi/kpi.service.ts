import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S10Service } from '../s10/s10.service';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

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
        const zero = { ingresos: 0, costoDirecto: 0, margenBruto: 0, gav: 0, ebitda: 0, gastosFinancieros: 0, utilidadNeta: 0 };
        const py = prevMonths.reduce((acc: any, m: any) => ({
          ingresos: acc.ingresos + m.ingresos,
          costoDirecto: acc.costoDirecto + m.costoDirecto,
          margenBruto: acc.margenBruto + m.margenBruto,
          gav: acc.gav + m.gav,
          ebitda: acc.ebitda + m.ebitda,
          gastosFinancieros: acc.gastosFinancieros + m.gastosFinancieros,
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
    // Clase 79 (Cargas imputables) es el contra-asiento de clase 9x:
    // suma clase91+94+97 en créditos. Restarla solo de clase91 daría
    // costoDirecto = -(GAV+GastosFinancieros), lo cual es incorrecto.
    // Se ignora clase79 y se usa clase91 bruto como costo directo.
    const monthly: Record<number, {
      ingresos: number;
      costo: number;
      gav: number;
      gastosFinancieros: number;
    }> = {};

    for (let m = 1; m <= 12; m++) {
      monthly[m] = { ingresos: 0, costo: 0, gav: 0, gastosFinancieros: 0 };
    }

    const detalleMap: Record<string, Record<string, any>> = {
      ingresos: {},
      costoDirecto: {},
      gav: {},
      gastosFinancieros: {},
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
        monthly[mes].ingresos += credito - debito;
        grupo = 'ingresos'; valor = credito - debito;
      } else if (clase === '91') {
        monthly[mes].costo += debito - credito;
        grupo = 'costoDirecto'; valor = debito - credito;
      } else if (clase === '79') {
        // ignorar — es el contra-asiento de clase 9x, no un costo real
      } else if (clase === '94') {
        monthly[mes].gav += debito - credito;
        grupo = 'gav'; valor = debito - credito;
      } else if (clase === '97') {
        monthly[mes].gastosFinancieros += debito - credito;
        grupo = 'gastosFinancieros'; valor = debito - credito;
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
      const utilidadNeta = ebitda - v.gastosFinancieros;

      return {
        mes,
        mesLabel: MONTHS[mes - 1],
        ingresos: round(v.ingresos),
        costoDirecto: round(costoNeto),
        margenBruto: round(margenBruto),
        margenBrutoPct: v.ingresos > 0 ? round((margenBruto / v.ingresos) * 100) : 0,
        gav: round(v.gav),
        ebitda: round(ebitda),
        ebitdaPct: v.ingresos > 0 ? round((ebitda / v.ingresos) * 100) : 0,
        gastosFinancieros: round(v.gastosFinancieros),
        utilidadNeta: round(utilidadNeta),
        utilidadNetaPct: v.ingresos > 0 ? round((utilidadNeta / v.ingresos) * 100) : 0,
      };
    });

    const ytd = plMonthly.reduce(
      (acc, m) => ({
        ingresos: acc.ingresos + m.ingresos,
        costoDirecto: acc.costoDirecto + m.costoDirecto,
        margenBruto: acc.margenBruto + m.margenBruto,
        gav: acc.gav + m.gav,
        ebitda: acc.ebitda + m.ebitda,
        gastosFinancieros: acc.gastosFinancieros + m.gastosFinancieros,
        utilidadNeta: acc.utilidadNeta + m.utilidadNeta,
      }),
      { ingresos: 0, costoDirecto: 0, margenBruto: 0, gav: 0, ebitda: 0, gastosFinancieros: 0, utilidadNeta: 0 },
    );

    ytd['margenBrutoPct'] = ytd.ingresos > 0 ? round((ytd.margenBruto / ytd.ingresos) * 100) : 0;
    ytd['ebitdaPct'] = ytd.ingresos > 0 ? round((ytd.ebitda / ytd.ingresos) * 100) : 0;
    ytd['margenNetoPct'] = ytd.ingresos > 0 ? round((ytd.utilidadNeta / ytd.ingresos) * 100) : 0;
    ytd['utilidadNetaPct'] = ytd['margenNetoPct']; // alias para compatibilidad con PL_ROWS del frontend
    ytd['gavPct'] = ytd.ingresos > 0 ? round((ytd.gav / ytd.ingresos) * 100) : 0;
    ytd['costoPct'] = ytd.ingresos > 0 ? round((ytd.costoDirecto / ytd.ingresos) * 100) : 0;
    ytd['covIntereses'] = ytd.gastosFinancieros > 0 ? round(ytd.ebitda / ytd.gastosFinancieros) : null;

    const detalle = {
      ingresos: Object.values(detalleMap.ingresos).sort((a: any, b: any) => b.ytd - a.ytd),
      costoDirecto: Object.values(detalleMap.costoDirecto).sort((a: any, b: any) => b.ytd - a.ytd),
      gav: Object.values(detalleMap.gav).sort((a: any, b: any) => b.ytd - a.ytd),
      gastosFinancieros: Object.values(detalleMap.gastosFinancieros).sort((a: any, b: any) => b.ytd - a.ytd),
    };

    return { plMonthly, ytd, detalle };
  }

  // ─────────────────────────────────────────────
  // CxC — con métricas de concentración
  // ─────────────────────────────────────────────

  async getCxC(companyId: string) {
    const period = 'current';
    const cached = await this.getSnapshot(companyId, 'cxc', period);
    if (cached) return cached.data;

    if (this.s10.isDirectMode) {
      const company = await this.resolveCompany(companyId);
      const rows = await this.s10.getCxC(companyId);
      const data = this.buildCxC(rows);
      await this.saveSnapshot(companyId, company.name, 'cxc', period, new Date().getFullYear(), null, data);
      return data;
    }

    return { message: 'No data available. Run sync first.' };
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

  async getCxCDocs(companyId: string, codCliente?: string) {
    const cached = await this.getSnapshot(companyId, 'cxc_docs', 'current');
    if (!cached) return { docs: [], message: 'No data available. Run sync first.' };

    let docs = cached.data as any[];
    if (codCliente) {
      docs = docs.filter((d: any) => String(d.CodCliente) === String(codCliente));
    }
    return { docs, syncedAt: cached.syncedAt };
  }

  async getCxPDocs(companyId: string, codProveedor?: string) {
    const cached = await this.getSnapshot(companyId, 'cxp_docs', 'current');
    if (!cached) return { docs: [], message: 'No data available. Run sync first.' };

    let docs = cached.data as any[];
    if (codProveedor) {
      docs = docs.filter((d: any) => String(d.CodProveedor) === String(codProveedor));
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
        bancos[banco] = { banco, codBanco: row.CodBanco, meses: {} };
        for (let m = 1; m <= 12; m++) bancos[banco].meses[m] = 0;
      }
      bancos[banco].meses[row.Mes] = round(parseFloat(row.FlujoNeto) || 0);
    }

    const bancosArr = Object.values(bancos);

    // Total por mes (suma de todos los bancos)
    const totalPorMes: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) {
      totalPorMes[m] = round(bancosArr.reduce((s: number, b: any) => s + (b.meses[m] || 0), 0));
    }

    return {
      bancos: bancosArr,
      totalPorMes,
      syncedAt: new Date().toISOString(),
    };
  }

  // ─────────────────────────────────────────────
  // Caja — Posición Trimestral
  // ─────────────────────────────────────────────

  async getCajaPosicion(companyId: string, year: number, quarter: string) {
    const Q_MONTHS: Record<string, number[]> = {
      Q1: [1,2,3], Q2: [4,5,6], Q3: [7,8,9], Q4: [10,11,12],
    };
    const months = Q_MONTHS[quarter] ?? [1,2,3];
    // Cuentas de tránsito interno — excluir de entradas/salidas reales
    const TRANSIT = new Set(['10300010','10300011','10300012']);

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

    // Saldo inicial del año (balance al 01/01/year) desde tesoreria, excl. tránsito
    const saldoInicialAnio = round(
      tesoreria
        .filter(b => !TRANSIT.has(b.CodBanco))
        .reduce((s, b) => s + (Number(b.SaldoInicial) || 0), 0),
    );

    // Acumular flujos mensuales de caja_txn (excl. tránsito)
    const txnPorMes: Record<number, { entradas: number; salidas: number }> = {};
    for (let m = 1; m <= 12; m++) {
      const txns = cajaTxn.filter(t => Number(t.Mes) === m && !TRANSIT.has(t.CodBanco));
      txnPorMes[m] = {
        entradas: round(txns.reduce((s, t) => s + (Number(t.Debito) || 0), 0)),
        salidas:  round(txns.reduce((s, t) => s + (Number(t.Credito) || 0), 0)),
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

    // Saldo inicial del Q = saldo inicio año + flujos netos de meses previos al Q
    let saldoInicialQ = saldoInicialAnio;
    for (let m = 1; m < months[0]; m++) {
      const d = txnPorMes[m];
      saldoInicialQ += (d?.entradas || 0) - (d?.salidas || 0);
    }
    saldoInicialQ = round(saldoInicialQ);

    // Datos mes a mes del Q
    let saldoAcum = saldoInicialQ;
    const meses = months.map(m => {
      const ent  = txnPorMes[m]?.entradas ?? 0;
      const sal  = txnPorMes[m]?.salidas  ?? 0;
      const remu = remuPorMes[m] ?? 0;
      const sun  = sunatPorMes[m] ?? 0;
      const prov = round(Math.max(0, sal - remu - sun));
      const saldoInicial = saldoAcum;
      saldoAcum = round(saldoAcum + ent - sal);
      return { mes: m, saldoInicial, entradas: ent, salidas: sal, remuneraciones: remu, sunat: sun, proveedores: prov, saldoFinal: saldoAcum };
    });

    const totalEntradas     = round(meses.reduce((s, m) => s + m.entradas, 0));
    const totalSalidas      = round(meses.reduce((s, m) => s + m.salidas, 0));
    const totalRemuneraciones = round(meses.reduce((s, m) => s + m.remuneraciones, 0));
    const totalSunat        = round(meses.reduce((s, m) => s + m.sunat, 0));
    const totalProveedores  = round(meses.reduce((s, m) => s + m.proveedores, 0));
    const saldoFinalQ       = round(saldoInicialQ + totalEntradas - totalSalidas);

    return {
      quarter,
      year,
      saldoInicialQ,
      saldoFinalQ,
      totalEntradas,
      totalSalidas,
      totalRemuneraciones,
      totalSunat,
      totalProveedores,
      meses,
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
    if (cached) return cached.data;

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
    const categorias: Record<string, any> = {};

    for (const row of rows) {
      const key = row.CodCuenta;
      if (!categorias[key]) {
        categorias[key] = { cod: row.CodCuenta, descripcion: row.DesCuenta, ytd: 0, meses: {} };
      }
      const val = round(parseFloat(row.GAV) || 0);
      categorias[key].meses[row.Mes] = val;
      categorias[key].ytd += val;
    }

    const lista = Object.values(categorias).sort((a: any, b: any) => b.ytd - a.ytd);
    const total = lista.reduce((sum: number, c: any) => sum + c.ytd, 0);

    return {
      categorias: lista.map((c: any) => ({ ...c, pct: total > 0 ? round((c.ytd / total) * 100) : 0 })),
      total: round(total),
      syncedAt: new Date().toISOString(),
    };
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
    const [cached, docsSnap] = await Promise.all([
      this.getSnapshot(companyId, 'cxp', 'current'),
      this.getSnapshot(companyId, 'cxp_docs', 'current'),
    ]);
    if (!cached) return { message: 'No data available. Run sync first.' };
    const result: any = this.buildCxP(cached.data as any[]);
    if (docsSnap) {
      result.breakdown = this.buildCxPBreakdown(docsSnap.data as any[]);
    }
    return result;
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
        saldoTotal:   round(parseFloat(r.SaldoTotal)   || 0),
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

  async getCajaTxn(companyId: string, year: number, codCuenta?: string) {
    const cached = await this.getSnapshot(companyId, 'caja_txn', `${year}`);
    if (!cached) return { transactions: [], total: 0 };
    let txns = cached.data as any[];
    if (codCuenta) txns = txns.filter((t: any) => String(t.CodBanco ?? t.CodCuenta).startsWith(codCuenta));
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
    return { payments };
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
      ingresos: 0, costoDirecto: 0, margenBruto: 0,
      gav: 0, ebitda: 0, gastosFinancieros: 0, utilidadNeta: 0,
    });

    const ytdTotal = zeroYtd();
    const empresas: any[] = [];

    // Monthly consolidado (12 meses)
    const monthlyTotal: Record<number, any> = {};
    for (let m = 1; m <= 12; m++) {
      monthlyTotal[m] = { mes: m, mesLabel: MONTHS[m - 1], ingresos: 0, costoDirecto: 0, margenBruto: 0, gav: 0, ebitda: 0, gastosFinancieros: 0, utilidadNeta: 0 };
    }

    for (const { company, data } of snapshots) {
      const d = data as any;
      if (!d?.ytd) continue;
      const y = d.ytd;

      ytdTotal.ingresos += y.ingresos || 0;
      ytdTotal.costoDirecto += y.costoDirecto || 0;
      ytdTotal.margenBruto += y.margenBruto || 0;
      ytdTotal.gav += y.gav || 0;
      ytdTotal.ebitda += y.ebitda || 0;
      ytdTotal.gastosFinancieros += y.gastosFinancieros || 0;
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
          monthlyTotal[m.mes].costoDirecto += m.costoDirecto || 0;
          monthlyTotal[m.mes].margenBruto += m.margenBruto || 0;
          monthlyTotal[m.mes].gav += m.gav || 0;
          monthlyTotal[m.mes].ebitda += m.ebitda || 0;
          monthlyTotal[m.mes].gastosFinancieros += m.gastosFinancieros || 0;
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
    ytd.covIntereses = ytd.gastosFinancieros > 0 ? round(ytd.ebitda / ytd.gastosFinancieros) : null;

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
    ] = await Promise.all([
      this.getSnapshot(companyId, 'pl', `${year}`),
      this.getSnapshot(companyId, 'pl', `${prevYear}`),
      this.getSnapshot(companyId, 'cxc', 'current'),
      this.getSnapshot(companyId, 'cxp', 'current'),
      this.getSnapshot(companyId, 'tesoreria', `${year}`),
      this.getSnapshot(companyId, 'balance', `${year}`),
      this.getSnapshot(companyId, 'patrimonio', 'current'),
      this.getSnapshot(companyId, 'caja_asiento_full', `${year}`),
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
        topClientes: sortedCxC.slice(0, 5).map(r => ({
          nombre: r.cliente ?? r.RazonSocial ?? '—',
          saldo: Number(r.saldoTotalSoles ?? 0),
        })),
      },
      pagos: {
        totalCxP, dpo,
        vigente: cxpVig, dias30: cxpD30, dias60: cxpD60, dias90: cxpD90, dias90mas: cxpD90mas,
        pctVencido: pctVencidoCxP, concTop3: concTop3CxP, agingAvailable: cxpAgingAvailable,
        numProveedores: cxpRows.length,
        topProveedores: sortedCxP.slice(0, 5).map(r => ({
          nombre: r.RazonSocial ?? r.Proveedor ?? r.proveedor ?? '—',
          saldo: Number(r.SaldoTotal ?? 0),
        })),
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
