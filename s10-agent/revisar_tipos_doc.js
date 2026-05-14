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
  { cod: '20431287651', nombre: 'AMERICANA' },
];

const fmt = n => n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

(async () => {
  const pool = await mssql.connect(cfg);

  for (const emp of EMPRESAS) {
    console.log(`\n${'═'.repeat(82)}`);
    console.log(`  ${emp.nombre}`);
    console.log('═'.repeat(82));

    const cxc = await pool.request().query(`
      SELECT
        CodTipoDocumento                              AS Cod,
        LEFT(MAX(DescripcionTipoDocumento),42)        AS Des,
        COUNT(*)                                      AS N,
        ROUND(SUM(ISNULL(Total,0)),0)                 AS Bruto,
        SUM(CASE WHEN (Total - ISNULL(TotalPagado,0)) > 0.01 THEN 1 ELSE 0 END) AS Pdtes,
        ROUND(SUM(CASE WHEN (Total - ISNULL(TotalPagado,0)) > 0.01
                       THEN (Total - ISNULL(TotalPagado,0)) ELSE 0 END),0)      AS SaldoPdte
      FROM CMO.dbo.vw_12DocumentosPorCobrar
      WHERE CodEmpresa = '${emp.cod}' AND YEAR(FechaDocumento) >= 2022
      GROUP BY CodTipoDocumento ORDER BY Bruto DESC
    `);
    console.log('  CxC  Cod  Descripción                                  N       Bruto  Pdtes       Saldo');
    cxc.recordset.forEach(r =>
      console.log(`       ${String(r.Cod).padEnd(5)} ${r.Des.padEnd(42)} ${String(r.N).padStart(4)} ${String(r.Bruto).padStart(14)} ${String(r.Pdtes).padStart(5)} ${String(r.SaldoPdte).padStart(13)}`)
    );

    const cxp = await pool.request().query(`
      SELECT
        CodTipoDocumento                              AS Cod,
        LEFT(MAX(DescripcionTipoDocumento),42)        AS Des,
        COUNT(*)                                      AS N,
        ROUND(SUM(ISNULL(Total,0)),0)                 AS Bruto,
        SUM(CASE WHEN (Total - ISNULL(TotalPagado,0)) > 0.01 THEN 1 ELSE 0 END) AS Pdtes,
        ROUND(SUM(CASE WHEN (Total - ISNULL(TotalPagado,0)) > 0.01
                       THEN (Total - ISNULL(TotalPagado,0)) ELSE 0 END),0)      AS SaldoPdte
      FROM CMO.dbo.vw_12DocumentosPorPagar
      WHERE CodEmpresa = '${emp.cod}' AND YEAR(FechaDocumento) >= 2022
      GROUP BY CodTipoDocumento ORDER BY Bruto DESC
    `);
    console.log('  CxP  Cod  Descripción                                  N       Bruto  Pdtes       Saldo');
    cxp.recordset.forEach(r =>
      console.log(`       ${String(r.Cod).padEnd(5)} ${r.Des.padEnd(42)} ${String(r.N).padStart(4)} ${String(r.Bruto).padStart(14)} ${String(r.Pdtes).padStart(5)} ${String(r.SaldoPdte).padStart(13)}`)
    );
  }

  await pool.close();
})().catch(e => { console.error(e.message); process.exit(1); });
