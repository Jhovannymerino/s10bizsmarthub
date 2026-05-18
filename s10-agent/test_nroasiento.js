const mssql = require('mssql');
const cfg = {
  server: '192.168.1.51', port: 1433, user: 'sa', password: 'Cmo$2017.',
  database: 'CMO', options: { trustServerCertificate: true, enableArithAbort: true }
};

async function run() {
  const pool = await mssql.connect(cfg);

  const r = await pool.request().query(`
    SELECT TOP 15
      CONVERT(varchar(20), CONVERT(bigint, ac.CodAsientoContable)) AS NroAsiento,
      ac.CodProcedencia,
      LEFT(ac.Procedencia, 35) AS Procedencia,
      CONVERT(VARCHAR(10), ac.FechaAplicacionContable, 103) AS Fecha,
      LEFT(ISNULL(ac.Glosa,''), 50) AS Glosa
    FROM CMO.dbo.AsientoContable ac
    WHERE ac.CodEmpresa = '80688541'
      AND YEAR(ac.FechaAplicacionContable) = 2026
    GROUP BY ac.CodAsientoContable, ac.CodProcedencia, ac.Procedencia, ac.FechaAplicacionContable, ac.Glosa
    ORDER BY ac.FechaAplicacionContable DESC
  `);

  console.log('Sample NroAsiento values (INTEGRAL 2026):');
  r.recordset.forEach(row => {
    console.log(`  NroAsiento=${String(row.NroAsiento).padStart(5)} | Proc=${row.CodProcedencia} | ${row.Procedencia?.padEnd(35)} | ${row.Fecha} | ${row.Glosa}`);
  });

  await pool.close();
}
run().catch(e => { console.error(e.message); process.exit(1); });
