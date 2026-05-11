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
  S10_HOST: '192.168.1.51',
  S10_PORT: 1433,
  S10_USER: 'sa',
  S10_PASSWORD: 'Cmo$2017.',
  S10_DATABASE: 'CMO',

  VPS_URL: 'https://s10bizsmarthub.bizwareapps.com',
  SYNC_API_KEY: '1fe0bf01e872d7f586e4828abcdc1ba0a5283f5625570128',

  COMPANIES: [
    { codEmpresa: '22011489', name: 'CMO GROUP S.A.',                                               claseIngreso: '75' },
    { codEmpresa: '80688541', name: 'INTEGRAL CONSULTORES S.A.C.',                                  claseIngreso: '70' },
    { codEmpresa: '80688706', name: 'MEDARQ S.A.C.',                                                claseIngreso: '70' },
    { codEmpresa: '80688524', name: 'COMPAÑÍA AMERICANA DE CONSTRUCCIÓN Y EQUIPAMIENTO S.A.C.',     claseIngreso: '70' },
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
// QUERIES — P&L, CxC, CxP, Caja, GAV (existentes)
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

const QUERY_TRANSACTIONS = (claseIngreso, codEmpresa, fechaInicio, fechaFin) => `
SELECT
  ac.NroAsientoContable                                    AS NroAsiento,
  ac.NroD                                                  AS NroD,
  CONVERT(VARCHAR(10), ac.FechaAplicacionContable, 103)    AS Fecha,
  MONTH(ac.FechaAplicacionContable)                        AS Mes,
  LEFT(pcd.CodCuenta, 2)                                   AS Clase,
  pcd.CodCuenta                                            AS CodCuenta,
  ISNULL(ac.Glosa, '')                                     AS Glosa,
  ISNULL(ac.Debito, 0)                                     AS Debito,
  ISNULL(ac.Credito, 0)                                    AS Credito,
  ISNULL(i.Descripcion, '')                                AS Tercero
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
LEFT JOIN CMO.dbo.Identificador i
  ON ac.CodIdentificador = i.CodIdentificador
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND ac.FechaAplicacionContable BETWEEN '${fechaInicio}' AND '${fechaFin}'
  AND LEFT(pcd.CodCuenta, 2) IN ('${claseIngreso}', '91', '94', '97')
ORDER BY ac.FechaAplicacionContable, ac.NroAsientoContable
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

const QUERY_CXC_TRANSACTIONS = (codEmpresa, year) => `
SELECT
  ac.NroAsientoContable                                    AS NroAsiento,
  ac.NroD                                                  AS NroD,
  CONVERT(VARCHAR(10), ac.FechaAplicacionContable, 103)    AS Fecha,
  YEAR(ac.FechaAplicacionContable)                         AS Anio,
  MONTH(ac.FechaAplicacionContable)                        AS Mes,
  pcd.CodCuenta                                            AS CodCuenta,
  ISNULL(ac.Glosa, '')                                     AS Glosa,
  ISNULL(ac.Debito, 0)                                     AS Debito,
  ISNULL(ac.Credito, 0)                                    AS Credito,
  ISNULL(i.Descripcion, '')                                AS Tercero,
  ISNULL(CAST(ac.CodIdentificador AS VARCHAR(20)), '')     AS CodTercero
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
LEFT JOIN CMO.dbo.Identificador i
  ON ac.CodIdentificador = i.CodIdentificador
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND LEFT(pcd.CodCuenta, 2) = '12'
  AND YEAR(ac.FechaAplicacionContable) = ${year}
ORDER BY ac.FechaAplicacionContable DESC, ac.NroAsientoContable
`;

const QUERY_CXP_TRANSACTIONS = (codEmpresa, year) => `
SELECT
  ac.NroAsientoContable                                    AS NroAsiento,
  ac.NroD                                                  AS NroD,
  CONVERT(VARCHAR(10), ac.FechaAplicacionContable, 103)    AS Fecha,
  YEAR(ac.FechaAplicacionContable)                         AS Anio,
  MONTH(ac.FechaAplicacionContable)                        AS Mes,
  pcd.CodCuenta                                            AS CodCuenta,
  ISNULL(ac.Glosa, '')                                     AS Glosa,
  ISNULL(ac.Debito, 0)                                     AS Debito,
  ISNULL(ac.Credito, 0)                                    AS Credito,
  ISNULL(i.Descripcion, '')                                AS Tercero,
  ISNULL(CAST(ac.CodIdentificador AS VARCHAR(20)), '')     AS CodTercero
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
LEFT JOIN CMO.dbo.Identificador i
  ON ac.CodIdentificador = i.CodIdentificador
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND LEFT(pcd.CodCuenta, 2) = '42'
  AND YEAR(ac.FechaAplicacionContable) = ${year}
ORDER BY ac.FechaAplicacionContable DESC, ac.NroAsientoContable
`;

const TIPOS_EMITIDAS = `'060','125','128','131','134'`;
const TIPOS_RECIBIDAS = `'001','002','004','012','015','091','123','143','144'`;
const TIPOS_HONORARIOS = `'010'`;
const TIPOS_PRESTAMOS  = `'071'`;
const TIPOS_TRANSFERENCIAS = `'058'`;
const TIPOS_ANTICIPOS  = `'069','070'`;
const CLASES_COSTO = `'60','61','62','63','64','65','66','67','68','69','91','94'`;

const QUERY_FACTURAS_EMITIDAS = (codEmpresa, year, claseIngreso) => `
SELECT
  doc.NroD                                                   AS NroD,
  ISNULL(doc.SerieDocumento, '')                             AS Serie,
  ISNULL(doc.NumeroDocumento, '')                            AS Numero,
  CONVERT(VARCHAR(10), doc.FechaDocumento, 103)              AS FechaDocumento,
  CONVERT(VARCHAR(10), doc.FechaVencimiento, 103)            AS FechaVencimiento,
  ISNULL(doc.DescripcionTipoDocumento, '')                   AS TipoDocumento,
  ISNULL(doc.DescripcionIdentificador, '')                   AS Cliente,
  ISNULL(doc.RUC, '')                                        AS RucCliente,
  ISNULL(doc.TotalNeto, 0)                                   AS TotalNeto,
  ISNULL(doc.TotalImpuesto, 0)                               AS TotalImpuesto,
  ISNULL(doc.Total, 0)                                       AS Total,
  ISNULL(doc.TotalPagado, 0)                                 AS TotalPagado,
  doc.Total - ISNULL(doc.TotalPagado, 0)                     AS Saldo,
  ISNULL(doc.DescripcionEstado, '')                          AS Estado,
  ISNULL(doc.Observacion, '')                                AS Observacion,
  CASE WHEN ac_chk.NroD IS NULL THEN 1 ELSE 0 END           AS SinAsiento,
  CASE WHEN UPPER(ISNULL(doc.DescripcionTipoDocumento,'')) LIKE '%NOTA DE CR%' THEN 1 ELSE 0 END AS EsNotaCredito
FROM CMO.dbo.vw_12DocumentosPorCobrar doc
LEFT JOIN (
  SELECT DISTINCT ac.NroD
  FROM CMO.dbo.AsientoContable ac
  JOIN CMO.dbo.PlanContableDetalle pcd
    ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
  WHERE ac.CodEmpresa = '${codEmpresa}'
    AND LEFT(pcd.CodCuenta, 2) = '${claseIngreso}'
    AND ac.FechaAplicacionContable BETWEEN '${year}-01-01' AND '${year}-12-31'
) ac_chk ON ac_chk.NroD = doc.NroD
WHERE doc.CodEmpresa = '${codEmpresa}'
  AND YEAR(doc.FechaDocumento) = ${year}
  AND doc.CodTipoDocumento IN (${TIPOS_EMITIDAS})
ORDER BY SinAsiento DESC, doc.FechaDocumento DESC, doc.SerieDocumento, doc.NumeroDocumento
`;

const QUERY_FACTURAS_RECIBIDAS = (codEmpresa, year) => `
SELECT
  doc.NroD                                                   AS NroD,
  ISNULL(doc.SerieDocumento, '')                             AS Serie,
  ISNULL(doc.NumeroDocumento, '')                            AS Numero,
  CONVERT(VARCHAR(10), doc.FechaDocumento, 103)              AS FechaDocumento,
  CONVERT(VARCHAR(10), doc.FechaVencimiento, 103)            AS FechaVencimiento,
  ISNULL(doc.DescripcionTipoDocumento, '')                   AS TipoDocumento,
  ISNULL(doc.DescripcionIdentificador, '')                   AS Proveedor,
  ISNULL(doc.RUC, '')                                        AS RucProveedor,
  ISNULL(doc.TotalNeto, 0)                                   AS TotalNeto,
  ISNULL(doc.TotalImpuesto, 0)                               AS TotalImpuesto,
  ISNULL(doc.Total, 0)                                       AS Total,
  ISNULL(doc.TotalPagado, 0)                                 AS TotalPagado,
  doc.Total - ISNULL(doc.TotalPagado, 0)                     AS TotalSaldo,
  ISNULL(doc.DescripcionEstado, '')                          AS Estado,
  ISNULL(doc.DescripcionCategoria, '')                       AS Categoria,
  CASE WHEN ac_chk.NroD IS NULL THEN 1 ELSE 0 END           AS SinAsiento,
  CASE WHEN doc.CodTipoDocumento = '004' THEN 1 ELSE 0 END  AS EsNotaCredito
FROM CMO.dbo.vw_12DocumentosPorPagar doc
LEFT JOIN (
  SELECT DISTINCT ac.NroD
  FROM CMO.dbo.AsientoContable ac
  JOIN CMO.dbo.PlanContableDetalle pcd
    ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
  WHERE ac.CodEmpresa = '${codEmpresa}'
    AND LEFT(pcd.CodCuenta, 2) IN (${CLASES_COSTO})
    AND ac.FechaAplicacionContable BETWEEN '${year}-01-01' AND '${year}-12-31'
) ac_chk ON ac_chk.NroD = doc.NroD
WHERE doc.CodEmpresa = '${codEmpresa}'
  AND YEAR(doc.FechaDocumento) = ${year}
  AND doc.CodTipoDocumento IN (${TIPOS_RECIBIDAS})
ORDER BY SinAsiento DESC, doc.FechaDocumento DESC, doc.SerieDocumento, doc.NumeroDocumento
`;

const QUERY_HONORARIOS_RECIBIDOS = (codEmpresa, year) => `
SELECT
  doc.NroD                                                   AS NroD,
  ISNULL(doc.SerieDocumento, '')                             AS Serie,
  ISNULL(doc.NumeroDocumento, '')                            AS Numero,
  CONVERT(VARCHAR(10), doc.FechaDocumento, 103)              AS FechaDocumento,
  CONVERT(VARCHAR(10), doc.FechaVencimiento, 103)            AS FechaVencimiento,
  ISNULL(doc.DescripcionTipoDocumento, '')                   AS TipoDocumento,
  ISNULL(doc.DescripcionIdentificador, '')                   AS Proveedor,
  ISNULL(doc.RUC, '')                                        AS RucProveedor,
  ISNULL(doc.TotalNeto, 0)                                   AS TotalNeto,
  ISNULL(doc.TotalImpuesto, 0)                               AS TotalImpuesto,
  ISNULL(doc.Total, 0)                                       AS Total,
  ISNULL(doc.TotalPagado, 0)                                 AS TotalPagado,
  doc.Total - ISNULL(doc.TotalPagado, 0)                     AS TotalSaldo,
  ISNULL(doc.DescripcionEstado, '')                          AS Estado,
  ISNULL(doc.DescripcionCategoria, '')                       AS Categoria,
  CASE WHEN ac_chk.NroD IS NULL THEN 1 ELSE 0 END           AS SinAsiento
FROM CMO.dbo.vw_12DocumentosPorPagar doc
LEFT JOIN (
  SELECT DISTINCT ac.NroD
  FROM CMO.dbo.AsientoContable ac
  JOIN CMO.dbo.PlanContableDetalle pcd
    ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
  WHERE ac.CodEmpresa = '${codEmpresa}'
    AND LEFT(pcd.CodCuenta, 2) IN (${CLASES_COSTO})
    AND ac.FechaAplicacionContable BETWEEN '${year}-01-01' AND '${year}-12-31'
) ac_chk ON ac_chk.NroD = doc.NroD
WHERE doc.CodEmpresa = '${codEmpresa}'
  AND YEAR(doc.FechaDocumento) = ${year}
  AND doc.CodTipoDocumento IN (${TIPOS_HONORARIOS})
ORDER BY SinAsiento DESC, doc.FechaDocumento DESC, doc.SerieDocumento, doc.NumeroDocumento
`;

const QUERY_CXP = (codEmpresa) => `
SELECT
  ISNULL(i.Descripcion, CAST(ac.CodIdentificador AS VARCHAR))  AS Proveedor,
  ac.CodIdentificador                                           AS CodProveedor,
  SUM(ISNULL(ac.Credito,0)) - SUM(ISNULL(ac.Debito,0))        AS SaldoTotal,
  SUM(CASE WHEN ac.FechaAplicacionContable >= DATEADD(DAY,-30,GETDATE())
           THEN ISNULL(ac.Credito,0)-ISNULL(ac.Debito,0) ELSE 0 END) AS Dias_0_30,
  SUM(CASE WHEN ac.FechaAplicacionContable BETWEEN DATEADD(DAY,-60,GETDATE()) AND DATEADD(DAY,-31,GETDATE())
           THEN ISNULL(ac.Credito,0)-ISNULL(ac.Debito,0) ELSE 0 END) AS Dias_31_60,
  SUM(CASE WHEN ac.FechaAplicacionContable BETWEEN DATEADD(DAY,-90,GETDATE()) AND DATEADD(DAY,-61,GETDATE())
           THEN ISNULL(ac.Credito,0)-ISNULL(ac.Debito,0) ELSE 0 END) AS Dias_61_90,
  SUM(CASE WHEN ac.FechaAplicacionContable < DATEADD(DAY,-90,GETDATE())
           THEN ISNULL(ac.Credito,0)-ISNULL(ac.Debito,0) ELSE 0 END) AS Dias_90_mas
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
// QUERIES NUEVAS — Balance, Otras CxC/CxP, Tributos,
//   Activo Fijo, Préstamos, Auditoría, Gastos Naturaleza
// ─────────────────────────────────────────────

// Balance General: saldo acumulado histórico por subcuenta (todas las clases)
// Activo: DB > CR → saldo positivo. Pasivo/Patrimonio: CR > DB → saldo positivo (se invierte en frontend)
const QUERY_BALANCE = (codEmpresa) => `
SELECT
  LEFT(pcd.CodCuenta, 2)                           AS Clase,
  LEFT(pcd.CodCuenta, 4)                           AS GrupoCuenta,
  pcd.CodCuenta,
  pcd.Descripcion                                  AS DesCuenta,
  SUM(ISNULL(ac.Debito, 0))                        AS TotalDebito,
  SUM(ISNULL(ac.Credito, 0))                       AS TotalCredito,
  SUM(ISNULL(ac.Debito, 0)) - SUM(ISNULL(ac.Credito, 0)) AS SaldoNeto
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND LEFT(pcd.CodCuenta, 2) IN (
    '10','11','12','13','14','15','16','17','18','19',
    '20','21','22','23','24','25','26','27','28','29',
    '30','31','32','33','34','35','36','37','38','39',
    '40','41','42','43','44','45','46','47','48','49',
    '50','51','52','53','54','55','56','57','58','59'
  )
GROUP BY LEFT(pcd.CodCuenta,2), LEFT(pcd.CodCuenta,4), pcd.CodCuenta, pcd.Descripcion
HAVING ABS(SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0))) > 0.01
ORDER BY Clase, GrupoCuenta, pcd.CodCuenta
`;

// Otras CxC: clases 13 (cartera), 14 (entregas rendir), 16 (otras CxC), 17 (préstamos otorgados), 18 (arrendatarios)
// Incluye aging igual que clase 12 para uniformidad
const QUERY_OTRAS_CXC = (codEmpresa) => `
SELECT
  LEFT(pcd.CodCuenta, 2)                                   AS Clase,
  pcd.CodCuenta,
  pcd.Descripcion                                          AS DesCuenta,
  ISNULL(i.Descripcion, CAST(ac.CodIdentificador AS VARCHAR)) AS Tercero,
  ac.CodIdentificador                                       AS CodTercero,
  SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0))    AS SaldoTotal,
  SUM(CASE WHEN ac.FechaAplicacionContable >= DATEADD(DAY,-30,GETDATE())
           THEN ISNULL(ac.Debito,0)-ISNULL(ac.Credito,0) ELSE 0 END) AS Dias_0_30,
  SUM(CASE WHEN ac.FechaAplicacionContable BETWEEN DATEADD(DAY,-60,GETDATE()) AND DATEADD(DAY,-31,GETDATE())
           THEN ISNULL(ac.Debito,0)-ISNULL(ac.Credito,0) ELSE 0 END) AS Dias_31_60,
  SUM(CASE WHEN ac.FechaAplicacionContable BETWEEN DATEADD(DAY,-90,GETDATE()) AND DATEADD(DAY,-61,GETDATE())
           THEN ISNULL(ac.Debito,0)-ISNULL(ac.Credito,0) ELSE 0 END) AS Dias_61_90,
  SUM(CASE WHEN ac.FechaAplicacionContable < DATEADD(DAY,-90,GETDATE())
           THEN ISNULL(ac.Debito,0)-ISNULL(ac.Credito,0) ELSE 0 END) AS Dias_90_mas
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
LEFT JOIN CMO.dbo.Identificador i
  ON ac.CodIdentificador = i.CodIdentificador
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND LEFT(pcd.CodCuenta, 2) IN ('13','14','16','17','18')
GROUP BY LEFT(pcd.CodCuenta,2), pcd.CodCuenta, pcd.Descripcion, i.Descripcion, ac.CodIdentificador
HAVING ABS(SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0))) > 0.5
ORDER BY Clase, SaldoTotal DESC
`;

// Detalle de transacciones de Otras CxC para drilldown (últimos 2 años)
const QUERY_OTRAS_CXC_TXN = (codEmpresa, year) => `
SELECT
  ac.NroAsientoContable                                    AS NroAsiento,
  ac.NroD                                                  AS NroD,
  CONVERT(VARCHAR(10), ac.FechaAplicacionContable, 103)    AS Fecha,
  YEAR(ac.FechaAplicacionContable)                         AS Anio,
  MONTH(ac.FechaAplicacionContable)                        AS Mes,
  LEFT(pcd.CodCuenta, 2)                                   AS Clase,
  pcd.CodCuenta                                            AS CodCuenta,
  pcd.Descripcion                                          AS DesCuenta,
  ISNULL(ac.Glosa, '')                                     AS Glosa,
  ISNULL(ac.Debito, 0)                                     AS Debito,
  ISNULL(ac.Credito, 0)                                    AS Credito,
  ISNULL(i.Descripcion, '')                                AS Tercero,
  ISNULL(CAST(ac.CodIdentificador AS VARCHAR(20)), '')     AS CodTercero
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
LEFT JOIN CMO.dbo.Identificador i
  ON ac.CodIdentificador = i.CodIdentificador
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND LEFT(pcd.CodCuenta, 2) IN ('13','14','16','17','18')
  AND YEAR(ac.FechaAplicacionContable) = ${year}
ORDER BY ac.FechaAplicacionContable DESC, ac.NroAsientoContable
`;

// Otras CxP: clases 43 (fact. por pagar interco), 44 (otras CxP directores), 45 (leasing),
//            46 (otras CxP diversas/interco), 47 (préstamos recibidos/dividendos)
const QUERY_OTRAS_CXP = (codEmpresa) => `
SELECT
  LEFT(pcd.CodCuenta, 2)                                    AS Clase,
  pcd.CodCuenta,
  pcd.Descripcion                                           AS DesCuenta,
  ISNULL(i.Descripcion, CAST(ac.CodIdentificador AS VARCHAR)) AS Tercero,
  ac.CodIdentificador                                        AS CodTercero,
  SUM(ISNULL(ac.Credito,0)) - SUM(ISNULL(ac.Debito,0))     AS SaldoTotal,
  SUM(CASE WHEN ac.FechaAplicacionContable >= DATEADD(DAY,-30,GETDATE())
           THEN ISNULL(ac.Credito,0)-ISNULL(ac.Debito,0) ELSE 0 END) AS Dias_0_30,
  SUM(CASE WHEN ac.FechaAplicacionContable BETWEEN DATEADD(DAY,-60,GETDATE()) AND DATEADD(DAY,-31,GETDATE())
           THEN ISNULL(ac.Credito,0)-ISNULL(ac.Debito,0) ELSE 0 END) AS Dias_31_60,
  SUM(CASE WHEN ac.FechaAplicacionContable BETWEEN DATEADD(DAY,-90,GETDATE()) AND DATEADD(DAY,-61,GETDATE())
           THEN ISNULL(ac.Credito,0)-ISNULL(ac.Debito,0) ELSE 0 END) AS Dias_61_90,
  SUM(CASE WHEN ac.FechaAplicacionContable < DATEADD(DAY,-90,GETDATE())
           THEN ISNULL(ac.Credito,0)-ISNULL(ac.Debito,0) ELSE 0 END) AS Dias_90_mas
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
LEFT JOIN CMO.dbo.Identificador i
  ON ac.CodIdentificador = i.CodIdentificador
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND LEFT(pcd.CodCuenta, 2) IN ('43','44','45','46','47')
GROUP BY LEFT(pcd.CodCuenta,2), pcd.CodCuenta, pcd.Descripcion, i.Descripcion, ac.CodIdentificador
HAVING ABS(SUM(ISNULL(ac.Credito,0)) - SUM(ISNULL(ac.Debito,0))) > 0.5
ORDER BY Clase, SaldoTotal DESC
`;

// Detalle transacciones Otras CxP para drilldown (año de sync)
const QUERY_OTRAS_CXP_TXN = (codEmpresa, year) => `
SELECT
  ac.NroAsientoContable                                    AS NroAsiento,
  ac.NroD                                                  AS NroD,
  CONVERT(VARCHAR(10), ac.FechaAplicacionContable, 103)    AS Fecha,
  YEAR(ac.FechaAplicacionContable)                         AS Anio,
  MONTH(ac.FechaAplicacionContable)                        AS Mes,
  LEFT(pcd.CodCuenta, 2)                                   AS Clase,
  pcd.CodCuenta                                            AS CodCuenta,
  pcd.Descripcion                                          AS DesCuenta,
  ISNULL(ac.Glosa, '')                                     AS Glosa,
  ISNULL(ac.Debito, 0)                                     AS Debito,
  ISNULL(ac.Credito, 0)                                    AS Credito,
  ISNULL(i.Descripcion, '')                                AS Tercero,
  ISNULL(CAST(ac.CodIdentificador AS VARCHAR(20)), '')     AS CodTercero
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
LEFT JOIN CMO.dbo.Identificador i
  ON ac.CodIdentificador = i.CodIdentificador
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND LEFT(pcd.CodCuenta, 2) IN ('43','44','45','46','47')
  AND YEAR(ac.FechaAplicacionContable) = ${year}
ORDER BY ac.FechaAplicacionContable DESC, ac.NroAsientoContable
`;

// Tributos por pagar (clase 40): IGV, Renta, AFP, ONP, ESSALUD, etc.
// Muestra actividad del año (provisionado/pagado) + saldo histórico acumulado.
// HAVING incluye cuentas con actividad en el año o con saldo pendiente, evitando
// el problema de filtrado cuando el neto histórico acumulado es cero.
const QUERY_TRIBUTOS = (codEmpresa, year) => `
SELECT
  pcd.CodCuenta,
  pcd.Descripcion                                          AS DesTributo,
  SUM(ISNULL(ac.Credito,0)) - SUM(ISNULL(ac.Debito,0))   AS SaldoPorPagar,
  SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) = ${year}
      THEN ISNULL(ac.Credito,0) ELSE 0 END)               AS ProvisionadoAnio,
  SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) = ${year}
      THEN ISNULL(ac.Debito,0) ELSE 0 END)                AS PagadoAnio,
  SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) = ${year}
      THEN ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0) ELSE 0 END) AS SaldoAnio,
  MAX(ac.FechaAplicacionContable)                          AS UltimoMovimiento
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND LEFT(pcd.CodCuenta, 2) = '40'
GROUP BY pcd.CodCuenta, pcd.Descripcion
HAVING SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) = ${year}
           THEN ISNULL(ac.Credito,0) ELSE 0 END) > 0
   OR ABS(SUM(ISNULL(ac.Credito,0)) - SUM(ISNULL(ac.Debito,0))) > 0.5
ORDER BY SaldoPorPagar DESC, ProvisionadoAnio DESC
`;

// Detalle transacciones tributos para drilldown (año de sync)
const QUERY_TRIBUTOS_TXN = (codEmpresa, year) => `
SELECT
  ac.NroAsientoContable                                    AS NroAsiento,
  ac.NroD                                                  AS NroD,
  CONVERT(VARCHAR(10), ac.FechaAplicacionContable, 103)    AS Fecha,
  YEAR(ac.FechaAplicacionContable)                         AS Anio,
  MONTH(ac.FechaAplicacionContable)                        AS Mes,
  pcd.CodCuenta                                            AS CodCuenta,
  pcd.Descripcion                                          AS DesCuenta,
  ISNULL(ac.Glosa, '')                                     AS Glosa,
  ISNULL(ac.Debito, 0)                                     AS Debito,
  ISNULL(ac.Credito, 0)                                    AS Credito
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND LEFT(pcd.CodCuenta, 2) = '40'
  AND YEAR(ac.FechaAplicacionContable) = ${year}
ORDER BY ac.FechaAplicacionContable DESC, ac.NroAsientoContable
`;

// Obligaciones laborales (clase 41): CTS, remuneraciones por pagar, vacaciones
const QUERY_LABORAL = (codEmpresa) => `
SELECT
  pcd.CodCuenta,
  pcd.Descripcion                                          AS DesConcepto,
  SUM(ISNULL(ac.Credito,0)) - SUM(ISNULL(ac.Debito,0))   AS SaldoPorPagar,
  SUM(ISNULL(ac.Credito,0))                               AS TotalProvisionado,
  SUM(ISNULL(ac.Debito,0))                                AS TotalPagado,
  MAX(ac.FechaAplicacionContable)                          AS UltimoMovimiento
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND LEFT(pcd.CodCuenta, 2) = '41'
GROUP BY pcd.CodCuenta, pcd.Descripcion
HAVING ABS(SUM(ISNULL(ac.Credito,0)) - SUM(ISNULL(ac.Debito,0))) > 0.5
ORDER BY SaldoPorPagar DESC
`;

// Activo Fijo (clase 33) y Depreciación Acumulada (clase 39)
// CORRECCIÓN (mayo 2026): la versión anterior usaba REPLACE(33,39) que NO mapea
// la numeración real del PCG en S10 (33611→39137, 33621→39135, etc.).
// Esta versión devuelve ambas clases en filas separadas con su saldo natural.
// El backend agrega a nivel empresa: Valor Neto = Σ(clase 33) − Σ(clase 39).
const QUERY_ACTIVO_FIJO = (codEmpresa) => `
SELECT
  LEFT(pcd.CodCuenta, 2)                                   AS Clase,
  pcd.CodCuenta,
  pcd.Descripcion                                          AS DesActivo,
  COUNT(*)                                                  AS NumAsientos,
  ROUND(SUM(ISNULL(ac.Debito, 0)), 2)                      AS TotalDebito,
  ROUND(SUM(ISNULL(ac.Credito, 0)), 2)                     AS TotalCredito,
  -- Saldo en su naturaleza: clase 33 deudor (Db-Cr), clase 39 acreedor (Cr-Db)
  ROUND(
    CASE WHEN LEFT(pcd.CodCuenta, 2) = '33'
         THEN SUM(ISNULL(ac.Debito, 0)) - SUM(ISNULL(ac.Credito, 0))
         ELSE SUM(ISNULL(ac.Credito, 0)) - SUM(ISNULL(ac.Debito, 0))
    END, 2)                                                AS Saldo
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND LEFT(pcd.CodCuenta, 2) IN ('33', '39')
GROUP BY pcd.CodCuenta, pcd.Descripcion
HAVING ABS(SUM(ISNULL(ac.Debito, 0)) - SUM(ISNULL(ac.Credito, 0))) > 0.5
ORDER BY pcd.CodCuenta
`;

// Préstamos otorgados (docs tipo 071 emitidos) — todos los años, con estado de pago
const QUERY_PRESTAMOS_OTORGADOS = (codEmpresa) => `
SELECT
  doc.NroD,
  ISNULL(doc.SerieDocumento, '')                           AS Serie,
  ISNULL(doc.NumeroDocumento, '')                          AS Numero,
  CONVERT(VARCHAR(10), doc.FechaDocumento, 103)            AS FechaDocumento,
  CONVERT(VARCHAR(10), doc.FechaVencimiento, 103)          AS FechaVencimiento,
  ISNULL(doc.DescripcionIdentificador, '')                 AS Beneficiario,
  ISNULL(doc.RUC, '')                                      AS RucBeneficiario,
  ISNULL(doc.Total, 0)                                     AS Monto,
  ISNULL(doc.TotalPagado, 0)                               AS MontoPagado,
  doc.Total - ISNULL(doc.TotalPagado, 0)                   AS SaldoPendiente,
  ISNULL(doc.DescripcionEstado, '')                        AS Estado,
  ISNULL(doc.Observacion, '')                              AS Observacion,
  YEAR(doc.FechaDocumento)                                 AS Anio,
  DATEDIFF(DAY, doc.FechaVencimiento, GETDATE())           AS DiasVencido
FROM CMO.dbo.vw_12DocumentosPorCobrar doc
WHERE doc.CodEmpresa = '${codEmpresa}'
  AND doc.CodTipoDocumento IN (${TIPOS_PRESTAMOS})
ORDER BY doc.FechaDocumento DESC
`;

// Préstamos recibidos (docs tipo 071 en CxP) — todos los años
const QUERY_PRESTAMOS_RECIBIDOS = (codEmpresa) => `
SELECT
  doc.NroD,
  ISNULL(doc.SerieDocumento, '')                           AS Serie,
  ISNULL(doc.NumeroDocumento, '')                          AS Numero,
  CONVERT(VARCHAR(10), doc.FechaDocumento, 103)            AS FechaDocumento,
  CONVERT(VARCHAR(10), doc.FechaVencimiento, 103)          AS FechaVencimiento,
  ISNULL(doc.DescripcionIdentificador, '')                 AS Prestamista,
  ISNULL(doc.RUC, '')                                      AS RucPrestamista,
  ISNULL(doc.Total, 0)                                     AS Monto,
  ISNULL(doc.TotalPagado, 0)                               AS MontoPagado,
  doc.Total - ISNULL(doc.TotalPagado, 0)                   AS SaldoPendiente,
  ISNULL(doc.DescripcionEstado, '')                        AS Estado,
  ISNULL(doc.Observacion, '')                              AS Observacion,
  YEAR(doc.FechaDocumento)                                 AS Anio,
  DATEDIFF(DAY, doc.FechaVencimiento, GETDATE())           AS DiasVencido
FROM CMO.dbo.vw_12DocumentosPorPagar doc
WHERE doc.CodEmpresa = '${codEmpresa}'
  AND doc.CodTipoDocumento IN (${TIPOS_PRESTAMOS})
ORDER BY doc.FechaDocumento DESC
`;

// Transferencias intercompany (tipo 058) en CxC y CxP
const QUERY_TRANSFERENCIAS = (codEmpresa) => `
SELECT
  'emitida'                                                AS Direccion,
  doc.NroD,
  CONVERT(VARCHAR(10), doc.FechaDocumento, 103)            AS FechaDocumento,
  ISNULL(doc.DescripcionIdentificador, '')                 AS Contraparte,
  ISNULL(doc.Total, 0)                                     AS Monto,
  ISNULL(doc.TotalPagado, 0)                               AS MontoPagado,
  doc.Total - ISNULL(doc.TotalPagado, 0)                   AS Saldo,
  ISNULL(doc.DescripcionEstado, '')                        AS Estado,
  YEAR(doc.FechaDocumento)                                 AS Anio
FROM CMO.dbo.vw_12DocumentosPorCobrar doc
WHERE doc.CodEmpresa = '${codEmpresa}'
  AND doc.CodTipoDocumento IN (${TIPOS_TRANSFERENCIAS})
UNION ALL
SELECT
  'recibida'                                               AS Direccion,
  doc.NroD,
  CONVERT(VARCHAR(10), doc.FechaDocumento, 103)            AS FechaDocumento,
  ISNULL(doc.DescripcionIdentificador, '')                 AS Contraparte,
  ISNULL(doc.Total, 0)                                     AS Monto,
  ISNULL(doc.TotalPagado, 0)                               AS MontoPagado,
  doc.Total - ISNULL(doc.TotalPagado, 0)                   AS Saldo,
  ISNULL(doc.DescripcionEstado, '')                        AS Estado,
  YEAR(doc.FechaDocumento)                                 AS Anio
FROM CMO.dbo.vw_12DocumentosPorPagar doc
WHERE doc.CodEmpresa = '${codEmpresa}'
  AND doc.CodTipoDocumento IN (${TIPOS_TRANSFERENCIAS})
ORDER BY FechaDocumento DESC
`;

// Gastos por naturaleza (clases 60-68) por mes — flujo del año
const QUERY_GASTOS_NATURALEZA = (codEmpresa, fechaInicio, fechaFin) => `
SELECT
  LEFT(pcd.CodCuenta, 2)                                   AS Clase,
  LEFT(pcd.CodCuenta, 4)                                   AS GrupoCuenta,
  pcd.CodCuenta,
  pcd.Descripcion                                          AS DesCuenta,
  MONTH(ac.FechaAplicacionContable)                        AS Mes,
  SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0))    AS Monto
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND ac.FechaAplicacionContable BETWEEN '${fechaInicio}' AND '${fechaFin}'
  AND LEFT(pcd.CodCuenta, 2) IN ('60','61','62','63','64','65','66','67','68')
GROUP BY LEFT(pcd.CodCuenta,2), LEFT(pcd.CodCuenta,4), pcd.CodCuenta, pcd.Descripcion, MONTH(ac.FechaAplicacionContable)
HAVING ABS(SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0))) > 0.01
ORDER BY Clase, GrupoCuenta, pcd.CodCuenta, Mes
`;

// Saldos bancarios acumulados (clase 10) — histórico por subcuenta
const QUERY_CAJA_SALDOS = (codEmpresa) => `
SELECT
  pcd.CodCuenta                                            AS CodBanco,
  pcd.Descripcion                                          AS DesBanco,
  SUM(ISNULL(ac.Debito,0))                                 AS TotalDebito,
  SUM(ISNULL(ac.Credito,0))                                AS TotalCredito,
  SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0))    AS SaldoActual,
  MAX(ac.FechaAplicacionContable)                          AS UltimoMovimiento,
  COUNT(*)                                                  AS NumAsientos,
  SUM(CASE WHEN ac.NroD IS NULL THEN 1 ELSE 0 END)         AS SinDocumento
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND LEFT(pcd.CodCuenta, 2) = '10'
GROUP BY pcd.CodCuenta, pcd.Descripcion
ORDER BY ABS(SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0))) DESC
`;

// Transacciones bancarias detalle para drilldown (año de sync, clase 10)
const QUERY_CAJA_TXN = (codEmpresa, year) => `
SELECT
  ac.NroAsientoContable                                    AS NroAsiento,
  ac.NroD                                                  AS NroD,
  CONVERT(VARCHAR(10), ac.FechaAplicacionContable, 103)    AS Fecha,
  YEAR(ac.FechaAplicacionContable)                         AS Anio,
  MONTH(ac.FechaAplicacionContable)                        AS Mes,
  pcd.CodCuenta                                            AS CodBanco,
  pcd.Descripcion                                          AS DesBanco,
  ISNULL(ac.Glosa, '')                                     AS Glosa,
  ISNULL(ac.Debito, 0)                                     AS Debito,
  ISNULL(ac.Credito, 0)                                    AS Credito,
  ISNULL(i.Descripcion, '')                                AS Tercero,
  CASE WHEN ac.NroD IS NULL THEN 1 ELSE 0 END              AS SinDocumento
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
LEFT JOIN CMO.dbo.Identificador i
  ON ac.CodIdentificador = i.CodIdentificador
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND LEFT(pcd.CodCuenta, 2) = '10'
  AND YEAR(ac.FechaAplicacionContable) = ${year}
ORDER BY ac.FechaAplicacionContable DESC, ac.NroAsientoContable
`;

// Auditoría: asientos sin NroD por clase (año en curso)
const QUERY_AUDIT_SIN_DOC = (codEmpresa, fechaInicio, fechaFin) => `
SELECT
  LEFT(pcd.CodCuenta, 2)                                   AS Clase,
  LEFT(MIN(pcd.Descripcion), 50)                           AS DescClase,
  COUNT(*)                                                  AS TotalAsientos,
  SUM(CASE WHEN ac.NroD IS NULL THEN 1 ELSE 0 END)         AS SinDocumento,
  SUM(CASE WHEN ac.NroD IS NOT NULL THEN 1 ELSE 0 END)     AS ConDocumento,
  SUM(CASE WHEN ac.NroD IS NULL THEN ABS(ISNULL(ac.Debito,0)-ISNULL(ac.Credito,0)) ELSE 0 END) AS MontoSinDoc
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND ac.FechaAplicacionContable BETWEEN '${fechaInicio}' AND '${fechaFin}'
  AND LEFT(pcd.CodCuenta, 2) IN ('10','12','13','14','16','17','40','41','42','43','46','70','75','91','94')
GROUP BY LEFT(pcd.CodCuenta, 2)
ORDER BY SinDocumento DESC
`;

// Auditoría: detalle de asientos sin NroD (año en curso)
const QUERY_AUDIT_SIN_DOC_TXN = (codEmpresa, fechaInicio, fechaFin) => `
SELECT
  ac.NroAsientoContable                                    AS NroAsiento,
  CONVERT(VARCHAR(10), ac.FechaAplicacionContable, 103)    AS Fecha,
  LEFT(pcd.CodCuenta, 2)                                   AS Clase,
  pcd.CodCuenta                                            AS CodCuenta,
  pcd.Descripcion                                          AS DesCuenta,
  ISNULL(ac.Glosa, '')                                     AS Glosa,
  ISNULL(ac.Debito, 0)                                     AS Debito,
  ISNULL(ac.Credito, 0)                                    AS Credito,
  ABS(ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0))         AS Monto,
  ISNULL(i.Descripcion, '')                                AS Tercero
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
LEFT JOIN CMO.dbo.Identificador i
  ON ac.CodIdentificador = i.CodIdentificador
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND ac.FechaAplicacionContable BETWEEN '${fechaInicio}' AND '${fechaFin}'
  AND ac.NroD IS NULL
  AND LEFT(pcd.CodCuenta, 2) IN ('10','12','13','14','16','17','40','41','42','43','46','70','75','91','94')
ORDER BY ABS(ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0)) DESC
`;

// Auditoría: documentos con contabilización desbalanceada.
// Agrupa por NroD (documento fuente), no por UUID de línea. Detecta documentos
// donde la suma de débitos ≠ suma de créditos en todos sus asientos, lo que
// indica una contabilización incompleta o con error de monto.
const QUERY_AUDIT_DESCUADRES = (codEmpresa, fechaInicio, fechaFin) => `
SELECT
  ac.NroD,
  MIN(CONVERT(VARCHAR(10), ac.FechaAplicacionContable, 103)) AS Fecha,
  COUNT(*)                                                  AS Lineas,
  COUNT(DISTINCT LEFT(pcd.CodCuenta,2))                    AS Clases,
  SUM(ISNULL(ac.Debito,0))                                 AS TotalDebito,
  SUM(ISNULL(ac.Credito,0))                                AS TotalCredito,
  ABS(SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0))) AS Descuadre,
  LEFT(MAX(ISNULL(ac.Glosa,'')), 60)                       AS Glosa,
  MAX(ISNULL(i.Descripcion,''))                            AS Tercero
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
LEFT JOIN CMO.dbo.Identificador i
  ON ac.CodIdentificador = i.CodIdentificador
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND ac.FechaAplicacionContable BETWEEN '${fechaInicio}' AND '${fechaFin}'
  AND ac.NroD IS NOT NULL
GROUP BY ac.NroD
HAVING ABS(SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0))) > 1
ORDER BY Descuadre DESC
`;

// Auditoría: movimientos atípicos >100K en una línea
const QUERY_AUDIT_ATIPICOS = (codEmpresa, fechaInicio, fechaFin) => `
SELECT
  ac.NroAsientoContable                                    AS NroAsiento,
  ac.NroD                                                  AS NroD,
  CONVERT(VARCHAR(10), ac.FechaAplicacionContable, 103)    AS Fecha,
  LEFT(pcd.CodCuenta, 2)                                   AS Clase,
  pcd.CodCuenta                                            AS CodCuenta,
  pcd.Descripcion                                          AS DesCuenta,
  ISNULL(ac.Glosa, '')                                     AS Glosa,
  ISNULL(ac.Debito, 0)                                     AS Debito,
  ISNULL(ac.Credito, 0)                                    AS Credito,
  CASE WHEN ISNULL(ac.Debito,0) >= ISNULL(ac.Credito,0)
       THEN ISNULL(ac.Debito,0)
       ELSE ISNULL(ac.Credito,0)
  END                                                      AS Monto,
  ISNULL(i.Descripcion, '')                                AS Tercero,
  CASE WHEN ac.NroD IS NULL THEN 1 ELSE 0 END              AS SinDocumento
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
LEFT JOIN CMO.dbo.Identificador i
  ON ac.CodIdentificador = i.CodIdentificador
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND ac.FechaAplicacionContable BETWEEN '${fechaInicio}' AND '${fechaFin}'
  AND (ISNULL(ac.Debito,0) > 100000 OR ISNULL(ac.Credito,0) > 100000)
  AND ISNULL(ac.Glosa,'') NOT LIKE '%Apertura%'
  AND ISNULL(ac.Glosa,'') NOT LIKE '%Cierre%'
ORDER BY CASE WHEN ISNULL(ac.Debito,0) >= ISNULL(ac.Credito,0)
              THEN ISNULL(ac.Debito,0) ELSE ISNULL(ac.Credito,0) END DESC
`;

// Auditoría: conciliación ingresos contables vs documentos emitidos por mes
const QUERY_AUDIT_CONCILIACION = (codEmpresa, claseIngreso, fechaInicio, fechaFin, year) => `
SELECT
  m.Mes,
  ISNULL(ing.IngresosContables, 0)                         AS IngresosContables,
  ISNULL(fac.FacturasEmitidas, 0)                          AS FacturasEmitidas,
  ISNULL(fac.NotasCredito, 0)                              AS NotasCredito,
  ISNULL(fac.FacturasEmitidas, 0) - ISNULL(fac.NotasCredito, 0) AS NetoDocumentos,
  ISNULL(ing.IngresosContables, 0) -
    (ISNULL(fac.FacturasEmitidas, 0) - ISNULL(fac.NotasCredito, 0)) AS Diferencia
FROM (
  SELECT 1 AS Mes UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
  UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8
  UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
) m
LEFT JOIN (
  SELECT MONTH(ac.FechaAplicacionContable) AS Mes,
         SUM(ISNULL(ac.Credito,0)) - SUM(ISNULL(ac.Debito,0)) AS IngresosContables
  FROM CMO.dbo.AsientoContable ac
  JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
  WHERE ac.CodEmpresa = '${codEmpresa}'
    AND ac.FechaAplicacionContable BETWEEN '${fechaInicio}' AND '${fechaFin}'
    AND LEFT(pcd.CodCuenta, 2) = '${claseIngreso}'
    AND ac.NroD IS NOT NULL
  GROUP BY MONTH(ac.FechaAplicacionContable)
) ing ON ing.Mes = m.Mes
LEFT JOIN (
  SELECT MONTH(doc.FechaDocumento) AS Mes,
         SUM(CASE WHEN doc.CodTipoDocumento NOT IN ('128','134') THEN ISNULL(doc.Total,0) ELSE 0 END) AS FacturasEmitidas,
         SUM(CASE WHEN doc.CodTipoDocumento IN ('128','134') THEN ISNULL(doc.Total,0) ELSE 0 END) AS NotasCredito
  FROM CMO.dbo.vw_12DocumentosPorCobrar doc
  WHERE doc.CodEmpresa = '${codEmpresa}'
    AND YEAR(doc.FechaDocumento) = ${year}
    AND doc.CodTipoDocumento IN (${TIPOS_EMITIDAS})
  GROUP BY MONTH(doc.FechaDocumento)
) fac ON fac.Mes = m.Mes
WHERE m.Mes <= MONTH(GETDATE())
ORDER BY m.Mes
`;

// ─────────────────────────────────────────────
// QUERIES NUEVAS — Patrimonio, Inventarios, Laboral TXN, Tesorería
// ─────────────────────────────────────────────

// Patrimonio neto: clases 50-59 (capital, reservas, resultados acumulados)
const QUERY_PATRIMONIO = (codEmpresa) => `
SELECT
  LEFT(pcd.CodCuenta, 2)                                   AS Clase,
  LEFT(pcd.CodCuenta, 4)                                   AS GrupoCuenta,
  pcd.CodCuenta,
  pcd.Descripcion                                          AS DesCuenta,
  SUM(ISNULL(ac.Debito, 0))                                AS TotalDebito,
  SUM(ISNULL(ac.Credito, 0))                               AS TotalCredito,
  SUM(ISNULL(ac.Credito, 0)) - SUM(ISNULL(ac.Debito, 0))  AS SaldoNeto
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND LEFT(pcd.CodCuenta, 2) IN ('50','51','52','53','54','55','56','57','58','59')
GROUP BY LEFT(pcd.CodCuenta,2), LEFT(pcd.CodCuenta,4), pcd.CodCuenta, pcd.Descripcion
HAVING ABS(SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0))) > 0.01
ORDER BY Clase, GrupoCuenta, pcd.CodCuenta
`;

// Inventarios y existencias: clases 20-29 con saldo histórico y movimiento del año
const QUERY_INVENTARIOS = (codEmpresa, year) => `
SELECT
  LEFT(pcd.CodCuenta, 2)                                   AS Clase,
  LEFT(pcd.CodCuenta, 4)                                   AS GrupoCuenta,
  pcd.CodCuenta,
  pcd.Descripcion                                          AS DesCuenta,
  SUM(ISNULL(ac.Debito, 0)) - SUM(ISNULL(ac.Credito, 0))  AS SaldoHistorico,
  SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) = ${year}
      THEN ISNULL(ac.Debito,0) ELSE 0 END)                 AS IngresoAnio,
  SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) = ${year}
      THEN ISNULL(ac.Credito,0) ELSE 0 END)                AS SalidaAnio,
  MAX(ac.FechaAplicacionContable)                          AS UltimoMovimiento
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND LEFT(pcd.CodCuenta, 2) IN ('20','21','22','23','24','25','26','27','28','29')
GROUP BY LEFT(pcd.CodCuenta,2), LEFT(pcd.CodCuenta,4), pcd.CodCuenta, pcd.Descripcion
HAVING ABS(SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0))) > 0.01
   OR SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) = ${year}
         THEN ISNULL(ac.Debito,0) + ISNULL(ac.Credito,0) ELSE 0 END) > 0.01
ORDER BY Clase, GrupoCuenta, pcd.CodCuenta
`;

// Detalle transacciones laborales (clase 41) para drilldown
const QUERY_LABORAL_TXN = (codEmpresa, year) => `
SELECT
  ac.NroAsientoContable                                    AS NroAsiento,
  ac.NroD                                                  AS NroD,
  CONVERT(VARCHAR(10), ac.FechaAplicacionContable, 103)    AS Fecha,
  YEAR(ac.FechaAplicacionContable)                         AS Anio,
  MONTH(ac.FechaAplicacionContable)                        AS Mes,
  pcd.CodCuenta                                            AS CodCuenta,
  pcd.Descripcion                                          AS DesCuenta,
  ISNULL(ac.Glosa, '')                                     AS Glosa,
  ISNULL(ac.Debito, 0)                                     AS Debito,
  ISNULL(ac.Credito, 0)                                    AS Credito,
  ISNULL(i.Descripcion, '')                                AS Tercero
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
LEFT JOIN CMO.dbo.Identificador i
  ON ac.CodIdentificador = i.CodIdentificador
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND LEFT(pcd.CodCuenta, 2) = '41'
  AND YEAR(ac.FechaAplicacionContable) = ${year}
ORDER BY ac.FechaAplicacionContable DESC, ac.NroAsientoContable
`;

// OB_CuentaBancoPeriodo: saldos iniciales bancarios reales según el módulo
// de conciliación bancaria de S10 (paralelo a AsientoContable).
// Permite distinguir saldo contable (caja_saldos) vs saldo bancario real (BalanceReal)
// y detectar inconsistencias entre el libro y el extracto bancario.
// Solo último período por cuenta para evitar duplicación.
const QUERY_OB_SALDOS_BANCO = (codEmpresa, year) => `
WITH UltimoPeriodo AS (
  SELECT cbp.BankAccount_ID, cbp.SaldoInicial, cbp.SaldoAnterior, cbp.Saldo, cbp.NroPeriodoContable,
         ROW_NUMBER() OVER (PARTITION BY cbp.BankAccount_ID ORDER BY cbp.NroPeriodoContable DESC) AS rn
  FROM CMO.dbo.OB_CuentaBancoPeriodo cbp
)
SELECT
  cb.BankAccount_ID                                        AS BankAccountId,
  cb.NoCuenta                                              AS NoCuenta,
  LEFT(cb.Descripcion, 80)                                 AS DesBanco,
  cb.CodMoneda                                             AS Moneda,
  cb.CodIdentificador                                      AS CodIdentificador,
  ROUND(ISNULL(cb.BalanceActual, 0), 2)                    AS BalanceActual,
  ROUND(ISNULL(cb.BalanceReal, 0), 2)                      AS BalanceReal,
  ROUND(ISNULL(cb.BalanceBanco, 0), 2)                     AS BalanceBanco,
  ROUND(ISNULL(cb.LimiteCredito, 0), 2)                    AS LimiteCredito,
  ROUND(ISNULL(up.SaldoInicial, 0), 2)                     AS SaldoInicialPeriodo,
  ROUND(ISNULL(up.SaldoAnterior, 0), 2)                    AS SaldoAnterior,
  ROUND(ISNULL(up.Saldo, 0), 2)                            AS SaldoPeriodo,
  up.NroPeriodoContable                                    AS NroPeriodoContable,
  cb.Activo                                                AS Activo
FROM CMO.dbo.OB_CuentaBanco cb
LEFT JOIN UltimoPeriodo up
  ON cb.BankAccount_ID = up.BankAccount_ID AND up.rn = 1
WHERE cb.CodIdentificador = '${codEmpresa}'
  AND cb.Activo = 1
ORDER BY ABS(ISNULL(cb.BalanceActual, 0)) DESC
`;

// Tesorería: posición bancaria con saldo inicial, entradas/salidas del año y saldo final.
// Muestra la posición real de cada cuenta bancaria con apertura y cierre del período.
const QUERY_TESORERIA = (codEmpresa, year) => `
SELECT
  pcd.CodCuenta                                            AS CodBanco,
  pcd.Descripcion                                          AS DesBanco,
  SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) < ${year}
      THEN ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0) ELSE 0 END)  AS SaldoInicial,
  SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) = ${year}
      THEN ISNULL(ac.Debito,0) ELSE 0 END)                AS EntradasAnio,
  SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) = ${year}
      THEN ISNULL(ac.Credito,0) ELSE 0 END)               AS SalidasAnio,
  SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0))   AS SaldoFinal,
  MAX(ac.FechaAplicacionContable)                          AS UltimoMovimiento,
  COUNT(CASE WHEN YEAR(ac.FechaAplicacionContable) = ${year} THEN 1 END) AS MovimientosAnio,
  SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) = ${year}
      AND ac.NroD IS NULL THEN 1 ELSE 0 END)              AS SinDocumentoAnio
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND LEFT(pcd.CodCuenta, 2) = '10'
GROUP BY pcd.CodCuenta, pcd.Descripcion
HAVING ABS(SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0))) > 0.01
   OR COUNT(CASE WHEN YEAR(ac.FechaAplicacionContable) = ${year} THEN 1 END) > 0
ORDER BY ABS(SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0))) DESC
`;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function markDups(rows) {
  const count = new Map();
  for (const row of rows) count.set(row.NroD, (count.get(row.NroD) || 0) + 1);
  return rows.map(row => ({ ...row, EsDuplicado: count.get(row.NroD) > 1 ? 1 : 0 }));
}

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
    requestTimeout: 300000,
  }).connect();

  console.log('✓ Connected to S10 SQL Server');

  const fechaInicio = `${year}-01-01`;
  const fechaFin = new Date().toISOString().slice(0, 10);

  for (const company of companies) {
    console.log(`\nProcessing: ${company.name} (${company.codEmpresa})`);

    try {
      // Batch 1 — queries existentes (P&L, CxC, CxP, Caja, GAV, transacciones, documentos)
      console.log('  → Batch 1: P&L, CxC, CxP, Caja, GAV, documentos...');
      const [
        plResult, cxcResult, cxpResult, cajaResult, gavResult,
        txResult, cxcTxResult, cxpTxResult,
        emitResult, reciResult, honorResult,
      ] = await Promise.all([
        pool.request().query(QUERY_PL(company.claseIngreso, company.codEmpresa, fechaInicio, fechaFin)),
        pool.request().query(QUERY_CXC(company.codEmpresa)),
        pool.request().query(QUERY_CXP(company.codEmpresa)),
        pool.request().query(QUERY_CAJA(company.codEmpresa, fechaInicio, fechaFin)),
        pool.request().query(QUERY_GAV(company.codEmpresa, fechaInicio, fechaFin)),
        pool.request().query(QUERY_TRANSACTIONS(company.claseIngreso, company.codEmpresa, fechaInicio, fechaFin)),
        pool.request().query(QUERY_CXC_TRANSACTIONS(company.codEmpresa, year)),
        pool.request().query(QUERY_CXP_TRANSACTIONS(company.codEmpresa, year)),
        pool.request().query(QUERY_FACTURAS_EMITIDAS(company.codEmpresa, year, company.claseIngreso)),
        pool.request().query(QUERY_FACTURAS_RECIBIDAS(company.codEmpresa, year)),
        pool.request().query(QUERY_HONORARIOS_RECIBIDOS(company.codEmpresa, year)),
      ]);

      // Batch 2 — módulos nuevos: Balance, Otras CxC/CxP, Tributos, Laboral, Activo Fijo,
      //           Patrimonio, Inventarios
      console.log('  → Batch 2: Balance, Otras CxC/CxP, Tributos, Activo Fijo, Patrimonio, Inventarios...');
      const [
        balanceResult, otrasCxcResult, otrasCxcTxnResult,
        otrasCxpResult, otrasCxpTxnResult,
        tributosResult, tributosTxnResult,
        laboralResult, laboralTxnResult,
        activoFijoResult,
        patrimonioResult, inventariosResult,
      ] = await Promise.all([
        pool.request().query(QUERY_BALANCE(company.codEmpresa)),
        pool.request().query(QUERY_OTRAS_CXC(company.codEmpresa)),
        pool.request().query(QUERY_OTRAS_CXC_TXN(company.codEmpresa, year)),
        pool.request().query(QUERY_OTRAS_CXP(company.codEmpresa)),
        pool.request().query(QUERY_OTRAS_CXP_TXN(company.codEmpresa, year)),
        pool.request().query(QUERY_TRIBUTOS(company.codEmpresa, year)),
        pool.request().query(QUERY_TRIBUTOS_TXN(company.codEmpresa, year)),
        pool.request().query(QUERY_LABORAL(company.codEmpresa)),
        pool.request().query(QUERY_LABORAL_TXN(company.codEmpresa, year)),
        pool.request().query(QUERY_ACTIVO_FIJO(company.codEmpresa)),
        pool.request().query(QUERY_PATRIMONIO(company.codEmpresa)),
        pool.request().query(QUERY_INVENTARIOS(company.codEmpresa, year)),
      ]);

      // Batch 3 — Préstamos, Transferencias, Caja saldos/detalle, Gastos naturaleza,
      //           Tesorería, Auditoría
      console.log('  → Batch 3: Préstamos, Transferencias, Caja, Tesorería, Gastos, Auditoría...');
      const [
        prestamosOtorgResult, prestamosReciResult, transferenciasResult,
        cajaSaldosResult, cajaTxnResult,
        tesoreriaResult, obSaldosBancoResult,
        gastosNatResult,
        auditSinDocResult, auditSinDocTxnResult,
        auditDescuadresResult, auditAtipicosResult,
        auditConciliacionResult,
      ] = await Promise.all([
        pool.request().query(QUERY_PRESTAMOS_OTORGADOS(company.codEmpresa)),
        pool.request().query(QUERY_PRESTAMOS_RECIBIDOS(company.codEmpresa)),
        pool.request().query(QUERY_TRANSFERENCIAS(company.codEmpresa)),
        pool.request().query(QUERY_CAJA_SALDOS(company.codEmpresa)),
        pool.request().query(QUERY_CAJA_TXN(company.codEmpresa, year)),
        pool.request().query(QUERY_TESORERIA(company.codEmpresa, year)),
        pool.request().query(QUERY_OB_SALDOS_BANCO(company.codEmpresa, year)),
        pool.request().query(QUERY_GASTOS_NATURALEZA(company.codEmpresa, fechaInicio, fechaFin)),
        pool.request().query(QUERY_AUDIT_SIN_DOC(company.codEmpresa, fechaInicio, fechaFin)),
        pool.request().query(QUERY_AUDIT_SIN_DOC_TXN(company.codEmpresa, fechaInicio, fechaFin)),
        pool.request().query(QUERY_AUDIT_DESCUADRES(company.codEmpresa, fechaInicio, fechaFin)),
        pool.request().query(QUERY_AUDIT_ATIPICOS(company.codEmpresa, fechaInicio, fechaFin)),
        pool.request().query(QUERY_AUDIT_CONCILIACION(company.codEmpresa, company.claseIngreso, fechaInicio, fechaFin, year)),
      ]);

      const emitidas   = markDups(emitResult.recordset);
      const recibidas  = markDups(reciResult.recordset);
      const honorarios = markDups(honorResult.recordset);

      // Log resumen
      const logRow = (label, rows) => console.log(`  ${label}: ${rows.length}`);
      logRow('P&L rows', plResult.recordset);
      logRow('CxC', cxcResult.recordset);
      logRow('CxP', cxpResult.recordset);
      logRow('Transacciones', txResult.recordset);
      logRow('Facturas emitidas', emitidas);
      logRow('Balance cuentas', balanceResult.recordset);
      logRow('Otras CxC', otrasCxcResult.recordset);
      logRow('Otras CxP', otrasCxpResult.recordset);
      logRow('Tributos', tributosResult.recordset);
      logRow('Activo Fijo', activoFijoResult.recordset);
      logRow('Patrimonio', patrimonioResult.recordset);
      logRow('Inventarios', inventariosResult.recordset);
      logRow('Laboral TXN', laboralTxnResult.recordset);
      logRow('Tesorería', tesoreriaResult.recordset);
      logRow('OB Saldos Banco', obSaldosBancoResult.recordset);
      logRow('Préstamos otorgados', prestamosOtorgResult.recordset);
      logRow('Préstamos recibidos', prestamosReciResult.recordset);
      logRow('Transferencias', transferenciasResult.recordset);
      logRow('Caja saldos', cajaSaldosResult.recordset);
      logRow('Gastos naturaleza', gastosNatResult.recordset);
      logRow('Audit sin doc (clases)', auditSinDocResult.recordset);
      logRow('Audit descuadres', auditDescuadresResult.recordset);
      logRow('Audit atípicos', auditAtipicosResult.recordset);

      // Build payload
      const payload = {
        companyId: company.codEmpresa,
        companyName: company.name,
        claseIngreso: company.claseIngreso,
        year,
        data: {
          // Existentes
          pl: plResult.recordset,
          cxc: cxcResult.recordset,
          cxp: cxpResult.recordset,
          caja: cajaResult.recordset,
          gav: gavResult.recordset,
          transactions: txResult.recordset,
          cxc_transactions: cxcTxResult.recordset,
          cxp_transactions: cxpTxResult.recordset,
          facturas_emitidas: emitidas,
          facturas_recibidas: recibidas,
          honorarios_recibidos: honorarios,
          // Nuevos
          balance: balanceResult.recordset,
          otras_cxc: otrasCxcResult.recordset,
          otras_cxc_txn: otrasCxcTxnResult.recordset,
          otras_cxp: otrasCxpResult.recordset,
          otras_cxp_txn: otrasCxpTxnResult.recordset,
          tributos: tributosResult.recordset,
          tributos_txn: tributosTxnResult.recordset,
          laboral: laboralResult.recordset,
          laboral_txn: laboralTxnResult.recordset,
          activo_fijo: activoFijoResult.recordset,
          patrimonio: patrimonioResult.recordset,
          inventarios: inventariosResult.recordset,
          prestamos_otorgados: prestamosOtorgResult.recordset,
          prestamos_recibidos: prestamosReciResult.recordset,
          transferencias: transferenciasResult.recordset,
          caja_saldos: cajaSaldosResult.recordset,
          caja_txn: cajaTxnResult.recordset,
          tesoreria: tesoreriaResult.recordset,
          ob_saldos_banco: obSaldosBancoResult.recordset,
          gastos_naturaleza: gastosNatResult.recordset,
          audit_sin_doc: auditSinDocResult.recordset,
          audit_sin_doc_txn: auditSinDocTxnResult.recordset,
          audit_descuadres: auditDescuadresResult.recordset,
          audit_atipicos: auditAtipicosResult.recordset,
          audit_conciliacion: auditConciliacionResult.recordset,
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
