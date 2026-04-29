import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { KpiService } from './kpi.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('kpi')
@UseGuards(JwtAuthGuard)
export class KpiController {
  constructor(private readonly kpiService: KpiService) {}

  /** Dashboard completo: P&L mensual + YTD */
  @Get(':companyId/dashboard')
  getDashboard(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getDashboard(companyId, y);
  }

  /** P&L mensual + YTD */
  @Get(':companyId/pl')
  getPL(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getDashboard(companyId, y);
  }

  /** CxC Aging por cliente */
  @Get(':companyId/cxc')
  getCxC(@Param('companyId') companyId: string) {
    return this.kpiService.getCxC(companyId);
  }

  /** Posición de Caja por banco */
  @Get(':companyId/caja')
  getCaja(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getCaja(companyId, y);
  }

  /** GAV por categoría */
  @Get(':companyId/gav')
  getGAV(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getGAV(companyId, y);
  }
}
