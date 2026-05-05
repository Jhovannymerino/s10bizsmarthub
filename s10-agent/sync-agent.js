/**
 * S10 BizSmartHub — Agente Local de Sincronización
 * ============================================================
 * Ejecutar desde la red CMO (acceso a SQL Server S10).
 * Lee datos financieros de S10 y los envía al VPS por HTTPS.
 *
 * Uso:
 *   node sync-agent.js [--year=2026] [--company=80688541]
 *
 * Programar en Windows Task Scheduler:
 *   Trigger: Diario 07:00, Lunes-Viernes
 *   Acción:  node "C:\ruta\al\sync-agent.js" --year=2026
 * ============================================================
 */

const mssql = require('mssql');

// ─────────────────────────────────────────────
// CONFIGURACIÓN — editar antes de desplegar
// ─────────────────────────────────────────────

const CONFIG = {
  // SQL Server S10 — COMPLETAR con datos reales de la red CMO
  S10_HOST: '192.168.1.51',
  S10_PORT: 1433,
  S10_USER: 'sa',
  S10_PASSWORD: 'Cmo$2017.',
  S10_DATABASE: 'CMO',

  // VPS BizSmartHub
  VPS_URL: 'https://s10bizsmarthub.bizwareapps.com',
  // Gateway VPN: 38.19.155.204:10443
  SYNC_API_KEY: '1fe0bf01e872d7f586e4828abcdc1ba0a5283f5625570128',

  // Empresas a sincronizar
  // codEmpresa: código en S10 | name: nombre display | claseIngreso: '70' o '75'
  COMPANIES: [
    { codEmpresa: '22011489',  name: 'CMO GROUP S.A.',                                                    claseIngreso: '75' },
    { codEmpresa: '80680645',  name: 'CONSORCIO SALUD ZACARIAS',                                          claseIngreso: '70' },
    { codEmpresa: '80688541',  name: 'INTEGRAL CONSULTORES S.A.C.',                                       claseIngreso: '70' },
    { codEmpresa: '80240175',  name: 'CONSORCIO PENITENCIARIO MISTI',                                     claseIngreso: '70' },
    { codEmpresa: '80688706',  name: 'MEDARQ S.A.C.',                                                     claseIngreso: '70' },
    { codEmpresa: '80688524',  name: 'COMPAÑÍA AMERICANA DE CONSTRUCCIÓN Y EQUIPAMIENTO S.A.C.',          claseIngreso: '70' },
    { codEmpresa: '80688895',  name: 'CONSORCIO SALUD MONTENEGRO',                                        claseIngreso: '70' },
    { codEmpresa: '22020135',  name: 'CONSORCIO DEPORTIVO ATE',                                           claseIngreso: '70' },
    { codEmpresa: '80688995',  name: 'CONSORCIO SALUD SANTA CRUZ',                                        claseIngreso: '70' },
    { codEmpresa: '80688535',  name: 'ESTRATEGIA Y SOLUCIONES RAVI E.I.R.L.',                             claseIngreso: '70' },
  ],
};

// ─────────────────────────────────────────────
// Parsear argumentos CLI
// ─────────────────────────────────────────────

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach((arg) => {
    const [key, val] = arg.replace(/^--/, '').split('=');
    args[key] = val;
  });
  return args;
}

// ─────────────────────────────────────────────
// Queries SQL (equivalentes a financial.queries.ts)
// ─────────────────────────────────────────────

const QUERY_PL = (claseIngreso, codEmpresa, fechaInicio, fechaFin) => `
SELECT
  LEFT(pcd.CodCuenta, 2)                   AS Clase,
  pcd.CodCuenta,
  pcd.Descripcion                          AS DesCuenta,
  MONTH(ac.FechaAplicacionContable)         AS Mes,
  SUM(ISNULL(ac.Debito, 0))                AS TotalDebito,
  SUM(ISNULL(ac.Credito, 0))               AS TotalCredito
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND ac.FechaAplicacionContable BETWEEN '${fechaInicio}' AND '${fechaFin}'
  AND LEFT(pcd.CodCuenta, 2) IN ('${claseIngreso}', '79', '91', '94', '97')
GROUP BY LEFT(pcd.CodCuenta,2), pcd.CodCuenta, pcd.Descripcion, MONTH(ac.FechaAplicacionContable)
ORDER BY Clase, CodCuenta, Mes
`;

const QUERY_CXC = (codEmpresa) => `
SELECT
  i.Descripcion                                                             AS Cliente,
  ac.CodIdentificador                                                       AS CodCliente,
  SUM(ISNULL(ac.Debito, 0)) - SUM(ISNULL(ac.Credito, 0))                  AS SaldoTotal,
  SUM(CASE WHEN ac.FechaAplicacionContable >= DATEADD(DAY,-30,GETDATE())
           THEN ISNULL(ac.Debito,0)-ISNULL(ac.Credito,0) ELSE 0 END)      AS Dias_0_30,
  SUM(CASE WHEN ac.FechaAplicacionContable BETWEEN DATEADD(DAY,-60,GETDATE()) AND DATEADD(DAY,-31,GETDATE())
           THEN ISNULL(ac.Debito,0)-ISNULL(ac.Credito,0) ELSE 0 END)      AS Dias_31_60,
  SUM(CASE WHEN ac.FechaAplicacionContable BETWEEN DATEADD(DAY,-90,GETDATE()) AND DATEADD(DAY,-61,GETDATE())
           THEN ISNULL(ac.Debito,0)-ISNULL(ac.Credito,0) ELSE 0 END)      AS Dias_61_90,
  SUM(CASE WHEN ac.FechaAplicacionContable < DATEADD(DAY,-90,GETDATE())
           THEN ISNULL(ac.Debito,0)-ISNULL(ac.Credito,0) ELSE 0 END)      AS Dias_90_mas
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
LEFT JOIN CMO.dbo.Identificador i
  ON ac.CodIdentificador = i.CodIdentificador
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND LEFT(pcd.CodCuenta, 2) = '12'
GROUP BY i.Descripcion, ac.CodIdentificador
HAVING SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0)) > 0
ORDER BY SaldoTotal DESC
`;

const QUERY_CXP = (codEmpresa) => `
SELECT
  i.Descripcion                                        AS Proveedor,
  ac.CodIdentificador                                  AS CodProveedor,
  SUM(ISNULL(ac.Credito,0)) - SUM(ISNULL(ac.Debito,0)) AS SaldoTotal
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
LEFT JOIN CMO.dbo.Identificador i
  ON ac.CodIdentificador = i.CodIdentificador
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND LEFT(pcd.CodCuenta, 2) = '42'
GROUP BY i.Descripcion, ac.CodIdentificador
HAVING SUM(ISNULL(ac.Credito,0)) - SUM(ISNULL(ac.Debito,0)) > 0
ORDER BY SaldoTotal DESC
`;

const QUERY_CAJA = (codEmpresa, fechaInicio, fechaFin) => `
SELECT
  pcd.Descripcion                                         AS Banco,
  pcd.CodCuenta                                           AS CodBanco,
  MONTH(ac.FechaAplicacionContable)                       AS Mes,
  SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0))   AS FlujoNeto
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND ac.FechaAplicacionContable BETWEEN '${fechaInicio}' AND '${fechaFin}'
  AND LEFT(pcd.CodCuenta, 2) = '10'
GROUP BY pcd.Descripcion, pcd.CodCuenta, MONTH(ac.FechaAplicacionContable)
ORDER BY pcd.Descripcion, Mes
`;

const QUERY_GAV = (codEmpresa, fechaInicio, fechaFin) => `
SELECT
  LEFT(d.CodCuenta, 3)                                    AS CodCuenta,
  MAX(ISNULL(p.Descripcion, d.Descripcion))               AS DesCuenta,
  MONTH(ac.FechaAplicacionContable)                       AS Mes,
  SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0))   AS GAV
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle d
  ON ac.NroPlanContableDetalle = d.NroPlanContableDetalle
LEFT JOIN CMO.dbo.PlanContableDetalle p
  ON p.CodCuenta = LEFT(d.CodCuenta, 3)
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND ac.FechaAplicacionContable BETWEEN '${fechaInicio}' AND '${fechaFin}'
  AND LEFT(d.CodCuenta, 2) = '94'
GROUP BY LEFT(d.CodCuenta, 3), MONTH(ac.FechaAplicacionContable)
ORDER BY CodCuenta, Mes
`;

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  const year = parseInt(args.year || new Date().getFullYear(), 10);
  const targetCompany = args.company;

  const companies = targetCompany
    ? CONFIG.COMPANIES.filter((c) => c.codEmpresa === targetCompany)
    : CONFIG.COMPANIES;

  if (!companies.length) {
    console.error(`No companies found${targetCompany ? ` for codEmpresa=${targetCompany}` : ''}`);
    process.exit(1);
  }

  console.log(`\nS10 Sync Agent — ${new Date().toISOString()}`);
  console.log(`Year: ${year} | Companies: ${companies.map((c) => c.name).join(', ')}\n`);

  // Connect to SQL Server
  const pool = await new mssql.ConnectionPool({
    server: CONFIG.S10_HOST,
    port: CONFIG.S10_PORT,
    user: CONFIG.S10_USER,
    password: CONFIG.S10_PASSWORD,
    database: CONFIG.S10_DATABASE,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    connectionTimeout: 30000,
    requestTimeout: 60000,
  }).connect();

  console.log('✓ Connected to S10 SQL Server');

  const fechaInicio = `${year}-01-01`;
  const fechaFin = `${year}-12-31`;

  for (const company of companies) {
    console.log(`\nProcessing: ${company.name} (${company.codEmpresa})`);

    try {
      // Run all queries in parallel
      const [plResult, cxcResult, cxpResult, cajaResult, gavResult] = await Promise.all([
        pool.request().query(QUERY_PL(company.claseIngreso, company.codEmpresa, fechaInicio, fechaFin)),
        pool.request().query(QUERY_CXC(company.codEmpresa)),
        pool.request().query(QUERY_CXP(company.codEmpresa)),
        pool.request().query(QUERY_CAJA(company.codEmpresa, fechaInicio, fechaFin)),
        pool.request().query(QUERY_GAV(company.codEmpresa, fechaInicio, fechaFin)),
      ]);

      console.log(`  P&L rows: ${plResult.recordset.length}`);
      console.log(`  CxC rows: ${cxcResult.recordset.length}`);
      console.log(`  CxP rows: ${cxpResult.recordset.length}`);
      console.log(`  Caja rows: ${cajaResult.recordset.length}`);
      console.log(`  GAV rows: ${gavResult.recordset.length}`);

      // Build payload
      const payload = {
        companyId: company.codEmpresa,
        companyName: company.name,
        claseIngreso: company.claseIngreso,
        year,
        data: {
          pl: plResult.recordset,
          cxc: cxcResult.recordset,
          cxp: cxpResult.recordset,
          caja: cajaResult.recordset,
          gav: gavResult.recordset,
        },
      };

      // POST to VPS
      const response = await fetch(`${CONFIG.VPS_URL}/api/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-key': CONFIG.SYNC_API_KEY,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`VPS returned ${response.status}: ${text}`);
      }

      const result = await response.json();
      console.log(`  ✓ Pushed to VPS — ${result.processed?.length || 0} KPI types saved`);

    } catch (err) {
      console.error(`  ✗ Error syncing ${company.name}: ${err.message}`);
    }
  }

  await pool.close();
  console.log('\nSync completed.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
