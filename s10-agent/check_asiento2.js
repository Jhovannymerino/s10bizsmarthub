const mssql = require('mssql');
const cfg = {
  server: '192.168.1.51', port: 1433, user: 'sa', password: 'Cmo$2017.',
  database: 'CMO', options: { trustServerCertificate: true, enableArithAbort: true }
};

async function run() {
  const pool = await mssql.connect(cfg);

  // Get non-closing entries - regular facturas, pagos etc
  const r = await pool.request().query(`
    SELECT TOP 10 
      ac.CodUnico,
      ac.CodAsientoContable,
      ac.NumeroCorrelativo,
      ac.CodVoucher,
      ac.CodProcedencia,
      ac.Procedencia,
      ac.NumeroDocumento,
      LEFT(ac.Glosa, 60) AS Glosa,
      ac.FechaAplicacionContable
    FROM CMO.dbo.AsientoContable ac
    WHERE ac.CodEmpresa = '22011489'
      AND YEAR(ac.FechaAplicacionContable) = 2026
      AND ac.CodProcedencia NOT IN ('15')
      AND ac.NumeroCorrelativo IS NOT NULL
    ORDER BY ac.FechaAplicacionContable DESC, ac.CodUnico DESC
  `);
  
  console.log('Entries with NumeroCorrelativo populated:');
  r.recordset.forEach(row => {
    console.log(`  CodUnico=${row.CodUnico} | CodAsiento=${row.CodAsientoContable} | Correlativo=${row.NumeroCorrelativo} | Voucher=${row.CodVoucher} | Proc=${row.CodProcedencia} | Glosa=${row.Glosa}`);
  });

  // Check how many have each field populated
  const counts = await pool.request().query(`
    SELECT 
      COUNT(*) AS Total,
      SUM(CASE WHEN NumeroCorrelativo IS NOT NULL AND NumeroCorrelativo != '' THEN 1 ELSE 0 END) AS TieneCorrelativo,
      SUM(CASE WHEN CodVoucher IS NOT NULL AND CodVoucher != '' THEN 1 ELSE 0 END) AS TieneVoucher,
      SUM(CASE WHEN CodAsientoContable IS NOT NULL AND CodAsientoContable != '' THEN 1 ELSE 0 END) AS TieneAsientoCod
    FROM CMO.dbo.AsientoContable
    WHERE CodEmpresa = '22011489'
      AND YEAR(FechaAplicacionContable) = 2026
  `);
  console.log('\nConteos 2026 CMO:');
  console.log(JSON.stringify(counts.recordset[0]));

  // Look at distinct CodUnico groups with their asiento codes
  const groups = await pool.request().query(`
    SELECT TOP 15 DISTINCT
      ac.CodUnico,
      MIN(ac.CodAsientoContable) AS CodAsientoContable,
      MIN(ac.NumeroCorrelativo) AS NumeroCorrelativo,
      MIN(ac.CodVoucher) AS CodVoucher,
      MIN(ac.CodProcedencia) AS CodProcedencia,
      MIN(LEFT(ac.Glosa, 50)) AS Glosa,
      MIN(ac.FechaAplicacionContable) AS Fecha
    FROM CMO.dbo.AsientoContable ac
    WHERE ac.CodEmpresa = '22011489'
      AND YEAR(ac.FechaAplicacionContable) = 2026
      AND ac.CodProcedencia IN ('01','02','03','04','05','06','07','08','09','10','11','12','13','14')
    GROUP BY ac.CodUnico
    ORDER BY MIN(ac.FechaAplicacionContable) DESC
  `);
  console.log('\nGrupos de asientos regulares (un CodUnico = un asiento):');
  groups.recordset.forEach(row => {
    console.log(`  CodUnico=${row.CodUnico} | CodAsiento=${row.CodAsientoContable} | Correlativo=${row.NumeroCorrelativo} | Voucher=${row.CodVoucher} | Proc=${row.CodProcedencia} | Fecha=${row.Fecha?.toISOString()?.slice(0,10)} | Glosa=${row.Glosa}`);
  });

  await pool.close();
}
run().catch(e => { console.error(e.message); process.exit(1); });
