import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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
