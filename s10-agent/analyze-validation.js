// Analiza validation-output.json y extrae hallazgos por validación
const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'validation-output.json'), 'utf8'));
const V = data.validations;

const COMPANIES = {
  '22011489': 'CMO',
  '80688541': 'INTEGRAL',
  '80688706': 'MEDARQ',
  '80688524': 'AMERICANA',
};

function header(title) {
  console.log('\n' + '═'.repeat(80));
  console.log(title);
  console.log('═'.repeat(80));
}

function showRows(rows, fields, max = 10) {
  if (!rows || rows.length === 0) { console.log('  (sin filas)'); return; }
  const sliced = rows.slice(0, max);
  for (const r of sliced) {
    const line = fields.map((f) => `${f}=${r[f] ?? '-'}`).join(' | ');
    console.log('  ' + line);
  }
  if (rows.length > max) console.log(`  ... y ${rows.length - max} más`);
}

function shortStr(s, n = 40) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// ─── V01: Partida doble ───
header('V01 — PARTIDA DOBLE (Σ Db = Σ Cr)');
for (const cod of Object.keys(COMPANIES)) {
  const r = V.V01_partida_doble[cod].rows[0] || {};
  console.log(`  ${COMPANIES[cod].padEnd(10)} | Asientos=${r.TotalAsientos?.toLocaleString()} | Σdb=${r.SumDebito?.toLocaleString()} | Σcr=${r.SumCredito?.toLocaleString()} | Descuadre=${r.Descuadre?.toLocaleString()} | DocsDistintos=${r.DocsDistintos?.toLocaleString()} | SinNroD=${r.SinNroD?.toLocaleString()}`);
}

// ─── V02: Apertura ───
header('V02 — ASIENTOS DE APERTURA por año (glosa con APERTURA/INICIO/INICIAL)');
for (const cod of Object.keys(COMPANIES)) {
  console.log(`\n  ${COMPANIES[cod]}:`);
  const rows = V.V02_apertura[cod].rows;
  if (rows.length === 0) { console.log('    (NO HAY ASIENTOS DE APERTURA EN NINGÚN AÑO)'); continue; }
  showRows(rows, ['Anio', 'PrimerAsiento', 'NumAsientos', 'NumClases', 'SumDebito', 'SumCredito'], 6);
}

// ─── V03: Patrimonio detalle ───
header('V03 — PATRIMONIO (clases 50,51,52,57,58,59)');
for (const cod of Object.keys(COMPANIES)) {
  console.log(`\n  ${COMPANIES[cod]}:`);
  const rows = V.V03_patrimonio[cod].rows;
  showRows(rows, ['CodCuenta', 'DesCuenta', 'SaldoAcreedor'], 12);
}

// ─── V04 y V04b: Facturas sin asiento ───
header('V04b — RESUMEN FACTURAS EMITIDAS SIN ASIENTO (por año)');
for (const cod of Object.keys(COMPANIES)) {
  console.log(`\n  ${COMPANIES[cod]}:`);
  const rows = V.V04b_facturas_sin_asiento_resumen[cod].rows;
  if (rows.length === 0) { console.log('    (todas contabilizadas)'); continue; }
  showRows(rows, ['Anio', 'Tipo', 'NumFacturas', 'MontoTotal'], 10);
  const total = rows.reduce((s, r) => s + (r.MontoTotal || 0), 0);
  const count = rows.reduce((s, r) => s + (r.NumFacturas || 0), 0);
  console.log(`    TOTAL: ${count} facturas | ${total.toLocaleString()} S/`);
}

// ─── V05: Ingresos sin doc ───
header('V05 — INGRESOS CLASE 70/75 SIN NroD (año actual)');
for (const cod of Object.keys(COMPANIES)) {
  const rows = V.V05_ingresos_sin_doc[cod].rows;
  if (rows.length === 0) { console.log(`  ${COMPANIES[cod]}: (ninguno)`); continue; }
  const monto = rows.reduce((s, r) => s + Math.abs((r.Credito || 0) - (r.Debito || 0)), 0);
  console.log(`\n  ${COMPANIES[cod]}: ${rows.length} asientos | ${monto.toLocaleString()} S/`);
  showRows(rows, ['Fecha', 'CodCuenta', 'Credito', 'Glosa'], 12);
}

// ─── V06: Sueldos aging ───
header('V06 — SUELDOS POR PAGAR cta 4111 (provisión vs pago por mes)');
for (const cod of Object.keys(COMPANIES)) {
  console.log(`\n  ${COMPANIES[cod]} — últimos 8 meses:`);
  const rows = V.V06_sueldos_aging[cod].rows.slice(0, 8);
  showRows(rows, ['Anio', 'Mes', 'Provisionado', 'Pagado', 'SaldoMes'], 8);
  // Saldo acumulado pendiente
  const total = V.V06_sueldos_aging[cod].rows.reduce((s, r) => s + (r.SaldoMes || 0), 0);
  console.log(`    Saldo acumulado pendiente: ${total.toFixed(2)} S/`);
}

// ─── V07: CTS depósitos ───
header('V07 — CTS cta 4151 (debe haber Mayo y Noviembre cada año)');
for (const cod of Object.keys(COMPANIES)) {
  console.log(`\n  ${COMPANIES[cod]}:`);
  const rows = V.V07_cts_depositos[cod].rows;
  // Agrupar por año/mes
  const groups = {};
  for (const r of rows) {
    const k = `${r.Anio}`;
    if (!groups[k]) groups[k] = [];
    groups[k].push(r);
  }
  for (const [anio, gs] of Object.entries(groups)) {
    const meses = gs.map((g) => `M${g.Mes}(prov=${(g.Provisionado||0).toFixed(0)} pag=${(g.Pagado||0).toFixed(0)})`).join(', ');
    console.log(`    ${anio}: ${meses}`);
  }
}

// ─── V08: Participaciones ───
header('V08 — PARTICIPACIONES cta 413* (DL 892)');
for (const cod of Object.keys(COMPANIES)) {
  console.log(`\n  ${COMPANIES[cod]}:`);
  const rows = V.V08_participaciones[cod].rows;
  if (rows.length === 0) { console.log('    (no usa cuenta 413*)'); continue; }
  showRows(rows, ['CodCuenta', 'Anio', 'Provisionado', 'Pagado', 'Saldo'], 10);
}

// ─── V09: Bancos detalle ───
header('V09 — BANCOS (clase 10) — saldos al cierre de cada año');
for (const cod of Object.keys(COMPANIES)) {
  console.log(`\n  ${COMPANIES[cod]}:`);
  const rows = V.V09_bancos_detalle[cod].rows;
  if (rows.length === 0) { console.log('    (sin filas)'); continue; }
  for (const r of rows.slice(0, 8)) {
    const cuenta = `${r.CodCuenta} ${shortStr(r.DesBanco, 30)}`;
    console.log(`    ${cuenta.padEnd(40)} | 2022=${(r.SaldoFin2022||0).toFixed(0).padStart(12)} | 2023=${(r.SaldoFin2023||0).toFixed(0).padStart(12)} | 2024=${(r.SaldoFin2024||0).toFixed(0).padStart(12)} | 2025=${(r.SaldoFin2025||0).toFixed(0).padStart(12)} | hoy=${(r.SaldoNeto||0).toFixed(0).padStart(12)}`);
  }
  if (rows.length > 8) console.log(`    ... y ${rows.length - 8} cuentas más`);
}

// ─── V10: OB_CuentaBanco ───
header('V10 — OB_CuentaBanco (cuentas registradas en módulo conciliación)');
for (const cod of Object.keys(COMPANIES)) {
  const rows = V.V10_ob_cuentas_banco[cod].rows;
  const sinEstados = rows.filter((r) => r.NumEstadosCargados === 0).length;
  console.log(`  ${COMPANIES[cod].padEnd(10)}: ${rows.length} cuentas activas | ${sinEstados} SIN estados cargados`);
}

// ─── V11: Bancarización ───
header('V11 — BANCARIZACIÓN Ley 28194 (pagos > S/3,500 ó > US$1,000)');
for (const cod of Object.keys(COMPANIES)) {
  const r = V.V11_bancarizacion[cod].rows[0] || {};
  const compliance = r.PagosMateriales > 0
    ? ((r.PagosBancarizados + (r.PagosCompensacionNC || 0) + (r.PagosCanjeLetra || 0)) / r.PagosMateriales * 100).toFixed(1)
    : 'N/A';
  console.log(`  ${COMPANIES[cod].padEnd(10)} | TotalPagos=${r.PagosTotalAnio} | Materiales=${r.PagosMateriales} | Bancarizados=${r.PagosBancarizados} | CompensaciónNC=${r.PagosCompensacionNC} | CanjeLetra=${r.PagosCanjeLetra} | NoBancarizados=${r.PagosNoBancarizados} | Compliance=${compliance}%`);
}

// ─── V12: PERGOLA aging ───
header('V12 — CLIENTE PERGOLA — documentos pendientes por empresa');
for (const cod of Object.keys(COMPANIES)) {
  const rows = V.V12_pergola_aging[cod].rows;
  if (rows.length === 0) { console.log(`  ${COMPANIES[cod]}: (sin docs PERGOLA pendientes)`); continue; }
  const saldoTotal = rows.reduce((s, r) => s + (r.Saldo || 0), 0);
  const vencidos90 = rows.filter((r) => r.DiasVencido > 90).length;
  const vencidos180 = rows.filter((r) => r.DiasVencido > 180).length;
  const vencidosMax = Math.max(...rows.map((r) => r.DiasVencido));
  console.log(`\n  ${COMPANIES[cod]}: ${rows.length} docs | Saldo total = ${saldoTotal.toLocaleString()} S/ | Vencidos >90d=${vencidos90} | >180d=${vencidos180} | Max=${vencidosMax}d`);
}

// ─── V13: CxC Concentración ───
header('V13 — CONCENTRACIÓN CxC (top clientes por saldo)');
for (const cod of Object.keys(COMPANIES)) {
  console.log(`\n  ${COMPANIES[cod]}:`);
  const rows = V.V13_cxc_concentracion[cod].rows;
  if (rows.length === 0) { console.log('    (sin saldos)'); continue; }
  showRows(rows, ['Cliente', 'Saldo', 'Vencido90Mas', 'Vencido180Mas'], 8);
  const total = rows.reduce((s, r) => s + (r.Saldo || 0), 0);
  console.log(`    Top ${rows.length} suman: ${total.toLocaleString()} S/`);
}

// ─── V14: Intercompañía ───
header('V14 — SALDOS INTERCOMPAÑÍA (cls 14,16,17 con tercero del grupo)');
for (const cod of Object.keys(COMPANIES)) {
  console.log(`\n  ${COMPANIES[cod]}:`);
  const rows = V.V14_intercompany[cod].rows;
  if (rows.length === 0) { console.log('    (sin saldos intercompañía)'); continue; }
  showRows(rows, ['Clase', 'CodCuenta', 'Tercero', 'RUC', 'Saldo'], 8);
  const total = rows.reduce((s, r) => s + (r.Saldo || 0), 0);
  console.log(`    TOTAL intercompañía: ${total.toLocaleString()} S/`);
}

// ─── V15: Activo fijo coherencia ───
header('V15 — ACTIVO FIJO clase 33/39/68');
for (const cod of Object.keys(COMPANIES)) {
  console.log(`\n  ${COMPANIES[cod]}:`);
  const rows = V.V15_activo_fijo[cod].rows;
  const c33 = rows.filter((r) => r.Clase === '33').reduce((s, r) => s + (r.SaldoNatural || 0), 0);
  const c39 = rows.filter((r) => r.Clase === '39').reduce((s, r) => s + (r.SaldoNatural || 0), 0);
  const c68 = rows.filter((r) => r.Clase === '68').reduce((s, r) => s + (r.SaldoNatural || 0), 0);
  console.log(`    Cls 33 (activo bruto):     ${c33.toLocaleString().padStart(15)} S/`);
  console.log(`    Cls 39 (deprec. acum.):    ${c39.toLocaleString().padStart(15)} S/`);
  console.log(`    Cls 68 (deprec. ejercicio):${c68.toLocaleString().padStart(15)} S/`);
  console.log(`    VALOR NETO (33-39):        ${(c33 - c39).toLocaleString().padStart(15)} S/`);
}

// ─── V16: Trazabilidad pago ───
header('V16 — TRAZABILIDAD OB_Pago ↔ DetalleAsignacion');
for (const cod of Object.keys(COMPANIES)) {
  const r = V.V16_trazabilidad_pago[cod].rows[0] || {};
  const pct = r.PagosTotal > 0 ? (r.PagosConAsignacion / r.PagosTotal * 100).toFixed(2) : '0';
  console.log(`  ${COMPANIES[cod].padEnd(10)} | Total=${r.PagosTotal} | ConAsign=${r.PagosConAsignacion} | SinAsign=${r.PagosSinAsignacion} | Trazabilidad=${pct}% | Facturas=${r.FacturasReferenciadas} | Compensaciones=${r.AsignConCompensacion}`);
}

// ─── V17: Reconciliación ingresos ───
header('V17 — RECONCILIACIÓN INGRESOS CONTABLES vs FACTURAS por mes (año 2026)');
for (const cod of Object.keys(COMPANIES)) {
  console.log(`\n  ${COMPANIES[cod]}:`);
  const rows = V.V17_reconciliacion_ingr[cod].rows;
  showRows(rows, ['Mes', 'IngresosContables', 'MontoFacturado', 'Diferencia'], 12);
  const totalC = rows.reduce((s, r) => s + (r.IngresosContables || 0), 0);
  const totalF = rows.reduce((s, r) => s + (r.MontoFacturado || 0), 0);
  console.log(`    Total: Contables=${totalC.toLocaleString()} | Facturado=${totalF.toLocaleString()} | Δ=${(totalC - totalF).toLocaleString()}`);
}

// ─── V18: Tributos ───
header('V18 — TRIBUTOS POR PAGAR cta 40* (saldo > 0)');
for (const cod of Object.keys(COMPANIES)) {
  console.log(`\n  ${COMPANIES[cod]} (top 5 por saldo):`);
  const rows = V.V18_tributos[cod].rows.slice(0, 5);
  for (const r of rows) {
    console.log(`    ${r.CodCuenta} ${shortStr(r.DesCuenta, 40).padEnd(40)} | Saldo=${(r.SaldoPorPagar || 0).toLocaleString().padStart(14)} S/ | Último: ${r.UltimoMov?.slice?.(0, 10) || '-'}`);
  }
}

// ─── V19: Balance resumen ───
header('V19 — BALANCE por clase (saldo histórico vs movimiento 2026)');
for (const cod of Object.keys(COMPANIES)) {
  console.log(`\n  ${COMPANIES[cod]} — saldos por clase histórica:`);
  const rows = V.V19_balance_resumen[cod].rows;
  // Mostrar grupo mayor
  const grouped = {};
  for (const r of rows) {
    if (!grouped[r.GrupoMayor]) grouped[r.GrupoMayor] = { sumDeb: 0, sumCre: 0, saldo: 0 };
    grouped[r.GrupoMayor].sumDeb += r.SumDebito || 0;
    grouped[r.GrupoMayor].sumCre += r.SumCredito || 0;
    grouped[r.GrupoMayor].saldo += r.SaldoNeto || 0;
  }
  const labels = { '1': 'Activo', '2': 'Inventarios', '3': 'A.Fijo', '4': 'Pasivo', '5': 'Patrim', '6': 'Gastos', '7': 'Ingresos', '8': 'Imp.Renta', '9': 'C.Operativo' };
  for (const [k, v] of Object.entries(grouped)) {
    console.log(`    Grupo ${k} (${labels[k] || ''}):  Σdb=${v.sumDeb.toLocaleString().padStart(15)} | Σcr=${v.sumCre.toLocaleString().padStart(15)} | Saldo=${v.saldo.toLocaleString().padStart(15)}`);
  }
}

// ─── V20: Fechas anómalas ───
header('V20 — ASIENTOS EN FECHAS ANÓMALAS');
for (const cod of Object.keys(COMPANIES)) {
  console.log(`\n  ${COMPANIES[cod]}:`);
  const rows = V.V20_fechas_anomalas[cod].rows;
  showRows(rows, ['Categoria', 'NumAsientos', 'DocsDistintos', 'Monto'], 5);
}

// ─── V21: Identificadores duplicados ───
header('V21 — IDENTIFICADORES con MÚLTIPLES NOMBRES (top 5)');
for (const cod of Object.keys(COMPANIES)) {
  console.log(`\n  ${COMPANIES[cod]}:`);
  const rows = V.V21_identificadores_dup[cod].rows.slice(0, 5);
  if (rows.length === 0) { console.log('    (todos consistentes)'); continue; }
  for (const r of rows) {
    console.log(`    Cod=${r.CodIdentificador} | Nombres=${r.NombresDistintos} | A: ${shortStr(r.NombreEjemplo1, 35)} | B: ${shortStr(r.NombreEjemplo2, 35)}`);
  }
}

// ─── V22: Conciliación estado ───
header('V22 — ESTADO CONCILIACIÓN BANCARIA por cuenta');
for (const cod of Object.keys(COMPANIES)) {
  console.log(`\n  ${COMPANIES[cod]}:`);
  const rows = V.V22_conciliacion_estado[cod].rows;
  for (const r of rows.slice(0, 8)) {
    const cuenta = shortStr(r.NoCuenta + ' ' + (r.DesBanco || ''), 50);
    console.log(`    ${cuenta.padEnd(52)} | BalContable=${(r.BalanceContable||0).toFixed(0).padStart(14)} | NumEstados=${(r.NumEstados||0).toString().padStart(3)} | ÚltimoAl=${r.UltimoEstadoAl||'N/A'} | DíasSinConc=${r.DiasDesdeUltimoEstado??'N/A'}`);
  }
}

// ─── V23: P&L anual ───
header('V23 — P&L ANUAL 2026 (datos directos S10)');
console.log(`  ${'Empresa'.padEnd(12)} | ${'Ingresos'.padStart(12)} | ${'GastosNat'.padStart(12)} | ${'GAV'.padStart(12)} | ${'CostoVtas'.padStart(12)} | ${'GtsFin'.padStart(10)}`);
for (const cod of Object.keys(COMPANIES)) {
  const r = V.V23_pl_anual[cod].rows[0] || {};
  console.log(`  ${COMPANIES[cod].padEnd(12)} | ${(r.Ingresos||0).toLocaleString().padStart(12)} | ${(r.GastosNaturaleza||0).toLocaleString().padStart(12)} | ${(r.GAV||0).toLocaleString().padStart(12)} | ${(r.CostoVentas||0).toLocaleString().padStart(12)} | ${(r.GastosFinancieros||0).toLocaleString().padStart(10)}`);
}

// ─── V24: OB_Pago vs Contable ───
header('V24 — COHERENCIA OB_Pago vs AsientoContable clase 10 por mes (2026)');
for (const cod of Object.keys(COMPANIES)) {
  console.log(`\n  ${COMPANIES[cod]}:`);
  const rows = V.V24_ob_vs_contable[cod].rows;
  showRows(rows, ['Mes', 'NumPagos', 'MontoOBPago', 'MontoContable', 'Diferencia'], 12);
}

// ─── V25: PCD críticas ───
header('V25 — EXISTENCIA EN PLAN CONTABLE de cuentas críticas');
for (const cod of Object.keys(COMPANIES)) {
  console.log(`\n  ${COMPANIES[cod]}:`);
  const rows = V.V25_pcd_criticas[cod].rows;
  const conUso = rows.filter((r) => r.NumAsientos > 0);
  const sinUso = rows.filter((r) => r.NumAsientos === 0);
  console.log(`    Cuentas en catálogo: ${rows.length} | Con asientos: ${conUso.length} | Sin uso por esta empresa: ${sinUso.length}`);
  // Mostrar las críticas relevantes
  const criticas = ['501', '581', '5811', '591', '4111', '4151', '4130', '1041'];
  for (const k of criticas) {
    const r = rows.find((rr) => rr.CodCuenta === k);
    if (r) console.log(`    ${r.CodCuenta} ${shortStr(r.DesCuenta, 40).padEnd(40)} | NumAsientos=${r.NumAsientos}`);
  }
}

console.log('\n' + '═'.repeat(80));
console.log('Análisis completo.');
console.log('═'.repeat(80));
