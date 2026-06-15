import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyAccessGuard } from '../auth/company-access.guard';

function parseYear(year?: string): number {
  return year ? parseInt(year, 10) : new Date().getFullYear();
}

@Controller('kpi')
@UseGuards(JwtAuthGuard, CompanyAccessGuard)
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  /** Árbol de cuentas del mayor: Clase → Grupo → Cuenta */
  @Get(':companyId/ledger/cuentas')
  getCuentas(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
  ) {
    return this.ledger.getCuentas(companyId, parseYear(year));
  }

  /** Partida doble completa de un asiento */
  @Get(':companyId/ledger/asiento/:nroAsiento')
  getAsiento(
    @Param('companyId') companyId: string,
    @Param('nroAsiento') nroAsiento: string,
  ) {
    return this.ledger.getAsiento(companyId, nroAsiento);
  }

  /** Mayor filtrado + paginado, con saldo acumulado */
  @Get(':companyId/ledger')
  getLedger(
    @Param('companyId') companyId: string,
    @Query('year') year?: string,
    @Query('mes') mes?: string,
    @Query('cuenta') codCuenta?: string,
    @Query('clase') clase?: string,
    @Query('grupo') grupoCuenta?: string,
    @Query('nroD') nroD?: string,
    @Query('asiento') nroAsiento?: string,
    @Query('tercero') tercero?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.ledger.getLedger(companyId, {
      year: parseYear(year),
      mes: mes ? parseInt(mes, 10) : undefined,
      codCuenta: codCuenta || undefined,
      clase: clase || undefined,
      grupoCuenta: grupoCuenta || undefined,
      nroD: nroD || undefined,
      nroAsiento: nroAsiento || undefined,
      tercero: tercero || undefined,
      search: search || undefined,
      page: page ? Math.max(1, parseInt(page, 10)) : 1,
      pageSize: pageSize ? Math.min(500, Math.max(1, parseInt(pageSize, 10))) : 100,
    });
  }
}
