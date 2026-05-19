// ============================================================
// S10 BizSmartHub — Financial SQL Queries
// Validados contra SQL Server 2014 SP2, base CMO
// Nombres de columnas exactos: FechaAplicacionContable, Debito, Credito
// ============================================================

/**
 * P&L completo en una sola pasada (Clases 70/75, 79, 91, 94, 97)
 * claseIngreso: '70' para INTEGRAL | '75' para CMO GROUP
 */
export const QUERY_PL_COMPLETO = (claseIngreso: string) => `
SELECT
  LEFT(pcd.CodCuenta, 2)                             AS Clase,
  pcd.CodCuenta                                       AS CodCuenta,
  pcd.DesCuenta                                       AS DesCuenta,
  MONTH(ac.FechaAplicacionContable)                   AS Mes,
  SUM(ISNULL(ac.Debito, 0))                           AS TotalDebito,
  SUM(ISNULL(ac.Credito, 0))                          AS TotalCredito
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = @codEmpresa
  AND ac.FechaAplicacionContable BETWEEN @fechaInicio AND @fechaFin
  AND LEFT(pcd.CodCuenta, 2) IN ('${claseIngreso}', '79', '91', '94', '97')
GROUP BY
  LEFT(pcd.CodCuenta, 2),
  pcd.CodCuenta,
  pcd.DesCuenta,
  MONTH(ac.FechaAplicacionContable)
ORDER BY Clase, CodCuenta, Mes
`;

/**
 * Ingresos mensuales por cuenta (Clase 70 o 75)
 */
export const QUERY_INGRESOS = (claseIngreso: string) => `
SELECT
  pcd.CodCuenta,
  pcd.DesCuenta,
  MONTH(ac.FechaAplicacionContable) AS Mes,
  SUM(ISNULL(ac.Credito, 0)) - SUM(ISNULL(ac.Debito, 0)) AS Ingresos
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = @codEmpresa
  AND ac.FechaAplicacionContable BETWEEN @fechaInicio AND @fechaFin
  AND LEFT(pcd.CodCuenta, 2) = '${claseIngreso}'
GROUP BY pcd.CodCuenta, pcd.DesCuenta, MONTH(ac.FechaAplicacionContable)
ORDER BY Mes
`;

/**
 * Costo Directo mensual (Clase 91, bruto)
 */
export const QUERY_COSTO_DIRECTO = `
SELECT
  pcd.CodCuenta,
  pcd.DesCuenta,
  MONTH(ac.FechaAplicacionContable) AS Mes,
  SUM(ISNULL(ac.Debito, 0)) - SUM(ISNULL(ac.Credito, 0)) AS CostoDirecto
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = @codEmpresa
  AND ac.FechaAplicacionContable BETWEEN @fechaInicio AND @fechaFin
  AND LEFT(pcd.CodCuenta, 2) = '91'
GROUP BY pcd.CodCuenta, pcd.DesCuenta, MONTH(ac.FechaAplicacionContable)
ORDER BY Mes
`;

/**
 * GAV por categoría (Clase 94)
 */
export const QUERY_GAV = `
SELECT
  pcd.CodCuenta,
  pcd.DesCuenta,
  MONTH(ac.FechaAplicacionContable) AS Mes,
  SUM(ISNULL(ac.Debito, 0)) - SUM(ISNULL(ac.Credito, 0)) AS GAV
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = @codEmpresa
  AND ac.FechaAplicacionContable BETWEEN @fechaInicio AND @fechaFin
  AND LEFT(pcd.CodCuenta, 2) = '94'
GROUP BY pcd.CodCuenta, pcd.DesCuenta, MONTH(ac.FechaAplicacionContable)
ORDER BY pcd.DesCuenta, Mes
`;

/**
 * CxC Aging por cliente (Clase 12)
 * Nota: FechaAplicacionContable se usa como aproximación a fecha de factura.
 * El saldo total es confiable; los buckets de aging son referenciales.
 */
export const QUERY_CXC = `
SELECT
  i.NomIdentificador                                                        AS Cliente,
  ac.CodIdentificador                                                       AS CodCliente,
  SUM(ISNULL(ac.Debito, 0)) - SUM(ISNULL(ac.Credito, 0))                  AS SaldoTotal,
  SUM(CASE WHEN ac.FechaAplicacionContable >= DATEADD(DAY, -30, GETDATE())
           THEN ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0) ELSE 0 END)    AS [Dias_0_30],
  SUM(CASE WHEN ac.FechaAplicacionContable BETWEEN DATEADD(DAY,-60,GETDATE()) AND DATEADD(DAY,-31,GETDATE())
           THEN ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0) ELSE 0 END)    AS [Dias_31_60],
  SUM(CASE WHEN ac.FechaAplicacionContable BETWEEN DATEADD(DAY,-90,GETDATE()) AND DATEADD(DAY,-61,GETDATE())
           THEN ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0) ELSE 0 END)    AS [Dias_61_90],
  SUM(CASE WHEN ac.FechaAplicacionContable < DATEADD(DAY, -90, GETDATE())
           THEN ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0) ELSE 0 END)    AS [Dias_90_mas]
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
LEFT JOIN CMO.dbo.Identificador i
  ON ac.CodIdentificador = i.CodIdentificador
WHERE ac.CodEmpresa = @codEmpresa
  AND LEFT(pcd.CodCuenta, 2) = '12'
GROUP BY i.NomIdentificador, ac.CodIdentificador
HAVING SUM(ISNULL(ac.Debito, 0)) - SUM(ISNULL(ac.Credito, 0)) > 0
ORDER BY SaldoTotal DESC
`;

/**
 * CxP por proveedor (Clase 42)
 */
export const QUERY_CXP = `
SELECT
  i.NomIdentificador                                                        AS Proveedor,
  ac.CodIdentificador                                                       AS CodProveedor,
  SUM(ISNULL(ac.Credito, 0)) - SUM(ISNULL(ac.Debito, 0))                  AS SaldoTotal,
  SUM(CASE WHEN ac.FechaAplicacionContable >= DATEADD(DAY, -30, GETDATE())
           THEN ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0) ELSE 0 END)    AS [SaldoVigente],
  SUM(CASE WHEN ac.FechaAplicacionContable BETWEEN DATEADD(DAY,-60,GETDATE()) AND DATEADD(DAY,-31,GETDATE())
           THEN ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0) ELSE 0 END)    AS [Dias_0_30],
  SUM(CASE WHEN ac.FechaAplicacionContable BETWEEN DATEADD(DAY,-90,GETDATE()) AND DATEADD(DAY,-61,GETDATE())
           THEN ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0) ELSE 0 END)    AS [Dias_31_60],
  SUM(CASE WHEN ac.FechaAplicacionContable BETWEEN DATEADD(DAY,-120,GETDATE()) AND DATEADD(DAY,-91,GETDATE())
           THEN ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0) ELSE 0 END)    AS [Dias_61_90],
  SUM(CASE WHEN ac.FechaAplicacionContable < DATEADD(DAY, -120, GETDATE())
           THEN ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0) ELSE 0 END)    AS [Dias_90_mas]
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
LEFT JOIN CMO.dbo.Identificador i
  ON ac.CodIdentificador = i.CodIdentificador
WHERE ac.CodEmpresa = @codEmpresa
  AND LEFT(pcd.CodCuenta, 2) = '42'
GROUP BY i.NomIdentificador, ac.CodIdentificador
HAVING SUM(ISNULL(ac.Credito, 0)) - SUM(ISNULL(ac.Debito, 0)) > 0
ORDER BY SaldoTotal DESC
`;

/**
 * Posición de Caja por banco y mes (Clase 10)
 */
export const QUERY_CAJA = `
SELECT
  pcd.DesCuenta                                         AS Banco,
  pcd.CodCuenta                                         AS CodBanco,
  MONTH(ac.FechaAplicacionContable)                     AS Mes,
  SUM(ISNULL(ac.Debito, 0)) - SUM(ISNULL(ac.Credito, 0)) AS FlujoNeto
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = @codEmpresa
  AND ac.FechaAplicacionContable BETWEEN @fechaInicio AND @fechaFin
  AND LEFT(pcd.CodCuenta, 2) = '10'
GROUP BY pcd.DesCuenta, pcd.CodCuenta, MONTH(ac.FechaAplicacionContable)
ORDER BY pcd.DesCuenta, Mes
`;

/**
 * Gastos Financieros mensuales (Clase 97)
 */
export const QUERY_GASTOS_FINANCIEROS = `
SELECT
  pcd.CodCuenta,
  pcd.DesCuenta,
  MONTH(ac.FechaAplicacionContable) AS Mes,
  SUM(ISNULL(ac.Debito, 0)) - SUM(ISNULL(ac.Credito, 0)) AS GastosFinancieros
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd
  ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = @codEmpresa
  AND ac.FechaAplicacionContable BETWEEN @fechaInicio AND @fechaFin
  AND LEFT(pcd.CodCuenta, 2) = '97'
GROUP BY pcd.CodCuenta, pcd.DesCuenta, MONTH(ac.FechaAplicacionContable)
ORDER BY Mes
`;

/**
 * Descubrir empresas disponibles en la base CMO
 */
export const QUERY_EMPRESAS = `
SELECT DISTINCT CodEmpresa FROM CMO.dbo.AsientoContable ORDER BY CodEmpresa
`;
