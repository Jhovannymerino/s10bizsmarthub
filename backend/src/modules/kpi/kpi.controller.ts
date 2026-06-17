import { Body, Controller, Get, Param, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { KpiService } from './kpi.service';
import { DirectorioPptxService } from './directorio-pptx.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyAccessGuard } from '../auth/company-access.guard';

function parseYear(year?: string): number {
  return year ? parseInt(year, 10) : new Date().getFullYear();
}

@Controller('kpi')
@UseGuards(JwtAuthGuard, CompanyAccessGuard)
export class KpiController {
  constructor(
    private readonly kpiService: KpiService,
    private readonly pptxService: DirectorioPptxService,
    private readonly prisma: PrismaService,
  ) {}

  /** Consolidado de todas las empresas del grupo */
  @Get('consolidado')
  getConsolidado(@Query('year') year?: string) {
    const y = parseYear(year);
    return this.kpiService.getConsolidado(y);
  }

  /** Scorecard: KPIs clave de todas las empresas en una sola llamada */
  @Get('scorecard')
  getScorecard(@Query('year') year?: string) {
    const y = parseYear(year);
    return this.kpiService.getScorecard(y);
  }

  /** Dashboard completo: P&L mensual + YTD + prevYear */
  @Get(':companyId/dashboard')
  getDashboard(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getDashboardRange(companyId, y, desde || undefined, hasta || undefined);
  }

  /** CxC Aging por cliente */
  @Get(':companyId/cxc')
  getCxC(@Param('companyId') companyId: string) {
    return this.kpiService.getCxC(companyId);
  }

  /** Documentos pendientes CxC desde vw_12DocumentosPorCobrar */
  @Get(':companyId/cxc-docs')
  getCxCDocs(
    @Param('companyId') companyId: string,
    @Query('codCliente') codCliente?: string,
  ) {
    return this.kpiService.getCxCDocs(companyId, codCliente);
  }

  /** Cartera Especial (Estado 6): vinculadas, intercompañía, en disputa */
  @Get(':companyId/cxc-vinculadas')
  getCxCVinculadas(@Param('companyId') companyId: string) {
    return this.kpiService.getCxCVinculadas(companyId);
  }

  /** CxP Aging por proveedor */
  @Get(':companyId/cxp')
  getCxP(@Param('companyId') companyId: string) {
    return this.kpiService.getCxP(companyId);
  }

  /** Documentos pendientes CxP desde vw_12DocumentosPorPagar */
  @Get(':companyId/cxp-docs')
  getCxPDocs(
    @Param('companyId') companyId: string,
    @Query('codProveedor') codProveedor?: string,
  ) {
    return this.kpiService.getCxPDocs(companyId, codProveedor);
  }

  /** Posición de Caja por banco */
  @Get(':companyId/caja')
  getCaja(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = parseYear(year);
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
    const y = parseYear(year);
    return this.kpiService.getTransactions(companyId, y, codCuenta, mes ? parseInt(mes) : undefined);
  }

  /** Detalle de asientos CxC (clase 12) por cliente */
  @Get(':companyId/cxc-transactions')
  getCxCTransactions(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
    @Query('codTercero') codTercero?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getCxCTransactions(companyId, y, codTercero);
  }

  /** Detalle de asientos CxP (clase 42) por proveedor */
  @Get(':companyId/cxp-transactions')
  getCxPTransactions(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
    @Query('codTercero') codTercero?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getCxPTransactions(companyId, y, codTercero);
  }

  /** Facturas emitidas (AgrupamientoDocumento vía NotaDeVenta) */
  @Get(':companyId/facturas-emitidas')
  getFacturasEmitidas(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getFacturasEmitidas(companyId, y);
  }

  /** Facturas recibidas (RDocumento) */
  @Get(':companyId/facturas-recibidas')
  getFacturasRecibidas(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getFacturasRecibidas(companyId, y);
  }

  /** Recibos por Honorarios Profesionales recibidos */
  @Get(':companyId/honorarios-recibidos')
  getHonorariosRecibidos(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getHonorariosRecibidos(companyId, y);
  }

  /** Ranking de clientes por facturación total (incluye pagados) */
  @Get(':companyId/ranking-clientes')
  getRankingClientes(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    return this.kpiService.getRankingClientes(companyId, parseYear(year));
  }

  /** Ranking de proveedores por facturación total (incluye pagados) */
  @Get(':companyId/ranking-proveedores')
  getRankingProveedores(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    return this.kpiService.getRankingProveedores(companyId, parseYear(year));
  }

  /** Posición de caja trimestral */
  @Get(':companyId/caja-posicion')
  getCajaPosicion(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
    @Query('quarter') quarter?: string,
  ) {
    const y = parseYear(year);
    const q = (quarter || 'Q1').toUpperCase();
    return this.kpiService.getCajaPosicion(companyId, y, q);
  }

  /** GAV por categoría */
  @Get(':companyId/gav')
  getGAV(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = parseYear(year);
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

  /** Balance de 8 columnas — saldo inicial + movimiento + saldo final por año */
  @Get(':companyId/balance')
  getBalance(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    return this.kpiService.getBalance(companyId, Number(year) || new Date().getFullYear());
  }

  /** CxC split — comercial (facturas) vs otras (préstamos, DSP, transferencias) */
  @Get(':companyId/cxc-split')
  getCxCSplit(@Param('companyId') companyId: string) {
    return this.kpiService.getCxCSplit(companyId);
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
    const y = parseYear(year);
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
    const y = parseYear(year);
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
    const y = parseYear(year);
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

  /** Activo Fijo — detalle de asientos (clases 33/39) para drilldown */
  @Get(':companyId/activo-fijo-transactions')
  getActivoFijoTxn(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
    @Query('codCuenta') codCuenta?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getActivoFijoTxn(companyId, y, codCuenta);
  }

  /** Gastos Naturaleza — detalle de asientos (clases 60-68) para drilldown */
  @Get(':companyId/gastos-nat-transactions')
  getGastosNatTxn(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
    @Query('codCuenta') codCuenta?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getGastosNatTxn(companyId, y, codCuenta);
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

  /** Libro de pagos OB_Pago — detalle de pagos del módulo de tesorería */
  @Get(':companyId/ob-pagos')
  getObPagos(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getObPagos(companyId, y);
  }

  /** Caja-Banco completo — Fase A.5: libros, operaciones, asignaciones, compensaciones */
  @Get(':companyId/caja-banco-completo')
  getCajaBancoCompleto(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getCajaBancoCompleto(companyId, y);
  }

  /** Bancarización Ley 28194 — Fase B: detección de pagos > S/3,500 sin medio bancario */
  @Get(':companyId/bancarizacion')
  getBancarizacion(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getBancarizacion(companyId, y);
  }

  /** Auditoría Laboral — Fase C: planilla, CTS, trabajadores, cumplimiento DL 650 */
  @Get(':companyId/auditoria-laboral')
  getAuditoriaLaboral(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getAuditoriaLaboral(companyId, y);
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
    const y = parseYear(year);
    return this.kpiService.getCajaTxn(companyId, y, codCuenta);
  }

  /** Caja — todas las líneas de un asiento (para ver la partida doble completa) */
  @Get(':companyId/caja-asiento-lineas')
  getCajaAsientoLineas(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
    @Query('nroAsiento') nroAsiento?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getCajaAsientoLineas(companyId, y, nroAsiento ?? '');
  }

  /** Pagos realizados/recibidos vinculados a un NroD (filtra caja_txn multi-año) */
  @Get(':companyId/document-payments')
  getDocumentPayments(
    @Param('companyId') companyId: string,
    @Query('nroD') nroD?: string,
  ) {
    return this.kpiService.getDocumentPayments(companyId, nroD ?? '');
  }

  /** Tesorería — posición bancaria con saldo inicial, entradas/salidas y saldo final */
  @Get(':companyId/tesoreria')
  getTesoreria(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getTesoreria(companyId, y);
  }

  /** Patrimonio neto — clases 50-59 (capital, reservas, resultados acumulados) */
  @Get(':companyId/patrimonio')
  getPatrimonio(@Param('companyId') companyId: string) {
    return this.kpiService.getPatrimonio(companyId);
  }

  /** Patrimonio — asientos individuales para drill-down (clases 50-59) */
  @Get(':companyId/patrimonio-transactions')
  getPatrimonioTransactions(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
    @Query('codCuenta') codCuenta?: string,
  ) {
    return this.kpiService.getPatrimonioTransactions(companyId, Number(year) || new Date().getFullYear(), codCuenta);
  }

  /** Inventarios — clases 20-29 con saldo histórico y movimiento del año */
  @Get(':companyId/inventarios')
  getInventarios(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getInventarios(companyId, y);
  }

  /** Detalle de transacciones laborales (clase 41) */
  @Get(':companyId/laboral-transactions')
  getLaboralTxn(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
    @Query('codCuenta') codCuenta?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getLaboralTxn(companyId, y, codCuenta);
  }

  /** Gastos por naturaleza — clases 60-68 por mes */
  @Get(':companyId/gastos-naturaleza')
  getGastosNaturaleza(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getGastosNaturaleza(companyId, y);
  }

  /** Auditoría — asientos sin documento fuente (resumen por clase) */
  @Get(':companyId/audit/sin-doc')
  getAuditSinDoc(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getAuditSinDoc(companyId, y);
  }

  /** Auditoría — detalle de asientos sin documento */
  @Get(':companyId/audit/sin-doc-transactions')
  getAuditSinDocTxn(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
    @Query('clase') clase?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getAuditSinDocTxn(companyId, y, clase);
  }

  /** Auditoría — asientos descuadrados (Débito ≠ Crédito) */
  @Get(':companyId/audit/descuadres')
  getAuditDescuadres(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getAuditDescuadres(companyId, y);
  }

  /** Auditoría — asientos atípicos >100K */
  @Get(':companyId/audit/atipicos')
  getAuditAtipicos(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getAuditAtipicos(companyId, y);
  }

  /** Auditoría — conciliación mensual ingresos contables vs documentos */
  @Get(':companyId/audit/conciliacion')
  getAuditConciliacion(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getAuditConciliacion(companyId, y);
  }

  /** Auditoría de clasificación contable: ítems en cuenta 42 que deberían estar en 45 o 162 */
  @Get(':companyId/audit/clasificacion')
  getAuditClasificacion(@Param('companyId') companyId: string) {
    return this.kpiService.getAuditClasificacion(companyId);
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
    const y = parseYear(year);
    return this.kpiService.getLastSync(companyId, y);
  }

  /** Validación forense — 25 validaciones de auditoría sincronizadas desde S10 */
  @Get('consolidado/validation-forense')
  getValidacionForenseConsolidado(@Query('year') year?: string) {
    const y = parseYear(year);
    return this.kpiService.getValidacionForenseConsolidado(y);
  }

  @Get(':companyId/validation-forense')
  getValidacionForense(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    const y = parseYear(year);
    return this.kpiService.getValidacionForense(companyId, y);
  }

  /** Dashboard Gerencial — KPIs ejecutivos integrados */
  @Get(':companyId/gerencial')
  getGerencial(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    return this.kpiService.getGerencial(companyId, parseYear(year));
  }

  /** Reporte Directorio — datos manuales (Ppto, HH, Backlog, Pipeline, Flags, Must Win) */
  @Get(':companyId/directorio')
  getDirectorio(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
    @Query('quarter') quarter?: string,
  ) {
    const y = parseYear(year);
    const q = (quarter || 'Q1').toUpperCase();
    return this.kpiService.getDirectorio(companyId, y, q);
  }

  @Put(':companyId/directorio')
  saveDirectorio(
    @Param('companyId') companyId: string,
    @Query('year') year: string,
    @Query('quarter') quarter: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const y = parseYear(year);
    const q = (quarter || 'Q1').toUpperCase();
    const updatedBy = req.user?.email || null;
    return this.kpiService.saveDirectorio(companyId, y, q, body, updatedBy);
  }

  /** Exporta el Reporte Directorio como archivo .pptx */
  @Get(':companyId/directorio/export')
  async exportDirectorio(
    @Param('companyId') companyId: string,
    @Query('year') year: string,
    @Query('quarter') quarter: string,
    @Res() res: Response,
  ) {
    const y = parseYear(year);
    const q = (quarter || 'Q1').toUpperCase();
    const qMonths: Record<string, number[]> = { Q1: [1,2,3], Q2: [4,5,6], Q3: [7,8,9], Q4: [10,11,12] };
    const qMeses = qMonths[q] || [1,2,3];

    // Cargar todo en paralelo
    const company = await this.prisma.company.findUnique({ where: { codEmpresa: companyId } });
    const [pl, gav, cxc, caja, directorio, cajaPosicion] = await Promise.all([
      this.kpiService.getDashboard(companyId, y),
      this.kpiService.getGAV(companyId, y),
      this.kpiService.getCxC(companyId),
      this.kpiService.getCaja(companyId, y),
      this.kpiService.getDirectorio(companyId, y, q),
      this.kpiService.getCajaPosicion(companyId, y, q),
    ]);

    // Calcular qData y ytdData del P&L mensual
    const plMonthly = (pl as any)?.plMonthly || [];
    const sumF = (rows: any[], field: string) => rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);
    const qRows = plMonthly.filter((m: any) => qMeses.includes(m.mes));
    const qData = {
      ingresos: sumF(qRows, 'ingresos'),
      costoDirecto: sumF(qRows, 'costoDirecto'),
      margenBruto: sumF(qRows, 'margenBruto'),
      gav: sumF(qRows, 'gav'),
      ebitda: sumF(qRows, 'ebitda'),
      gastosFinancieros: sumF(qRows, 'gastosFinancieros'),
      utilidadNeta: sumF(qRows, 'utilidadNeta'),
    };
    const ytdData = (pl as any)?.ytd || qData;

    const buf = await this.pptxService.generate({
      empresa: company?.name || companyId,
      quarter: q,
      year: y,
      qData,
      ytdData,
      pptoQ: (directorio as any)?.data?.presupuesto?.q || {},
      pptoYTD: (directorio as any)?.data?.presupuesto?.ytd || {},
      gav,
      cxc,
      caja,
      cajaPosicion,
      directorio: (directorio as any)?.data || {},
    });

    const fileName = `Directorio_${(company?.name || companyId).replace(/[^\w]/g, '_')}_${q}_${y}.pptx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buf);
  }
}
