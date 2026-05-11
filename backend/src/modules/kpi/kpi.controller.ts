import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { KpiService } from './kpi.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyAccessGuard } from '../auth/company-access.guard';

@Controller('kpi')
@UseGuards(JwtAuthGuard, CompanyAccessGuard)
export class KpiController {
  constructor(private readonly kpiService: KpiService) {}

  /** Consolidado de todas las empresas del grupo */
  @Get('consolidado')
  getConsolidado(@Query('year') year?: string) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getConsolidado(y);
  }

  /** Scorecard: KPIs clave de todas las empresas en una sola llamada */
  @Get('scorecard')
  getScorecard(@Query('year') year?: string) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getScorecard(y);
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

  /** CxP Aging por proveedor */
  @Get(':companyId/cxp')
  getCxP(@Param('companyId') companyId: string) {
    return this.kpiService.getCxP(companyId);
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
    @Query('year') year?: string,
    @Query('codTercero') codTercero?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getCxCTransactions(companyId, y, codTercero);
  }

  /** Detalle de asientos CxP (clase 42) por proveedor */
  @Get(':companyId/cxp-transactions')
  getCxPTransactions(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
    @Query('codTercero') codTercero?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getCxPTransactions(companyId, y, codTercero);
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

  /** Recibos por Honorarios Profesionales recibidos */
  @Get(':companyId/honorarios-recibidos')
  getHonorariosRecibidos(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getHonorariosRecibidos(companyId, y);
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

  /** Documento fuente (factura/boleta/honorario) por NroD */
  @Get(':companyId/documento')
  getDocumentoByNroD(
    @Param('companyId') companyId: string,
    @Query('nroD') nroD: string,
  ) {
    return this.kpiService.getDocumentoByNroD(companyId, nroD);
  }

  /** Balance General — saldos acumulados por subcuenta */
  @Get(':companyId/balance')
  getBalance(@Param('companyId') companyId: string) {
    return this.kpiService.getBalance(companyId);
  }

  /** Otras CxC — aging clases 13,14,16,17,18 */
  @Get(':companyId/otras-cxc')
  getOtrasCxC(@Param('companyId') companyId: string) {
    return this.kpiService.getOtrasCxC(companyId);
  }

  /** Otras CxC — detalle de transacciones */
  @Get(':companyId/otras-cxc-transactions')
  getOtrasCxCTransactions(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
    @Query('codCuenta') codCuenta?: string,
    @Query('codTercero') codTercero?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getOtrasCxCTransactions(companyId, y, codCuenta, codTercero);
  }

  /** Otras CxP — aging clases 43,44,45,46,47 */
  @Get(':companyId/otras-cxp')
  getOtrasCxP(@Param('companyId') companyId: string) {
    return this.kpiService.getOtrasCxP(companyId);
  }

  /** Otras CxP — detalle de transacciones */
  @Get(':companyId/otras-cxp-transactions')
  getOtrasCxPTransactions(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
    @Query('codCuenta') codCuenta?: string,
    @Query('codTercero') codTercero?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getOtrasCxPTransactions(companyId, y, codCuenta, codTercero);
  }

  /** Tributos — clase 40 saldos por cuenta (year-aware si se pasa ?year=) */
  @Get(':companyId/tributos')
  getTributos(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = year ? parseInt(year, 10) : undefined;
    return this.kpiService.getTributos(companyId, y);
  }

  /** Tributos — detalle de transacciones */
  @Get(':companyId/tributos-transactions')
  getTributosTxn(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
    @Query('codCuenta') codCuenta?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getTributosTxn(companyId, y, codCuenta);
  }

  /** Laboral — clase 41 (CTS, remuneraciones por pagar) */
  @Get(':companyId/laboral')
  getLaboral(@Param('companyId') companyId: string) {
    return this.kpiService.getLaboral(companyId);
  }

  /** Activo Fijo — clase 33 vs 39, valor neto */
  @Get(':companyId/activo-fijo')
  getActivoFijo(@Param('companyId') companyId: string) {
    return this.kpiService.getActivoFijo(companyId);
  }

  /** Saldos bancarios desde módulo OB_CuentaBanco — saldo contable vs banco real */
  @Get(':companyId/ob-saldos-banco')
  getObSaldosBanco(@Param('companyId') companyId: string) {
    return this.kpiService.getObSaldosBanco(companyId);
  }

  /** Conciliación bancaria — estado del módulo OB_EstadoBanco/Detalle */
  @Get(':companyId/conciliacion-bancaria')
  getConciliacionBancaria(@Param('companyId') companyId: string) {
    return this.kpiService.getConciliacionBancaria(companyId);
  }

  /** Préstamos otorgados — tipo 071 en CxC */
  @Get(':companyId/prestamos-otorgados')
  getPrestamosOtorgados(@Param('companyId') companyId: string) {
    return this.kpiService.getPrestamosOtorgados(companyId);
  }

  /** Préstamos recibidos — tipo 071 en CxP */
  @Get(':companyId/prestamos-recibidos')
  getPrestamosRecibidos(@Param('companyId') companyId: string) {
    return this.kpiService.getPrestamosRecibidos(companyId);
  }

  /** Transferencias — tipo 058 inter-empresa/bancos */
  @Get(':companyId/transferencias')
  getTransferencias(@Param('companyId') companyId: string) {
    return this.kpiService.getTransferencias(companyId);
  }

  /** Caja — saldos bancarios acumulados (sin filtro año) */
  @Get(':companyId/caja-saldos')
  getCajaSaldos(@Param('companyId') companyId: string) {
    return this.kpiService.getCajaSaldos(companyId);
  }

  /** Caja — detalle de movimientos bancarios */
  @Get(':companyId/caja-transactions')
  getCajaTxn(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
    @Query('codCuenta') codCuenta?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getCajaTxn(companyId, y, codCuenta);
  }

  /** Tesorería — posición bancaria con saldo inicial, entradas/salidas y saldo final */
  @Get(':companyId/tesoreria')
  getTesoreria(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getTesoreria(companyId, y);
  }

  /** Patrimonio neto — clases 50-59 (capital, reservas, resultados acumulados) */
  @Get(':companyId/patrimonio')
  getPatrimonio(@Param('companyId') companyId: string) {
    return this.kpiService.getPatrimonio(companyId);
  }

  /** Inventarios — clases 20-29 con saldo histórico y movimiento del año */
  @Get(':companyId/inventarios')
  getInventarios(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getInventarios(companyId, y);
  }

  /** Detalle de transacciones laborales (clase 41) */
  @Get(':companyId/laboral-transactions')
  getLaboralTxn(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
    @Query('codCuenta') codCuenta?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getLaboralTxn(companyId, y, codCuenta);
  }

  /** Gastos por naturaleza — clases 60-68 por mes */
  @Get(':companyId/gastos-naturaleza')
  getGastosNaturaleza(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getGastosNaturaleza(companyId, y);
  }

  /** Auditoría — asientos sin documento fuente (resumen por clase) */
  @Get(':companyId/audit/sin-doc')
  getAuditSinDoc(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getAuditSinDoc(companyId, y);
  }

  /** Auditoría — detalle de asientos sin documento */
  @Get(':companyId/audit/sin-doc-transactions')
  getAuditSinDocTxn(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
    @Query('clase') clase?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getAuditSinDocTxn(companyId, y, clase);
  }

  /** Auditoría — asientos descuadrados (Débito ≠ Crédito) */
  @Get(':companyId/audit/descuadres')
  getAuditDescuadres(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getAuditDescuadres(companyId, y);
  }

  /** Auditoría — asientos atípicos >100K */
  @Get(':companyId/audit/atipicos')
  getAuditAtipicos(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getAuditAtipicos(companyId, y);
  }

  /** Auditoría — conciliación mensual ingresos contables vs documentos */
  @Get(':companyId/audit/conciliacion')
  getAuditConciliacion(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getAuditConciliacion(companyId, y);
  }

  /** Años disponibles (con datos sincronizados) para una empresa */
  @Get(':companyId/available-years')
  getAvailableYears(@Param('companyId') companyId: string) {
    return this.kpiService.getAvailableYears(companyId);
  }

  /** Fecha y hora del último sync exitoso para la empresa/año */
  @Get(':companyId/last-sync')
  getLastSync(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.kpiService.getLastSync(companyId, y);
  }
}
