const mssql = require('mssql');
const cfg = { server:'192.168.1.51', port:1433, user:'sa', password:'Cmo$2017.', database:'CMO',
  options:{trustServerCertificate:true,encrypt:false}, connectionTimeout:15000, requestTimeout:30000 };
async function run() {
  const pool = await mssql.connect(cfg);
  const r1 = await pool.request().query(`
    SELECT TOP 15 CodEmpresa, DescripcionEstado AS Estado,
      SerieDocumento, NumeroDocumento, DescripcionIdentificador AS Cliente, ISNULL(Total,0) AS Total,
      RelacionadoCon, SerieRelacionado, NumeroRelacionado, LEFT(ISNULL(Observacion,''),80) AS Obs
    FROM CMO.dbo.vw_12DocumentosPorCobrar
    WHERE CodEmpresa IN ('22011489','80688541','80688706','80688524')
      AND DescripcionEstado = '6'
    ORDER BY ISNULL(Total,0) DESC
  `);
  console.log('=== RELACIONADO ===');
  r1.recordset.forEach(r => console.log(JSON.stringify(r)));
  const r2 = await pool.request().query(`
    SELECT TOP 8
      doc.SerieDocumento, doc.NumeroDocumento, doc.DescripcionIdentificador AS Cliente,
      pcd.CodCuenta, pcd.Descripcion AS DesCuenta,
      ROUND(ISNULL(ac.Debito,0),2) AS Debe, ROUND(ISNULL(ac.Credito,0),2) AS Haber
    FROM CMO.dbo.vw_12DocumentosPorCobrar doc
    JOIN CMO.dbo.AsientoContable ac ON ac.NroD=doc.NroD AND ac.CodEmpresa=doc.CodEmpresa
    JOIN CMO.dbo.PlanContableDetalle pcd ON ac.NroPlanContableDetalle=pcd.NroPlanContableDetalle
    WHERE doc.CodEmpresa='22011489' AND doc.DescripcionEstado='6' AND ISNULL(doc.Total,0)=0
    ORDER BY doc.NumeroDocumento
  `);
  console.log('=== CUENTAS ASIENTO ANULADO/0 ===');
  r2.recordset.forEach(r => console.log(JSON.stringify(r)));
  await pool.close();
}
run().catch(e=>{ console.error('ERROR:',e.message); process.exit(1); });
