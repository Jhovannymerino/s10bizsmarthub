'use client';
import React from 'react';
import { fmt } from '../_lib/formatters';

// ── Static lookup tables (never change at runtime) ──
const VALIDATION_INFO: Record<string, { categoria: string; riesgo: string; norma: string; descripcion: string }> = {
  V01_partida_doble:                { categoria: 'Integridad Contable', riesgo: 'CRÍTICO', norma: 'NIIF / Partida Doble',       descripcion: 'Verifica que Σ Débitos = Σ Créditos en el año seleccionado. HALLAZGO solo si hay diferencia real (Descuadre > 0). Si está en OK, el libro cuadra perfectamente para ese año.' },
  V02_apertura:                     { categoria: 'Integridad Contable', riesgo: 'ALTO',    norma: 'NIC 1',                      descripcion: 'Verifica que el asiento de apertura del año (glosa APERTURA/INICIO, enero-febrero) esté balanceado. HALLAZGO solo si Debe ≠ Haber en la apertura. OK significa que el año abrió correctamente.' },
  V03_patrimonio:                   { categoria: 'Patrimonio',          riesgo: 'CRÍTICO', norma: 'Art. 220 LGS / NIC 1',       descripcion: 'Detecta cuentas de patrimonio (clases 50–59) con saldo DEUDOR acumulado (histórico). Las cuentas patrimoniales deben tener saldo acreedor; un saldo deudor indica pérdidas acumuladas, reducción de capital no registrada, o error de clasificación grave.' },
  V04_facturas_sin_asiento_top:     { categoria: 'Ingresos',            riesgo: 'ALTO',    norma: 'NIIF 15 / Bancarización',    descripcion: 'Top 50 facturas de venta emitidas en el año (y año anterior) que no tienen asiento contable. Ingresos no reconocidos = posible evasión tributaria o desconexión entre área comercial y contabilidad.' },
  V04b_facturas_sin_asiento_resumen:{ categoria: 'Ingresos',            riesgo: 'ALTO',    norma: 'NIIF 15',                    descripcion: 'Resumen por año y tipo de todas las facturas emitidas sin asiento contable. Permite ver el patrón histórico completo (no solo el top 50).' },
  V05_ingresos_sin_doc:             { categoria: 'Ingresos',            riesgo: 'ALTO',    norma: 'NIIF 15 / Art. 24-A LIR',    descripcion: 'Asientos de ingresos (clase ingreso) en el año sin NroD (sin documento de respaldo). Riesgo de ingresos ficticios, anticipos no documentados o asientos manuales sin sustento.' },
  V06_sueldos_aging:                { categoria: 'Laboral',             riesgo: 'ALTO',    norma: 'DL 728',                     descripcion: 'Meses donde los sueldos y remuneraciones (cta 4111) permanecen sin pagar (Provisionado > Pagado > S/100). Muestra los últimos 3 años. HALLAZGO = salarios devengados no cancelados. OK = pagos al día.' },
  V07_cts_depositos:                { categoria: 'Laboral',             riesgo: 'ALTO',    norma: 'DL 650',                     descripcion: 'Detecta períodos donde la CTS (cta 4151) tiene saldo por depositar > S/100 (Provisionado > Pagado). DL 650 exige depósito en mayo y noviembre. HALLAZGO = CTS devengada sin depositar.' },
  V08_participaciones:              { categoria: 'Laboral',             riesgo: 'MEDIO',   norma: 'DL 892',                     descripcion: 'Años donde las participaciones de trabajadores (cta 413x) tienen saldo pendiente > S/100 (Provisionado > Distribuido). HALLAZGO = participaciones devengadas sin pago. OK = sin saldo pendiente.' },
  V09_bancos_detalle:               { categoria: 'Caja y Bancos',       riesgo: 'ALTO',    norma: 'NIIF 7',                     descripcion: 'Detecta cuentas bancarias con saldo NEGATIVO (Haber > Debe) en el histórico acumulado — un descubierto bancario contable. En condiciones normales, una cuenta banco siempre debe tener saldo deudor. HALLAZGO solo en saldo negativo.' },
  V10_ob_cuentas_banco:             { categoria: 'Caja y Bancos',       riesgo: 'MEDIO',   norma: 'Control Interno',            descripcion: 'Cuentas bancarias activas en el módulo OB con problemas: diferencia entre BalanceActual y BalanceReal > S/0.5, sin extractos bancarios cargados, o con extracto desactualizado > 60 días. HALLAZGO = cuenta con problema de reconciliación.' },
  V11_bancarizacion:                { categoria: 'Cumplimiento',        riesgo: 'ALTO',    norma: 'Ley 28194',                  descripcion: 'Detecta pagos sobre el umbral (S/3,500 o $1,000) realizados SIN medio de pago bancarizado en el año seleccionado. HALLAZGO solo si existen pagos no bancarizados reales. OK = todos los pagos materiales cumplieron Ley 28194.' },
  V12_pergola_aging:                { categoria: 'Cuentas por Cobrar',  riesgo: 'ALTO',    norma: 'NIIF 9',                     descripcion: 'Documentos por cobrar de cliente PERGOLA (o PÉRGOLA) con saldo pendiente. Bajo NIIF 9, saldos sin movimiento de cobro requieren evaluación de deterioro. HALLAZGO si hay saldo impago.' },
  V13_cxc_concentracion:            { categoria: 'Cuentas por Cobrar',  riesgo: 'MEDIO',   norma: 'NIIF 9',                     descripcion: 'Top 20 clientes con saldo acumulado en cuentas por cobrar (clase 12) > S/1,000. Alta concentración en pocos clientes genera riesgo crediticio. Revisar antigüedad (Vencido90Mas) para priorizar gestión de cobranza.' },
  V14_intercompany:                 { categoria: 'Intercompañía',       riesgo: 'CRÍTICO', norma: 'Art. 32-A LIR / NIC 24',     descripcion: 'Saldos en clases 14/16/17 con contrapartes vinculadas al grupo CMO. Operaciones entre relacionadas requieren precios de transferencia documentados. HALLAZGO = saldo intercompañía > S/100 sin justificación documentada.' },
  V15_activo_fijo:                  { categoria: 'Activo Fijo',         riesgo: 'MEDIO',   norma: 'NIC 16',                     descripcion: 'Detecta activos fijos (clase 33) con saldo ACREEDOR o depreciación acumulada (clase 39/68) con saldo DEUDOR — dirección contraria a la naturaleza contable. HALLAZGO = balance en dirección incorrecta, posible error de registro.' },
  V16_trazabilidad_pago:            { categoria: 'Caja y Bancos',       riesgo: 'ALTO',    norma: 'Control Interno',            descripcion: 'Pagos en el módulo OB sin asignación a una factura en el mismo año. HALLAZGO solo si existen pagos sin asignación (PagosSinAsignacion > 0). OK = todos los pagos están referenciados a documentos.' },
  V17_reconciliacion_ingr:          { categoria: 'Ingresos',            riesgo: 'ALTO',    norma: 'NIIF 15 / NIIF 9',           descripcion: 'Meses del año donde la diferencia entre ingresos contabilizados y montos facturados supera S/100. HALLAZGO solo en meses con brecha real. OK = ingresos contables y facturación cuadran mes a mes.' },
  V18_tributos:                     { categoria: 'Tributario',          riesgo: 'ALTO',    norma: 'Código Tributario',          descripcion: 'Cuentas tributarias (clase 40) con saldo acreedor neto > S/0.5 en el histórico acumulado (tributos devengados sin pagar). La deuda tributaria genera intereses moratorios y puede derivar en cobranza coactiva de SUNAT.' },
  V19_balance_resumen:              { categoria: 'Balance General',     riesgo: 'CRÍTICO', norma: 'NIC 1',                      descripcion: 'Detecta clases contables con saldo en dirección INCORRECTA: activos/gastos (clases 1,2,3,6,9) con saldo acreedor, o pasivos/patrimonio/ingresos (clases 4,5,7) con saldo deudor > S/1,000. HALLAZGO = error estructural en el balance.' },
  V20_fechas_anomalas:              { categoria: 'Calidad de Datos',    riesgo: 'MEDIO',   norma: 'Control Interno',            descripcion: 'Asientos registrados en domingo o con fecha futura en el año seleccionado. Los sábados y domingos no son días hábiles contables. HALLAZGO = movimientos en días no hábiles o con fecha futura (posible manipulación).' },
  V21_identificadores_dup:          { categoria: 'Calidad de Datos',    riesgo: 'BAJO',    norma: 'Control Interno',            descripcion: 'Identificadores (RUC/DNI) que aparecen con más de un nombre en la base de datos. Puede indicar terceros duplicados, cambios de razón social no actualizados, o identidades falsas. Top 20 casos.' },
  V22_conciliacion_estado:          { categoria: 'Caja y Bancos',       riesgo: 'ALTO',    norma: 'Control Interno',            descripcion: 'Cuentas bancarias activas con problemas reales: diferencia BalanceActual vs BalanceReal > S/0.5, movimientos sin conciliar, o extracto desactualizado > 60 días. HALLAZGO solo en cuentas con brecha concreta.' },
  V23_pl_anual:                     { categoria: 'P&L',                 riesgo: 'MEDIO',   norma: 'NIIF 15 / NIC 1',           descripcion: 'Verifica que la empresa tenga ingresos reconocidos en el año. HALLAZGO solo si los ingresos son cero o negativos (posible falta de cierre contable, año en blanco, o empresa inactiva). OK = empresa tiene ingresos registrados.' },
  V24_ob_vs_contable:               { categoria: 'Coherencia Modular',  riesgo: 'ALTO',    norma: 'Control Interno',            descripcion: 'Meses donde el monto de pagos del módulo OB difiere de los créditos contables en clase 10 en más de S/100. HALLAZGO solo en meses con brecha real. OK = módulo OB y mayor contable cuadran.' },
  V25_pcd_criticas:                 { categoria: 'Calidad de Datos',    riesgo: 'MEDIO',   norma: 'PCGR Perú',                  descripcion: 'Cuentas contables críticas (capital, CTS, sueldos, bancos) que están en el Plan de Cuentas pero NUNCA han tenido movimiento para esta empresa. HALLAZGO = cuenta crítica en plan sin uso — posible omisión de provisión o falta de cierre.' },
  V26_asientos_sin_glosa:           { categoria: 'Calidad de Datos',    riesgo: 'ALTO',    norma: 'Control Interno',            descripcion: 'Años donde más del 5% de los asientos contables tienen glosa vacía o genérica ("VARIOS", "ASIENTO", "S/D"). Alta proporción indica falta de trazabilidad: imposible identificar la operación sin el documento físico.' },
  V27_cxp_concentracion:            { categoria: 'Cuentas por Pagar',   riesgo: 'ALTO',    norma: 'NIC 24 / Art. 32-A LIR',     descripcion: 'Top 15 proveedores con saldo acreedor histórico > S/1,000 en clase 42. Alta concentración en pocos proveedores puede indicar partes vinculadas no declaradas o sobrefacturación. Contrasta con V14 (intercompañía).' },
  V28_nc_sospechosas:               { categoria: 'Ingresos',            riesgo: 'MEDIO',   norma: 'NIIF 15 / SUNAT',            descripcion: 'Años donde las notas de crédito representan más del 3% del total facturado. Porcentaje elevado puede indicar anulaciones masivas post-venta, correcciones retroactivas o ajuste de ingresos no autorizado.' },
  V29_fraccionamiento_pagos:        { categoria: 'Cumplimiento',        riesgo: 'ALTO',    norma: 'Ley 28194',                  descripcion: 'Días con 3 o más pagos en efectivo al mismo banco, cada uno individualmente bajo S/3,500, pero cuya suma supera el umbral. HALLAZGO = patrón de fraccionamiento para evadir obligación de bancarización (Ley 28194).' },
  V30_provisiones_sin_reverso:      { categoria: 'Integridad Contable', riesgo: 'MEDIO',   norma: 'NIC 37 / PCGR Perú',         descripcion: 'Provisiones en diciembre (glosa PROVISIÓN/ESTIMACIÓN) en cuentas de pasivo o gasto > S/100 que no tienen reverso en enero siguiente. HALLAZGO = posibles "provisiones fantasma" para inflar gastos y reducir impuesto a la renta.' },
};
const RIESGO_STYLE: Record<string, React.CSSProperties> = {
  CRÍTICO: { background: 'rgba(239,68,68,0.15)',   color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' },
  ALTO:    { background: 'rgba(245,158,11,0.15)',  color: '#FBB040', border: '1px solid rgba(245,158,11,0.3)' },
  MEDIO:   { background: 'rgba(234,179,8,0.12)',   color: '#FACC15', border: '1px solid rgba(234,179,8,0.25)' },
  BAJO:    { background: 'rgba(16,185,129,0.12)',  color: '#34D399', border: '1px solid rgba(16,185,129,0.25)' },
};
const TIPO_DOC_LABEL: Record<string, string> = {
  '060': 'Boleta de Venta', '125': 'Factura', '131': 'Ticket',
  '128': 'Nota de Crédito', '134': 'Nota de Débito',
};
const isMoney = (k: string) => /monto|importe|totalpen|totalmonto|totalsaldo|totalimporte|totaldebe|totalhaber|saldo|diferencia|debito|credito|neto|valor|debe|haber|descuadre|brecha|gap|pagado|provisionado|saldopagar|saldodepositar|saldomensual/i.test(k);
const isCount = (k: string) => /^(n|cant|count|num|nro_asientos?|qty|docs)/i.test(k);

const endpointForClase = (clase: string): string | null => {
  if (['33','39','68'].includes(clase)) return 'activo-fijo-transactions';
  if (clase === '40') return 'tributos-transactions';
  if (clase === '41') return 'laboral-transactions';
  if (clase === '10') return 'caja-transactions';
  if (['60','61','62','63','64','65','66','67'].includes(clase)) return 'gastos-nat-transactions';
  if (['12','13','14','16','17','18'].includes(clase)) return 'otras-cxc-transactions';
  if (['42','43','44','45','46','47'].includes(clase)) return 'otras-cxp-transactions';
  if (['50','51','52','53','54','55','56','57','58','59'].includes(clase)) return 'patrimonio-transactions';
  return null;
};

interface Props {
  validacionForenseData: any;
  isGrupo: boolean;
  selectedCompany: { shortName: string };
  selectedYear: number | string;
  validacionForenseExpanded: string | null;
  setValidacionForenseExpanded: (id: string | null) => void;
  forenseFacturasDrillKey: string | null;
  setForenseFacturasDrillKey: (key: string | null) => void;
  setAccountTxDrill: (v: any) => void;
}

export function TabValidacionForense({
  validacionForenseData,
  isGrupo,
  selectedCompany,
  selectedYear,
  validacionForenseExpanded,
  setValidacionForenseExpanded,
  forenseFacturasDrillKey,
  setForenseFacturasDrillKey,
  setAccountTxDrill,
}: Props) {
  const vfd = validacionForenseData;
  return (
    <>
      {/* Summary cards */}
      {vfd?.summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="kpi-card" style={{ textAlign: 'center' }}>
            <div className="kpi-label">Validaciones ejecutadas</div>
            <div className="kpi-value" style={{ fontSize: '2rem', color: '#F8FAFC' }}>{vfd.summary.total}</div>
          </div>
          <div className="kpi-card" style={{ textAlign: 'center' }}>
            <div className="kpi-label">Sin errores SQL</div>
            <div className="kpi-value" style={{ fontSize: '2rem', color: '#10B981' }}>{vfd.summary.ok}</div>
          </div>
          <div className="kpi-card" style={{ textAlign: 'center' }}>
            <div className="kpi-label">Con error de ejecución</div>
            <div className="kpi-value" style={{ fontSize: '2rem', color: vfd.summary.errors > 0 ? '#EF4444' : '#10B981' }}>{vfd.summary.errors}</div>
          </div>
        </div>
      )}

      {/* No data */}
      {(!vfd || (vfd?.message && !vfd?.validations)) && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 280, textAlign: 'center', gap: '0.75rem' }}>
          <div style={{ fontSize: '2rem' }}>🔬</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F8FAFC' }}>Sin datos de Validación Forense</div>
          <div style={{ fontSize: '0.82rem', color: '#8B97A8', maxWidth: 380 }}>
            {vfd?.message || 'Los datos forenses no están disponibles para esta empresa/año.'}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#8B97A8' }}>
            Usa el botón <strong style={{ color: '#207E83' }}>Sincronizar Datos</strong> del sidebar para cargar la información desde S10.
          </div>
        </div>
      )}

      {/* Matrix */}
      {vfd?.validations && (
        <div className="kpi-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="kpi-label">Matriz de Validación Forense</div>
              <div style={{ color: '#F8FAFC', fontWeight: 700, fontSize: '0.95rem' }}>
                {isGrupo ? 'GRUPO CONSOLIDADO' : selectedCompany.shortName} · {selectedYear}
              </div>
            </div>
            {vfd.syncedAt && (
              <span style={{ fontSize: '0.7rem', color: '#8B97A8' }}>
                Sync: {new Date(vfd.syncedAt).toLocaleString('es-PE', { timeZone: 'America/Lima' })}
              </span>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table-s10">
              <thead>
                <tr>
                  <th style={{ textAlign: 'center', width: 36 }}>#</th>
                  <th style={{ textAlign: 'left' }}>Validación</th>
                  <th style={{ textAlign: 'left' }}>Categoría</th>
                  <th style={{ textAlign: 'center' }}>Riesgo</th>
                  <th style={{ textAlign: 'left' }}>Norma</th>
                  <th>Registros</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {vfd.validations.map((v: any, idx: number) => {
                  const info = VALIDATION_INFO[v.id] ?? { categoria: '—', riesgo: 'MEDIO', norma: '—', descripcion: '' };
                  const isExpanded = validacionForenseExpanded === v.id;
                  const rawRows = vfd.raw?.[v.id]?.rows ?? [];
                  return (
                    <React.Fragment key={v.id}>
                      <tr data-clickable
                        onClick={() => setValidacionForenseExpanded(isExpanded ? null : v.id)}
                        style={{ background: isExpanded ? 'rgba(32,126,131,0.1)' : undefined }}
                      >
                        <td style={{ textAlign: 'center', color: '#8B97A8', fontFamily: 'monospace', fontSize: '0.7rem' }}>{idx + 1}</td>
                        <td style={{ textAlign: 'left' }}>
                          <span style={{ fontWeight: 600, color: '#F8FAFC' }}>{v.label}</span>
                        </td>
                        <td style={{ textAlign: 'left', color: '#8B97A8', fontSize: '0.78rem' }}>{info.categoria}</td>
                        <td style={{ textAlign: 'center' }}>
                          {v.rowCount > 0 && !v.error
                            ? <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, ...RIESGO_STYLE[info.riesgo] }}>{info.riesgo}</span>
                            : <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 500, background: 'transparent', color: '#4B5563', border: '1px solid transparent' }}>{info.riesgo}</span>
                          }
                        </td>
                        <td style={{ textAlign: 'left', color: '#8B97A8', fontSize: '0.72rem', fontStyle: 'italic' }}>{info.norma}</td>
                        <td style={{ fontFamily: 'monospace', textAlign: 'center' }}>
                          {v.rowCount > 0
                            ? <span style={{ color: '#F59E0B', fontWeight: 700 }}>{v.rowCount.toLocaleString()} {isExpanded ? '▲' : '▼'}</span>
                            : <span style={{ color: '#10B981' }}>0</span>
                          }
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {v.error
                            ? <span style={{ color: '#EF4444', fontWeight: 700, fontSize: '0.7rem' }}>ERROR</span>
                            : v.rowCount > 0
                              ? <span style={{ color: '#F59E0B', fontWeight: 700, fontSize: '0.72rem' }}>HALLAZGO</span>
                              : <span style={{ color: '#10B981', fontWeight: 700 }}>OK</span>
                          }
                        </td>
                      </tr>

                      {isExpanded && info.descripcion && (
                        <tr>
                          <td colSpan={7} style={{ padding: '0.6rem 1rem', background: 'rgba(32,126,131,0.08)', borderLeft: '3px solid #2BB4BB', color: '#CBD5E1', fontSize: '0.78rem', lineHeight: 1.5, textAlign: 'left' }}>
                            <span style={{ fontWeight: 600, color: '#2BB4BB', marginRight: '0.4rem' }}>¿Qué detecta?</span>{info.descripcion}
                          </td>
                        </tr>
                      )}

                      {isExpanded && rawRows.length > 0 && (() => {
                        const isV04bResumen = v.id === 'V04b_facturas_sin_asiento_resumen';
                        const colKeys = Object.keys(rawRows[0]).filter(k => isV04bResumen && k === 'DesTipo' ? false : true);
                        const isV17 = v.id === 'V17_reconciliacion_ingr';
                        return (
                          <tr>
                            <td colSpan={7} style={{ padding: 0 }}>
                              <div style={{ background: 'rgba(32,126,131,0.06)', borderLeft: '3px solid #207E83', overflowX: 'auto', maxHeight: 320 }}>
                                <table className="table-s10" style={{ fontSize: '0.72rem' }}>
                                  <thead>
                                    <tr>
                                      {colKeys.map((k) => (
                                        <th key={k} style={{ textAlign: isMoney(k) ? 'right' : 'left' }}>{k}</th>
                                      ))}
                                      {isV17 && <th style={{ textAlign: 'center' }}>Tipo</th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rawRows.slice(0, 50).map((row: any, ri: number) => {
                                      const effectiveCod: string | null = row.CodCuenta
                                        ? String(row.CodCuenta)
                                        : v.id === 'V06_sueldos_aging' ? '4111'
                                        : v.id === 'V07_cts_depositos' ? '4151'
                                        : row.Clase ? String(row.Clase)
                                        : null;
                                      const rowClase = effectiveCod ? effectiveCod.slice(0, 2) : '';
                                      const rowEndpoint = effectiveCod ? endpointForClase(rowClase) : null;
                                      const isV04b = v.id === 'V04b_facturas_sin_asiento_resumen';
                                      const isV28 = v.id === 'V28_nc_sospechosas';
                                      const isMultiYearV = ['V06_sueldos_aging', 'V07_cts_depositos', 'V08_participaciones'].includes(v.id);
                                      const v04bDrillKey = isV04b ? `v04b-${row.Anio}` : isV28 ? `v28-${row.Anio}` : null;
                                      const v04bIsOpen = v04bDrillKey !== null && forenseFacturasDrillKey === v04bDrillKey;
                                      return (
                                        <React.Fragment key={ri}>
                                          <tr>
                                            {colKeys.map((k, vi) => {
                                              const val = row[k];
                                              const money = isMoney(k) && typeof val === 'number';
                                              const cnt   = isCount(k) && typeof val === 'number';
                                              const isNumAsientosCell = (k === 'NumAsientos' || k === 'NumFacturas') && typeof val === 'number' && val > 0 && rowEndpoint && !isV04b && !isV28;
                                              const isV04bFacturas = (isV04b && k === 'NumFacturas') || (isV28 && k === 'NumNC');
                                              const isV04bFacturasActive = isV04bFacturas && typeof val === 'number' && val > 0;
                                              return (
                                                <td key={vi} style={{ textAlign: money ? 'right' : 'left', whiteSpace: 'nowrap', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis',
                                                  color: money && val < 0 ? '#F87171' : money && val > 0 ? '#F8FAFC' : undefined,
                                                  fontFamily: (money || cnt) ? 'monospace' : undefined,
                                                }}>
                                                  {val === null || val === undefined ? '—'
                                                    : isV04bFacturasActive
                                                      ? <button onClick={() => setForenseFacturasDrillKey(v04bIsOpen ? null : v04bDrillKey)}
                                                          title={isV28 ? 'Ver notas de crédito individuales' : 'Ver facturas individuales'}
                                                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E25C1A', fontFamily: 'monospace', fontSize: '0.72rem', padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                                                          {val} {v04bIsOpen ? '▲' : '▶'}
                                                        </button>
                                                    : isNumAsientosCell
                                                      ? <button onClick={() => setAccountTxDrill({ codCuenta: effectiveCod!, descripcion: String(row.DesCuenta ?? row.DesBanco ?? row.Tipo ?? effectiveCod), endpoint: rowEndpoint!, ...(isMultiYearV && row.Anio ? { yearOverride: Number(row.Anio), ...(row.Mes ? { mesPreset: Number(row.Mes) } : {}) } : {}) })}
                                                          title="Ver asientos individuales"
                                                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2BB4BB', fontFamily: 'monospace', fontSize: '0.72rem', padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                                                          {val} ▶
                                                        </button>
                                                    : isV04bResumen && k === 'Tipo'
                                                      ? <>{String(val)}<span style={{ color: '#8B97A8', fontWeight: 400, marginLeft: '0.4rem', fontSize: '0.65rem' }}>{TIPO_DOC_LABEL[String(val)] ?? String(row.DesTipo ?? '')}</span></>
                                                    : k === 'Estado' && String(val) === '5' ? <span style={{ color: '#6B7280', fontSize: '0.62rem' }}>Anulado</span>
                                                    : k === 'Estado' && String(val) === '6' ? <span title="PENDIENTE DE REVISIÓN: documento vinculado/netteado contra otro (anticipo, NC, intercompañía). Confirmar en S10 si el ingreso fue reconocido por un mecanismo alternativo." style={{ color: '#F59E0B', fontWeight: 600 }}>⚠ Vinculada</span>
                                                    : k === 'Estado' && String(val) === '1' ? <span style={{ color: '#10B981' }}>Pendiente</span>
                                                    : money ? fmt(val) : String(val)
                                                  }
                                                </td>
                                              );
                                            })}
                                            {isV17 && (() => {
                                              const diff = row.Diferencia ?? 0;
                                              return (
                                                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                  {diff > 0
                                                    ? <span style={{ color: '#F59E0B', fontWeight: 700, fontSize: '0.68rem' }}>Tipo B</span>
                                                    : diff < 0
                                                      ? <span style={{ color: '#EF4444', fontWeight: 700, fontSize: '0.68rem' }}>Tipo A</span>
                                                      : <span style={{ color: '#10B981', fontSize: '0.68rem' }}>OK</span>
                                                  }
                                                </td>
                                              );
                                            })()}
                                          </tr>
                                          {v04bIsOpen && (() => {
                                            const detailRows = isV28
                                              ? (vfd.raw?.V28b_nc_detalle?.rows ?? []).filter((r: any) => r.Anio === row.Anio)
                                              : (vfd.raw?.V04b_facturas_sin_asiento_detalle?.rows ?? vfd.raw?.V04_facturas_sin_asiento_top?.rows ?? []).filter((r: any) => r.Anio === row.Anio && r.Tipo === row.Tipo);
                                            const detailKeys = detailRows.length > 0 ? Object.keys(detailRows[0]) : [];
                                            const totalCount = isV28 ? row.NumNC : row.NumFacturas;
                                            const titulo = isV28
                                              ? `Notas de crédito — ${row.Anio}`
                                              : `Facturas sin asiento — ${row.Anio} · ${TIPO_DOC_LABEL[String(row.Tipo)] ?? `Tipo ${row.Tipo}`}`;
                                            return (
                                              <tr>
                                                <td colSpan={colKeys.length} style={{ padding: 0, background: 'rgba(226,92,26,0.06)', borderLeft: '3px solid #E25C1A' }}>
                                                  <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.68rem', color: '#FBB040', fontWeight: 600, marginBottom: '0.25rem' }}>
                                                    {titulo}
                                                    {detailRows.length === 0 && <span style={{ color: '#8B97A8', fontWeight: 400, marginLeft: '0.5rem' }}>Sin datos — ejecuta sync para cargar el detalle</span>}
                                                    {detailRows.length > 0 && <span style={{ color: '#8B97A8', fontWeight: 400, marginLeft: '0.5rem' }}>top {detailRows.length} por monto{totalCount > detailRows.length ? ` de ${totalCount} total` : ''}</span>}
                                                  </div>
                                                  {detailRows.length > 0 && (
                                                    <div style={{ overflowX: 'auto', maxHeight: 280 }}>
                                                      <table className="table-s10" style={{ fontSize: '0.68rem' }}>
                                                        <thead><tr>{detailKeys.map((k: string) => <th key={k}>{k}</th>)}</tr></thead>
                                                        <tbody>
                                                          {detailRows.map((r: any, i: number) => (
                                                            <tr key={i}>{detailKeys.map((k: string) => (
                                                              <td key={k} style={{ whiteSpace: k === 'Observacion' ? 'normal' : 'nowrap', maxWidth: k === 'Observacion' ? 240 : undefined, textAlign: isMoney(k) ? 'right' : 'left' }}>
                                                                {isMoney(k) && typeof r[k] === 'number' ? fmt(r[k])
                                                                  : k === 'Moneda' ? (r[k] === '01' ? 'PEN' : r[k] === '02' ? 'USD' : String(r[k] ?? '—'))
                                                                  : k === 'Estado' && String(r[k]) === '5' ? <span style={{ color: '#6B7280', fontSize: '0.62rem' }}>Anulado</span>
                                                                  : k === 'Estado' && String(r[k]) === '6' ? <span title="PENDIENTE DE REVISIÓN: documento vinculado/netteado contra otro (anticipo, NC, intercompañía). Confirmar en S10 si el ingreso fue reconocido por un mecanismo alternativo." style={{ color: '#F59E0B', fontWeight: 600 }}>⚠ Vinculada</span>
                                                                  : k === 'Estado' && String(r[k]) === '1' ? <span style={{ color: '#10B981' }}>Pendiente</span>
                                                                  : k === 'Observacion' ? <span style={{ color: '#8B97A8', fontStyle: r[k] ? 'normal' : 'italic' }}>{r[k] || '—'}</span>
                                                                  : String(r[k] ?? '—')}
                                                              </td>
                                                            ))}</tr>
                                                          ))}
                                                        </tbody>
                                                      </table>
                                                    </div>
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          })()}
                                        </React.Fragment>
                                      );
                                    })}
                                    {rawRows.length > 50 && (
                                      <tr><td colSpan={isV17 ? colKeys.length + 1 : colKeys.length} style={{ color: '#8B97A8', fontStyle: 'italic', textAlign: 'left' }}>… y {rawRows.length - 50} registros más</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        );
                      })()}

                      {isExpanded && v.error && (
                        <tr>
                          <td colSpan={7} style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.08)', borderLeft: '3px solid #EF4444', color: '#F87171', fontSize: '0.78rem', textAlign: 'left' }}>
                            Error SQL: {v.error}
                          </td>
                        </tr>
                      )}
                      {isExpanded && !v.error && rawRows.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ padding: '0.75rem 1rem', background: 'rgba(16,185,129,0.06)', borderLeft: '3px solid #10B981', color: '#34D399', fontSize: '0.78rem', textAlign: 'left' }}>
                            Sin hallazgos — resultado limpio para esta validación.
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
