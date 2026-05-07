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
    };
  }) {
    const { companyId, companyName, claseIngreso, year, data } = payload;
    const period = `${year}`;
    const logs: any[] = [];

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
        await this.kpiService.saveSnapshot(companyId, companyName, 'cxc_transactions', 'current', year, null, data.cxc_transactions);
        logs.push({ kpiType: 'cxc_transactions', rowsProcessed: data.cxc_transactions.length, status: 'success' });
      }

      if (data.cxp_transactions?.length) {
        await this.kpiService.saveSnapshot(companyId, companyName, 'cxp_transactions', 'current', year, null, data.cxp_transactions);
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

  private readonly TRIGGER_URL = 'http://172.17.0.1:3299';
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
