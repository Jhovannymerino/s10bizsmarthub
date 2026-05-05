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
      update: { data, syncedAt: new Date(), companyName },
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
  // Dashboard (P&L + KPI cards)
  // ─────────────────────────────────────────────

  async getDashboard(companyId: string, year: number) {
    const period = `${year}`;

    // Try cache first
    const cached = await this.getSnapshot(companyId, 'pl', period);
    if (cached) {
      this.logger.debug(`Cache hit: ${companyId}/pl/${period}`);
      return cached.data;
    }

    // Direct mode fallback
    if (this.s10.isDirectMode) {
      const company = await this.resolveCompany(companyId);
      const rows = await this.s10.getPLCompleto(companyId, company.claseIngreso, year);
      const dashboard = this.buildDashboardFromPL(rows, company.claseIngreso);
      await this.saveSnapshot(companyId, company.name, 'pl', period, year, null, dashboard);
      return dashboard;
    }

    // No data available yet
    return { message: 'No data available. Run sync first.', year };
  }

  // ─────────────────────────────────────────────
  // Build dashboard from raw P&L rows
  // ─────────────────────────────────────────────

  buildDashboardFromPL(rows: any[], claseIngreso: string) {
    const monthly: Record<number, {
      ingresos: number;
      costo: number;
      cargas: number;
      gav: number;
      gastosFinancieros: number;
    }> = {};

    for (let m = 1; m <= 12; m++) {
      monthly[m] = { ingresos: 0, costo: 0, cargas: 0, gav: 0, gastosFinancieros: 0 };
    }

    // Per-account detail maps
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
        monthly[mes].cargas += credito - debito;
        // 79 reduces costo — no separate detail row
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
      const costoNeto = v.costo - v.cargas;
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

    const detalle = {
      ingresos: Object.values(detalleMap.ingresos).sort((a: any, b: any) => b.ytd - a.ytd),
      costoDirecto: Object.values(detalleMap.costoDirecto).sort((a: any, b: any) => b.ytd - a.ytd),
      gav: Object.values(detalleMap.gav).sort((a: any, b: any) => b.ytd - a.ytd),
      gastosFinancieros: Object.values(detalleMap.gastosFinancieros).sort((a: any, b: any) => b.ytd - a.ytd),
    };

    return { plMonthly, ytd, detalle };
  }

  // ─────────────────────────────────────────────
  // CxC
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

    return {
      clientes,
      totalSaldo: round(totalSaldo),
      total90mas: round(total90mas),
      pct90mas: totalSaldo > 0 ? round((total90mas / totalSaldo) * 100) : 0,
      syncedAt: new Date().toISOString(),
    };
  }

  // ─────────────────────────────────────────────
  // Caja
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

    return {
      bancos: Object.values(bancos),
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
}

function round(n: number, decimals = 2): number {
  return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
}
