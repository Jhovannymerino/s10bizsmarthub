import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { KpiService } from '../kpi/kpi.service';
import { S10Service } from '../s10/s10.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private prisma: PrismaService,
    private kpiService: KpiService,
    private s10: S10Service,
  ) {}

  // ─────────────────────────────────────────────
  // Push mode: receive data from local agent
  // ─────────────────────────────────────────────

  async processPush(payload: {
    companyId: string;
    companyName: string;
    claseIngreso: string;
    year: number;
    data: {
      pl?: any[];
      cxc?: any[];
      cxp?: any[];
      caja?: any[];
      gav?: any[];
      transactions?: any[];
      cxc_transactions?: any[];
      cxp_transactions?: any[];
      facturas_emitidas?: any[];
      facturas_recibidas?: any[];
      honorarios_recibidos?: any[];
      // Nuevos
      balance?: any[];
      otras_cxc?: any[];
      otras_cxc_txn?: any[];
      otras_cxp?: any[];
      otras_cxp_txn?: any[];
      tributos?: any[];
      tributos_txn?: any[];
      laboral?: any[];
      activo_fijo?: any[];
      prestamos_otorgados?: any[];
      prestamos_recibidos?: any[];
      transferencias?: any[];
      caja_saldos?: any[];
      caja_txn?: any[];
      gastos_naturaleza?: any[];
      audit_sin_doc?: any[];
      audit_sin_doc_txn?: any[];
      audit_descuadres?: any[];
      audit_atipicos?: any[];
      audit_conciliacion?: any[];
      // Nuevos módulos
      laboral_txn?: any[];
      patrimonio?: any[];
      inventarios?: any[];
      tesoreria?: any[];
      ob_saldos_banco?: any[];
      conciliacion_bancaria?: any[];
      movs_sin_conciliar?: any[];
      ob_pagos?: any[];
    };
  }) {
    const { companyId, companyName, claseIngreso, year, data } = payload;
    const period = `${year}`;
    const logs: any[] = [];

    // Auto-upsert Company para que la app refleje todas las empresas sincronizadas
    // (corrige hallazgo D-05: tabla Company solo tenía 1 registro mientras se sincronizaban 4).
    try {
      await this.prisma.company.upsert({
        where: { codEmpresa: companyId },
        update: { name: companyName, claseIngreso, active: true },
        create: { codEmpresa: companyId, name: companyName, claseIngreso, active: true },
      });
    } catch (e) {
      this.logger.warn(`No se pudo upsertar Company ${companyId}: ${(e as any).message}`);
    }

    try {
      if (data.pl?.length) {
        const dashboard = this.kpiService.buildDashboardFromPL(data.pl, claseIngreso);
        await this.kpiService.saveSnapshot(companyId, companyName, 'pl', period, year, null, dashboard);
        logs.push({ kpiType: 'pl', rowsProcessed: data.pl.length, status: 'success' });
      }

      if (data.cxc?.length) {
        const cxcData = this.kpiService.buildCxC(data.cxc);
        await this.kpiService.saveSnapshot(companyId, companyName, 'cxc', 'current', year, null, cxcData);
        logs.push({ kpiType: 'cxc', rowsProcessed: data.cxc.length, status: 'success' });
      }

      if (data.cxp?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'cxp', 'current', year, null, data.cxp);
        logs.push({ kpiType: 'cxp', rowsProcessed: data.cxp.length, status: 'success' });
      }

      if (data.caja?.length) {
        const cajaData = this.kpiService.buildCaja(data.caja);
        await this.kpiService.saveSnapshot(companyId, companyName, 'caja', period, year, null, cajaData);
        logs.push({ kpiType: 'caja', rowsProcessed: data.caja.length, status: 'success' });
      }

      if (data.gav?.length) {
        const gavData = this.kpiService.buildGAV(data.gav);
        await this.kpiService.saveSnapshot(companyId, companyName, 'gav', period, year, null, gavData);
        logs.push({ kpiType: 'gav', rowsProcessed: data.gav.length, status: 'success' });
      }

      if (data.transactions?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'transactions', period, year, null, data.transactions);
        logs.push({ kpiType: 'transactions', rowsProcessed: data.transactions.length, status: 'success' });
      }

      if (data.cxc_transactions?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'cxc_transactions', period, year, null, data.cxc_transactions);
        logs.push({ kpiType: 'cxc_transactions', rowsProcessed: data.cxc_transactions.length, status: 'success' });
      }

      if (data.cxp_transactions?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'cxp_transactions', period, year, null, data.cxp_transactions);
        logs.push({ kpiType: 'cxp_transactions', rowsProcessed: data.cxp_transactions.length, status: 'success' });
      }

      if (data.facturas_emitidas?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'facturas_emitidas', `${year}`, year, null, data.facturas_emitidas);
        logs.push({ kpiType: 'facturas_emitidas', rowsProcessed: data.facturas_emitidas.length, status: 'success' });
      }

      if (data.facturas_recibidas?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'facturas_recibidas', `${year}`, year, null, data.facturas_recibidas);
        logs.push({ kpiType: 'facturas_recibidas', rowsProcessed: data.facturas_recibidas.length, status: 'success' });
      }

      if (data.honorarios_recibidos?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'honorarios_recibidos', `${year}`, year, null, data.honorarios_recibidos);
        logs.push({ kpiType: 'honorarios_recibidos', rowsProcessed: data.honorarios_recibidos.length, status: 'success' });
      }

      // ── Nuevos módulos ──────────────────────────────────────────────

      if (data.balance?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'balance', 'current', year, null, data.balance);
        logs.push({ kpiType: 'balance', rowsProcessed: data.balance.length, status: 'success' });
      }

      if (data.otras_cxc?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'otras_cxc', 'current', year, null, data.otras_cxc);
        logs.push({ kpiType: 'otras_cxc', rowsProcessed: data.otras_cxc.length, status: 'success' });
      }

      if (data.otras_cxc_txn?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'otras_cxc_txn', period, year, null, data.otras_cxc_txn);
        logs.push({ kpiType: 'otras_cxc_txn', rowsProcessed: data.otras_cxc_txn.length, status: 'success' });
      }

      if (data.otras_cxp?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'otras_cxp', 'current', year, null, data.otras_cxp);
        logs.push({ kpiType: 'otras_cxp', rowsProcessed: data.otras_cxp.length, status: 'success' });
      }

      if (data.otras_cxp_txn?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'otras_cxp_txn', period, year, null, data.otras_cxp_txn);
        logs.push({ kpiType: 'otras_cxp_txn', rowsProcessed: data.otras_cxp_txn.length, status: 'success' });
      }

      if (data.tributos?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'tributos', period, year, null, data.tributos);
        logs.push({ kpiType: 'tributos', rowsProcessed: data.tributos.length, status: 'success' });
      }

      if (data.tributos_txn?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'tributos_txn', period, year, null, data.tributos_txn);
        logs.push({ kpiType: 'tributos_txn', rowsProcessed: data.tributos_txn.length, status: 'success' });
      }

      if (data.laboral?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'laboral', 'current', year, null, data.laboral);
        logs.push({ kpiType: 'laboral', rowsProcessed: data.laboral.length, status: 'success' });
      }

      if (data.laboral_txn?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'laboral_txn', period, year, null, data.laboral_txn);
        logs.push({ kpiType: 'laboral_txn', rowsProcessed: data.laboral_txn.length, status: 'success' });
      }

      if (data.patrimonio?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'patrimonio', 'current', year, null, data.patrimonio);
        logs.push({ kpiType: 'patrimonio', rowsProcessed: data.patrimonio.length, status: 'success' });
      }

      if (data.inventarios?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'inventarios', period, year, null, data.inventarios);
        logs.push({ kpiType: 'inventarios', rowsProcessed: data.inventarios.length, status: 'success' });
      }

      if (data.tesoreria?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'tesoreria', period, year, null, data.tesoreria);
        logs.push({ kpiType: 'tesoreria', rowsProcessed: data.tesoreria.length, status: 'success' });
      }

      if (data.activo_fijo?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'activo_fijo', 'current', year, null, data.activo_fijo);
        logs.push({ kpiType: 'activo_fijo', rowsProcessed: data.activo_fijo.length, status: 'success' });
      }

      if (data.prestamos_otorgados?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'prestamos_otorgados', 'current', year, null, data.prestamos_otorgados);
        logs.push({ kpiType: 'prestamos_otorgados', rowsProcessed: data.prestamos_otorgados.length, status: 'success' });
      }

      if (data.prestamos_recibidos?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'prestamos_recibidos', 'current', year, null, data.prestamos_recibidos);
        logs.push({ kpiType: 'prestamos_recibidos', rowsProcessed: data.prestamos_recibidos.length, status: 'success' });
      }

      if (data.transferencias?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'transferencias', 'current', year, null, data.transferencias);
        logs.push({ kpiType: 'transferencias', rowsProcessed: data.transferencias.length, status: 'success' });
      }

      if (data.caja_saldos?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'caja_saldos', 'current', year, null, data.caja_saldos);
        logs.push({ kpiType: 'caja_saldos', rowsProcessed: data.caja_saldos.length, status: 'success' });
      }

      if (data.caja_txn?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'caja_txn', period, year, null, data.caja_txn);
        logs.push({ kpiType: 'caja_txn', rowsProcessed: data.caja_txn.length, status: 'success' });
      }

      if (data.gastos_naturaleza?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'gastos_naturaleza', period, year, null, data.gastos_naturaleza);
        logs.push({ kpiType: 'gastos_naturaleza', rowsProcessed: data.gastos_naturaleza.length, status: 'success' });
      }

      if (data.ob_saldos_banco?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'ob_saldos_banco', 'current', year, null, data.ob_saldos_banco);
        logs.push({ kpiType: 'ob_saldos_banco', rowsProcessed: data.ob_saldos_banco.length, status: 'success' });
      }

      // Conciliación bancaria — siempre guardar (incluso si vacío) para detectar
      // empresas que NO usan el módulo (riesgo de control interno).
      if (data.conciliacion_bancaria !== undefined) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'conciliacion_bancaria', 'current', year, null, data.conciliacion_bancaria);
        logs.push({ kpiType: 'conciliacion_bancaria', rowsProcessed: data.conciliacion_bancaria.length, status: 'success' });
      }

      if (data.movs_sin_conciliar?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'movs_sin_conciliar', 'current', year, null, data.movs_sin_conciliar);
        logs.push({ kpiType: 'movs_sin_conciliar', rowsProcessed: data.movs_sin_conciliar.length, status: 'success' });
      }

      if (data.ob_pagos?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'ob_pagos', period, year, null, data.ob_pagos);
        logs.push({ kpiType: 'ob_pagos', rowsProcessed: data.ob_pagos.length, status: 'success' });
      }

      if (data.audit_sin_doc?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'audit_sin_doc', period, year, null, data.audit_sin_doc);
        logs.push({ kpiType: 'audit_sin_doc', rowsProcessed: data.audit_sin_doc.length, status: 'success' });
      }

      if (data.audit_sin_doc_txn?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'audit_sin_doc_txn', period, year, null, data.audit_sin_doc_txn);
        logs.push({ kpiType: 'audit_sin_doc_txn', rowsProcessed: data.audit_sin_doc_txn.length, status: 'success' });
      }

      if (data.audit_descuadres?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'audit_descuadres', period, year, null, data.audit_descuadres);
        logs.push({ kpiType: 'audit_descuadres', rowsProcessed: data.audit_descuadres.length, status: 'success' });
      } else {
        // Always save even if empty so front knows the check ran
        await this.kpiService.saveSnapshot(companyId, companyName, 'audit_descuadres', period, year, null, []);
        logs.push({ kpiType: 'audit_descuadres', rowsProcessed: 0, status: 'success' });
      }

      if (data.audit_atipicos?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'audit_atipicos', period, year, null, data.audit_atipicos);
        logs.push({ kpiType: 'audit_atipicos', rowsProcessed: data.audit_atipicos.length, status: 'success' });
      }

      if (data.audit_conciliacion?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'audit_conciliacion', period, year, null, data.audit_conciliacion);
        logs.push({ kpiType: 'audit_conciliacion', rowsProcessed: data.audit_conciliacion.length, status: 'success' });
      }

      // Write sync logs
      await this.prisma.syncLog.createMany({
        data: logs.map((l) => ({
          companyId,
          kpiType: l.kpiType,
          status: l.status,
          mode: 'push',
          rowsProcessed: l.rowsProcessed,
          triggeredBy: 'agent',
        })),
      });

      this.logger.log(`Push sync complete for ${companyId} year ${year}: ${logs.length} KPI types`);
      return { success: true, processed: logs };

    } catch (error) {
      this.logger.error(`Push sync failed for ${companyId}: ${error.message}`);
      await this.prisma.syncLog.create({
        data: {
          companyId,
          kpiType: 'all',
          status: 'error',
          mode: 'push',
          rowsProcessed: 0,
          errorMessage: error.message,
          triggeredBy: 'agent',
        },
      });
      throw error;
    }
  }

  // ─────────────────────────────────────────────
  // VPN script trigger — llama al servicio trigger en el host VPS
  // El servicio corre en host:3299 y ejecuta sync-vpn.sh fuera de Docker
  // ─────────────────────────────────────────────

  private readonly TRIGGER_URL = 'http://host.docker.internal:3299';
  private readonly SYNC_KEY = process.env.SYNC_API_KEY ?? '';

  async triggerVpnSync(years: number[] = [new Date().getFullYear()]) {
    // Primero verificar si el servicio trigger está disponible
    let serviceAvailable = false;
    try {
      const status = await fetch(`${this.TRIGGER_URL}/status`, {
        headers: { 'x-sync-key': this.SYNC_KEY },
        signal: AbortSignal.timeout(3000),
      });
      if (status.ok) {
        const body: any = await status.json();
        serviceAvailable = true;
        if (body.running) {
          return { message: 'Sync ya en curso, espera que termine.', status: 'busy' };
        }
      }
    } catch {
      serviceAvailable = false;
    }

    if (!serviceAvailable) {
      this.logger.warn('sync-trigger service no disponible en host:3299');
      return {
        message: 'Servicio de sincronización no disponible. El sync automático corre a las 7am y 6pm (lunes-viernes).',
        status: 'unavailable',
      };
    }

    this.logger.log(`VPN sync trigger → host:3299 years: ${years.join(', ')}`);

    const res = await fetch(`${this.TRIGGER_URL}/trigger?years=${years.join(',')}`, {
      method: 'POST',
      headers: { 'x-sync-key': this.SYNC_KEY },
      signal: AbortSignal.timeout(5000),
    });

    const body: any = await res.json();
    this.logger.log(`Sync trigger response: ${JSON.stringify(body)}`);
    return body;
  }

  async getVpnSyncStatus() {
    try {
      const res = await fetch(`${this.TRIGGER_URL}/status`, {
        headers: { 'x-sync-key': this.SYNC_KEY },
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) return await res.json();
    } catch {
      // ignore
    }
    return { running: false, available: false };
  }

  // ─────────────────────────────────────────────
  // Direct mode: trigger sync from VPS
  // ─────────────────────────────────────────────

  async triggerDirectSync(companyId?: string) {
    if (!this.s10.isDirectMode) {
      return { message: 'Direct mode not enabled. Set S10_SYNC_MODE=direct.' };
    }

    const companies = companyId
      ? await this.prisma.company.findMany({ where: { codEmpresa: companyId, active: true } })
      : await this.prisma.company.findMany({ where: { active: true } });

    const year = new Date().getFullYear();
    const results: any[] = [];

    for (const company of companies) {
      try {
        const { pl, cxc, cxp, caja } = await this.s10.syncAll(company.codEmpresa, company.claseIngreso, year);
        await this.processPush({
          companyId: company.codEmpresa,
          companyName: company.name,
          claseIngreso: company.claseIngreso,
          year,
          data: { pl, cxc, cxp, caja },
        });
        results.push({ companyId: company.codEmpresa, status: 'success' });
      } catch (err) {
        this.logger.error(`Direct sync failed for ${company.codEmpresa}: ${err.message}`);
        results.push({ companyId: company.codEmpresa, status: 'error', error: err.message });
      }
    }

    return { results };
  }

  // ─────────────────────────────────────────────
  // Scheduled sync (direct mode only, weekdays 7am)
  // ─────────────────────────────────────────────

  @Cron('0 7 * * 1-5')
  async scheduledSync() {
    if (!this.s10.isDirectMode) return;
    this.logger.log('Scheduled sync triggered');
    await this.triggerDirectSync();
  }
}
