/**
 * Diagnóstico: columnas disponibles en AsientoContable + muestra de 3 filas
 * Correr desde la red del cliente (acceso al SQL Server S10)
 *   node inspect-asiento.js
 */

const mssql = require('mssql');

const cfg = {
  server:   '192.168.1.51',
  port:     1433,
  user:     'sa',
  password: 'Cmo$2017.',
  database: 'CMO',
  options:  { trustServerCertificate: true, enableArithAbort: true },
};

async function run() {
  const pool = await mssql.connect(cfg);

  console.log('\n=== COLUMNAS DE AsientoContable ===');
  const cols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_CATALOG = 'CMO' AND TABLE_NAME = 'AsientoContable'
    ORDER BY ORDINAL_POSITION
  `);
  cols.recordset.forEach(c =>
    console.log(`  ${c.COLUMN_NAME.padEnd(40)} ${c.DATA_TYPE}(${c.CHARACTER_MAXIMUM_LENGTH ?? ''})`)
  );

  console.log('\n=== 3 ASIENTOS DE MUESTRA (empresa CMO GROUP, 2026) ===');
  const sample = await pool.request().query(`
    SELECT TOP 3 *
    FROM CMO.dbo.AsientoContable
    WHERE CodEmpresa = '22011489'
      AND YEAR(FechaAplicacionContable) = 2026
    ORDER BY FechaAplicacionContable DESC
  `);
  sample.recordset.forEach((r, i) => {
    console.log(`\n--- Asiento ${i + 1} ---`);
    Object.entries(r).forEach(([k, v]) => console.log(`  ${k.padEnd(35)} = ${v}`));
  });

  await pool.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });
