/**
 * S10 BizSmartHub — Agente Local de Sincronización
 * ============================================================
 * Ejecutar desde la red CMO (acceso a SQL Server S10).
 * Lee datos financieros de S10 y los envía al VPS por HTTPS.
 *
 * Uso:
 *   node sync-agent.js [--year=2026] [--company=80688541] [--fast] [--forensics]
 *
 *   --fast       Salta Batch 3 y 4 (solo KPIs core). Ideal para sync desde botón.
 *                Las 4 empresas corren en paralelo. Tiempo estimado: <30s.
 *   --forensics  Incluye Batch 4 (33 queries forenses). Solo para crontab nocturno.
 *                Sin este flag, el crontab corre Batches 1+2+3 (2 empresas en paralelo).
 *
 * Programar en Windows Task Scheduler:
 *   Trigger: Diario 07:00, Lunes-Viernes
 *   Acción:  node "C:\ruta\al\sync-agent.js" --year=2026 --forensics
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
  ac.CodUnico                                              AS NroAsiento,
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
ORDER BY ac.FechaAplicacionContable, ac.CodUnico
`;

// Aging CxC por FechaVencimiento del documento (no por fecha contable)
// Vigente = no vencido; 0-30/30-60/60-90/+90 = días de mora
const QUERY_CXC = (codEmpresa) => `
-- Saldo por documento: facturas positivo, NCs como negativo (compensan balance del cliente)
-- NC aplicada (TotalPagado<0): contribuye 0 (ya reflejada en TotalPagado de la factura)
-- NC flotante (TotalPagado>=0): contribuye negativo (reduce lo que debe el cliente)
SELECT
  ISNULL(doc.DescripcionIdentificador, doc.CodIdentificador)               AS Cliente,
  ISNULL(doc.CodIdentificador,'')                                          AS CodCliente,
  doc.CodMoneda                                                             AS Moneda,
  ROUND(SUM(
    CASE WHEN UPPER(ISNULL(doc.DescripcionTipoDocumento,'')) LIKE '%NOTA DE CR%'
      THEN CASE WHEN ISNULL(doc.TotalPagado,0) < 0 THEN 0
                ELSE -(doc.Total - ISNULL(doc.TotalPagado,0) - ISNULL(doc.MontoDetraccion,0)) END
    ELSE doc.Total - ISNULL(doc.TotalPagado,0) - ISNULL(doc.MontoDetraccion,0)
    END
  ), 2)                                                                     AS SaldoTotal,
  ROUND(SUM(CASE WHEN ISNULL(doc.FechaVencimiento,GETDATE()) >= GETDATE()
                  AND UPPER(ISNULL(doc.DescripcionTipoDocumento,'')) NOT LIKE '%NOTA DE CR%'
           THEN doc.Total - ISNULL(doc.TotalPagado,0) - ISNULL(doc.MontoDetraccion,0) ELSE 0 END), 2)     AS SaldoVigente,
  ROUND(SUM(CASE WHEN ISNULL(doc.FechaVencimiento,GETDATE()) BETWEEN DATEADD(DAY,-30,GETDATE()) AND DATEADD(DAY,-1,GETDATE())
                  AND UPPER(ISNULL(doc.DescripcionTipoDocumento,'')) NOT LIKE '%NOTA DE CR%'
           THEN doc.Total - ISNULL(doc.TotalPagado,0) - ISNULL(doc.MontoDetraccion,0) ELSE 0 END), 2)    AS Dias_0_30,
  ROUND(SUM(CASE WHEN ISNULL(doc.FechaVencimiento,GETDATE()) BETWEEN DATEADD(DAY,-60,GETDATE()) AND DATEADD(DAY,-31,GETDATE())
                  AND UPPER(ISNULL(doc.DescripcionTipoDocumento,'')) NOT LIKE '%NOTA DE CR%'
           THEN doc.Total - ISNULL(doc.TotalPagado,0) - ISNULL(doc.MontoDetraccion,0) ELSE 0 END), 2)    AS Dias_31_60,
  ROUND(SUM(CASE WHEN ISNULL(doc.FechaVencimiento,GETDATE()) BETWEEN DATEADD(DAY,-90,GETDATE()) AND DATEADD(DAY,-61,GETDATE())
                  AND UPPER(ISNULL(doc.DescripcionTipoDocumento,'')) NOT LIKE '%NOTA DE CR%'
           THEN doc.Total - ISNULL(doc.TotalPagado,0) - ISNULL(doc.MontoDetraccion,0) ELSE 0 END), 2)    AS Dias_61_90,
  ROUND(SUM(CASE WHEN ISNULL(doc.FechaVencimiento,GETDATE()) < DATEADD(DAY,-90,GETDATE())
                  AND UPPER(ISNULL(doc.DescripcionTipoDocumento,'')) NOT LIKE '%NOTA DE CR%'
           THEN doc.Total - ISNULL(doc.TotalPagado,0) - ISNULL(doc.MontoDetraccion,0) ELSE 0 END), 2)    AS Dias_90_mas,
  MAX(ISNULL(doc.TipoCambio, 3.80))                                        AS TipoCambio
FROM CMO.dbo.vw_12DocumentosPorCobrar doc
WHERE doc.CodEmpresa = '${codEmpresa}'
  AND doc.CodTipoDocumento IN ('131','125','128','134')
  AND doc.DescripcionEstado = '1'
  AND UPPER(ISNULL(doc.DescripcionTipoDocumento,'')) NOT LIKE '%VINCULADA%'
GROUP BY doc.DescripcionIdentificador, doc.CodIdentificador, doc.CodMoneda
HAVING SUM(
  CASE WHEN UPPER(ISNULL(doc.DescripcionTipoDocumento,'')) LIKE '%NOTA DE CR%'
    THEN CASE WHEN ISNULL(doc.TotalPagado,0) < 0 THEN 0
              ELSE -(doc.Total - ISNULL(doc.TotalPagado,0) - ISNULL(doc.MontoDetraccion,0)) END
  ELSE doc.Total - ISNULL(doc.TotalPagado,0) - ISNULL(doc.MontoDetraccion,0)
  END
) > 0.01
ORDER BY SUM(
  CASE WHEN UPPER(ISNULL(doc.DescripcionTipoDocumento,'')) LIKE '%NOTA DE CR%'
    THEN CASE WHEN ISNULL(doc.TotalPagado,0) < 0 THEN 0
              ELSE -(doc.Total - ISNULL(doc.TotalPagado,0) - ISNULL(doc.MontoDetraccion,0)) END
  ELSE doc.Total - ISNULL(doc.TotalPagado,0) - ISNULL(doc.MontoDetraccion,0)
  END * CASE WHEN doc.CodMoneda='01' THEN 1.0 ELSE ISNULL(doc.TipoCambio,3.80) END
) DESC
`;

// CxC split por naturaleza: comercial (facturas/NC) vs otras (préstamos, DSP, transferencias, etc.)
const QUERY_CXC_SPLIT = (codEmpresa) => `
SELECT
  CASE WHEN doc.CodTipoDocumento IN ('131','125','128','134') THEN 'comercial' ELSE 'otras' END AS Grupo,
  doc.CodTipoDocumento                                                AS Tipo,
  LEFT(MAX(doc.DescripcionTipoDocumento), 40)                         AS DesTipo,
  COUNT(*)                                                            AS NDocs,
  COUNT(CASE WHEN UPPER(ISNULL(doc.DescripcionTipoDocumento,'')) NOT LIKE '%NOTA DE CR%'
              AND (doc.Total - ISNULL(doc.TotalPagado,0) - ISNULL(doc.MontoDetraccion,0)) > 0.01 THEN 1 END) AS NDocsPendientes,
  ROUND(SUM(
    CASE WHEN UPPER(ISNULL(doc.DescripcionTipoDocumento,'')) LIKE '%NOTA DE CR%'
      THEN CASE WHEN ISNULL(doc.TotalPagado,0) < 0 THEN 0
                ELSE -(doc.Total - ISNULL(doc.TotalPagado,0) - ISNULL(doc.MontoDetraccion,0)) END
    ELSE CASE WHEN (doc.Total - ISNULL(doc.TotalPagado,0) - ISNULL(doc.MontoDetraccion,0)) > 0.01
              THEN (doc.Total - ISNULL(doc.TotalPagado,0) - ISNULL(doc.MontoDetraccion,0))
              ELSE 0 END
    END *
    CASE WHEN doc.CodMoneda='01' THEN 1.0 ELSE ISNULL(doc.TipoCambio,3.80) END
  ), 0) AS SaldoPendiente
FROM CMO.dbo.vw_12DocumentosPorCobrar doc
WHERE doc.CodEmpresa = '${codEmpresa}'
  AND doc.DescripcionEstado = '1'
  AND UPPER(ISNULL(doc.DescripcionTipoDocumento,'')) NOT LIKE '%VINCULADA%'
GROUP BY
  CASE WHEN doc.CodTipoDocumento IN ('131','125','128','134') THEN 'comercial' ELSE 'otras' END,
  doc.CodTipoDocumento
ORDER BY Grupo, SaldoPendiente DESC
`;

// Documentos pendientes de cobro por cliente (trazabilidad en modal)
// Reemplaza el drilldown de asientos contables — muestra los documentos reales
const QUERY_CXC_DOCS = (codEmpresa) => `
SELECT
  ISNULL(doc.CodIdentificador,'')                                    AS CodCliente,
  ISNULL(doc.DescripcionIdentificador, doc.CodIdentificador)         AS Cliente,
  doc.NroD,
  doc.CodTipoDocumento                                               AS TipoDoc,
  ISNULL(doc.DescripcionTipoDocumento,'')                            AS DesTipo,
  ISNULL(doc.SerieDocumento,'')                                      AS Serie,
  ISNULL(doc.NumeroDocumento,'')                                     AS Numero,
  CONVERT(VARCHAR(10), doc.FechaDocumento, 103)                      AS FechaDocumento,
  CONVERT(VARCHAR(10), ISNULL(doc.FechaVencimiento, doc.FechaDocumento), 103) AS FechaVencimiento,
  doc.CodMoneda                                                      AS Moneda,
  ROUND(doc.Total, 2)                                                AS Total,
  ROUND(ISNULL(doc.TotalPagado,0), 2)                                AS Pagado,
  ROUND(ISNULL(doc.MontoDetraccion,0), 2)                            AS Detraccion,
  ROUND(doc.Total - ISNULL(doc.TotalPagado,0) - ISNULL(doc.MontoDetraccion,0), 2) AS Saldo,
  DATEDIFF(DAY, ISNULL(doc.FechaVencimiento, doc.FechaDocumento), GETDATE()) AS DiasVencido,
  ISNULL(doc.DescripcionEstado,'')                                   AS Estado
FROM CMO.dbo.vw_12DocumentosPorCobrar doc
WHERE doc.CodEmpresa = '${codEmpresa}'
  AND doc.CodTipoDocumento IN ('131','125','128','134')
  AND doc.DescripcionEstado = '1'
  AND UPPER(ISNULL(doc.DescripcionTipoDocumento,'')) NOT LIKE '%NOTA DE CR%'
  AND UPPER(ISNULL(doc.DescripcionTipoDocumento,'')) NOT LIKE '%VINCULADA%'
  AND (doc.Total - ISNULL(doc.TotalPagado,0) - ISNULL(doc.MontoDetraccion,0)) > 0.01
ORDER BY doc.CodIdentificador,
         DATEDIFF(DAY, ISNULL(doc.FechaVencimiento, doc.FechaDocumento), GETDATE()) DESC,
         doc.Total DESC
`;

// Cartera especial Estado='6': vinculadas, intercompañía, en disputa, provisionadas
// Se muestra SEPARADA del aging normal para no inflar la CxC comercial
const QUERY_CXC_VINCULADAS = (codEmpresa) => `
SELECT
  ISNULL(doc.CodIdentificador,'')                                             AS CodCliente,
  ISNULL(doc.DescripcionIdentificador, doc.CodIdentificador)                  AS Cliente,
  doc.CodMoneda                                                               AS Moneda,
  ISNULL(doc.DescripcionTipoDocumento,'')                                     AS TipoDocumento,
  ISNULL(doc.SerieDocumento,'')                                               AS Serie,
  ISNULL(doc.NumeroDocumento,'')                                              AS Numero,
  CONVERT(VARCHAR(10), doc.FechaDocumento, 103)                               AS FechaDocumento,
  CONVERT(VARCHAR(10), ISNULL(doc.FechaVencimiento, doc.FechaDocumento), 103) AS FechaVencimiento,
  ROUND(doc.Total, 2)                                                         AS Total,
  ROUND(ISNULL(doc.TotalPagado,0), 2)                                         AS Pagado,
  ROUND(ISNULL(doc.MontoDetraccion,0), 2)                                     AS Detraccion,
  ROUND(doc.Total - ISNULL(doc.TotalPagado,0) - ISNULL(doc.MontoDetraccion,0), 2)  AS Saldo,
  ROUND((doc.Total - ISNULL(doc.TotalPagado,0) - ISNULL(doc.MontoDetraccion,0))
    * CASE WHEN doc.CodMoneda='01' THEN 1.0 ELSE ISNULL(doc.TipoCambio,3.80) END, 0) AS SaldoSoles,
  DATEDIFF(DAY, doc.FechaDocumento, GETDATE())                                AS DiasAntiguedad,
  LEFT(ISNULL(doc.Observacion,''), 150)                                       AS Observacion
FROM CMO.dbo.vw_12DocumentosPorCobrar doc
WHERE doc.CodEmpresa = '${codEmpresa}'
  AND doc.CodTipoDocumento IN ('131','125','128','134')
  AND (
    doc.DescripcionEstado = '6'
    OR UPPER(ISNULL(doc.DescripcionTipoDocumento,'')) LIKE '%VINCULADA%'
  )
  AND (doc.Total - ISNULL(doc.TotalPagado,0) - ISNULL(doc.MontoDetraccion,0)) > 0.01
ORDER BY SaldoSoles DESC
`;

const QUERY_CXC_TRANSACTIONS = (codEmpresa, year) => `
SELECT
  ac.CodUnico                                              AS NroAsiento,
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
ORDER BY ac.FechaAplicacionContable DESC, ac.CodUnico
`;

const QUERY_CXP_TRANSACTIONS = (codEmpresa, year) => `
SELECT
  ac.CodUnico                                              AS NroAsiento,
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
ORDER BY ac.FechaAplicacionContable DESC, ac.CodUnico
`;

// Tributarios: 125 128 131 134 — Operativos: 060 056 058 069 070 071 073 075 048
// El frontend separa ambos grupos en sub-tabs (Facturas vs Operativos)
const TIPOS_EMITIDAS = `'060','056','058','069','070','071','073','075','048','125','128','131','134'`;
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
  doc.CodTipoDocumento                                        AS CodTipo,
  ISNULL(doc.DescripcionTipoDocumento, '')                   AS TipoDocumento,
  ISNULL(doc.DescripcionIdentificador, '')                   AS Cliente,
  ISNULL(doc.RUC, '')                                        AS RucCliente,
  ISNULL(doc.TotalNeto, 0)                                   AS TotalNeto,
  ISNULL(doc.TotalImpuesto, 0)                               AS TotalImpuesto,
  ISNULL(doc.Total, 0)                                       AS Total,
  ISNULL(doc.TotalPagado, 0)                                 AS TotalPagado,
  ISNULL(doc.MontoDetraccion, 0)                             AS Detraccion,
  doc.Total - ISNULL(doc.TotalPagado, 0) - ISNULL(doc.MontoDetraccion, 0) AS Saldo,
  ISNULL(doc.DescripcionEstado, '')                          AS Estado,
  ISNULL(doc.Observacion, '')                                AS Observacion,
  ISNULL(doc.CodMoneda, '01')                                AS Moneda,
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
  ISNULL(doc.CodMoneda, '01')                                AS Moneda,
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
HAVING SUM(ISNULL(ac.Credito,0)) - SUM(ISNULL(ac.Debito,0)) > 0.01
ORDER BY SaldoTotal DESC
`;

// Documentos pendientes de pago por proveedor (reemplaza drilldown de asientos contables)
// CTE dedup elimina duplicados que genera vw_12DocumentosPorPagar por su JOIN interno
const QUERY_CXP_DOCS = (codEmpresa) => `
WITH dedup AS (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY NroD ORDER BY NroD) AS rn
  FROM CMO.dbo.vw_12DocumentosPorPagar
  WHERE CodEmpresa = '${codEmpresa}'
    AND DescripcionEstado = '1'
    AND UPPER(ISNULL(DescripcionTipoDocumento,'')) NOT LIKE '%NOTA DE CR%'
    AND UPPER(ISNULL(DescripcionTipoDocumento,'')) NOT LIKE '%VINCULADA%'
    AND (Total - ISNULL(TotalPagado,0) - ISNULL(MontoDetraccion,0)) > 0.01
)
SELECT
  ISNULL(CodIdentificador,'')                                        AS CodProveedor,
  ISNULL(DescripcionIdentificador, CodIdentificador)                 AS Proveedor,
  NroD,
  CodTipoDocumento                                                   AS TipoDoc,
  ISNULL(DescripcionTipoDocumento,'')                                AS DesTipo,
  ISNULL(SerieDocumento,'')                                          AS Serie,
  ISNULL(NumeroDocumento,'')                                         AS Numero,
  CONVERT(VARCHAR(10), FechaDocumento, 103)                          AS FechaDocumento,
  CONVERT(VARCHAR(10), ISNULL(FechaVencimiento, FechaDocumento), 103) AS FechaVencimiento,
  CodMoneda                                                          AS Moneda,
  ROUND(Total, 2)                                                    AS Total,
  ROUND(ISNULL(TotalPagado,0), 2)                                    AS Pagado,
  ROUND(ISNULL(MontoDetraccion,0), 2)                                AS Detraccion,
  ROUND(Total - ISNULL(TotalPagado,0) - ISNULL(MontoDetraccion,0), 2) AS Saldo,
  DATEDIFF(DAY, ISNULL(FechaVencimiento, FechaDocumento), GETDATE()) AS DiasVencido,
  ISNULL(DescripcionEstado,'')                                       AS Estado
FROM dedup
WHERE rn = 1
ORDER BY CodIdentificador,
         DATEDIFF(DAY, ISNULL(FechaVencimiento, FechaDocumento), GETDATE()) DESC,
         Total DESC
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
// Balance de 8 columnas: Saldo inicial | Movimiento del período | Saldo final
// Saldo inicial = acumulado hasta el año anterior
// Saldo final   = acumulado hasta fin del año seleccionado (neto deudor/acreedor)
const QUERY_BALANCE = (codEmpresa, year) => `
SELECT
  LEFT(pcd.CodCuenta, 2)   AS Clase,
  LEFT(pcd.CodCuenta, 4)   AS GrupoCuenta,
  pcd.CodCuenta,
  pcd.Descripcion           AS DesCuenta,
  -- Saldo inicial (antes del año)
  SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) < ${year}
        THEN ISNULL(ac.Debito,0) ELSE 0 END)   AS SaldoIniDebe,
  SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) < ${year}
        THEN ISNULL(ac.Credito,0) ELSE 0 END)  AS SaldoIniHaber,
  -- Movimiento del período
  SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) = ${year}
        THEN ISNULL(ac.Debito,0) ELSE 0 END)   AS MovDebe,
  SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) = ${year}
        THEN ISNULL(ac.Credito,0) ELSE 0 END)  AS MovHaber,
  -- Totales para calcular saldo final neto
  SUM(ISNULL(ac.Debito,0))  AS TotalDebe,
  SUM(ISNULL(ac.Credito,0)) AS TotalHaber
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND YEAR(ac.FechaAplicacionContable) <= ${year}
  AND LEFT(pcd.CodCuenta, 2) IN (
    '10','11','12','13','14','15','16','17','18','19',
    '20','21','22','23','24','25','26','27','28','29',
    '30','31','32','33','34','35','36','37','38','39',
    '40','41','42','43','44','45','46','47','48','49',
    '50','51','52','53','54','55','56','57','58','59'
  )
GROUP BY LEFT(pcd.CodCuenta,2), LEFT(pcd.CodCuenta,4), pcd.CodCuenta, pcd.Descripcion
HAVING (
  ABS(SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0))) > 0.01
  OR SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) = ${year}
             THEN ISNULL(ac.Debito,0) + ISNULL(ac.Credito,0) ELSE 0 END) > 0.01
)
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
  ac.CodUnico                                              AS NroAsiento,
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
ORDER BY ac.FechaAplicacionContable DESC, ac.CodUnico
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
  ac.CodUnico                                              AS NroAsiento,
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
ORDER BY ac.FechaAplicacionContable DESC, ac.CodUnico
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
  ac.CodUnico                                              AS NroAsiento,
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
ORDER BY ac.FechaAplicacionContable DESC, ac.CodUnico
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

// Detalle transacciones activo fijo (clases 33/39) para drilldown — SIN filtro de año
// Los activos son históricos acumulados; el filtro de año se aplica en la UI.
const QUERY_ACTIVO_FIJO_TXN = (codEmpresa) => `
SELECT
  ac.CodUnico                                              AS NroAsiento,
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
  ISNULL(i.Descripcion, '')                                AS Tercero
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
LEFT JOIN CMO.dbo.Identificador i
  ON ac.CodIdentificador = i.CodIdentificador
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND LEFT(pcd.CodCuenta, 2) IN ('33', '39')
ORDER BY ac.FechaAplicacionContable DESC, ac.CodUnico
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

// Detalle transacciones gastos naturaleza (clases 60-68) para drilldown
const QUERY_GASTOS_NAT_TXN = (codEmpresa, fechaInicio, fechaFin) => `
SELECT
  ac.CodUnico                                              AS NroAsiento,
  ac.NroD                                                  AS NroD,
  CONVERT(VARCHAR(10), ac.FechaAplicacionContable, 103)    AS Fecha,
  YEAR(ac.FechaAplicacionContable)                         AS Anio,
  MONTH(ac.FechaAplicacionContable)                        AS Mes,
  LEFT(pcd.CodCuenta, 2)                                   AS Clase,
  LEFT(pcd.CodCuenta, 4)                                   AS GrupoCuenta,
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
  AND ac.FechaAplicacionContable BETWEEN '${fechaInicio}' AND '${fechaFin}'
  AND LEFT(pcd.CodCuenta, 2) IN ('60','61','62','63','64','65','66','67','68')
ORDER BY ac.FechaAplicacionContable DESC, ac.CodUnico
`;

// Saldos bancarios acumulados (clase 10) — histórico por subcuenta
const QUERY_CAJA_SALDOS = (codEmpresa) => `
SELECT
  pcd.CodCuenta                                            AS CodBanco,
  pcd.Descripcion                                          AS DesBanco,
  SUM(ISNULL(ac.Debito,0))                              AS TotalDebito,
  SUM(ISNULL(ac.Credito,0))                             AS TotalCredito,
  SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0)) AS SaldoActual,
  MAX(ac.FechaAplicacionContable)                          AS UltimoMovimiento,
  COUNT(*)                                                 AS NumAsientos,
  SUM(CASE WHEN ac.NroD IS NULL THEN 1 ELSE 0 END)        AS SinDocumento
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
  ac.CodUnico                                              AS NroAsiento,
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
ORDER BY ac.FechaAplicacionContable DESC, ac.CodUnico
`;

// Asientos bancarios completos: todas las líneas de cada asiento que toca clase 10
// Permite ver el asiento doble completo (banco + contrapartida) en el modal de Tesorería
const QUERY_CAJA_ASIENTO_FULL = (codEmpresa, year) => `
SELECT
  ac2.CodUnico                                             AS NroAsiento,
  CONVERT(VARCHAR(10), ac2.FechaAplicacionContable, 103)   AS Fecha,
  ac2.NroD                                                 AS NroD,
  LEFT(pcd2.CodCuenta, 2)                                  AS Clase,
  pcd2.CodCuenta                                           AS CodCuenta,
  pcd2.Descripcion                                         AS DesCuenta,
  ISNULL(ac2.Glosa, '')                                    AS Glosa,
  ISNULL(ac2.Debito, 0)                                    AS Debito,
  ISNULL(ac2.Credito, 0)                                   AS Credito,
  ISNULL(i2.Descripcion, '')                               AS Tercero
FROM CMO.dbo.AsientoContable ac2
JOIN CMO.dbo.PlanContableDetalle pcd2
  ON ac2.NroPlanContableDetalle = pcd2.NroPlanContableDetalle
LEFT JOIN CMO.dbo.Identificador i2
  ON ac2.CodIdentificador = i2.CodIdentificador
WHERE ac2.CodEmpresa = '${codEmpresa}'
  AND ac2.CodUnico IN (
    SELECT DISTINCT ac1.CodUnico
    FROM CMO.dbo.AsientoContable ac1
    JOIN CMO.dbo.PlanContableDetalle pcd1
      ON ac1.NroPlanContableDetalle = pcd1.NroPlanContableDetalle
    WHERE ac1.CodEmpresa = '${codEmpresa}'
      AND LEFT(pcd1.CodCuenta, 2) = '10'
      AND YEAR(ac1.FechaAplicacionContable) = ${year}
  )
ORDER BY ac2.CodUnico, pcd2.CodCuenta
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
  ac.CodUnico                                              AS NroAsiento,
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
  ac.CodUnico                                              AS NroAsiento,
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
         SUM(CASE WHEN doc.CodTipoDocumento NOT IN ('128','134')
                  THEN ISNULL(doc.Total,0) * CASE WHEN doc.CodMoneda='01' THEN 1.0 ELSE ISNULL(doc.TipoCambio,3.80) END
                  ELSE 0 END) AS FacturasEmitidas,
         SUM(CASE WHEN doc.CodTipoDocumento IN ('128','134')
                  THEN ISNULL(doc.Total,0) * CASE WHEN doc.CodMoneda='01' THEN 1.0 ELSE ISNULL(doc.TipoCambio,3.80) END
                  ELSE 0 END) AS NotasCredito
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

// Patrimonio (clases 50-59): asientos individuales del año para drill-down
const QUERY_PATRIMONIO_TXN = (codEmpresa, year) => `
SELECT
  ac.CodUnico                                              AS NroAsiento,
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
  AND LEFT(pcd.CodCuenta, 2) IN ('50','51','52','53','54','55','56','57','58','59')
  AND YEAR(ac.FechaAplicacionContable) = ${year}
ORDER BY ac.FechaAplicacionContable DESC, ac.CodUnico
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
  ac.CodUnico                                              AS NroAsiento,
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
ORDER BY ac.FechaAplicacionContable DESC, ac.CodUnico
`;

// FASE C — Auditoría Laboral (las 4 empresas NO usan AFPNet/PDT-PLAME formal de S10;
// procesan planilla externamente y registran resumen en clase 41 + pagos en OB_Pago)

// Pagos a personas naturales (RUC 10*) — trabajadores y profesionales independientes
const QUERY_PAGOS_TRABAJADORES = (codEmpresa, year) => `
SELECT TOP 200
  i.Descripcion                                    AS NombreTrabajador,
  p.CodIdentificadorReferencia                     AS RUC,
  COUNT(*)                                          AS NumPagos,
  ROUND(SUM(p.PayAmt), 2)                          AS MontoTotal,
  ROUND(AVG(p.PayAmt), 2)                          AS MontoPromedio,
  ROUND(MAX(p.PayAmt), 2)                          AS MontoMaximo,
  CONVERT(VARCHAR(10), MAX(p.FechaTrx), 103)       AS UltimoPago,
  CONVERT(VARCHAR(10), MIN(p.FechaTrx), 103)       AS PrimerPago,
  CASE WHEN COUNT(*) >= 10 THEN 'Recurrente'
       WHEN COUNT(*) >= 3 THEN 'Frecuente'
       ELSE 'Ocasional' END                        AS PatronPago
FROM CMO.dbo.OB_Pago p
JOIN CMO.dbo.Identificador i ON p.CodIdentificadorReferencia = i.CodIdentificador
WHERE p.CodIdentificador = '${codEmpresa}'
  AND YEAR(p.FechaTrx) = ${year}
  AND p.PayAmt > 500
  AND LEFT(i.RUC, 2) = '10'
GROUP BY i.Descripcion, p.CodIdentificadorReferencia
ORDER BY SUM(p.PayAmt) DESC
`;

// Métricas laborales (clase 41) — depósitos CTS por mes (debería ser may/nov)
const QUERY_CTS_DEPOSITOS = (codEmpresa) => `
SELECT
  YEAR(ac.FechaAplicacionContable)                 AS Anio,
  MONTH(ac.FechaAplicacionContable)                AS Mes,
  ROUND(SUM(ISNULL(ac.Debito, 0)), 2)              AS MontoDepositado,
  ROUND(SUM(ISNULL(ac.Credito, 0)), 2)             AS MontoProvisionado,
  CASE
    WHEN MONTH(ac.FechaAplicacionContable) IN (5, 11) THEN 'En plazo (DL 650)'
    WHEN MONTH(ac.FechaAplicacionContable) IN (4, 10) THEN 'Anticipado'
    WHEN MONTH(ac.FechaAplicacionContable) IN (6, 12) THEN 'Fuera de plazo'
    ELSE 'No es mes CTS'
  END                                              AS ClasificacionLegal
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND pcd.CodCuenta LIKE '4151%'
  AND YEAR(ac.FechaAplicacionContable) IN (${new Date().getFullYear() - 1}, ${new Date().getFullYear()})
GROUP BY YEAR(ac.FechaAplicacionContable), MONTH(ac.FechaAplicacionContable)
HAVING SUM(ISNULL(ac.Debito, 0)) + SUM(ISNULL(ac.Credito, 0)) > 0
ORDER BY YEAR(ac.FechaAplicacionContable), MONTH(ac.FechaAplicacionContable)
`;

// Métricas laborales agregadas
const QUERY_LABORAL_METRICAS = (codEmpresa, year) => `
SELECT
  -- Conteo asientos clase 41 por concepto
  SUM(CASE WHEN pcd.CodCuenta LIKE '4111%' THEN ISNULL(ac.Credito, 0) ELSE 0 END) AS SueldosProvisionado,
  SUM(CASE WHEN pcd.CodCuenta LIKE '4111%' THEN ISNULL(ac.Debito, 0) ELSE 0 END)  AS SueldosPagado,
  SUM(CASE WHEN pcd.CodCuenta LIKE '4114%' THEN ISNULL(ac.Credito, 0) ELSE 0 END) AS GratifProvisionado,
  SUM(CASE WHEN pcd.CodCuenta LIKE '4114%' THEN ISNULL(ac.Debito, 0) ELSE 0 END)  AS GratifPagado,
  SUM(CASE WHEN pcd.CodCuenta LIKE '4115%' THEN ISNULL(ac.Credito, 0) ELSE 0 END) AS VacacionesProvisionado,
  SUM(CASE WHEN pcd.CodCuenta LIKE '4115%' THEN ISNULL(ac.Debito, 0) ELSE 0 END)  AS VacacionesPagado,
  SUM(CASE WHEN pcd.CodCuenta LIKE '4151%' THEN ISNULL(ac.Credito, 0) ELSE 0 END) AS CTSProvisionado,
  SUM(CASE WHEN pcd.CodCuenta LIKE '4151%' THEN ISNULL(ac.Debito, 0) ELSE 0 END)  AS CTSPagado,
  SUM(CASE WHEN pcd.CodCuenta LIKE '4130%' THEN ISNULL(ac.Credito, 0) ELSE 0 END) AS ParticipacionesProvisionado,
  SUM(CASE WHEN pcd.CodCuenta LIKE '4130%' THEN ISNULL(ac.Debito, 0) ELSE 0 END)  AS ParticipacionesPagado,
  -- Saldos pendientes
  ROUND(SUM(CASE WHEN pcd.CodCuenta LIKE '4111%' THEN ISNULL(ac.Credito, 0) - ISNULL(ac.Debito, 0) ELSE 0 END), 2) AS SaldoSueldos,
  ROUND(SUM(CASE WHEN pcd.CodCuenta LIKE '4114%' THEN ISNULL(ac.Credito, 0) - ISNULL(ac.Debito, 0) ELSE 0 END), 2) AS SaldoGratif,
  ROUND(SUM(CASE WHEN pcd.CodCuenta LIKE '4115%' THEN ISNULL(ac.Credito, 0) - ISNULL(ac.Debito, 0) ELSE 0 END), 2) AS SaldoVacaciones,
  ROUND(SUM(CASE WHEN pcd.CodCuenta LIKE '4151%' THEN ISNULL(ac.Credito, 0) - ISNULL(ac.Debito, 0) ELSE 0 END), 2) AS SaldoCTS,
  ROUND(SUM(CASE WHEN pcd.CodCuenta LIKE '4130%' THEN ISNULL(ac.Credito, 0) - ISNULL(ac.Debito, 0) ELSE 0 END), 2) AS SaldoParticipaciones
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${codEmpresa}'
  AND LEFT(pcd.CodCuenta, 2) = '41'
  AND YEAR(ac.FechaAplicacionContable) = ${year}
`;

// FASE B — Auditoría de Bancarización (Ley 28194)
// Pagos > S/3,500 (o US$1,000) DEBEN usar medio bancario:
// - MedioDePago: 1=Cheque, 2=Transferencia, 3=Detracción, 5=OtroElec, 7=Voucher → BANCARIZADOS
// - MedioDePago: 4=Compensación NC, 6=Canje Letra → NO requieren bancarización (extinción de obligación sin dinero, Art. 1288 CC)
// - MedioDePago: 0=SinClasif → riesgo (revisar caso a caso)
// Umbrales: S/3,500 (Mon='01') o US$1,000 (Mon='02')
const QUERY_BANCARIZACION_METRICAS = (codEmpresa, year) => `
SELECT
  COUNT(*)                                                              AS PagosTotalesAnio,
  ROUND(SUM(p.PayAmt), 2)                                               AS MontoTotalAnio,
  SUM(CASE WHEN
    (cb.CodMoneda = '01' AND p.PayAmt > 3500) OR
    (cb.CodMoneda = '02' AND p.PayAmt > 1000)
    THEN 1 ELSE 0 END)                                                  AS PagosMateriales,
  ROUND(SUM(CASE WHEN
    (cb.CodMoneda = '01' AND p.PayAmt > 3500) OR
    (cb.CodMoneda = '02' AND p.PayAmt > 1000)
    THEN p.PayAmt ELSE 0 END), 2)                                       AS MontoMaterial,
  SUM(CASE WHEN
    ((cb.CodMoneda = '01' AND p.PayAmt > 3500) OR (cb.CodMoneda = '02' AND p.PayAmt > 1000))
    AND p.MedioDePago IN (1,2,3,5,7)
    THEN 1 ELSE 0 END)                                                  AS PagosBancarizados,
  ROUND(SUM(CASE WHEN
    ((cb.CodMoneda = '01' AND p.PayAmt > 3500) OR (cb.CodMoneda = '02' AND p.PayAmt > 1000))
    AND p.MedioDePago IN (1,2,3,5,7)
    THEN p.PayAmt ELSE 0 END), 2)                                       AS MontoBancarizado,
  SUM(CASE WHEN
    ((cb.CodMoneda = '01' AND p.PayAmt > 3500) OR (cb.CodMoneda = '02' AND p.PayAmt > 1000))
    AND (p.MedioDePago IS NULL OR p.MedioDePago = 0)
    THEN 1 ELSE 0 END)                                                  AS PagosNoBancarizados,
  ROUND(SUM(CASE WHEN
    ((cb.CodMoneda = '01' AND p.PayAmt > 3500) OR (cb.CodMoneda = '02' AND p.PayAmt > 1000))
    AND (p.MedioDePago IS NULL OR p.MedioDePago = 0)
    THEN p.PayAmt ELSE 0 END), 2)                                       AS MontoNoBancarizado,
  SUM(CASE WHEN
    ((cb.CodMoneda = '01' AND p.PayAmt > 3500) OR (cb.CodMoneda = '02' AND p.PayAmt > 1000))
    AND p.MedioDePago = 4
    THEN 1 ELSE 0 END)                                                  AS PagosCompensacionNC,
  ROUND(SUM(CASE WHEN
    ((cb.CodMoneda = '01' AND p.PayAmt > 3500) OR (cb.CodMoneda = '02' AND p.PayAmt > 1000))
    AND p.MedioDePago = 4
    THEN p.PayAmt ELSE 0 END), 2)                                       AS MontoCompensacionNC,
  SUM(CASE WHEN
    ((cb.CodMoneda = '01' AND p.PayAmt > 3500) OR (cb.CodMoneda = '02' AND p.PayAmt > 1000))
    AND p.MedioDePago = 6
    THEN 1 ELSE 0 END)                                                  AS PagosCanjeLetra,
  ROUND(SUM(CASE WHEN
    ((cb.CodMoneda = '01' AND p.PayAmt > 3500) OR (cb.CodMoneda = '02' AND p.PayAmt > 1000))
    AND p.MedioDePago = 6
    THEN p.PayAmt ELSE 0 END), 2)                                       AS MontoCanjeLetra,
  -- Distribución por medio
  SUM(CASE WHEN p.MedioDePago = 1 THEN 1 ELSE 0 END)                    AS MedioCheque,
  SUM(CASE WHEN p.MedioDePago = 2 THEN 1 ELSE 0 END)                    AS MedioTransferencia,
  SUM(CASE WHEN p.MedioDePago = 3 THEN 1 ELSE 0 END)                    AS MedioDetraccion,
  SUM(CASE WHEN p.MedioDePago = 4 THEN 1 ELSE 0 END)                    AS MedioEfectivo4,
  SUM(CASE WHEN p.MedioDePago = 5 THEN 1 ELSE 0 END)                    AS MedioOtroElec,
  SUM(CASE WHEN p.MedioDePago = 6 THEN 1 ELSE 0 END)                    AS MedioEfectivo6,
  SUM(CASE WHEN p.MedioDePago = 7 THEN 1 ELSE 0 END)                    AS MedioVoucher,
  SUM(CASE WHEN p.MedioDePago = 0 OR p.MedioDePago IS NULL THEN 1 ELSE 0 END) AS MedioSinClasificar
FROM CMO.dbo.OB_Pago p
LEFT JOIN CMO.dbo.OB_CuentaBanco cb ON p.BankAccount_ID = cb.BankAccount_ID
WHERE p.CodIdentificador = '${codEmpresa}'
  AND YEAR(p.FechaTrx) = ${year}
`;

// Detalle de pagos > S/3,500 con MedioDePago no clasificado (sospechosos) — TOP 100
const QUERY_PAGOS_NO_BANCARIZADOS = (codEmpresa, year) => `
SELECT TOP 100
  CONVERT(VARCHAR(10), p.FechaTrx, 103)            AS Fecha,
  ISNULL(p.NoDocumento, '')                        AS NoDocumento,
  ISNULL(p.NoCheque, '')                           AS NoCheque,
  LEFT(ISNULL(p.Descripcion, ''), 80)              AS Descripcion,
  ROUND(ISNULL(p.PayAmt, 0), 2)                    AS Monto,
  ISNULL(cb.CodMoneda, '')                         AS Moneda,
  ISNULL(cb.Descripcion, '')                       AS Banco,
  CASE p.MedioDePago
    WHEN 0 THEN 'Sin clasificar (revisar)'
    WHEN 4 THEN 'Compensación NC (OK)'
    WHEN 6 THEN 'Canje de Letra (OK)'
    ELSE 'Otro' END                                AS MedioDescripcion,
  p.MedioDePago                                    AS MedioCodigo,
  ISNULL(p.CodIdentificadorReferencia, '')         AS Beneficiario,
  ISNULL(p.NumeroOperacion, '')                    AS NumOperacion,
  ISNULL(p.EstadoDoc, '')                          AS Estado,
  ROUND(ISNULL(p.PayAmt, 0) * 0.295, 2)            AS RiesgoFiscalIR,
  ROUND(ISNULL(p.PayAmt, 0) * 0.18, 2)             AS RiesgoFiscalIGV
FROM CMO.dbo.OB_Pago p
LEFT JOIN CMO.dbo.OB_CuentaBanco cb ON p.BankAccount_ID = cb.BankAccount_ID
WHERE p.CodIdentificador = '${codEmpresa}'
  AND YEAR(p.FechaTrx) = ${year}
  AND ((cb.CodMoneda = '01' AND p.PayAmt > 3500) OR (cb.CodMoneda = '02' AND p.PayAmt > 1000))
  AND (p.MedioDePago IS NULL OR p.MedioDePago = 0)
ORDER BY p.PayAmt DESC
`;

// Pagos a beneficiarios SIN cuenta bancaria registrada — riesgo operativo
const QUERY_BENEFICIARIOS_SIN_CUENTA = (codEmpresa, year) => `
SELECT TOP 50
  p.CodIdentificadorReferencia                     AS Beneficiario,
  COUNT(*)                                          AS NumPagos,
  ROUND(SUM(p.PayAmt), 2)                          AS MontoTotal,
  ROUND(MAX(p.PayAmt), 2)                          AS MontoMaximo,
  CONVERT(VARCHAR(10), MAX(p.FechaTrx), 103)       AS UltimoPago,
  ISNULL(i.Descripcion, '(sin tercero)')           AS NombreBeneficiario
FROM CMO.dbo.OB_Pago p
LEFT JOIN CMO.dbo.Identificador i ON p.CodIdentificadorReferencia = i.CodIdentificador
LEFT JOIN CMO.dbo.OB_CuentaBanco cb ON p.BankAccount_ID = cb.BankAccount_ID
WHERE p.CodIdentificador = '${codEmpresa}'
  AND YEAR(p.FechaTrx) = ${year}
  AND ((cb.CodMoneda = '01' AND p.PayAmt > 3500) OR (cb.CodMoneda = '02' AND p.PayAmt > 1000))
  AND NOT EXISTS (
    SELECT 1 FROM CMO.dbo.IdentificadorCuentaBanco icb
    WHERE icb.CodIdentificador = p.CodIdentificadorReferencia
  )
  AND p.CodIdentificadorReferencia IS NOT NULL
  AND p.CodIdentificadorReferencia <> ''
GROUP BY p.CodIdentificadorReferencia, i.Descripcion
ORDER BY SUM(p.PayAmt) DESC
`;

// FASE A.5 — Módulo de Caja-Banco completo

// QUERY_OB_LIBROS_CAJA: catálogo de libros de caja por empresa
const QUERY_OB_LIBROS_CAJA = (codEmpresa) => `
SELECT
  lc.LibroCaja_ID                                  AS LibroCajaId,
  ISNULL(lc.Nombre, '')                            AS Nombre,
  ISNULL(lc.Descripcion, '')                       AS Descripcion,
  lc.BankAccount_ID                                AS BankAccountId,
  ISNULL(cb.Descripcion, '')                       AS BancoDescripcion,
  ISNULL(cb.NoCuenta, '')                          AS NoCuenta,
  lc.CodMoneda                                     AS Moneda,
  CONVERT(VARCHAR(10), lc.FechaInicial, 103)       AS FechaInicial,
  CONVERT(VARCHAR(10), lc.FechaFinal, 103)         AS FechaFinal,
  lc.Activo                                        AS Activo,
  lc.Predeterminado                                AS Predeterminado,
  lc.ProcesoAutomatico                             AS ProcesoAutomatico,
  (SELECT COUNT(*) FROM CMO.dbo.OB_Caja c WHERE c.LibroCaja_ID = lc.LibroCaja_ID) AS NumOperaciones
FROM CMO.dbo.OB_LibroCaja lc
LEFT JOIN CMO.dbo.OB_CuentaBanco cb ON lc.BankAccount_ID = cb.BankAccount_ID
WHERE lc.CodIdentificadorEmpresa = '${codEmpresa}'
ORDER BY lc.Activo DESC, lc.FechaInicial DESC
`;

// QUERY_OB_CAJA: operaciones de caja agrupadas con totales
const QUERY_OB_CAJA = (codEmpresa, year) => `
SELECT TOP 500
  c.Caja_ID                                        AS CajaId,
  c.LibroCaja_ID                                   AS LibroCajaId,
  LEFT(ISNULL(lc.Nombre, ''), 60)                  AS LibroNombre,
  CONVERT(VARCHAR(10), c.FechaEstado, 103)         AS Fecha,
  ROUND(ISNULL(c.BalanceInicial, 0), 2)            AS BalanceInicial,
  ROUND(ISNULL(c.BalanceFinal, 0), 2)              AS BalanceFinal,
  ROUND(ISNULL(c.DiferenciaEstado, 0), 2)          AS Diferencia,
  ISNULL(c.EstadoDoc, '')                          AS EstadoDoc,
  (SELECT COUNT(*) FROM CMO.dbo.OB_DetalleCaja dc WHERE dc.Caja_ID = c.Caja_ID) AS NumLineas,
  (SELECT ROUND(SUM(ISNULL(dc.Monto,0)), 2) FROM CMO.dbo.OB_DetalleCaja dc WHERE dc.Caja_ID = c.Caja_ID) AS MontoTotal
FROM CMO.dbo.OB_Caja c
LEFT JOIN CMO.dbo.OB_LibroCaja lc ON c.LibroCaja_ID = lc.LibroCaja_ID
WHERE c.CodIdentificador = '${codEmpresa}'
  AND YEAR(c.FechaEstado) = ${year}
ORDER BY c.FechaEstado DESC
`;

// QUERY_OB_ASIGNACIONES_METRICAS: análisis agregado de OB_DetalleAsignacion por empresa
// Esta tabla es el VÍNCULO clave entre Pago↔Factura↔Asiento.
// Métrica crítica: pagos en OB_Pago SIN DetalleAsignacion = pagos sin sustento documental.
const QUERY_OB_ASIGNACIONES_METRICAS = (codEmpresa, year) => `
SELECT
  COUNT(DISTINCT p.Pago_ID)                        AS PagosTotalAnio,
  COUNT(DISTINCT da.Pago_ID)                       AS PagosConAsignacion,
  COUNT(DISTINCT p.Pago_ID) - COUNT(DISTINCT da.Pago_ID) AS PagosSinAsignacion,
  COUNT(da.DetalleAsignacion_ID)                   AS TotalAsignaciones,
  ROUND(ISNULL(SUM(da.Monto), 0), 2)               AS MontoTotalAsignado,
  ROUND(ISNULL(SUM(da.MontoRetencion), 0), 2)      AS MontoTotalRetencion,
  ROUND(ISNULL(SUM(da.MontoPercepcion), 0), 2)     AS MontoTotalPercepcion,
  COUNT(DISTINCT CASE WHEN da.Factura_ID > 0 THEN da.DetalleAsignacion_ID END) AS AsignAFacturas,
  COUNT(DISTINCT CASE WHEN da.DetalleCaja_ID > 0 THEN da.DetalleAsignacion_ID END) AS AsignACaja,
  COUNT(DISTINCT CASE WHEN da.NroCompensacionDocumento IS NOT NULL THEN da.DetalleAsignacion_ID END) AS AsignConCompensacion
FROM CMO.dbo.OB_Pago p
LEFT JOIN CMO.dbo.OB_DetalleAsignacion da ON p.Pago_ID = da.Pago_ID
WHERE p.CodIdentificador = '${codEmpresa}'
  AND YEAR(p.FechaTrx) = ${year}
`;

// QUERY_PAGOS_SIN_ASIGNACION: detalle de pagos sin sustento documental (TOP 100)
const QUERY_PAGOS_SIN_ASIGNACION = (codEmpresa, year) => `
SELECT TOP 100
  CONVERT(VARCHAR(10), p.FechaTrx, 103)            AS Fecha,
  ISNULL(p.NoDocumento, '')                        AS NoDocumento,
  ISNULL(p.NoCheque, '')                           AS NoCheque,
  LEFT(ISNULL(p.Descripcion, ''), 80)              AS Descripcion,
  ROUND(ISNULL(p.PayAmt, 0), 2)                    AS Monto,
  ISNULL(cb.Descripcion, '')                       AS Banco,
  ISNULL(p.EstadoDoc, '')                          AS Estado,
  ISNULL(p.NumeroOperacion, '')                    AS NumOperacion
FROM CMO.dbo.OB_Pago p
LEFT JOIN CMO.dbo.OB_CuentaBanco cb ON p.BankAccount_ID = cb.BankAccount_ID
WHERE p.CodIdentificador = '${codEmpresa}'
  AND YEAR(p.FechaTrx) = ${year}
  AND NOT EXISTS (SELECT 1 FROM CMO.dbo.OB_DetalleAsignacion da WHERE da.Pago_ID = p.Pago_ID)
  AND ISNULL(p.PayAmt, 0) > 0
ORDER BY p.PayAmt DESC
`;

// QUERY_COMPENSACIONES: compensaciones intercompañía / netos entre documentos
const QUERY_COMPENSACIONES = (codEmpresa) => `
SELECT TOP 200
  cdp.NroCDP                                       AS NroCDP,
  cdp.NroCompensacionDocumento                     AS NroCompensacion,
  CONVERT(VARCHAR(10), cdp.CreacionFecha, 103)     AS FechaCreacion,
  cdp.CreacionUsuario                              AS UsuarioCreacion,
  ROUND(ISNULL(da.Monto, 0), 2)                    AS Monto,
  ROUND(ISNULL(da.MontoPago, 0), 2)                AS MontoPago,
  da.Factura_ID                                    AS FacturaId,
  da.Pago_ID                                       AS PagoId,
  ISNULL(p.NoDocumento, '')                        AS PagoDocumento,
  ISNULL(p.CodIdentificador, '')                   AS PagoCodIdentificador,
  LEFT(ISNULL(p.Descripcion, ''), 60)              AS PagoDescripcion
FROM CMO.dbo.CompensacionDocumentoPago cdp
LEFT JOIN CMO.dbo.OB_DetalleAsignacion da ON cdp.NroDCP = da.NroDCP
LEFT JOIN CMO.dbo.OB_Pago p ON da.Pago_ID = p.Pago_ID
WHERE p.CodIdentificador = '${codEmpresa}'
ORDER BY cdp.CreacionFecha DESC
`;

// OB_Pago — Libro de Pagos del módulo de Tesorería de S10.
// Esto es el módulo donde la empresa registra CADA PAGO emitido (cheque, transferencia,
// detracción, planilla, etc.). Es paralelo a AsientoContable pero con detalle operativo
// (NoCheque, BankAccount_ID, EstadoDoc=anulado/vigente, etc.).
// Año en curso para no inflar el payload.
const QUERY_OB_PAGOS = (codEmpresa, year) => `
SELECT TOP 1000
  CONVERT(VARCHAR(10), p.FechaTrx, 103)            AS Fecha,
  ISNULL(p.NoDocumento, '')                        AS NoDocumento,
  ISNULL(p.NoCheque, '')                           AS NoCheque,
  LEFT(ISNULL(p.Descripcion, ''), 80)              AS Descripcion,
  ROUND(ISNULL(p.PayAmt, 0), 2)                    AS Monto,
  ISNULL(cb.Descripcion, '')                       AS Banco,
  ISNULL(cb.NoCuenta, '')                          AS NoCuenta,
  ISNULL(cb.CodMoneda, '')                         AS Moneda,
  ISNULL(p.MedioDePago, '')                        AS MedioPago,
  ISNULL(p.EstadoDoc, '')                          AS Estado,
  ISNULL(p.PagoElectronico, 0)                     AS EsElectronico,
  ISNULL(p.NumeroOperacion, '')                    AS NumOperacion,
  ISNULL(p.CodIdentificadorReferencia, '')         AS Beneficiario
FROM CMO.dbo.OB_Pago p
LEFT JOIN CMO.dbo.OB_CuentaBanco cb ON p.BankAccount_ID = cb.BankAccount_ID
WHERE p.CodIdentificador = '${codEmpresa}'
  AND YEAR(p.FechaTrx) = ${year}
ORDER BY p.FechaTrx DESC
`;

// Conciliación Bancaria — resumen por cuenta con último estado de cuenta cargado.
// Captura el estado del módulo OB_EstadoBanco / OB_EstadoBancoDetalle de S10,
// que es donde la empresa carga manualmente los estados de cuenta de cada
// banco para conciliar contra la contabilidad. Si una cuenta NO tiene estados
// de cuenta cargados, es señal de FALTA TOTAL DE CONCILIACIÓN BANCARIA.
const QUERY_CONCILIACION_BANCARIA = (codEmpresa) => `
WITH UltimoEstado AS (
  SELECT BankAccount_ID, MAX(Al) AS UltimoAl
  FROM CMO.dbo.OB_EstadoBanco
  GROUP BY BankAccount_ID
)
SELECT
  cb.BankAccount_ID                                AS BankAccountId,
  cb.NoCuenta                                      AS NoCuenta,
  LEFT(cb.Descripcion, 60)                         AS DesCuenta,
  cb.CodMoneda                                     AS Moneda,
  cb.CodIdentificador                              AS CodEmpresa,
  ROUND(ISNULL(cb.BalanceActual, 0), 2)            AS BalanceContable,
  ROUND(ISNULL(cb.BalanceReal, 0), 2)              AS BalanceReal,
  CONVERT(VARCHAR(10), eb.Del, 103)                AS UltimoEstadoDel,
  CONVERT(VARCHAR(10), eb.Al, 103)                 AS UltimoEstadoAl,
  ROUND(ISNULL(eb.SaldoContableInicial, 0), 2)     AS UltimoSaldoInicialBanco,
  ROUND(ISNULL(eb.SaldoContableFinal, 0), 2)       AS UltimoSaldoFinalBanco,
  ROUND(ISNULL(eb.DepositoEfectivo, 0)
        + ISNULL(eb.OtrosAbono, 0)
        + ISNULL(eb.InteresesAcreedores, 0), 2)    AS TotalAbonosBanco,
  ROUND(ISNULL(eb.ChequesPagados, 0)
        + ISNULL(eb.OtrosCargos, 0)
        + ISNULL(eb.InteresesDeudores, 0), 2)      AS TotalCargosBanco,
  (SELECT COUNT(*) FROM CMO.dbo.OB_EstadoBancoDetalle d
   WHERE d.NroEstadoBanco = eb.NroEstadoBanco)     AS NumMovimientos,
  (SELECT COUNT(*) FROM CMO.dbo.OB_EstadoBancoDetalle d
   WHERE d.NroEstadoBanco = eb.NroEstadoBanco AND d.ConciliarEstado = 1) AS NumConciliados,
  (SELECT COUNT(*) FROM CMO.dbo.OB_EstadoBancoDetalle d
   WHERE d.NroEstadoBanco = eb.NroEstadoBanco AND (d.ConciliarEstado IS NULL OR d.ConciliarEstado = 0)) AS NumSinConciliar,
  (SELECT COUNT(DISTINCT NroEstadoBanco) FROM CMO.dbo.OB_EstadoBanco eb2 WHERE eb2.BankAccount_ID = cb.BankAccount_ID) AS TotalEstadosHistoricos,
  DATEDIFF(DAY, eb.Al, GETDATE())                  AS DiasDesdeUltimoEstado
FROM CMO.dbo.OB_CuentaBanco cb
LEFT JOIN UltimoEstado ue ON cb.BankAccount_ID = ue.BankAccount_ID
LEFT JOIN CMO.dbo.OB_EstadoBanco eb ON cb.BankAccount_ID = eb.BankAccount_ID AND eb.Al = ue.UltimoAl
WHERE cb.CodIdentificador = '${codEmpresa}'
  AND cb.Activo = 1
ORDER BY ABS(ISNULL(cb.BalanceActual, 0)) DESC
`;

// Movimientos bancarios SIN CONCILIAR — top 100 más recientes por empresa
// Estos son movimientos del extracto del banco que NO se han cuadrado contra
// la contabilidad. Cada uno representa un riesgo de conciliación pendiente.
const QUERY_MOVIMIENTOS_SIN_CONCILIAR = (codEmpresa) => `
SELECT TOP 100
  CONVERT(VARCHAR(10), d.FechaTransaccion, 103)    AS Fecha,
  LEFT(cb.Descripcion, 50)                         AS DesCuenta,
  cb.CodMoneda                                     AS Moneda,
  LEFT(ISNULL(d.Descripcion, ''), 80)              AS DescMovimiento,
  ISNULL(d.NumeroOperacion, '')                    AS NumOperacion,
  ISNULL(d.NumeroCheque, '')                       AS NumCheque,
  ROUND(ISNULL(d.Cargo, 0), 2)                     AS Cargo,
  ROUND(ISNULL(d.Abono, 0), 2)                     AS Abono,
  CONVERT(VARCHAR(10), eb.Del, 103)                AS EstadoDel,
  CONVERT(VARCHAR(10), eb.Al, 103)                 AS EstadoAl
FROM CMO.dbo.OB_EstadoBancoDetalle d
JOIN CMO.dbo.OB_EstadoBanco eb ON d.NroEstadoBanco = eb.NroEstadoBanco
JOIN CMO.dbo.OB_CuentaBanco cb ON eb.BankAccount_ID = cb.BankAccount_ID
WHERE cb.CodIdentificador = '${codEmpresa}'
  AND (d.ConciliarEstado IS NULL OR d.ConciliarEstado = 0)
ORDER BY d.FechaTransaccion DESC
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
// QUERIES FORENSES (Batch 4) — mismas 25 que validation-agent.js
// Prefijo VQ_ para distinguirlas de las queries de sync.
// ─────────────────────────────────────────────

const VQ_RUC_GRUPO = ['22011489', '80688541', '80688706', '80688524', '20557987541'];

const VQ_PARTIDA_DOBLE = (cod, year) => `
SELECT
  ${year} AS Anio,
  COUNT(*) AS NumAsientos,
  ROUND(SUM(ISNULL(Debito, 0)), 2)  AS SumDebito,
  ROUND(SUM(ISNULL(Credito, 0)), 2) AS SumCredito,
  ROUND(ABS(SUM(ISNULL(Debito, 0)) - SUM(ISNULL(Credito, 0))), 2) AS Descuadre,
  COUNT(DISTINCT NroD) AS DocsDistintos,
  SUM(CASE WHEN NroD IS NULL THEN 1 ELSE 0 END) AS SinNroD
FROM CMO.dbo.AsientoContable
WHERE CodEmpresa = '${cod}'
  AND YEAR(FechaAplicacionContable) = ${year}
HAVING ABS(SUM(ISNULL(Debito, 0)) - SUM(ISNULL(Credito, 0))) > 0.01
`;

const VQ_APERTURA = (cod, year) => `
SELECT
  YEAR(ac.FechaAplicacionContable) AS Anio,
  CONVERT(VARCHAR(10), MIN(ac.FechaAplicacionContable), 103) AS PrimerAsiento,
  COUNT(*) AS NumAsientos,
  COUNT(DISTINCT LEFT(pcd.CodCuenta,2)) AS NumClases,
  ROUND(SUM(ISNULL(ac.Debito,0)), 2)  AS SumDebito,
  ROUND(SUM(ISNULL(ac.Credito,0)), 2) AS SumCredito,
  ROUND(ABS(SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0))), 2) AS Descuadre
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${cod}'
  AND YEAR(ac.FechaAplicacionContable) = ${year}
  AND (ac.Glosa LIKE '%APERTURA%' OR ac.Glosa LIKE '%INICIO%' OR ac.Glosa LIKE '%ASIENTO INICIAL%')
  AND MONTH(ac.FechaAplicacionContable) <= 2
GROUP BY YEAR(ac.FechaAplicacionContable)
HAVING ABS(SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0))) > 0.01
`;

const VQ_PATRIMONIO_DETALLE = (cod) => `
SELECT
  LEFT(pcd.CodCuenta, 2) AS Clase,
  LEFT(pcd.CodCuenta, 4) AS Grupo,
  pcd.CodCuenta,
  pcd.Descripcion AS DesCuenta,
  COUNT(*) AS NumAsientos,
  ROUND(SUM(ISNULL(ac.Debito,0)), 2)  AS SumDebito,
  ROUND(SUM(ISNULL(ac.Credito,0)), 2) AS SumCredito,
  ROUND(SUM(ISNULL(ac.Credito,0)) - SUM(ISNULL(ac.Debito,0)), 2) AS SaldoAcreedor,
  CONVERT(VARCHAR(10), MIN(ac.FechaAplicacionContable), 103) AS PrimerMov,
  CONVERT(VARCHAR(10), MAX(ac.FechaAplicacionContable), 103) AS UltimoMov
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${cod}'
  AND LEFT(pcd.CodCuenta, 2) IN ('50','51','52','57','58','59')
GROUP BY LEFT(pcd.CodCuenta,2), LEFT(pcd.CodCuenta,4), pcd.CodCuenta, pcd.Descripcion
HAVING SUM(ISNULL(ac.Credito,0)) - SUM(ISNULL(ac.Debito,0)) < -0.01
ORDER BY Clase, pcd.CodCuenta
`;

const VQ_FACTURAS_SIN_ASIENTO = (cod, year, claseIngreso) => `
SELECT TOP 50
  YEAR(doc.FechaDocumento) AS Anio,
  doc.SerieDocumento AS Serie,
  doc.NumeroDocumento AS Numero,
  CONVERT(VARCHAR(10), doc.FechaDocumento, 103) AS Fecha,
  doc.CodTipoDocumento AS Tipo,
  doc.DescripcionTipoDocumento AS DesTipo,
  doc.DescripcionIdentificador AS Cliente,
  doc.RUC,
  ROUND(ISNULL(doc.Total, 0), 2) AS Total,
  ISNULL(doc.DescripcionEstado, '') AS Estado
FROM CMO.dbo.vw_12DocumentosPorCobrar doc
WHERE doc.CodEmpresa = '${cod}'
  AND YEAR(doc.FechaDocumento) IN (${year}, ${year - 1})
  AND doc.CodTipoDocumento IN ('060','125','128','131','134')
  AND NOT EXISTS (
    SELECT 1 FROM CMO.dbo.AsientoContable ac
    JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
    WHERE ac.CodEmpresa = doc.CodEmpresa
      AND ac.NroD = doc.NroD
      AND LEFT(pcd.CodCuenta, 2) = '${claseIngreso}'
  )
ORDER BY doc.Total DESC
`;

const VQ_FACTURAS_SIN_ASIENTO_HISTORICO = (cod, claseIngreso) => `
SELECT TOP 200
  YEAR(doc.FechaDocumento) AS Anio,
  doc.CodTipoDocumento AS Tipo,
  doc.SerieDocumento AS Serie,
  doc.NumeroDocumento AS Numero,
  CONVERT(VARCHAR(10), doc.FechaDocumento, 103) AS Fecha,
  doc.DescripcionTipoDocumento AS DesTipo,
  doc.DescripcionIdentificador AS Cliente,
  doc.RUC,
  ROUND(ISNULL(doc.Total, 0), 2) AS Total,
  ISNULL(doc.DescripcionEstado, '') AS Estado
FROM CMO.dbo.vw_12DocumentosPorCobrar doc
WHERE doc.CodEmpresa = '${cod}'
  AND doc.CodTipoDocumento IN ('060','125','128','131','134')
  AND NOT EXISTS (
    SELECT 1 FROM CMO.dbo.AsientoContable ac
    JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
    WHERE ac.CodEmpresa = doc.CodEmpresa
      AND ac.NroD = doc.NroD
      AND LEFT(pcd.CodCuenta, 2) = '${claseIngreso}'
  )
ORDER BY YEAR(doc.FechaDocumento) DESC, doc.Total DESC
`;

const VQ_FACTURAS_SIN_ASIENTO_RESUMEN = (cod, claseIngreso) => `
SELECT
  YEAR(doc.FechaDocumento) AS Anio,
  doc.CodTipoDocumento AS Tipo,
  COUNT(*) AS NumFacturas,
  ROUND(SUM(ISNULL(doc.Total,0) * CASE WHEN doc.CodMoneda='01' THEN 1.0 ELSE ISNULL(doc.TipoCambio,3.80) END), 2) AS MontoTotal
FROM CMO.dbo.vw_12DocumentosPorCobrar doc
WHERE doc.CodEmpresa = '${cod}'
  AND doc.CodTipoDocumento IN ('060','125','128','131','134')
  AND NOT EXISTS (
    SELECT 1 FROM CMO.dbo.AsientoContable ac
    JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
    WHERE ac.CodEmpresa = doc.CodEmpresa
      AND ac.NroD = doc.NroD
      AND LEFT(pcd.CodCuenta, 2) = '${claseIngreso}'
  )
GROUP BY YEAR(doc.FechaDocumento), doc.CodTipoDocumento
ORDER BY Anio DESC, Tipo
`;

const VQ_INGRESOS_SIN_DOC = (cod, year, claseIngreso) => `
SELECT
  ac.CodUnico AS NroAsiento,
  CONVERT(VARCHAR(10), ac.FechaAplicacionContable, 103) AS Fecha,
  pcd.CodCuenta,
  pcd.Descripcion AS DesCuenta,
  LEFT(ISNULL(ac.Glosa,''), 100) AS Glosa,
  ROUND(ISNULL(ac.Debito,0), 2)  AS Debito,
  ROUND(ISNULL(ac.Credito,0), 2) AS Credito,
  ISNULL(i.Descripcion,'') AS Tercero
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
LEFT JOIN CMO.dbo.Identificador i ON ac.CodIdentificador = i.CodIdentificador
WHERE ac.CodEmpresa = '${cod}'
  AND YEAR(ac.FechaAplicacionContable) = ${year}
  AND LEFT(pcd.CodCuenta, 2) = '${claseIngreso}'
  AND ac.NroD IS NULL
ORDER BY ABS(ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0)) DESC
`;

const VQ_SUELDOS_AGING = (cod, year) => `
SELECT
  YEAR(ac.FechaAplicacionContable)  AS Anio,
  MONTH(ac.FechaAplicacionContable) AS Mes,
  COUNT(*) AS NumAsientos,
  ROUND(SUM(ISNULL(ac.Credito,0)), 2) AS Provisionado,
  ROUND(SUM(ISNULL(ac.Debito,0)), 2)  AS Pagado,
  ROUND(SUM(ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0)), 2) AS SaldoMes
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${cod}'
  AND pcd.CodCuenta LIKE '4111%'
  AND YEAR(ac.FechaAplicacionContable) >= ${year} - 2
GROUP BY YEAR(ac.FechaAplicacionContable), MONTH(ac.FechaAplicacionContable)
HAVING ROUND(SUM(ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0)), 2) > 100
ORDER BY Anio DESC, Mes DESC
`;

const VQ_CTS_DEPOSITOS_HISTORICO = (cod, year) => `
SELECT
  YEAR(ac.FechaAplicacionContable)  AS Anio,
  MONTH(ac.FechaAplicacionContable) AS Mes,
  COUNT(*) AS NumAsientos,
  ROUND(SUM(ISNULL(ac.Credito,0)), 2) AS Provisionado,
  ROUND(SUM(ISNULL(ac.Debito,0)), 2)  AS Pagado,
  ROUND(SUM(ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0)), 2) AS SaldoPorDepositar,
  CASE
    WHEN MONTH(ac.FechaAplicacionContable) = 5  THEN 'CTS Primer Semestre'
    WHEN MONTH(ac.FechaAplicacionContable) = 11 THEN 'CTS Segundo Semestre'
    WHEN MONTH(ac.FechaAplicacionContable) = 4  THEN 'CTS Anticipado May'
    WHEN MONTH(ac.FechaAplicacionContable) = 10 THEN 'CTS Anticipado Nov'
    ELSE 'Provisión/Otros'
  END AS Tipo
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${cod}'
  AND pcd.CodCuenta LIKE '4151%'
  AND YEAR(ac.FechaAplicacionContable) >= ${year} - 2
GROUP BY YEAR(ac.FechaAplicacionContable), MONTH(ac.FechaAplicacionContable)
HAVING ROUND(SUM(ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0)), 2) > 100
ORDER BY Anio DESC, Mes DESC
`;

const VQ_PARTICIPACIONES = (cod, year) => `
SELECT
  pcd.CodCuenta,
  pcd.Descripcion AS DesCuenta,
  YEAR(ac.FechaAplicacionContable) AS Anio,
  COUNT(*) AS NumAsientos,
  ROUND(SUM(ISNULL(ac.Credito,0)), 2) AS Provisionado,
  ROUND(SUM(ISNULL(ac.Debito,0)), 2)  AS Pagado,
  ROUND(SUM(ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0)), 2) AS Saldo,
  CONVERT(VARCHAR(10), MIN(ac.FechaAplicacionContable), 103) AS PrimerMov,
  CONVERT(VARCHAR(10), MAX(ac.FechaAplicacionContable), 103) AS UltimoMov
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${cod}'
  AND pcd.CodCuenta LIKE '413%'
  AND YEAR(ac.FechaAplicacionContable) >= ${year} - 2
GROUP BY pcd.CodCuenta, pcd.Descripcion, YEAR(ac.FechaAplicacionContable)
HAVING ROUND(SUM(ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0)), 2) > 100
ORDER BY pcd.CodCuenta, Anio DESC
`;

const VQ_BANCOS_DETALLE = (cod) => `
SELECT
  pcd.CodCuenta,
  pcd.Descripcion AS DesBanco,
  COUNT(*) AS NumAsientos,
  ROUND(SUM(ISNULL(ac.Debito,0)), 2)  AS SumDebito,
  ROUND(SUM(ISNULL(ac.Credito,0)), 2) AS SumCredito,
  ROUND(SUM(ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0)), 2) AS SaldoNeto,
  ROUND(SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) <= 2022 THEN ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0) ELSE 0 END), 2) AS SaldoFin2022,
  ROUND(SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) <= 2023 THEN ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0) ELSE 0 END), 2) AS SaldoFin2023,
  ROUND(SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) <= 2024 THEN ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0) ELSE 0 END), 2) AS SaldoFin2024,
  ROUND(SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) <= 2025 THEN ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0) ELSE 0 END), 2) AS SaldoFin2025,
  CONVERT(VARCHAR(10), MIN(ac.FechaAplicacionContable), 103) AS PrimerMov,
  CONVERT(VARCHAR(10), MAX(ac.FechaAplicacionContable), 103) AS UltimoMov
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${cod}'
  AND LEFT(pcd.CodCuenta, 2) = '10'
GROUP BY pcd.CodCuenta, pcd.Descripcion
HAVING SUM(ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0)) < -0.5
ORDER BY SUM(ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0)) ASC
`;

const VQ_OB_CUENTAS_BANCO = (cod) => `
SELECT
  cb.BankAccount_ID AS BankAccountId,
  cb.NoCuenta,
  LEFT(cb.Descripcion, 60) AS DesBanco,
  cb.CodMoneda AS Moneda,
  ROUND(ISNULL(cb.BalanceActual, 0), 2) AS BalanceActual,
  ROUND(ISNULL(cb.BalanceReal, 0), 2)   AS BalanceReal,
  ROUND(ISNULL(cb.BalanceActual, 0) - ISNULL(cb.BalanceReal, 0), 2) AS Diferencia,
  (SELECT COUNT(*) FROM CMO.dbo.OB_EstadoBanco eb WHERE eb.BankAccount_ID = cb.BankAccount_ID) AS NumEstados,
  (SELECT CONVERT(VARCHAR(10), MAX(eb.Al), 103) FROM CMO.dbo.OB_EstadoBanco eb WHERE eb.BankAccount_ID = cb.BankAccount_ID) AS UltimoEstadoAl,
  (SELECT DATEDIFF(DAY, MAX(eb.Al), GETDATE()) FROM CMO.dbo.OB_EstadoBanco eb WHERE eb.BankAccount_ID = cb.BankAccount_ID) AS DiasDesdeEstado
FROM CMO.dbo.OB_CuentaBanco cb
WHERE cb.CodIdentificador = '${cod}'
  AND cb.Activo = 1
  AND (
    ABS(ISNULL(cb.BalanceActual,0) - ISNULL(cb.BalanceReal,0)) > 0.5
    OR (SELECT COUNT(*) FROM CMO.dbo.OB_EstadoBanco eb WHERE eb.BankAccount_ID = cb.BankAccount_ID) = 0
    OR (SELECT DATEDIFF(DAY, MAX(eb.Al), GETDATE()) FROM CMO.dbo.OB_EstadoBanco eb WHERE eb.BankAccount_ID = cb.BankAccount_ID) > 60
  )
ORDER BY ABS(ISNULL(cb.BalanceActual,0) - ISNULL(cb.BalanceReal,0)) DESC
`;

const VQ_BANCARIZACION_FORENSE = (cod, year) => `
SELECT
  COUNT(*) AS PagosTotalAnio,
  SUM(CASE WHEN ((cb.CodMoneda='01' AND p.PayAmt>3500) OR (cb.CodMoneda='02' AND p.PayAmt>1000)) THEN 1 ELSE 0 END) AS PagosMateriales,
  ROUND(SUM(CASE WHEN ((cb.CodMoneda='01' AND p.PayAmt>3500) OR (cb.CodMoneda='02' AND p.PayAmt>1000)) THEN p.PayAmt ELSE 0 END), 2) AS MontoMaterial,
  SUM(CASE WHEN ((cb.CodMoneda='01' AND p.PayAmt>3500) OR (cb.CodMoneda='02' AND p.PayAmt>1000)) AND p.MedioDePago IN (1,2,3,5,7) THEN 1 ELSE 0 END) AS PagosBancarizados,
  SUM(CASE WHEN ((cb.CodMoneda='01' AND p.PayAmt>3500) OR (cb.CodMoneda='02' AND p.PayAmt>1000)) AND (p.MedioDePago IS NULL OR p.MedioDePago=0) THEN 1 ELSE 0 END) AS PagosNoBancarizados,
  SUM(CASE WHEN ((cb.CodMoneda='01' AND p.PayAmt>3500) OR (cb.CodMoneda='02' AND p.PayAmt>1000)) AND p.MedioDePago=4 THEN 1 ELSE 0 END) AS PagosCompensacionNC,
  SUM(CASE WHEN ((cb.CodMoneda='01' AND p.PayAmt>3500) OR (cb.CodMoneda='02' AND p.PayAmt>1000)) AND p.MedioDePago=6 THEN 1 ELSE 0 END) AS PagosCanjeLetra
FROM CMO.dbo.OB_Pago p
LEFT JOIN CMO.dbo.OB_CuentaBanco cb ON p.BankAccount_ID = cb.BankAccount_ID
WHERE p.CodIdentificador = '${cod}'
  AND YEAR(p.FechaTrx) = ${year}
HAVING SUM(CASE WHEN ((cb.CodMoneda='01' AND p.PayAmt>3500) OR (cb.CodMoneda='02' AND p.PayAmt>1000))
                    AND (p.MedioDePago IS NULL OR p.MedioDePago=0) THEN 1 ELSE 0 END) > 0
`;

const VQ_PERGOLA_AGING = (cod) => `
SELECT
  doc.SerieDocumento + '-' + doc.NumeroDocumento AS Documento,
  CONVERT(VARCHAR(10), doc.FechaDocumento, 103) AS FechaDoc,
  CONVERT(VARCHAR(10), doc.FechaVencimiento, 103) AS FechaVenc,
  DATEDIFF(DAY, doc.FechaVencimiento, GETDATE()) AS DiasVencido,
  doc.DescripcionIdentificador AS Cliente,
  doc.RUC,
  ROUND(ISNULL(doc.Total,0), 2) AS Total,
  ROUND(ISNULL(doc.TotalPagado,0), 2) AS Pagado,
  ROUND(ISNULL(doc.Total,0) - ISNULL(doc.TotalPagado,0), 2) AS Saldo,
  ISNULL(doc.DescripcionEstado,'') AS Estado
FROM CMO.dbo.vw_12DocumentosPorCobrar doc
WHERE doc.CodEmpresa = '${cod}'
  AND (doc.DescripcionIdentificador LIKE '%PERGOLA%' OR doc.DescripcionIdentificador LIKE '%PÉRGOLA%')
  AND (doc.Total - ISNULL(doc.TotalPagado,0)) > 0.5
ORDER BY doc.FechaDocumento DESC
`;

const VQ_CXC_CONCENTRACION = (cod) => `
SELECT TOP 20
  ISNULL(i.Descripcion, CAST(ac.CodIdentificador AS VARCHAR)) AS Cliente,
  ac.CodIdentificador,
  ROUND(SUM(ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0)), 2) AS Saldo,
  ROUND(SUM(CASE WHEN ac.FechaAplicacionContable < DATEADD(DAY,-90,GETDATE())
                 THEN ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0) ELSE 0 END), 2) AS Vencido90Mas,
  ROUND(SUM(CASE WHEN ac.FechaAplicacionContable < DATEADD(DAY,-180,GETDATE())
                 THEN ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0) ELSE 0 END), 2) AS Vencido180Mas,
  CONVERT(VARCHAR(10), MIN(ac.FechaAplicacionContable), 103) AS PrimerMov,
  CONVERT(VARCHAR(10), MAX(ac.FechaAplicacionContable), 103) AS UltimoMov
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
LEFT JOIN CMO.dbo.Identificador i ON ac.CodIdentificador = i.CodIdentificador
WHERE ac.CodEmpresa = '${cod}'
  AND LEFT(pcd.CodCuenta,2) = '12'
GROUP BY i.Descripcion, ac.CodIdentificador
HAVING SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0)) > 1000
ORDER BY Saldo DESC
`;

const VQ_INTERCOMPANY = (cod) => `
SELECT
  LEFT(pcd.CodCuenta,2) AS Clase,
  pcd.CodCuenta,
  pcd.Descripcion AS DesCuenta,
  ac.CodIdentificador AS CodTercero,
  ISNULL(i.Descripcion, '') AS Tercero,
  ISNULL(i.RUC, '') AS RUC,
  COUNT(*) AS NumAsientos,
  ROUND(SUM(ISNULL(ac.Debito,0)), 2)  AS SumDebito,
  ROUND(SUM(ISNULL(ac.Credito,0)), 2) AS SumCredito,
  ROUND(SUM(ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0)), 2) AS Saldo,
  CONVERT(VARCHAR(10), MIN(ac.FechaAplicacionContable), 103) AS PrimerMov,
  CONVERT(VARCHAR(10), MAX(ac.FechaAplicacionContable), 103) AS UltimoMov
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
LEFT JOIN CMO.dbo.Identificador i ON ac.CodIdentificador = i.CodIdentificador
WHERE ac.CodEmpresa = '${cod}'
  AND LEFT(pcd.CodCuenta,2) IN ('14','16','17')
  AND (
    i.RUC IN (${VQ_RUC_GRUPO.map((r) => `'${r}'`).join(',')})
    OR ac.CodIdentificador IN (${VQ_RUC_GRUPO.map((r) => `'${r}'`).join(',')})
    OR ISNULL(i.Descripcion,'') LIKE '%CMO%'
    OR ISNULL(i.Descripcion,'') LIKE '%INTEGRAL%'
    OR ISNULL(i.Descripcion,'') LIKE '%MEDARQ%'
    OR ISNULL(i.Descripcion,'') LIKE '%AMERICANA%'
  )
GROUP BY LEFT(pcd.CodCuenta,2), pcd.CodCuenta, pcd.Descripcion, ac.CodIdentificador, i.Descripcion, i.RUC
HAVING ABS(SUM(ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0))) > 100
ORDER BY ABS(SUM(ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0))) DESC
`;

const VQ_ACTIVO_FIJO_COHERENCIA = (cod) => `
SELECT
  LEFT(pcd.CodCuenta, 2) AS Clase,
  pcd.CodCuenta,
  LEFT(pcd.Descripcion, 50) AS DesCuenta,
  COUNT(*) AS NumAsientos,
  ROUND(SUM(ISNULL(ac.Debito,0)), 2)  AS SumDebito,
  ROUND(SUM(ISNULL(ac.Credito,0)), 2) AS SumCredito,
  ROUND(
    CASE WHEN LEFT(pcd.CodCuenta,2) = '33'
         THEN SUM(ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0))
         ELSE SUM(ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0))
    END, 2) AS SaldoNatural
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${cod}'
  AND LEFT(pcd.CodCuenta, 2) IN ('33', '39', '68')
GROUP BY LEFT(pcd.CodCuenta,2), pcd.CodCuenta, pcd.Descripcion
HAVING
  (LEFT(pcd.CodCuenta,2) = '33'       AND SUM(ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0)) < -0.5)
  OR (LEFT(pcd.CodCuenta,2) IN ('39','68') AND SUM(ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0)) < -0.5)
ORDER BY Clase, pcd.CodCuenta
`;

const VQ_TRAZABILIDAD_PAGO = (cod, year) => `
SELECT
  COUNT(DISTINCT p.Pago_ID) AS PagosTotal,
  COUNT(DISTINCT CASE WHEN da.Pago_ID IS NOT NULL THEN p.Pago_ID END) AS PagosConAsignacion,
  COUNT(DISTINCT CASE WHEN da.Pago_ID IS NULL THEN p.Pago_ID END) AS PagosSinAsignacion,
  ROUND(SUM(ISNULL(p.PayAmt, 0)), 2) AS MontoTotalPagos,
  ROUND(SUM(CASE WHEN da.Pago_ID IS NULL THEN ISNULL(p.PayAmt, 0) ELSE 0 END), 2) AS MontoSinAsignacion,
  COUNT(DISTINCT da.Factura_ID) AS FacturasReferenciadas,
  COUNT(DISTINCT CASE WHEN da.NroCompensacionDocumento IS NOT NULL THEN da.DetalleAsignacion_ID END) AS AsignConCompensacion
FROM CMO.dbo.OB_Pago p
LEFT JOIN CMO.dbo.OB_DetalleAsignacion da ON p.Pago_ID = da.Pago_ID
WHERE p.CodIdentificador = '${cod}'
  AND YEAR(p.FechaTrx) = ${year}
HAVING COUNT(DISTINCT CASE WHEN da.Pago_ID IS NULL THEN p.Pago_ID END) > 0
`;

const VQ_RECONCILIACION_INGRESOS = (cod, year, claseIngreso) => `
SELECT
  m.Mes,
  ISNULL(ing.MontoContable, 0) AS IngresosContables,
  ISNULL(fac.MontoFacturado, 0) AS MontoFacturado,
  ISNULL(ing.MontoContable, 0) - ISNULL(fac.MontoFacturado, 0) AS Diferencia
FROM (SELECT 1 AS Mes UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6
      UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12) m
LEFT JOIN (
  SELECT MONTH(ac.FechaAplicacionContable) AS Mes,
         ROUND(SUM(ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0)), 2) AS MontoContable
  FROM CMO.dbo.AsientoContable ac
  JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
  WHERE ac.CodEmpresa = '${cod}'
    AND YEAR(ac.FechaAplicacionContable) = ${year}
    AND LEFT(pcd.CodCuenta, 2) = '${claseIngreso}'
  GROUP BY MONTH(ac.FechaAplicacionContable)
) ing ON ing.Mes = m.Mes
LEFT JOIN (
  SELECT MONTH(doc.FechaDocumento) AS Mes,
         ROUND(SUM(CASE WHEN doc.CodTipoDocumento NOT IN ('128','134')
                        THEN ISNULL(doc.Total,0) * CASE WHEN doc.CodMoneda='01' THEN 1.0 ELSE ISNULL(doc.TipoCambio,3.80) END
                        ELSE -ISNULL(doc.Total,0) * CASE WHEN doc.CodMoneda='01' THEN 1.0 ELSE ISNULL(doc.TipoCambio,3.80) END
                   END), 2) AS MontoFacturado
  FROM CMO.dbo.vw_12DocumentosPorCobrar doc
  WHERE doc.CodEmpresa = '${cod}'
    AND YEAR(doc.FechaDocumento) = ${year}
    AND doc.CodTipoDocumento IN ('060','125','128','131','134')
  GROUP BY MONTH(doc.FechaDocumento)
) fac ON fac.Mes = m.Mes
WHERE m.Mes <= MONTH(GETDATE())
  AND ABS(ISNULL(ing.MontoContable, 0) - ISNULL(fac.MontoFacturado, 0)) > 100
ORDER BY m.Mes
`;

const VQ_TRIBUTOS_DETALLE = (cod, year) => `
SELECT
  pcd.CodCuenta,
  LEFT(pcd.Descripcion, 60) AS DesCuenta,
  COUNT(*) AS NumAsientos,
  ROUND(SUM(ISNULL(ac.Credito,0)), 2) AS Provisionado,
  ROUND(SUM(ISNULL(ac.Debito,0)), 2)  AS Pagado,
  ROUND(SUM(ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0)), 2) AS SaldoPorPagar,
  CONVERT(VARCHAR(10), MAX(ac.FechaAplicacionContable), 103) AS UltimoMov
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${cod}'
  AND LEFT(pcd.CodCuenta, 2) = '40'
  AND YEAR(ac.FechaAplicacionContable) = ${year}
GROUP BY pcd.CodCuenta, pcd.Descripcion
HAVING ABS(SUM(ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0))) > 0.5
ORDER BY ABS(SUM(ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0))) DESC
`;

const VQ_BALANCE_RESUMEN = (cod, year) => `
SELECT
  LEFT(pcd.CodCuenta, 1) AS GrupoMayor,
  LEFT(pcd.CodCuenta, 2) AS Clase,
  COUNT(*) AS NumAsientos,
  ROUND(SUM(ISNULL(ac.Debito,0)), 2)  AS SumDebito,
  ROUND(SUM(ISNULL(ac.Credito,0)), 2) AS SumCredito,
  ROUND(SUM(ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0)), 2) AS SaldoNeto,
  ROUND(SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) = ${year} THEN ISNULL(ac.Debito,0) ELSE 0 END), 2) AS DebitoAnio,
  ROUND(SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) = ${year} THEN ISNULL(ac.Credito,0) ELSE 0 END), 2) AS CreditoAnio
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${cod}'
GROUP BY LEFT(pcd.CodCuenta, 1), LEFT(pcd.CodCuenta, 2)
HAVING
  (LEFT(pcd.CodCuenta,1) IN ('1','2','3','6','9')
    AND SUM(ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0)) < -1000)
  OR (LEFT(pcd.CodCuenta,1) IN ('4','5','7')
    AND SUM(ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0)) > 1000)
ORDER BY Clase
`;

const VQ_FECHAS_ANOMALAS = (cod, year) => `
SELECT
  CASE
    WHEN ac.FechaAplicacionContable > GETDATE() THEN 'Futura'
    WHEN DATEPART(WEEKDAY, ac.FechaAplicacionContable) = 1 THEN 'Domingo'
    WHEN DATEPART(WEEKDAY, ac.FechaAplicacionContable) = 7 THEN 'Sábado'
  END AS Categoria,
  COUNT(*) AS NumAsientos,
  COUNT(DISTINCT ac.NroD) AS DocsDistintos,
  ROUND(SUM(ABS(ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0))), 2) AS Monto
FROM CMO.dbo.AsientoContable ac
WHERE ac.CodEmpresa = '${cod}'
  AND YEAR(ac.FechaAplicacionContable) = ${year}
  AND (
    ac.FechaAplicacionContable > GETDATE()
    OR DATEPART(WEEKDAY, ac.FechaAplicacionContable) IN (1, 7)
  )
GROUP BY CASE
    WHEN ac.FechaAplicacionContable > GETDATE() THEN 'Futura'
    WHEN DATEPART(WEEKDAY, ac.FechaAplicacionContable) = 1 THEN 'Domingo'
    WHEN DATEPART(WEEKDAY, ac.FechaAplicacionContable) = 7 THEN 'Sábado'
  END
ORDER BY 1
`;

const VQ_IDENTIFICADORES_DUPLICADOS = (cod) => `
SELECT TOP 20
  ac.CodIdentificador,
  COUNT(DISTINCT i.Descripcion) AS NombresDistintos,
  MIN(LEFT(ISNULL(i.Descripcion,''),60)) AS NombreEjemplo1,
  MAX(LEFT(ISNULL(i.Descripcion,''),60)) AS NombreEjemplo2
FROM CMO.dbo.AsientoContable ac
LEFT JOIN CMO.dbo.Identificador i ON ac.CodIdentificador = i.CodIdentificador
WHERE ac.CodEmpresa = '${cod}'
  AND ac.CodIdentificador IS NOT NULL
GROUP BY ac.CodIdentificador
HAVING COUNT(DISTINCT i.Descripcion) > 1
ORDER BY COUNT(DISTINCT i.Descripcion) DESC
`;

const VQ_CONCILIACION_ESTADO = (cod) => `
SELECT
  cb.NoCuenta,
  LEFT(cb.Descripcion, 50) AS DesBanco,
  cb.CodMoneda AS Moneda,
  ROUND(ISNULL(cb.BalanceActual,0), 2) AS BalanceContable,
  ROUND(ISNULL(cb.BalanceReal,0), 2) AS BalanceReal,
  ROUND(ISNULL(cb.BalanceActual,0) - ISNULL(cb.BalanceReal,0), 2) AS DiferenciaCRvsBR,
  (SELECT COUNT(*) FROM CMO.dbo.OB_EstadoBanco eb WHERE eb.BankAccount_ID = cb.BankAccount_ID) AS NumEstados,
  (SELECT CONVERT(VARCHAR(10), MAX(eb.Al), 103) FROM CMO.dbo.OB_EstadoBanco eb WHERE eb.BankAccount_ID = cb.BankAccount_ID) AS UltimoEstadoAl,
  (SELECT DATEDIFF(DAY, MAX(eb.Al), GETDATE()) FROM CMO.dbo.OB_EstadoBanco eb WHERE eb.BankAccount_ID = cb.BankAccount_ID) AS DiasDesdeUltimoEstado,
  (SELECT COUNT(*) FROM CMO.dbo.OB_EstadoBanco eb JOIN CMO.dbo.OB_EstadoBancoDetalle d ON eb.NroEstadoBanco = d.NroEstadoBanco
   WHERE eb.BankAccount_ID = cb.BankAccount_ID AND (d.ConciliarEstado IS NULL OR d.ConciliarEstado = 0)) AS MovsSinConciliar
FROM CMO.dbo.OB_CuentaBanco cb
WHERE cb.CodIdentificador = '${cod}'
  AND cb.Activo = 1
  AND (
    ABS(ISNULL(cb.BalanceActual,0) - ISNULL(cb.BalanceReal,0)) > 0.5
    OR (SELECT DATEDIFF(DAY, MAX(eb.Al), GETDATE()) FROM CMO.dbo.OB_EstadoBanco eb WHERE eb.BankAccount_ID = cb.BankAccount_ID) > 60
    OR (SELECT COUNT(*) FROM CMO.dbo.OB_EstadoBanco eb
        JOIN CMO.dbo.OB_EstadoBancoDetalle d ON eb.NroEstadoBanco = d.NroEstadoBanco
        WHERE eb.BankAccount_ID = cb.BankAccount_ID
          AND (d.ConciliarEstado IS NULL OR d.ConciliarEstado = 0)) > 0
  )
ORDER BY ABS(ISNULL(cb.BalanceActual,0) - ISNULL(cb.BalanceReal,0)) DESC
`;

const VQ_PL_ANUAL = (cod, year, claseIngreso) => `
SELECT
  ${year} AS Anio,
  ROUND(SUM(CASE WHEN LEFT(pcd.CodCuenta,2) = '${claseIngreso}'
       THEN ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0) ELSE 0 END), 2) AS Ingresos,
  ROUND(SUM(CASE WHEN LEFT(pcd.CodCuenta,2) IN ('60','61','62','63','64','65','66','67','68','69')
       THEN ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0) ELSE 0 END), 2) AS GastosNaturaleza,
  ROUND(SUM(CASE WHEN LEFT(pcd.CodCuenta,2) = '94'
       THEN ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0) ELSE 0 END), 2) AS GAV,
  ROUND(SUM(CASE WHEN LEFT(pcd.CodCuenta,2) = '91'
       THEN ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0) ELSE 0 END), 2) AS CostoVentas,
  ROUND(SUM(CASE WHEN LEFT(pcd.CodCuenta,2) = '97'
       THEN ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0) ELSE 0 END), 2) AS GastosFinancieros,
  ROUND(SUM(CASE WHEN LEFT(pcd.CodCuenta,2) = '88'
       THEN ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0) ELSE 0 END), 2) AS ImpuestoRenta
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${cod}'
  AND YEAR(ac.FechaAplicacionContable) = ${year}
HAVING ROUND(SUM(CASE WHEN LEFT(pcd.CodCuenta,2) = '${claseIngreso}'
     THEN ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0) ELSE 0 END), 2) <= 0
`;

const VQ_OB_VS_CONTABLE = (cod, year) => `
SELECT
  m.Mes,
  ISNULL(ob.MontoOBPago, 0)        AS MontoOBPago,
  ISNULL(con.MontoContable, 0)     AS MontoContable,
  ISNULL(ob.MontoOBPago, 0) - ISNULL(con.MontoContable, 0) AS Diferencia,
  ISNULL(ob.NumPagos, 0)           AS NumPagos
FROM (SELECT 1 AS Mes UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6
      UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12) m
LEFT JOIN (
  SELECT MONTH(p.FechaTrx) AS Mes,
         ROUND(SUM(ISNULL(p.PayAmt,0)), 2) AS MontoOBPago,
         COUNT(*) AS NumPagos
  FROM CMO.dbo.OB_Pago p
  WHERE p.CodIdentificador = '${cod}' AND YEAR(p.FechaTrx) = ${year}
  GROUP BY MONTH(p.FechaTrx)
) ob ON ob.Mes = m.Mes
LEFT JOIN (
  SELECT MONTH(ac.FechaAplicacionContable) AS Mes,
         ROUND(SUM(ISNULL(ac.Credito,0)), 2) AS MontoContable
  FROM CMO.dbo.AsientoContable ac
  JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
  WHERE ac.CodEmpresa = '${cod}'
    AND YEAR(ac.FechaAplicacionContable) = ${year}
    AND LEFT(pcd.CodCuenta,2) = '10'
  GROUP BY MONTH(ac.FechaAplicacionContable)
) con ON con.Mes = m.Mes
WHERE m.Mes <= MONTH(GETDATE())
  AND ABS(ISNULL(ob.MontoOBPago, 0) - ISNULL(con.MontoContable, 0)) > 100
ORDER BY m.Mes
`;

const VQ_PCD_CRITICAS = (cod) => `
SELECT
  pcd.CodCuenta,
  LEFT(pcd.Descripcion, 60) AS DesCuenta,
  (SELECT COUNT(*) FROM CMO.dbo.AsientoContable ac
   WHERE ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle AND ac.CodEmpresa = '${cod}') AS NumAsientos
FROM CMO.dbo.PlanContableDetalle pcd
WHERE pcd.CodCuenta IN (
  '501','5011','502','5021','58','581','5811','591','5911',
  '4111','4115','4151','4130','4131',
  '1041','1042','104','105'
)
  AND (SELECT COUNT(*) FROM CMO.dbo.AsientoContable ac
       WHERE ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
         AND ac.CodEmpresa = '${cod}') = 0
ORDER BY pcd.CodCuenta
`;

const VQ_ASIENTOS_SIN_GLOSA = (cod) => `
SELECT
  YEAR(ac.FechaAplicacionContable) AS Anio,
  COUNT(*) AS TotalAsientos,
  SUM(CASE WHEN ac.Glosa IS NULL OR LTRIM(RTRIM(ac.Glosa)) = ''
           OR UPPER(LTRIM(RTRIM(ac.Glosa))) IN ('VARIOS','ASIENTO','OTROS','NA','N/A','-','.','X','XX','S/D')
           THEN 1 ELSE 0 END) AS SinGlosa,
  ROUND(100.0 * SUM(CASE WHEN ac.Glosa IS NULL OR LTRIM(RTRIM(ac.Glosa)) = ''
           OR UPPER(LTRIM(RTRIM(ac.Glosa))) IN ('VARIOS','ASIENTO','OTROS','NA','N/A','-','.','X','XX','S/D')
           THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS PctSinGlosa
FROM CMO.dbo.AsientoContable ac
WHERE ac.CodEmpresa = '${cod}'
  AND YEAR(ac.FechaAplicacionContable) >= 2022
GROUP BY YEAR(ac.FechaAplicacionContable)
HAVING ROUND(100.0 * SUM(CASE WHEN ac.Glosa IS NULL OR LTRIM(RTRIM(ac.Glosa)) = ''
         OR UPPER(LTRIM(RTRIM(ac.Glosa))) IN ('VARIOS','ASIENTO','OTROS','NA','N/A','-','.','X','XX','S/D')
         THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) > 5
ORDER BY Anio DESC
`;

const VQ_CXP_CONCENTRACION = (cod) => `
SELECT TOP 15
  ISNULL(i.Descripcion, CAST(ac.CodIdentificador AS VARCHAR)) AS Proveedor,
  ISNULL(i.RUC, '') AS RUC,
  ROUND(SUM(ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0)), 2) AS SaldoCxP,
  COUNT(*) AS NumAsientos,
  CONVERT(VARCHAR(10), MIN(ac.FechaAplicacionContable), 103) AS PrimerMov,
  CONVERT(VARCHAR(10), MAX(ac.FechaAplicacionContable), 103) AS UltimoMov
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
LEFT JOIN CMO.dbo.Identificador i ON ac.CodIdentificador = i.CodIdentificador
WHERE ac.CodEmpresa = '${cod}'
  AND LEFT(pcd.CodCuenta, 2) = '42'
GROUP BY i.Descripcion, ac.CodIdentificador, i.RUC
HAVING SUM(ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0)) > 1000
ORDER BY SaldoCxP DESC
`;

const VQ_NC_SOSPECHOSAS = (cod) => `
SELECT
  YEAR(doc.FechaDocumento) AS Anio,
  COUNT(*) AS NumNC,
  ROUND(SUM(ISNULL(doc.Total,0) * CASE WHEN doc.CodMoneda='01' THEN 1.0 ELSE ISNULL(doc.TipoCambio,3.80) END), 2) AS MontoNC,
  ROUND(100.0 * SUM(ISNULL(doc.Total,0) * CASE WHEN doc.CodMoneda='01' THEN 1.0 ELSE ISNULL(doc.TipoCambio,3.80) END) / NULLIF((
    SELECT SUM(ISNULL(d2.Total,0) * CASE WHEN d2.CodMoneda='01' THEN 1.0 ELSE ISNULL(d2.TipoCambio,3.80) END)
    FROM CMO.dbo.vw_12DocumentosPorCobrar d2
    WHERE d2.CodEmpresa = '${cod}'
      AND YEAR(d2.FechaDocumento) = YEAR(doc.FechaDocumento)
      AND d2.CodTipoDocumento IN ('060','125','131')
  ), 0), 2) AS PctSobreFacturacion,
  ROUND(SUM(ISNULL(doc.Total,0) * CASE WHEN doc.CodMoneda='01' THEN 1.0 ELSE ISNULL(doc.TipoCambio,3.80) END) / NULLIF(COUNT(*), 0), 2) AS PromedioNC
FROM CMO.dbo.vw_12DocumentosPorCobrar doc
WHERE doc.CodEmpresa = '${cod}'
  AND doc.CodTipoDocumento IN ('128', '134')
  AND YEAR(doc.FechaDocumento) >= 2022
GROUP BY YEAR(doc.FechaDocumento)
HAVING ROUND(100.0 * SUM(ISNULL(doc.Total,0) * CASE WHEN doc.CodMoneda='01' THEN 1.0 ELSE ISNULL(doc.TipoCambio,3.80) END) / NULLIF((
    SELECT SUM(ISNULL(d2.Total,0) * CASE WHEN d2.CodMoneda='01' THEN 1.0 ELSE ISNULL(d2.TipoCambio,3.80) END)
    FROM CMO.dbo.vw_12DocumentosPorCobrar d2
    WHERE d2.CodEmpresa = '${cod}'
      AND YEAR(d2.FechaDocumento) = YEAR(doc.FechaDocumento)
      AND d2.CodTipoDocumento IN ('060','125','131')
  ), 0), 2) > 3
ORDER BY Anio DESC
`;

const VQ_NC_DETALLE = (cod) => `
SELECT TOP 50
  YEAR(doc.FechaDocumento) AS Anio,
  doc.SerieDocumento AS Serie,
  doc.NumeroDocumento AS Numero,
  CONVERT(VARCHAR(10), doc.FechaDocumento, 103) AS Fecha,
  doc.CodTipoDocumento AS Tipo,
  doc.DescripcionTipoDocumento AS DesTipo,
  doc.DescripcionIdentificador AS Cliente,
  doc.RUC,
  ROUND(ISNULL(doc.Total, 0), 2) AS Total,
  ISNULL(doc.DescripcionEstado, '') AS Estado
FROM CMO.dbo.vw_12DocumentosPorCobrar doc
WHERE doc.CodEmpresa = '${cod}'
  AND doc.CodTipoDocumento IN ('128', '134')
  AND YEAR(doc.FechaDocumento) >= 2022
ORDER BY doc.Total DESC
`;

const VQ_FRACCIONAMIENTO_PAGOS = (cod) => `
SELECT TOP 20
  CONVERT(VARCHAR(10), p.FechaTrx, 103) AS Fecha,
  cb.NoCuenta AS CuentaBancaria,
  LEFT(ISNULL(cb.Descripcion,''), 50) AS DesBanco,
  ISNULL(cb.CodMoneda,'') AS Moneda,
  COUNT(*) AS NumPagos,
  ROUND(SUM(ISNULL(p.PayAmt, 0)), 2) AS MontoTotal,
  ROUND(MAX(ISNULL(p.PayAmt, 0)), 2) AS MayorPago
FROM CMO.dbo.OB_Pago p
LEFT JOIN CMO.dbo.OB_CuentaBanco cb ON p.BankAccount_ID = cb.BankAccount_ID
WHERE p.CodIdentificador = '${cod}'
  AND YEAR(p.FechaTrx) >= 2023
  AND (p.MedioDePago IS NULL OR p.MedioDePago = 0)
  AND ISNULL(p.PayAmt, 0) BETWEEN 500 AND 3499
GROUP BY CONVERT(VARCHAR(10), p.FechaTrx, 103), p.BankAccount_ID, cb.NoCuenta, cb.Descripcion, cb.CodMoneda
HAVING COUNT(*) >= 3
  AND SUM(ISNULL(p.PayAmt, 0)) > 3500
ORDER BY NumPagos DESC, MontoTotal DESC
`;

const VQ_PROVISIONES_SIN_REVERSO = (cod) => `
SELECT
  YEAR(ac.FechaAplicacionContable) AS AnioProvision,
  LEFT(pcd.CodCuenta, 2) AS Clase,
  pcd.CodCuenta,
  LEFT(pcd.Descripcion, 60) AS DesCuenta,
  COUNT(*) AS NumAsientos,
  ROUND(SUM(ISNULL(ac.Credito, 0)), 2) AS MontoProvisionado,
  ROUND(SUM(ISNULL(ac.Debito, 0)), 2) AS MontoReversado,
  ROUND(SUM(ISNULL(ac.Credito, 0)) - SUM(ISNULL(ac.Debito, 0)), 2) AS SaldoSinReverso
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${cod}'
  AND MONTH(ac.FechaAplicacionContable) = 12
  AND YEAR(ac.FechaAplicacionContable) >= 2022
  AND (UPPER(ac.Glosa) LIKE '%PROVI%' OR UPPER(ac.Glosa) LIKE '%ESTIMACI%')
  AND LEFT(pcd.CodCuenta, 2) IN ('40','41','42','43','44','45','46','47','68')
  AND NOT EXISTS (
    SELECT 1 FROM CMO.dbo.AsientoContable ac2
    WHERE ac2.CodEmpresa = ac.CodEmpresa
      AND ac2.NroPlanContableDetalle = ac.NroPlanContableDetalle
      AND MONTH(ac2.FechaAplicacionContable) = 1
      AND YEAR(ac2.FechaAplicacionContable) = YEAR(ac.FechaAplicacionContable) + 1
      AND UPPER(ac2.Glosa) LIKE '%REVER%'
  )
GROUP BY YEAR(ac.FechaAplicacionContable), LEFT(pcd.CodCuenta, 2), pcd.CodCuenta, pcd.Descripcion
HAVING ABS(SUM(ISNULL(ac.Credito, 0)) - SUM(ISNULL(ac.Debito, 0))) > 100
ORDER BY AnioProvision DESC, ABS(SUM(ISNULL(ac.Credito, 0)) - SUM(ISNULL(ac.Debito, 0))) DESC
`;

async function runBatch4Validation(pool, company, year) {
  const cod = company.codEmpresa;
  const ci = company.claseIngreso;

  async function runQ(sql) {
    try {
      const r = await pool.request().query(sql);
      return { ok: true, rows: r.recordset, error: null };
    } catch (e) {
      return { ok: false, rows: [], error: e.message };
    }
  }

  const [
    v01, v02, v03, v04, v04b, v04bdet, v05, v06, v07, v08, v09, v10,
    v11, v12, v13, v14, v15, v16, v17, v18, v19, v20, v21,
    v22, v23, v24, v25, v26, v27, v28, v28b, v29, v30,
  ] = await Promise.all([
    runQ(VQ_PARTIDA_DOBLE(cod, year)),
    runQ(VQ_APERTURA(cod, year)),
    runQ(VQ_PATRIMONIO_DETALLE(cod)),
    runQ(VQ_FACTURAS_SIN_ASIENTO(cod, year, ci)),
    runQ(VQ_FACTURAS_SIN_ASIENTO_RESUMEN(cod, ci)),
    runQ(VQ_FACTURAS_SIN_ASIENTO_HISTORICO(cod, ci)),
    runQ(VQ_INGRESOS_SIN_DOC(cod, year, ci)),
    runQ(VQ_SUELDOS_AGING(cod, year)),
    runQ(VQ_CTS_DEPOSITOS_HISTORICO(cod, year)),
    runQ(VQ_PARTICIPACIONES(cod, year)),
    runQ(VQ_BANCOS_DETALLE(cod)),
    runQ(VQ_OB_CUENTAS_BANCO(cod)),
    runQ(VQ_BANCARIZACION_FORENSE(cod, year)),
    runQ(VQ_PERGOLA_AGING(cod)),
    runQ(VQ_CXC_CONCENTRACION(cod)),
    runQ(VQ_INTERCOMPANY(cod)),
    runQ(VQ_ACTIVO_FIJO_COHERENCIA(cod)),
    runQ(VQ_TRAZABILIDAD_PAGO(cod, year)),
    runQ(VQ_RECONCILIACION_INGRESOS(cod, year, ci)),
    runQ(VQ_TRIBUTOS_DETALLE(cod, year)),
    runQ(VQ_BALANCE_RESUMEN(cod, year)),
    runQ(VQ_FECHAS_ANOMALAS(cod, year)),
    runQ(VQ_IDENTIFICADORES_DUPLICADOS(cod)),
    runQ(VQ_CONCILIACION_ESTADO(cod)),
    runQ(VQ_PL_ANUAL(cod, year, ci)),
    runQ(VQ_OB_VS_CONTABLE(cod, year)),
    runQ(VQ_PCD_CRITICAS(cod)),
    runQ(VQ_ASIENTOS_SIN_GLOSA(cod)),
    runQ(VQ_CXP_CONCENTRACION(cod)),
    runQ(VQ_NC_SOSPECHOSAS(cod)),
    runQ(VQ_NC_DETALLE(cod)),
    runQ(VQ_FRACCIONAMIENTO_PAGOS(cod)),
    runQ(VQ_PROVISIONES_SIN_REVERSO(cod)),
  ]);

  return {
    timestamp: new Date().toISOString(),
    year,
    V01_partida_doble:               v01,
    V02_apertura:                    v02,
    V03_patrimonio:                  v03,
    V04_facturas_sin_asiento_top:    v04,
    V04b_facturas_sin_asiento_resumen: v04b,
    V04b_facturas_sin_asiento_detalle: v04bdet,
    V05_ingresos_sin_doc:            v05,
    V06_sueldos_aging:               v06,
    V07_cts_depositos:               v07,
    V08_participaciones:             v08,
    V09_bancos_detalle:              v09,
    V10_ob_cuentas_banco:            v10,
    V11_bancarizacion:               v11,
    V12_pergola_aging:               v12,
    V13_cxc_concentracion:           v13,
    V14_intercompany:                v14,
    V15_activo_fijo:                 v15,
    V16_trazabilidad_pago:           v16,
    V17_reconciliacion_ingr:         v17,
    V18_tributos:                    v18,
    V19_balance_resumen:             v19,
    V20_fechas_anomalas:             v20,
    V21_identificadores_dup:         v21,
    V22_conciliacion_estado:         v22,
    V23_pl_anual:                    v23,
    V24_ob_vs_contable:              v24,
    V25_pcd_criticas:                v25,
    V26_asientos_sin_glosa:          v26,
    V27_cxp_concentracion:           v27,
    V28_nc_sospechosas:              v28,
    V28b_nc_detalle:                 v28b,
    V29_fraccionamiento_pagos:       v29,
    V30_provisiones_sin_reverso:     v30,
  };
}

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

// Whitelist de codEmpresa válidos para evitar interpolación no controlada en queries
const VALID_COMPANY_IDS = new Set(CONFIG.COMPANIES.map((c) => c.codEmpresa));

function sanitizeYear(raw) {
  const y = parseInt(raw, 10);
  if (isNaN(y) || y < 2018 || y > new Date().getFullYear() + 1) {
    throw new Error(`Año inválido: ${raw}. Rango permitido: 2018-${new Date().getFullYear() + 1}`);
  }
  return y;
}

function sanitizeCompanyId(raw) {
  if (raw && !VALID_COMPANY_IDS.has(String(raw))) {
    throw new Error(`codEmpresa desconocido: ${raw}. Usar uno de: ${[...VALID_COMPANY_IDS].join(', ')}`);
  }
  return raw;
}

// Ejecuta fn sobre cada item con hasta `concurrency` en paralelo
async function runWithConcurrency(items, concurrency, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}

async function syncCompany(company, pool, year, fechaInicio, fechaFin, opts) {
  const { fast, forensics } = opts;
  const tag = `[${company.codEmpresa}]`;
  console.log(`\n${tag} Processing: ${company.name}`);

  try {
    // Batch 1 — KPIs core (siempre corre)
    console.log(`${tag} → Batch 1: P&L, CxC, CxP, Caja, GAV, documentos...`);
    const [
      plResult, cxcResult, cxcSplitResult, cxpResult, cajaResult, gavResult,
      txResult, cxcTxResult, cxpTxResult,
      emitResult, reciResult, honorResult, cxcDocsResult, cxcVinResult, cxpDocsResult,
    ] = await Promise.all([
      pool.request().query(QUERY_PL(company.claseIngreso, company.codEmpresa, fechaInicio, fechaFin)),
      pool.request().query(QUERY_CXC(company.codEmpresa)),
      pool.request().query(QUERY_CXC_SPLIT(company.codEmpresa)),
      pool.request().query(QUERY_CXP(company.codEmpresa)),
      pool.request().query(QUERY_CAJA(company.codEmpresa, fechaInicio, fechaFin)),
      pool.request().query(QUERY_GAV(company.codEmpresa, fechaInicio, fechaFin)),
      pool.request().query(QUERY_TRANSACTIONS(company.claseIngreso, company.codEmpresa, fechaInicio, fechaFin)),
      pool.request().query(QUERY_CXC_TRANSACTIONS(company.codEmpresa, year)),
      pool.request().query(QUERY_CXP_TRANSACTIONS(company.codEmpresa, year)),
      pool.request().query(QUERY_FACTURAS_EMITIDAS(company.codEmpresa, year, company.claseIngreso)),
      pool.request().query(QUERY_FACTURAS_RECIBIDAS(company.codEmpresa, year)),
      pool.request().query(QUERY_HONORARIOS_RECIBIDOS(company.codEmpresa, year)),
      pool.request().query(QUERY_CXC_DOCS(company.codEmpresa)),
      pool.request().query(QUERY_CXC_VINCULADAS(company.codEmpresa)),
      pool.request().query(QUERY_CXP_DOCS(company.codEmpresa)),
    ]);

    // Batch 2 — Balance, Otras CxC/CxP, Tributos, Laboral, Activo Fijo, Patrimonio, Inventarios
    console.log(`${tag} → Batch 2: Balance, Otras CxC/CxP, Tributos, Activo Fijo, Patrimonio, Inventarios...`);
    const [
      balanceResult, otrasCxcResult, otrasCxcTxnResult,
      otrasCxpResult, otrasCxpTxnResult,
      tributosResult, tributosTxnResult,
      laboralResult, laboralTxnResult,
      activoFijoResult, activoFijoTxnResult,
      patrimonioResult, patrimonioTxnResult, inventariosResult,
    ] = await Promise.all([
      pool.request().query(QUERY_BALANCE(company.codEmpresa, year)),
      pool.request().query(QUERY_OTRAS_CXC(company.codEmpresa)),
      pool.request().query(QUERY_OTRAS_CXC_TXN(company.codEmpresa, year)),
      pool.request().query(QUERY_OTRAS_CXP(company.codEmpresa)),
      pool.request().query(QUERY_OTRAS_CXP_TXN(company.codEmpresa, year)),
      pool.request().query(QUERY_TRIBUTOS(company.codEmpresa, year)),
      pool.request().query(QUERY_TRIBUTOS_TXN(company.codEmpresa, year)),
      pool.request().query(QUERY_LABORAL(company.codEmpresa)),
      pool.request().query(QUERY_LABORAL_TXN(company.codEmpresa, year)),
      pool.request().query(QUERY_ACTIVO_FIJO(company.codEmpresa)),
      pool.request().query(QUERY_ACTIVO_FIJO_TXN(company.codEmpresa)),
      pool.request().query(QUERY_PATRIMONIO(company.codEmpresa)),
      pool.request().query(QUERY_PATRIMONIO_TXN(company.codEmpresa, year)),
      pool.request().query(QUERY_INVENTARIOS(company.codEmpresa, year)),
    ]);

    const emitidas   = markDups(emitResult.recordset);
    const recibidas  = markDups(reciResult.recordset);
    const honorarios = markDups(honorResult.recordset);

    // Batch 3 — Préstamos, Caja, Tesorería, Gastos, Auditoría (omitido en --fast)
    let b3 = null;
    if (!fast) {
      console.log(`${tag} → Batch 3: Préstamos, Caja, Tesorería, Gastos, Auditoría...`);
      const [
        prestamosOtorgResult, prestamosReciResult, transferenciasResult,
        cajaSaldosResult, cajaTxnResult, cajaAsientoFullResult,
        tesoreriaResult, obSaldosBancoResult,
        conciliacionBancariaResult, movsSinConciliarResult, obPagosResult,
        obLibrosCajaResult, obCajaResult, obAsignMetricasResult,
        pagosSinAsignacionResult, compensacionesResult,
        bancarizacionMetricasResult, pagosNoBancarizadosResult, beneficiariosSinCuentaResult,
        pagosTrabajadoresResult, ctsDepositosResult, laboralMetricasResult,
        gastosNatResult, gastosNatTxnResult,
        auditSinDocResult, auditSinDocTxnResult,
        auditDescuadresResult, auditAtipicosResult,
        auditConciliacionResult,
      ] = await Promise.all([
        pool.request().query(QUERY_PRESTAMOS_OTORGADOS(company.codEmpresa)),
        pool.request().query(QUERY_PRESTAMOS_RECIBIDOS(company.codEmpresa)),
        pool.request().query(QUERY_TRANSFERENCIAS(company.codEmpresa)),
        pool.request().query(QUERY_CAJA_SALDOS(company.codEmpresa)),
        pool.request().query(QUERY_CAJA_TXN(company.codEmpresa, year)),
        pool.request().query(QUERY_CAJA_ASIENTO_FULL(company.codEmpresa, year)),
        pool.request().query(QUERY_TESORERIA(company.codEmpresa, year)),
        pool.request().query(QUERY_OB_SALDOS_BANCO(company.codEmpresa, year)),
        pool.request().query(QUERY_CONCILIACION_BANCARIA(company.codEmpresa)),
        pool.request().query(QUERY_MOVIMIENTOS_SIN_CONCILIAR(company.codEmpresa)),
        pool.request().query(QUERY_OB_PAGOS(company.codEmpresa, year)),
        pool.request().query(QUERY_OB_LIBROS_CAJA(company.codEmpresa)),
        pool.request().query(QUERY_OB_CAJA(company.codEmpresa, year)),
        pool.request().query(QUERY_OB_ASIGNACIONES_METRICAS(company.codEmpresa, year)),
        pool.request().query(QUERY_PAGOS_SIN_ASIGNACION(company.codEmpresa, year)),
        pool.request().query(QUERY_COMPENSACIONES(company.codEmpresa)),
        pool.request().query(QUERY_BANCARIZACION_METRICAS(company.codEmpresa, year)),
        pool.request().query(QUERY_PAGOS_NO_BANCARIZADOS(company.codEmpresa, year)),
        pool.request().query(QUERY_BENEFICIARIOS_SIN_CUENTA(company.codEmpresa, year)),
        pool.request().query(QUERY_PAGOS_TRABAJADORES(company.codEmpresa, year)),
        pool.request().query(QUERY_CTS_DEPOSITOS(company.codEmpresa)),
        pool.request().query(QUERY_LABORAL_METRICAS(company.codEmpresa, year)),
        pool.request().query(QUERY_GASTOS_NATURALEZA(company.codEmpresa, fechaInicio, fechaFin)),
        pool.request().query(QUERY_GASTOS_NAT_TXN(company.codEmpresa, fechaInicio, fechaFin)),
        pool.request().query(QUERY_AUDIT_SIN_DOC(company.codEmpresa, fechaInicio, fechaFin)),
        pool.request().query(QUERY_AUDIT_SIN_DOC_TXN(company.codEmpresa, fechaInicio, fechaFin)),
        pool.request().query(QUERY_AUDIT_DESCUADRES(company.codEmpresa, fechaInicio, fechaFin)),
        pool.request().query(QUERY_AUDIT_ATIPICOS(company.codEmpresa, fechaInicio, fechaFin)),
        pool.request().query(QUERY_AUDIT_CONCILIACION(company.codEmpresa, company.claseIngreso, fechaInicio, fechaFin, year)),
      ]);
      b3 = {
        prestamosOtorgResult, prestamosReciResult, transferenciasResult,
        cajaSaldosResult, cajaTxnResult, cajaAsientoFullResult,
        tesoreriaResult, obSaldosBancoResult,
        conciliacionBancariaResult, movsSinConciliarResult, obPagosResult,
        obLibrosCajaResult, obCajaResult, obAsignMetricasResult,
        pagosSinAsignacionResult, compensacionesResult,
        bancarizacionMetricasResult, pagosNoBancarizadosResult, beneficiariosSinCuentaResult,
        pagosTrabajadoresResult, ctsDepositosResult, laboralMetricasResult,
        gastosNatResult, gastosNatTxnResult,
        auditSinDocResult, auditSinDocTxnResult,
        auditDescuadresResult, auditAtipicosResult,
        auditConciliacionResult,
      };
    } else {
      console.log(`${tag} → Batch 3: OMITIDO (modo --fast)`);
    }

    // Batch 4 — Validaciones forenses (solo con --forensics)
    let validationForense = null;
    if (forensics) {
      console.log(`${tag} → Batch 4: Validaciones forenses (33 queries)...`);
      validationForense = await runBatch4Validation(pool, company, year);
      const v4ok = Object.values(validationForense)
        .filter((v) => v && typeof v === 'object' && 'ok' in v)
        .filter((v) => v.ok).length;
      console.log(`${tag}    ✓ ${v4ok}/33 queries forenses OK`);
    } else {
      console.log(`${tag} → Batch 4: OMITIDO (usar --forensics para incluir)`);
    }

    // Build payload
    const payload = {
      companyId: company.codEmpresa,
      companyName: company.name,
      claseIngreso: company.claseIngreso,
      year,
      data: {
        pl: plResult.recordset,
        cxc: cxcResult.recordset,
        cxc_docs: cxcDocsResult.recordset,
        cxc_vinculadas: cxcVinResult.recordset,
        cxc_split: cxcSplitResult.recordset,
        cxp: cxpResult.recordset,
        cxp_docs: cxpDocsResult.recordset,
        caja: cajaResult.recordset,
        gav: gavResult.recordset,
        transactions: txResult.recordset,
        cxc_transactions: cxcTxResult.recordset,
        cxp_transactions: cxpTxResult.recordset,
        facturas_emitidas: emitidas,
        facturas_recibidas: recibidas,
        honorarios_recibidos: honorarios,
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
        activo_fijo_txn: activoFijoTxnResult.recordset,
        patrimonio: patrimonioResult.recordset,
        patrimonio_txn: patrimonioTxnResult.recordset,
        inventarios: inventariosResult.recordset,
        ...(b3 && {
          prestamos_otorgados:       b3.prestamosOtorgResult.recordset,
          prestamos_recibidos:       b3.prestamosReciResult.recordset,
          transferencias:            b3.transferenciasResult.recordset,
          caja_saldos:               b3.cajaSaldosResult.recordset,
          caja_txn:                  b3.cajaTxnResult.recordset,
          caja_asiento_full:         b3.cajaAsientoFullResult.recordset,
          tesoreria:                 b3.tesoreriaResult.recordset,
          ob_saldos_banco:           b3.obSaldosBancoResult.recordset,
          conciliacion_bancaria:     b3.conciliacionBancariaResult.recordset,
          movs_sin_conciliar:        b3.movsSinConciliarResult.recordset,
          ob_pagos:                  b3.obPagosResult.recordset,
          ob_libros_caja:            b3.obLibrosCajaResult.recordset,
          ob_caja:                   b3.obCajaResult.recordset,
          ob_asignaciones_metricas:  b3.obAsignMetricasResult.recordset,
          pagos_sin_asignacion:      b3.pagosSinAsignacionResult.recordset,
          compensaciones:            b3.compensacionesResult.recordset,
          bancarizacion_metricas:    b3.bancarizacionMetricasResult.recordset,
          pagos_no_bancarizados:     b3.pagosNoBancarizadosResult.recordset,
          beneficiarios_sin_cuenta:  b3.beneficiariosSinCuentaResult.recordset,
          pagos_trabajadores:        b3.pagosTrabajadoresResult.recordset,
          cts_depositos:             b3.ctsDepositosResult.recordset,
          laboral_metricas:          b3.laboralMetricasResult.recordset,
          gastos_naturaleza:         b3.gastosNatResult.recordset,
          gastos_nat_txn:            b3.gastosNatTxnResult.recordset,
          audit_sin_doc:             b3.auditSinDocResult.recordset,
          audit_sin_doc_txn:         b3.auditSinDocTxnResult.recordset,
          audit_descuadres:          b3.auditDescuadresResult.recordset,
          audit_atipicos:            b3.auditAtipicosResult.recordset,
          audit_conciliacion:        b3.auditConciliacionResult.recordset,
        }),
        ...(validationForense && { validation_forense: validationForense }),
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
    console.log(`${tag} ✓ Pushed — ${result.processed?.length || 0} KPI types saved`);

  } catch (err) {
    console.error(`  ✗ Error syncing ${company.name}: ${err.message}`);
  }
}

async function main() {
  const args = parseArgs();
  const year = sanitizeYear(args.year || new Date().getFullYear());
  const targetCompany = sanitizeCompanyId(args.company);
  const fast = 'fast' in args;
  const forensics = 'forensics' in args;

  const companies = targetCompany
    ? CONFIG.COMPANIES.filter((c) => c.codEmpresa === targetCompany)
    : CONFIG.COMPANIES;

  if (!companies.length) {
    console.error(`No companies found${targetCompany ? ` for codEmpresa=${targetCompany}` : ''}`);
    process.exit(1);
  }

  const mode = fast ? 'FAST (Batches 1+2 only)' : forensics ? 'FULL + FORENSICS' : 'FULL (Batches 1+2+3)';
  const concurrency = fast ? 4 : 2;
  console.log(`\nS10 Sync Agent — ${new Date().toISOString()}`);
  console.log(`Year: ${year} | Mode: ${mode} | Concurrency: ${concurrency} | Companies: ${companies.map((c) => c.name).join(', ')}\n`);

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
    pool: {
      max: 40,
      min: 2,
      acquireTimeoutMillis: 60000,
      idleTimeoutMillis: 30000,
    },
    connectionTimeout: 30000,
    requestTimeout: 300000,
  }).connect();

  console.log('✓ Connected to S10 SQL Server');

  const fechaInicio = `${year}-01-01`;
  const currentYear = new Date().getFullYear();
  const fechaFin = year < currentYear
    ? `${year}-12-31`
    : new Date().toISOString().slice(0, 10);

  const t0 = Date.now();
  await runWithConcurrency(
    companies,
    concurrency,
    (company) => syncCompany(company, pool, year, fechaInicio, fechaFin, { fast, forensics }),
  );

  await pool.close();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nSync completed in ${elapsed}s.`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
