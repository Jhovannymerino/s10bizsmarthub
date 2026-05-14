const mssql = require('mssql');
const cfg = {
  server:'192.168.1.51', port:1433, user:'sa', password:'Cmo$2017.', database:'CMO',
  options:{ trustServerCertificate:true, enableArithAbort:true },
  requestTimeout: 60000,
};

const EMPRESAS = [
  { cod: '22011489',    nombre: 'CMO GROUP' },
  { cod: '80688541',    nombre: 'INTEGRAL' },
  { cod: '80688706',    nombre: 'MEDARQ' },
];

const TIPOS = ['071','058','060'];

(async () => {
  const pool = await mssql.connect(cfg);

  for (const emp of EMPRESAS) {
    console.log(`\n${'═'.repeat(90)}`);
    console.log(`  ${emp.nombre}`);
    console.log('═'.repeat(90));

    const r = await pool.request().query(`
      SELECT
        doc.CodTipoDocumento                              AS Tipo,
        LEFT(MAX(doc.DescripcionTipoDocumento), 35)       AS DesTipo,
        LEFT(pcd.CodCuenta, 4)                            AS GrupoCuenta,
        pcd.CodCuenta,
        LEFT(MAX(pcd.Descripcion), 40)                    AS DesCuenta,
        COUNT(DISTINCT ac.CodUnico)                       AS NroAsientos,
        ROUND(SUM(ISNULL(ac.Debito,0)),0)                 AS TotalDebe,
        ROUND(SUM(ISNULL(ac.Credito,0)),0)                AS TotalHaber,
        ROUND(SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0)),0) AS NetoDR
      FROM CMO.dbo.vw_12DocumentosPorCobrar doc
      JOIN CMO.dbo.AsientoContable ac
        ON ac.NroD = doc.NroD
        AND ac.CodEmpresa = doc.CodEmpresa
      JOIN CMO.dbo.PlanContableDetalle pcd
        ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
      WHERE doc.CodEmpresa = '${emp.cod}'
        AND doc.CodTipoDocumento IN ('071','058','060')
        AND YEAR(doc.FechaDocumento) >= 2022
      GROUP BY doc.CodTipoDocumento, LEFT(pcd.CodCuenta,4), pcd.CodCuenta
      ORDER BY doc.CodTipoDocumento, ABS(ROUND(SUM(ISNULL(ac.Debito,0)) - SUM(ISNULL(ac.Credito,0)),0)) DESC
    `);

    if (!r.recordset.length) {
      console.log('  (sin resultados — puede que el JOIN por NroD no aplique para estos tipos)');

      // Fallback: buscar por CodIdentificador / glosa en AsientoContable
      const r2 = await pool.request().query(`
        SELECT
          doc.CodTipoDocumento                              AS Tipo,
          LEFT(MAX(doc.DescripcionTipoDocumento), 35)       AS DesTipo,
          COUNT(*)                                          AS NDocs,
          MIN(doc.NroD)                                     AS EjemploNroD
        FROM CMO.dbo.vw_12DocumentosPorCobrar doc
        WHERE doc.CodEmpresa = '${emp.cod}'
          AND doc.CodTipoDocumento IN ('071','058','060')
          AND YEAR(doc.FechaDocumento) >= 2022
        GROUP BY doc.CodTipoDocumento
      `);
      console.log('  Tipos en CxC:');
      r2.recordset.forEach(x =>
        console.log(`    Tipo ${x.Tipo} (${x.DesTipo}) — ${x.NDocs} docs — NroD ejemplo: ${x.EjemploNroD}`)
      );

      if (r2.recordset.length) {
        // Buscar ese NroD en AsientoContable
        const ejemplo = r2.recordset[0].EjemploNroD;
        if (ejemplo) {
          const r3 = await pool.request().query(`
            SELECT TOP 20
              ac.CodUnico, pcd.CodCuenta, LEFT(pcd.Descripcion,40) AS Des,
              ac.Debito, ac.Credito, LEFT(ac.Glosa,50) AS Glosa
            FROM CMO.dbo.AsientoContable ac
            JOIN CMO.dbo.PlanContableDetalle pcd
              ON ac.NroPlanContableDetalle = pcd.NroPlanContableDetalle
            WHERE ac.CodEmpresa = '${emp.cod}'
              AND ac.NroD = '${ejemplo}'
          `);
          console.log(`  Asiento ejemplo NroD=${ejemplo}:`);
          r3.recordset.forEach(x =>
            console.log(`    ${x.CodCuenta.padEnd(12)} ${x.Des.padEnd(40)} D:${String(x.Debito||0).padStart(12)} H:${String(x.Credito||0).padStart(12)}  ${x.Glosa}`)
          );
        }
      }
      continue;
    }

    console.log(`  ${'Tipo'.padEnd(5)} ${'Descripción'.padEnd(36)} ${'GrupoCuenta'.padEnd(5)} ${'CodCuenta'.padEnd(14)} ${'Descripción Cuenta'.padEnd(41)} ${'Asientos'.padStart(8)} ${'NetoDR'.padStart(14)}`);
    let lastTipo = '';
    r.recordset.forEach(x => {
      if (x.Tipo !== lastTipo) { console.log(''); lastTipo = x.Tipo; }
      console.log(`  ${String(x.Tipo).padEnd(5)} ${x.DesTipo.padEnd(36)} ${x.GrupoCuenta.padEnd(5)} ${x.CodCuenta.padEnd(14)} ${x.DesCuenta.padEnd(41)} ${String(x.NroAsientos).padStart(8)} ${String(x.NetoDR).padStart(14)}`);
    });
  }

  await pool.close();
})().catch(e => { console.error(e.message); process.exit(1); });
