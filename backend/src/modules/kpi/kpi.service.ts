import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S10Service } from '../s10/s10.service';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

@Injectable()
export class KpiService {
  private readonly logger = new Logger(KpiService.name);

  constructor(
    private prisma: PrismaService,
    private s10: S10Service,
  ) {}

  // ─────────────────────────────────────────────
  // Snapshot helpers
  // ─────────────────────────────────────────────

  async getSnapshot(companyId: string, kpiType: string, period: string) {
    return this.prisma.kpiSnapshot.findUnique({
      where: { companyId_kpiType_period: { companyId, kpiType, period } },
    });
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
    return this.prisma.kpiSnapshot.upsert({
      where: { companyId_kpiType_period: { companyId, kpiType, period } },
      update: { data, year, syncedAt: new Date(), companyName },
      create: { companyId, companyName, kpiType, period, year, month, data },
    });
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

    const cached = await this.getSnapshot(companyId, 'pl', period);
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
    const prevCached = await this.getSnapshot(companyId, 'pl', `${year - 1}`);
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
    const clientes = rows.map((r) => ({
      cliente: r.Cliente || r.CodCliente,
      codCliente: r.CodCliente,
      saldoTotal: round(parseFloat(r.SaldoTotal) || 0),
      dias0_30: round(parseFloat(r.Dias_0_30) || 0),
      dias31_60: round(parseFloat(r.Dias_31_60) || 0),
      dias61_90: round(parseFloat(r.Dias_61_90) || 0),
      dias90mas: round(parseFloat(r.Dias_90_mas) || 0),
    }));

    const totalSaldo = clientes.reduce((sum, c) => sum + c.saldoTotal, 0);
    const total90mas = clientes.reduce((sum, c) => sum + c.dias90mas, 0);

    // Concentración: top 3 clientes por saldo
    const sorted = [...clientes].sort((a, b) => b.saldoTotal - a.saldoTotal);
    const top3Saldo = sorted.slice(0, 3).reduce((s, c) => s + c.saldoTotal, 0);
    const concentracionTop3 = totalSaldo > 0 ? round((top3Saldo / totalSaldo) * 100) : 0;

    return {
      clientes,
      totalSaldo: round(totalSaldo),
      total90mas: round(total90mas),
      pct90mas: totalSaldo > 0 ? round((total90mas / totalSaldo) * 100) : 0,
      concentracionTop3,
      numClientes: clientes.length,
      syncedAt: new Date().toISOString(),
    };
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
    for (const year of years) {
      for (const { key, tipo } of snapTypes) {
        const snap = await this.getSnapshot(companyId, key, `${year}`);
        if (!snap) continue;
        const doc = (snap.data as any[]).find(
          (d: any) => d.NroD && String(d.NroD).toUpperCase() === nroDUpper,
        );
        if (doc) return { tipo, year, doc };
      }
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

  async getCxP(companyId: string) {
    const cached = await this.getSnapshot(companyId, 'cxp', 'current');
    if (cached) {
      const raw = cached.data as any[];
      return this.buildCxP(raw);
    }
    return { message: 'No data available. Run sync first.' };
  }

  buildCxP(rows: any[]) {
    const proveedores = rows.map((r) => ({
      proveedor: r.Proveedor || r.CodProveedor,
      codProveedor: r.CodProveedor,
      saldoTotal: round(parseFloat(r.SaldoTotal) || 0),
      dias0_30:  round(parseFloat(r.Dias_0_30)  || 0),
      dias31_60: round(parseFloat(r.Dias_31_60) || 0),
      dias61_90: round(parseFloat(r.Dias_61_90) || 0),
      dias90mas: round(parseFloat(r.Dias_90_mas) || 0),
    }));

    const totalSaldo  = proveedores.reduce((s, p) => s + p.saldoTotal, 0);
    const total90mas  = proveedores.reduce((s, p) => s + p.dias90mas, 0);
    const sorted      = [...proveedores].sort((a, b) => b.saldoTotal - a.saldoTotal);
    const top3Saldo   = sorted.slice(0, 3).reduce((s, p) => s + p.saldoTotal, 0);

    return {
      proveedores,
      totalSaldo:        round(totalSaldo),
      total90mas:        round(total90mas),
      pct90mas:          totalSaldo > 0 ? round((total90mas / totalSaldo) * 100) : 0,
      concentracionTop3: totalSaldo > 0 ? round((top3Saldo / totalSaldo) * 100) : 0,
      numProveedores:    proveedores.length,
    };
  }

  // ─────────────────────────────────────────────
  // Balance General — saldos acumulados por subcuenta (sin filtro de año)
  // ─────────────────────────────────────────────

  async getBalance(companyId: string) {
    const cached = await this.getSnapshot(companyId, 'balance', 'current');
    if (!cached) return { rows: [], message: 'No data. Run sync first.' };
    return { rows: cached.data as any[], syncedAt: cached.syncedAt };
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

  async getAuditSinDoc(companyId: string, year: number) {
    const cached = await this.getSnapshot(companyId, 'audit_sin_doc', `${year}`);
    if (!cached) return { resumen: [], year };
    return { resumen: cached.data as any[], year, syncedAt: cached.syncedAt };
  }

  async getAuditSinDocTxn(companyId: string, year: number, clase?: string) {
    const cached = await this.getSnapshot(companyId, 'audit_sin_doc_txn', `${year}`);
    if (!cached) return { transactions: [], total: 0 };
    let txns = cached.data as any[];
    if (clase) txns = txns.filter((t: any) => String(t.CodCuenta).startsWith(clase));
    return { transactions: txns, total: txns.length };
  }

  async getAuditDescuadres(companyId: string, year: number) {
    const cached = await this.getSnapshot(companyId, 'audit_descuadres', `${year}`);
    if (!cached) return { rows: [], year };
    return { rows: cached.data as any[], count: (cached.data as any[]).length, year, syncedAt: cached.syncedAt };
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
}

function round(n: number, decimals = 2): number {
  return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
}
