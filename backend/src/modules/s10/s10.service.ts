import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as mssql from 'mssql';
import {
  QUERY_PL_COMPLETO,
  QUERY_CXC,
  QUERY_CXP,
  QUERY_CAJA,
  QUERY_GAV,
  QUERY_GASTOS_FINANCIEROS,
  QUERY_EMPRESAS,
} from './queries/financial.queries';

@Injectable()
export class S10Service implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(S10Service.name);
  private pool: mssql.ConnectionPool | null = null;

  get isDirectMode(): boolean {
    return process.env.S10_SYNC_MODE === 'direct';
  }

  async onModuleInit() {
    if (this.isDirectMode) {
      await this.connect();
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.close();
    }
  }

  private async connect(): Promise<mssql.ConnectionPool> {
    if (this.pool && this.pool.connected) return this.pool;

    const config: mssql.config = {
      server: process.env.S10_HOST || '',
      port: parseInt(process.env.S10_PORT || '1433', 10),
      user: process.env.S10_USER || 'sa',
      password: process.env.S10_PASSWORD || '',
      database: process.env.S10_DATABASE || 'CMO',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
      },
      connectionTimeout: 30000,
      requestTimeout: 60000,
    };

    this.pool = await new mssql.ConnectionPool(config).connect();
    this.logger.log('Connected to S10 SQL Server');
    return this.pool;
  }

  private getDateRange(year: number): { fechaInicio: string; fechaFin: string } {
    return {
      fechaInicio: `${year}-01-01`,
      fechaFin: `${year}-12-31`,
    };
  }

  async getPLCompleto(codEmpresa: string, claseIngreso: string, year: number): Promise<any[]> {
    const pool = await this.connect();
    const { fechaInicio, fechaFin } = this.getDateRange(year);

    const result = await pool
      .request()
      .input('codEmpresa', mssql.VarChar, codEmpresa)
      .input('fechaInicio', mssql.Date, new Date(fechaInicio))
      .input('fechaFin', mssql.Date, new Date(fechaFin))
      .query(QUERY_PL_COMPLETO(claseIngreso));

    return result.recordset;
  }

  async getCxC(codEmpresa: string): Promise<any[]> {
    const pool = await this.connect();

    const result = await pool
      .request()
      .input('codEmpresa', mssql.VarChar, codEmpresa)
      .query(QUERY_CXC);

    return result.recordset;
  }

  async getCxP(codEmpresa: string): Promise<any[]> {
    const pool = await this.connect();

    const result = await pool
      .request()
      .input('codEmpresa', mssql.VarChar, codEmpresa)
      .query(QUERY_CXP);

    return result.recordset;
  }

  async getCaja(codEmpresa: string, year: number): Promise<any[]> {
    const pool = await this.connect();
    const { fechaInicio, fechaFin } = this.getDateRange(year);

    const result = await pool
      .request()
      .input('codEmpresa', mssql.VarChar, codEmpresa)
      .input('fechaInicio', mssql.Date, new Date(fechaInicio))
      .input('fechaFin', mssql.Date, new Date(fechaFin))
      .query(QUERY_CAJA);

    return result.recordset;
  }

  async getGAV(codEmpresa: string, year: number): Promise<any[]> {
    const pool = await this.connect();
    const { fechaInicio, fechaFin } = this.getDateRange(year);

    const result = await pool
      .request()
      .input('codEmpresa', mssql.VarChar, codEmpresa)
      .input('fechaInicio', mssql.Date, new Date(fechaInicio))
      .input('fechaFin', mssql.Date, new Date(fechaFin))
      .query(QUERY_GAV);

    return result.recordset;
  }

  async getGastosFinancieros(codEmpresa: string, year: number): Promise<any[]> {
    const pool = await this.connect();
    const { fechaInicio, fechaFin } = this.getDateRange(year);

    const result = await pool
      .request()
      .input('codEmpresa', mssql.VarChar, codEmpresa)
      .input('fechaInicio', mssql.Date, new Date(fechaInicio))
      .input('fechaFin', mssql.Date, new Date(fechaFin))
      .query(QUERY_GASTOS_FINANCIEROS);

    return result.recordset;
  }

  async syncAll(codEmpresa: string, claseIngreso: string, year: number): Promise<{
    pl: any[];
    cxc: any[];
    cxp: any[];
    caja: any[];
  }> {
    const pool = await this.connect();
    this.logger.log(`Syncing all KPIs for ${codEmpresa} year ${year}`);

    const [pl, cxc, cxp, caja] = await Promise.all([
      this.getPLCompleto(codEmpresa, claseIngreso, year),
      this.getCxC(codEmpresa),
      this.getCxP(codEmpresa),
      this.getCaja(codEmpresa, year),
    ]);

    return { pl, cxc, cxp, caja };
  }

  async getEmpresas(): Promise<string[]> {
    const pool = await this.connect();
    const result = await pool.request().query(QUERY_EMPRESAS);
    return result.recordset.map((r: any) => r.CodEmpresa);
  }
}
