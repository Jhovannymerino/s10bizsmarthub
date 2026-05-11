/**
 * S10 BizSmartHub — VALIDATION AGENT (FORENSE)
 * ============================================================
 * Standalone script que ejecuta 25 queries forenses contra S10
 * para validar cada hallazgo del informe de auditoría
 * (01_RESUMEN_GERENCIAL / 03_INFORME_CONSOLIDADO_FINAL).
 *
 * Salida: validation-output.json con estructura:
 *   {
 *     timestamp,
 *     companies: [...],
 *     validations: {
 *       V01_partida_doble: { CMO: {...}, INTEGRAL: {...}, ... },
 *       V02_apertura_2026: {...},
 *       ...
 *     }
 *   }
 *
 * Uso:
 *   node validation-agent.js [--out=validation-output.json]
 * ============================================================
 */

const mssql = require('mssql');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  S10_HOST: '192.168.1.51',
  S10_PORT: 1433,
  S10_USER: 'sa',
  S10_PASSWORD: 'Cmo$2017.',
  S10_DATABASE: 'CMO',
};

const COMPANIES = [
  { codEmpresa: '22011489', name: 'CMO GROUP S.A.',                                            claseIngreso: '75' },
  { codEmpresa: '80688541', name: 'INTEGRAL CONSULTORES S.A.C.',                               claseIngreso: '70' },
  { codEmpresa: '80688706', name: 'MEDARQ S.A.C.',                                             claseIngreso: '70' },
  { codEmpresa: '80688524', name: 'COMPAÑÍA AMERICANA DE CONSTRUCCIÓN Y EQUIPAMIENTO S.A.C.',  claseIngreso: '70' },
];

const RUC_GRUPO = ['22011489', '80688541', '80688706', '80688524', '20557987541'];

const YEAR = parseInt(parseArg('year', new Date().getFullYear()), 10);
const OUT  = parseArg('out', path.join(__dirname, 'validation-output.json'));

function parseArg(name, def) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : def;
}

// ─────────────────────────────────────────────
// QUERIES FORENSES
// ─────────────────────────────────────────────

// V01 — Partida doble: suma débitos vs créditos total (debe ser ~0)
const Q_PARTIDA_DOBLE = (cod) => `
SELECT
  '${cod}' AS CodEmpresa,
  COUNT(*) AS TotalAsientos,
  ROUND(SUM(ISNULL(Debito, 0)), 2)  AS SumDebito,
  ROUND(SUM(ISNULL(Credito, 0)), 2) AS SumCredito,
  ROUND(SUM(ISNULL(Debito, 0)) - SUM(ISNULL(Credito, 0)), 2) AS Descuadre,
  COUNT(DISTINCT NroD) AS DocsDistintos,
  SUM(CASE WHEN NroD IS NULL THEN 1 ELSE 0 END) AS SinNroD
FROM CMO.dbo.AsientoContable
WHERE CodEmpresa = '${cod}'
`;

// V02 — Asientos de apertura por empresa (todos los años, glosa apertura/inicio)
const Q_APERTURA = (cod) => `
SELECT
  YEAR(ac.FechaAplicacionContable) AS Anio,
  CONVERT(VARCHAR(10), MIN(ac.FechaAplicacionContable), 103) AS PrimerAsiento,
  COUNT(*) AS NumAsientos,
  COUNT(DISTINCT LEFT(pcd.CodCuenta,2)) AS NumClases,
  ROUND(SUM(ISNULL(ac.Debito,0)), 2)  AS SumDebito,
  ROUND(SUM(ISNULL(ac.Credito,0)), 2) AS SumCredito
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${cod}'
  AND (ac.Glosa LIKE '%APERTURA%' OR ac.Glosa LIKE '%INICIO%' OR ac.Glosa LIKE '%ASIENTO INICIAL%')
  AND MONTH(ac.FechaAplicacionContable) <= 2
GROUP BY YEAR(ac.FechaAplicacionContable)
ORDER BY Anio DESC
`;

// V03 — Saldos clases patrimonio (50,51,52,57,58,59) — capital, primas, reservas, resultados
const Q_PATRIMONIO_DETALLE = (cod) => `
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
HAVING ABS(SUM(ISNULL(ac.Credito,0)) - SUM(ISNULL(ac.Debito,0))) > 0.01
ORDER BY Clase, pcd.CodCuenta
`;

// V04 — Facturas emitidas sin asiento (top 50 monto, año actual y anterior)
const Q_FACTURAS_SIN_ASIENTO = (cod, year, claseIngreso) => `
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
  AND YEAR(doc.FechaDocumento) IN (${year}, ${year-1})
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

// V04b — Resumen agregado facturas sin asiento por año
const Q_FACTURAS_SIN_ASIENTO_RESUMEN = (cod, claseIngreso) => `
SELECT
  YEAR(doc.FechaDocumento) AS Anio,
  doc.CodTipoDocumento AS Tipo,
  COUNT(*) AS NumFacturas,
  ROUND(SUM(ISNULL(doc.Total, 0)), 2) AS MontoTotal
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

// V05 — Ingresos contabilizados sin NroD (year actual)
const Q_INGRESOS_SIN_DOC = (cod, year, claseIngreso) => `
SELECT
  ac.NroAsientoContable AS NroAsiento,
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

// V06 — Sueldos por pagar (cta 4111) por mes — aging puntualidad pago
const Q_SUELDOS_AGING = (cod) => `
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
  AND YEAR(ac.FechaAplicacionContable) >= 2024
GROUP BY YEAR(ac.FechaAplicacionContable), MONTH(ac.FechaAplicacionContable)
ORDER BY Anio DESC, Mes DESC
`;

// V07 — CTS (cta 4151) por año/mes — debería tener movimientos en may + nov
const Q_CTS_DEPOSITOS_HISTORICO = (cod) => `
SELECT
  YEAR(ac.FechaAplicacionContable)  AS Anio,
  MONTH(ac.FechaAplicacionContable) AS Mes,
  COUNT(*) AS NumAsientos,
  ROUND(SUM(ISNULL(ac.Credito,0)), 2) AS Provisionado,
  ROUND(SUM(ISNULL(ac.Debito,0)), 2)  AS Pagado,
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
  AND YEAR(ac.FechaAplicacionContable) >= 2023
GROUP BY YEAR(ac.FechaAplicacionContable), MONTH(ac.FechaAplicacionContable)
ORDER BY Anio DESC, Mes DESC
`;

// V08 — Participaciones DL 892 (cta 4130/4131/4132) — provisión, pago, saldo
const Q_PARTICIPACIONES = (cod) => `
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
  AND YEAR(ac.FechaAplicacionContable) >= 2023
GROUP BY pcd.CodCuenta, pcd.Descripcion, YEAR(ac.FechaAplicacionContable)
HAVING SUM(ISNULL(ac.Debito,0) + ISNULL(ac.Credito,0)) > 0.5
ORDER BY pcd.CodCuenta, Anio DESC
`;

// V09 — Saldos por cuenta bancaria (clase 10) — saldo + saldo por año (apertura a último día del año)
const Q_BANCOS_DETALLE = (cod) => `
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
HAVING ABS(SUM(ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0))) > 0.5
ORDER BY SUM(ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0)) ASC
`;

// V10 — Cuentas bancarias registradas en OB_CuentaBanco (módulo conciliación)
const Q_OB_CUENTAS_BANCO = (cod) => `
SELECT
  cb.BankAccount_ID AS BankAccountId,
  cb.NoCuenta,
  LEFT(cb.Descripcion, 60) AS DesBanco,
  cb.CodMoneda AS Moneda,
  ROUND(ISNULL(cb.BalanceActual, 0), 2) AS BalanceActual,
  ROUND(ISNULL(cb.BalanceReal, 0), 2)   AS BalanceReal,
  ROUND(ISNULL(cb.BalanceBanco, 0), 2)  AS BalanceBanco,
  cb.Activo,
  (SELECT COUNT(*) FROM CMO.dbo.OB_EstadoBanco eb WHERE eb.BankAccount_ID = cb.BankAccount_ID) AS NumEstadosCargados,
  (SELECT CONVERT(VARCHAR(10), MAX(eb.Al), 103) FROM CMO.dbo.OB_EstadoBanco eb WHERE eb.BankAccount_ID = cb.BankAccount_ID) AS UltimoEstadoAl
FROM CMO.dbo.OB_CuentaBanco cb
WHERE cb.CodIdentificador = '${cod}'
  AND cb.Activo = 1
ORDER BY cb.CodMoneda, ABS(ISNULL(cb.BalanceActual,0)) DESC
`;

// V11 — Bancarización: distribución pagos > umbral por MedioDePago (Ley 28194)
const Q_BANCARIZACION_FORENSE = (cod, year) => `
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
`;

// V12 — Aging CxC AMERICANA cliente PERGOLA (documentos)
const Q_PERGOLA_AGING = (cod) => `
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

// V13 — Aging total CxC por empresa con concentración
const Q_CXC_CONCENTRACION = (cod) => `
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

// V14 — Préstamos intercompañía (clases 14,16,17) — solo terceros con RUC del grupo
const Q_INTERCOMPANY = (cod) => `
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
    i.RUC IN (${RUC_GRUPO.map(r => `'${r}'`).join(',')})
    OR ac.CodIdentificador IN (${RUC_GRUPO.map(r => `'${r}'`).join(',')})
    OR ISNULL(i.Descripcion,'') LIKE '%CMO%'
    OR ISNULL(i.Descripcion,'') LIKE '%INTEGRAL%'
    OR ISNULL(i.Descripcion,'') LIKE '%MEDARQ%'
    OR ISNULL(i.Descripcion,'') LIKE '%AMERICANA%'
  )
GROUP BY LEFT(pcd.CodCuenta,2), pcd.CodCuenta, pcd.Descripcion, ac.CodIdentificador, i.Descripcion, i.RUC
HAVING ABS(SUM(ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0))) > 100
ORDER BY ABS(SUM(ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0))) DESC
`;

// V15 — Activo Fijo (33) y Depreciación (39) — coherencia
const Q_ACTIVO_FIJO_COHERENCIA = (cod) => `
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
HAVING ABS(SUM(ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0))) > 0.5
ORDER BY Clase, pcd.CodCuenta
`;

// V16 — Trazabilidad OB_Pago ↔ DetalleAsignacion ↔ Factura
const Q_TRAZABILIDAD_PAGO = (cod, year) => `
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
`;

// V17 — Reconciliación: ingresos contables (clase ingreso) vs facturas emitidas por mes
const Q_RECONCILIACION_INGRESOS = (cod, year, claseIngreso) => `
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
         ROUND(SUM(CASE WHEN doc.CodTipoDocumento NOT IN ('128','134') THEN ISNULL(doc.Total,0) ELSE -ISNULL(doc.Total,0) END), 2) AS MontoFacturado
  FROM CMO.dbo.vw_12DocumentosPorCobrar doc
  WHERE doc.CodEmpresa = '${cod}'
    AND YEAR(doc.FechaDocumento) = ${year}
    AND doc.CodTipoDocumento IN ('060','125','128','131','134')
  GROUP BY MONTH(doc.FechaDocumento)
) fac ON fac.Mes = m.Mes
WHERE m.Mes <= MONTH(GETDATE())
ORDER BY m.Mes
`;

// V18 — Saldos tributos por pagar clase 40 — verificar IGV, Renta, etc.
const Q_TRIBUTOS_DETALLE = (cod) => `
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
GROUP BY pcd.CodCuenta, pcd.Descripcion
HAVING ABS(SUM(ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0))) > 0.5
ORDER BY ABS(SUM(ISNULL(ac.Credito,0) - ISNULL(ac.Debito,0))) DESC
`;

// V19 — Balance: clase de cuenta consolidada (activo, pasivo, patrimonio, ingresos, gastos)
const Q_BALANCE_RESUMEN = (cod, year) => `
SELECT
  LEFT(pcd.CodCuenta, 1) AS GrupoMayor,
  LEFT(pcd.CodCuenta, 2) AS Clase,
  COUNT(*) AS NumAsientos,
  ROUND(SUM(ISNULL(ac.Debito,0)), 2)  AS SumDebito,
  ROUND(SUM(ISNULL(ac.Credito,0)), 2) AS SumCredito,
  ROUND(SUM(ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0)), 2) AS SaldoNeto,
  -- Saldo del año en curso únicamente
  ROUND(SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) = ${year} THEN ISNULL(ac.Debito,0) ELSE 0 END), 2) AS DebitoAnio,
  ROUND(SUM(CASE WHEN YEAR(ac.FechaAplicacionContable) = ${year} THEN ISNULL(ac.Credito,0) ELSE 0 END), 2) AS CreditoAnio
FROM CMO.dbo.AsientoContable ac
JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
WHERE ac.CodEmpresa = '${cod}'
GROUP BY LEFT(pcd.CodCuenta, 1), LEFT(pcd.CodCuenta, 2)
ORDER BY Clase
`;

// V20 — Asientos con fechas anómalas (futuras, domingos festivos)
const Q_FECHAS_ANOMALAS = (cod) => `
SELECT
  CASE
    WHEN ac.FechaAplicacionContable > GETDATE() THEN 'Futura'
    WHEN DATEPART(WEEKDAY, ac.FechaAplicacionContable) = 1 THEN 'Domingo'
    WHEN DATEPART(WEEKDAY, ac.FechaAplicacionContable) = 7 THEN 'Sábado'
    ELSE 'Normal'
  END AS Categoria,
  COUNT(*) AS NumAsientos,
  COUNT(DISTINCT ac.NroD) AS DocsDistintos,
  ROUND(SUM(ABS(ISNULL(ac.Debito,0) - ISNULL(ac.Credito,0))), 2) AS Monto
FROM CMO.dbo.AsientoContable ac
WHERE ac.CodEmpresa = '${cod}'
  AND YEAR(ac.FechaAplicacionContable) >= 2024
GROUP BY CASE
    WHEN ac.FechaAplicacionContable > GETDATE() THEN 'Futura'
    WHEN DATEPART(WEEKDAY, ac.FechaAplicacionContable) = 1 THEN 'Domingo'
    WHEN DATEPART(WEEKDAY, ac.FechaAplicacionContable) = 7 THEN 'Sábado'
    ELSE 'Normal'
  END
ORDER BY 1
`;

// V21 — Identificadores duplicados (multiple Descripcion por mismo CodIdentificador)
// (SQL Server antiguo sin STRING_AGG — usar conteo simple + ejemplo de nombre)
const Q_IDENTIFICADORES_DUPLICADOS = (cod) => `
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

// V22 — Conciliación bancaria estado: cuentas activas vs estados cargados
const Q_CONCILIACION_ESTADO = (cod) => `
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
ORDER BY ABS(ISNULL(cb.BalanceActual,0)) DESC
`;

// V23 — Resumen anual: ingresos, costos, GAV, utilidad esperada (P&L verificable)
const Q_PL_ANUAL = (cod, year, claseIngreso) => `
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
`;

// V24 — Coherencia: SUM(OB_Pago.PayAmt) vs SUM(AsientoContable clase 10 créditos) por mes
const Q_OB_VS_CONTABLE = (cod, year) => `
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
ORDER BY m.Mes
`;

// V25 — Existencia de PlanContableDetalle para cuentas críticas (50,58,4111,4151,4130)
const Q_PCD_CRITICAS = (cod) => `
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
ORDER BY pcd.CodCuenta
`;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function runOne(pool, label, query) {
  try {
    const res = await pool.request().query(query);
    return { ok: true, rows: res.recordset, error: null };
  } catch (e) {
    return { ok: false, rows: [], error: e.message };
  }
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  console.log(`\nS10 Validation Agent — ${new Date().toISOString()}`);
  console.log(`Year: ${YEAR} | Output: ${OUT}\n`);

  const pool = await new mssql.ConnectionPool({
    server: CONFIG.S10_HOST,
    port: CONFIG.S10_PORT,
    user: CONFIG.S10_USER,
    password: CONFIG.S10_PASSWORD,
    database: CONFIG.S10_DATABASE,
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
    connectionTimeout: 30000,
    requestTimeout: 300000,
  }).connect();

  console.log('Connected to S10 SQL Server\n');

  const output = {
    timestamp: new Date().toISOString(),
    year: YEAR,
    companies: COMPANIES,
    validations: {},
  };

  // Por cada validación, ejecutar para cada empresa y agrupar
  const VALIDATIONS = [
    { id: 'V01_partida_doble',        q: Q_PARTIDA_DOBLE,                 perCompany: true,  extra: null },
    { id: 'V02_apertura',              q: Q_APERTURA,                      perCompany: true,  extra: null },
    { id: 'V03_patrimonio',            q: Q_PATRIMONIO_DETALLE,            perCompany: true,  extra: null },
    { id: 'V04_facturas_sin_asiento_top',     q: (c, ci) => Q_FACTURAS_SIN_ASIENTO(c, YEAR, ci),         perCompany: true,  needsClase: true },
    { id: 'V04b_facturas_sin_asiento_resumen',q: (c, ci) => Q_FACTURAS_SIN_ASIENTO_RESUMEN(c, ci),       perCompany: true,  needsClase: true },
    { id: 'V05_ingresos_sin_doc',     q: (c, ci) => Q_INGRESOS_SIN_DOC(c, YEAR, ci),             perCompany: true,  needsClase: true },
    { id: 'V06_sueldos_aging',        q: Q_SUELDOS_AGING,                 perCompany: true,  extra: null },
    { id: 'V07_cts_depositos',        q: Q_CTS_DEPOSITOS_HISTORICO,       perCompany: true,  extra: null },
    { id: 'V08_participaciones',      q: Q_PARTICIPACIONES,               perCompany: true,  extra: null },
    { id: 'V09_bancos_detalle',       q: Q_BANCOS_DETALLE,                perCompany: true,  extra: null },
    { id: 'V10_ob_cuentas_banco',     q: Q_OB_CUENTAS_BANCO,              perCompany: true,  extra: null },
    { id: 'V11_bancarizacion',        q: (c) => Q_BANCARIZACION_FORENSE(c, YEAR), perCompany: true,  extra: null },
    { id: 'V12_pergola_aging',        q: Q_PERGOLA_AGING,                 perCompany: true,  extra: null },
    { id: 'V13_cxc_concentracion',    q: Q_CXC_CONCENTRACION,             perCompany: true,  extra: null },
    { id: 'V14_intercompany',         q: Q_INTERCOMPANY,                  perCompany: true,  extra: null },
    { id: 'V15_activo_fijo',          q: Q_ACTIVO_FIJO_COHERENCIA,        perCompany: true,  extra: null },
    { id: 'V16_trazabilidad_pago',    q: (c) => Q_TRAZABILIDAD_PAGO(c, YEAR), perCompany: true,  extra: null },
    { id: 'V17_reconciliacion_ingr',  q: (c, ci) => Q_RECONCILIACION_INGRESOS(c, YEAR, ci),      perCompany: true,  needsClase: true },
    { id: 'V18_tributos',             q: Q_TRIBUTOS_DETALLE,              perCompany: true,  extra: null },
    { id: 'V19_balance_resumen',      q: (c) => Q_BALANCE_RESUMEN(c, YEAR), perCompany: true,  extra: null },
    { id: 'V20_fechas_anomalas',      q: Q_FECHAS_ANOMALAS,               perCompany: true,  extra: null },
    { id: 'V21_identificadores_dup',  q: Q_IDENTIFICADORES_DUPLICADOS,    perCompany: true,  extra: null },
    { id: 'V22_conciliacion_estado',  q: Q_CONCILIACION_ESTADO,           perCompany: true,  extra: null },
    { id: 'V23_pl_anual',             q: (c, ci) => Q_PL_ANUAL(c, YEAR, ci),                     perCompany: true,  needsClase: true },
    { id: 'V24_ob_vs_contable',       q: (c) => Q_OB_VS_CONTABLE(c, YEAR), perCompany: true,  extra: null },
    { id: 'V25_pcd_criticas',         q: Q_PCD_CRITICAS,                  perCompany: true,  extra: null },
  ];

  for (const v of VALIDATIONS) {
    console.log(`▶ ${v.id} ...`);
    output.validations[v.id] = {};
    for (const c of COMPANIES) {
      const sql = v.needsClase ? v.q(c.codEmpresa, c.claseIngreso) : v.q(c.codEmpresa);
      const r = await runOne(pool, v.id, sql);
      output.validations[v.id][c.codEmpresa] = {
        companyName: c.name,
        ok: r.ok,
        rowCount: r.rows.length,
        rows: r.rows,
        error: r.error,
      };
      const stat = r.ok ? `${r.rows.length} rows` : `ERROR: ${r.error}`;
      console.log(`    ${c.name.padEnd(50)} → ${stat}`);
    }
  }

  await pool.close();

  fs.writeFileSync(OUT, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n✓ Resultados escritos a: ${OUT}`);
  console.log(`  Total validaciones: ${VALIDATIONS.length}`);
  console.log(`  Total empresas: ${COMPANIES.length}`);
  console.log(`  Total queries ejecutadas: ${VALIDATIONS.length * COMPANIES.length}`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
