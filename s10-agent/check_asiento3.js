const mssql = require('mssql');
const cfg = {
  server: '192.168.1.51', port: 1433, user: 'sa', password: 'Cmo$2017.',
  database: 'CMO', options: { trustServerCertificate: true, enableArithAbort: true }
};

async function run() {
  const pool = await mssql.connect(cfg);

  // Check distinct CodUnico groups - one per asiento
  // Look at the CodAsientoContable sequence to understand if it's per-type or global
  const r = await pool.request().query(`
    SELECT TOP 20
      MIN(ac.CodUnico) AS CodUnico,
      MIN(ac.CodAsientoContable) AS CodAsientoContable,
      MIN(ac.CodProcedencia) AS CodProcedencia,
      MIN(ac.Procedencia) AS Procedencia,
      MIN(ac.FechaAplicacionContable) AS Fecha,
      MIN(LEFT(ac.Glosa, 60)) AS Glosa
    FROM CMO.dbo.AsientoContable ac
    WHERE ac.CodEmpresa = '22011489'
      AND YEAR(ac.FechaAplicacionContable) = 2026
    GROUP BY ac.CodUnico
    ORDER BY MIN(ac.FechaAplicacionContable) ASC, MIN(ac.CodUnico) ASC
  `);

  console.log('Primeros 20 asientos de CMO 2026 (ordenados por fecha):');
  r.recordset.forEach(row => {
    console.log(`  CodUnico=${String(row.CodUnico).padStart(8)} | CodAsiento=${row.CodAsientoContable} | Proc=${row.CodProcedencia} | Fecha=${row.Fecha?.toISOString()?.slice(0,10)} | Glosa=${row.Glosa}`);
  });

  // Check if CodAsientoContable restarts per procedure type
  const byProc = await pool.request().query(`
    SELECT 
      ac.CodProcedencia,
      LEFT(MIN(ac.Procedencia), 50) AS Procedencia,
      COUNT(DISTINCT ac.CodUnico) AS Asientos,
      MIN(CAST(ac.CodAsientoContable AS bigint)) AS MinCodAsiento,
      MAX(CAST(ac.CodAsientoContable AS bigint)) AS MaxCodAsiento
    FROM CMO.dbo.AsientoContable ac
    WHERE ac.CodEmpresa = '22011489'
      AND YEAR(ac.FechaAplicacionContable) = 2026
    GROUP BY ac.CodProcedencia
    ORDER BY ac.CodProcedencia
  `);
  console.log('\nPor CodProcedencia:');
  byProc.recordset.forEach(row => {
    console.log(`  Proc=${row.CodProcedencia} | Asientos=${row.Asientos} | CodAsiento MIN=${row.MinCodAsiento} MAX=${row.MaxCodAsiento} | ${row.Procedencia}`);
  });

  await pool.close();
}
run().catch(e => { console.error(e.message); process.exit(1); });
