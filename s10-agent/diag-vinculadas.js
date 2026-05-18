/**
 * Diagnóstico forense: Vinculadas en vw_12DocumentosPorCobrar
 * Corre desde el VPS con VPN activa hacia 192.168.1.51
 */
const mssql = require('mssql');

const cfg = {
  server: '192.168.1.51', port: 1433,
  user: 'sa', password: 'Cmo$2017.', database: 'CMO',
  options: { trustServerCertificate: true, encrypt: false },
  connectionTimeout: 15000, requestTimeout: 30000,
};

async function run() {
  const pool = await mssql.connect(cfg);
  const q = (sql) => pool.request().query(sql);

  // 1. Columnas disponibles en la vista
  console.log('\n=== COLUMNAS vw_12DocumentosPorCobrar ===');
  const cols = await q(`
    SELECT c.name AS col, t.name AS tipo
    FROM sys.columns c
    JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID('CMO.dbo.vw_12DocumentosPorCobrar')
    ORDER BY c.column_id
  `);
  cols.recordset.forEach(r => console.log(`  ${r.col} (${r.tipo})`));

  // 2. Muestra de Estado=6 con TODOS los campos de las 4 empresas
  console.log('\n=== ESTADO=6 MUESTRA (top 5 con valor, top 5 sin valor) ===');
  const v6 = await q(`
    SELECT TOP 10
      CodEmpresa, NroD, CodTipoDocumento, DescripcionTipoDocumento,
      SerieDocumento, NumeroDocumento,
      CONVERT(VARCHAR(10), FechaDocumento, 103) AS Fecha,
      DescripcionEstado AS Estado,
      CodIdentificador AS RUC,
      DescripcionIdentificador AS Cliente,
      CodMoneda, Total, TotalPagado,
      -- campos de vinculación candidatos:
      NroDOrigen,
      CodDocRelacionado,
      NroDocRelacionado,
      NroDVinculado,
      CodVinculado,
      Observacion
    FROM CMO.dbo.vw_12DocumentosPorCobrar
    WHERE CodEmpresa IN ('22011489','80688541','80688706','80688524')
      AND DescripcionEstado = '6'
    ORDER BY ISNULL(Total,0) DESC
  `).catch(() => q(`
    SELECT TOP 10
      CodEmpresa, NroD, CodTipoDocumento, DescripcionTipoDocumento,
      SerieDocumento, NumeroDocumento,
      CONVERT(VARCHAR(10), FechaDocumento, 103) AS Fecha,
      DescripcionEstado AS Estado,
      CodIdentificador AS RUC,
      DescripcionIdentificador AS Cliente,
      CodMoneda, Total, TotalPagado,
      Observacion
    FROM CMO.dbo.vw_12DocumentosPorCobrar
    WHERE CodEmpresa IN ('22011489','80688541','80688706','80688524')
      AND DescripcionEstado = '6'
    ORDER BY ISNULL(Total,0) DESC
  `));
  v6.recordset.forEach(r => console.log(JSON.stringify(r)));

  // 3. Estado=6/Total=0: ¿tienen asiento contable?
  console.log('\n=== ESTADO=6/Total=0 — asientos en AsientoContable ===');
  const ac = await q(`
    SELECT TOP 20
      doc.CodEmpresa, doc.NroD, doc.SerieDocumento, doc.NumeroDocumento,
      CONVERT(VARCHAR(10), doc.FechaDocumento, 103) AS FechaDoc,
      doc.DescripcionIdentificador AS Cliente,
      ISNULL(doc.Total,0) AS Total,
      COUNT(ac.CodUnico) AS NumAsientos,
      ROUND(SUM(ISNULL(ac.Debito,0)),2) AS TotalDebe,
      ROUND(SUM(ISNULL(ac.Credito,0)),2) AS TotalHaber
    FROM CMO.dbo.vw_12DocumentosPorCobrar doc
    LEFT JOIN CMO.dbo.AsientoContable ac
      ON ac.NroD = doc.NroD AND ac.CodEmpresa = doc.CodEmpresa
    WHERE doc.CodEmpresa IN ('22011489','80688541','80688706','80688524')
      AND doc.DescripcionEstado = '6'
      AND ISNULL(doc.Total,0) = 0
    GROUP BY doc.CodEmpresa, doc.NroD, doc.SerieDocumento,
             doc.NumeroDocumento, doc.FechaDocumento,
             doc.DescripcionIdentificador, doc.Total
    ORDER BY doc.CodEmpresa, doc.FechaDocumento DESC
  `);
  ac.recordset.forEach(r => console.log(JSON.stringify(r)));

  // 4. Estado=6/Total>0: ¿tienen asiento de ingreso?
  console.log('\n=== ESTADO=6/Total>0 — asientos de ingreso (7x) ===');
  const ac2 = await q(`
    SELECT TOP 20
      doc.CodEmpresa, doc.NroD,
      doc.SerieDocumento, doc.NumeroDocumento,
      CONVERT(VARCHAR(10), doc.FechaDocumento, 103) AS Fecha,
      doc.DescripcionIdentificador AS Cliente,
      doc.CodMoneda, ISNULL(doc.Total,0) AS Total,
      COUNT(DISTINCT ac.CodUnico) AS NumAsientosIngreso
    FROM CMO.dbo.vw_12DocumentosPorCobrar doc
    LEFT JOIN CMO.dbo.AsientoContable ac
      ON ac.NroD = doc.NroD AND ac.CodEmpresa = doc.CodEmpresa
    LEFT JOIN CMO.dbo.PlanContableDetalle pcd
      ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
     AND LEFT(pcd.CodCuenta,2) IN ('70','71','72','73','74','75')
    WHERE doc.CodEmpresa IN ('22011489','80688541','80688706','80688524')
      AND doc.DescripcionEstado = '6'
      AND ISNULL(doc.Total,0) > 0
      AND doc.CodTipoDocumento IN ('060','125','131')
    GROUP BY doc.CodEmpresa, doc.NroD, doc.SerieDocumento,
             doc.NumeroDocumento, doc.FechaDocumento,
             doc.DescripcionIdentificador, doc.CodMoneda, doc.Total
    ORDER BY ISNULL(doc.Total,0) DESC
  `);
  ac2.recordset.forEach(r => console.log(JSON.stringify(r)));

  await pool.close();
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
