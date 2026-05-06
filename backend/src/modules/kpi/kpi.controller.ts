import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { KpiService } from './kpi.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('kpi')
@UseGuards(JwtAuthGuard)
export class KpiController {
  constructor(private readonly kpiService: KpiService) {}

  /** Consolidado de todas las empresas del grupo */
  @Get('consolidado')
  getConsolidado(@Query('year') year?: string) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getConsolidado(y);
  }

  /** Dashboard completo: P&L mensual + YTD + prevYear */
  @Get(':companyId/dashboard')
  getDashboard(
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

  /** Detalle de asientos por cuenta y mes */
  @Get(':companyId/transactions')
  getTransactions(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
    @Query('codCuenta') codCuenta?: string,
    @Query('mes') mes?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getTransactions(companyId, y, codCuenta, mes ? parseInt(mes) : undefined);
  }

  /** Detalle de asientos CxC (clase 12) por cliente */
  @Get(':companyId/cxc-transactions')
  getCxCTransactions(
    @Param('companyId') companyId: string,
    @Query('codTercero') codTercero?: string,
  ) {
    return this.kpiService.getCxCTransactions(companyId, codTercero);
  }

  /** Facturas emitidas (AgrupamientoDocumento vía NotaDeVenta) */
  @Get(':companyId/facturas-emitidas')
  getFacturasEmitidas(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getFacturasEmitidas(companyId, y);
  }

  /** Facturas recibidas (RDocumento) */
  @Get(':companyId/facturas-recibidas')
  getFacturasRecibidas(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getFacturasRecibidas(companyId, y);
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
