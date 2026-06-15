import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LedgerFilters {
  year: number;
  mes?: number;
  codCuenta?: string;
  clase?: string;
  grupoCuenta?: string;
  nroD?: string;
  nroAsiento?: string;
  tercero?: string;
  search?: string;
  page: number;
  pageSize: number;
}

@Injectable()
export class LedgerService {
  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // Árbol de cuentas: Clase → Grupo → Cuenta, con débito/crédito/saldo
  // ─────────────────────────────────────────────
  async getCuentas(companyId: string, year: number) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "clase", "grupoCuenta", "codCuenta", "desCuenta",
              SUM("debito")::float8  AS debito,
              SUM("credito")::float8 AS credito,
              COUNT(*)::int          AS movimientos
         FROM "LedgerEntry"
        WHERE "companyId" = $1 AND "anio" = $2
        GROUP BY "clase", "grupoCuenta", "codCuenta", "desCuenta"
        ORDER BY "codCuenta"`,
      companyId,
      year,
    );

    // Construir árbol jerárquico
    const clases = new Map<string, any>();
    for (const r of rows) {
      const saldo = r.debito - r.credito;
      if (!clases.has(r.clase)) {
        clases.set(r.clase, { clase: r.clase, debito: 0, credito: 0, saldo: 0, movimientos: 0, grupos: new Map() });
      }
      const cl = clases.get(r.clase);
      cl.debito += r.debito; cl.credito += r.credito; cl.saldo += saldo; cl.movimientos += r.movimientos;

      if (!cl.grupos.has(r.grupoCuenta)) {
        cl.grupos.set(r.grupoCuenta, { grupoCuenta: r.grupoCuenta, debito: 0, credito: 0, saldo: 0, movimientos: 0, cuentas: [] });
      }
      const gr = cl.grupos.get(r.grupoCuenta);
      gr.debito += r.debito; gr.credito += r.credito; gr.saldo += saldo; gr.movimientos += r.movimientos;
      gr.cuentas.push({
        codCuenta: r.codCuenta, desCuenta: r.desCuenta,
        debito: r.debito, credito: r.credito, saldo, movimientos: r.movimientos,
      });
    }

    return {
      year,
      clases: Array.from(clases.values()).map((cl) => ({
        ...cl,
        grupos: Array.from(cl.grupos.values()),
      })),
    };
  }

  // ─────────────────────────────────────────────
  // Asientos filtrados + paginados, con saldo acumulado (window function)
  // ─────────────────────────────────────────────
  async getLedger(companyId: string, f: LedgerFilters) {
    const conds: string[] = ['"companyId" = $1', '"anio" = $2'];
    const params: any[] = [companyId, f.year];
    let p = 3;

    if (f.mes) { conds.push(`"mes" = $${p++}`); params.push(f.mes); }
    if (f.codCuenta) { conds.push(`"codCuenta" = $${p++}`); params.push(f.codCuenta); }
    if (f.clase) { conds.push(`"clase" = $${p++}`); params.push(f.clase); }
    if (f.grupoCuenta) { conds.push(`"grupoCuenta" = $${p++}`); params.push(f.grupoCuenta); }
    if (f.nroD) { conds.push(`"nroD" = $${p++}`); params.push(f.nroD); }
    if (f.nroAsiento) { conds.push(`"nroAsiento" = $${p++}`); params.push(f.nroAsiento); }
    if (f.tercero) { conds.push(`"codTercero" = $${p++}`); params.push(f.tercero); }
    if (f.search) {
      conds.push(`(UPPER("glosa") LIKE UPPER($${p}) OR UPPER("tercero") LIKE UPPER($${p}) OR "nroD" LIKE $${p})`);
      params.push(`%${f.search}%`); p++;
    }
    const where = conds.join(' AND ');

    // Totales del conjunto filtrado (footer + opening balance)
    const [tot] = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS total,
              COALESCE(SUM("debito"),0)::float8  AS "totalDebito",
              COALESCE(SUM("credito"),0)::float8 AS "totalCredito"
         FROM "LedgerEntry" WHERE ${where}`,
      ...params,
    );

    const offset = (f.page - 1) * f.pageSize;

    // Saldo de apertura: neto de las filas anteriores a esta página
    const [open] = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(SUM("debito" - "credito"),0)::float8 AS opening FROM (
         SELECT "debito","credito" FROM "LedgerEntry"
          WHERE ${where}
          ORDER BY "fecha", "nroAsiento", "id"
          LIMIT $${p} OFFSET 0
       ) prev`,
      ...params, offset,
    );
    const opening = open?.opening ?? 0;

    // Página con saldo acumulado relativo al inicio del conjunto filtrado
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "id"::text AS id, "fecha", "nroAsiento", "codUnico", "nroD",
              "codCuenta", "desCuenta", "glosa", "tercero", "codTercero",
              "debito"::float8 AS debito, "credito"::float8 AS credito,
              ($${p} + SUM("debito" - "credito") OVER (ORDER BY "fecha", "nroAsiento", "id"
                       ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW))::float8 AS "saldoAcumulado"
         FROM "LedgerEntry"
        WHERE ${where}
        ORDER BY "fecha", "nroAsiento", "id"
        LIMIT $${p + 1} OFFSET $${p + 2}`,
      ...params, opening, f.pageSize, offset,
    );

    return {
      rows,
      page: f.page,
      pageSize: f.pageSize,
      total: tot?.total ?? 0,
      totalDebito: tot?.totalDebito ?? 0,
      totalCredito: tot?.totalCredito ?? 0,
      saldoNeto: (tot?.totalDebito ?? 0) - (tot?.totalCredito ?? 0),
    };
  }

  // ─────────────────────────────────────────────
  // Partida doble de un comprobante.
  // OJO: en S10 el CodAsientoContable (nroAsiento) NO es único por comprobante
  // — se repite por periodo (p.ej. "asiento 1" existe en cada mes). El identificador
  // real del comprobante es CodUnico cuando está presente; cuando viene vacío,
  // acotamos por (nroAsiento + fecha) para no mezclar comprobantes de otros días.
  // ─────────────────────────────────────────────
  async getAsiento(companyId: string, nroAsiento: string, fecha?: string, codUnico?: string) {
    let where: string;
    const params: any[] = [companyId];
    if (codUnico) {
      where = '"companyId" = $1 AND "codUnico" = $2';
      params.push(codUnico);
    } else if (fecha) {
      where = '"companyId" = $1 AND "nroAsiento" = $2 AND "fecha"::date = $3::date';
      params.push(nroAsiento, fecha);
    } else {
      where = '"companyId" = $1 AND "nroAsiento" = $2';
      params.push(nroAsiento);
    }

    const lineas = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "id"::text AS id, "fecha", "nroAsiento", "codUnico", "nroD",
              "codCuenta", "desCuenta", "clase", "glosa", "tercero", "codTercero",
              "debito"::float8 AS debito, "credito"::float8 AS credito
         FROM "LedgerEntry"
        WHERE ${where}
        ORDER BY "codCuenta", "id"`,
      ...params,
    );

    const totalDebito = lineas.reduce((s, l) => s + l.debito, 0);
    const totalCredito = lineas.reduce((s, l) => s + l.credito, 0);

    return {
      nroAsiento,
      codUnico: codUnico ?? lineas[0]?.codUnico ?? null,
      lineas,
      totalDebito,
      totalCredito,
      // Diferencia ~0 confirma que el comprobante cuadra (partida doble)
      cuadra: Math.abs(totalDebito - totalCredito) < 0.01,
      fecha: lineas[0]?.fecha ?? null,
      glosa: lineas[0]?.glosa ?? '',
    };
  }
}
