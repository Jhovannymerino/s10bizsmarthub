'use client';
import React from 'react';
import { CLASE_NAMES, MESES } from '../_lib/constants';
import { fmt } from '../_lib/formatters';

function ThHint({ label, hint }: { label: string; hint: string }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', cursor: 'default' }}>
      {label}
      <span className="th-hint-icon">?
        <span className="th-hint-tooltip">{hint}</span>
      </span>
    </span>
  );
}

interface Props {
  auditData: any;
  selectedYear: number | string;
  setAuditSinDocDrill: (v: { clase: string; desClase: string } | null) => void;
}

export function TabAudit({ auditData, selectedYear, setAuditSinDocDrill }: Props) {
  return (
    <>
      {/* Sin documento */}
      <div className="kpi-card" style={{ marginBottom: '1rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC', marginBottom: '0.75rem' }}>
          🔴 Asientos sin documento fuente (NroD = NULL) · {selectedYear}
        </div>
        {!auditData?.sinDoc?.resumen?.length ? (
          <div style={{ color: '#10B981', fontSize: '0.85rem' }}>✓ Sin hallazgos en este período.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-s10" style={{ fontSize: '0.8rem' }}>
              <thead><tr>
                <th>Clase</th>
                <th style={{ minWidth: 160 }}>Descripción</th>
                <th><ThHint label="Sin Doc" hint="Asientos sin documento de respaldo (NroD = NULL)" /></th>
                <th><ThHint label="Total líneas" hint="Total de asientos en la clase (con y sin documento), incluyendo apertura/cierre que se excluyen del conteo Sin Doc. El % se calcula sobre este total." /></th>
                <th><ThHint label="% Sin Doc" hint="De cada 100 asientos de la clase, cuántos carecen de documento (Sin Doc ÷ Total × 100)" /></th>
                <th><ThHint label="Monto Sin Doc" hint="Suma de los montos de los asientos sin documento" /></th>
              </tr></thead>
              <tbody>
                {auditData.sinDoc.resumen.map((r: any, i: number) => {
                  const pctSD = r.TotalAsientos > 0 ? (r.SinDocumento / r.TotalAsientos * 100) : 0;
                  return (
                    <tr key={i} style={{ cursor: r.SinDocumento > 0 ? 'pointer' : 'default' }}
                      onClick={r.SinDocumento > 0 ? () => setAuditSinDocDrill({ clase: r.Clase, desClase: CLASE_NAMES[r.Clase] || `Clase ${r.Clase}` }) : undefined}
                      title={r.SinDocumento > 0 ? 'Ver asientos sin documento' : undefined}>
                      <td style={{ fontFamily: 'monospace', color: '#2BB4BB' }}>{r.Clase}{r.SinDocumento > 0 && <span style={{ fontSize: '0.65rem', marginLeft: '0.3rem' }}>▶</span>}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={CLASE_NAMES[r.Clase] || r.DescClase}>{CLASE_NAMES[r.Clase] || r.DescClase || '—'}</td>
                      <td style={{ color: r.SinDocumento > 0 ? '#F59E0B' : '#10B981' }}>{r.SinDocumento}</td>
                      <td style={{ color: '#8B97A8' }}>{r.TotalAsientos}</td>
                      <td style={{ color: pctSD > 20 ? '#EF4444' : pctSD > 5 ? '#F59E0B' : '#10B981' }}>{pctSD.toFixed(1)}%</td>
                      <td style={{ fontWeight: 600 }}>{fmt(r.MontoSinDoc)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr className="total-row">
                <td colSpan={2}>TOTAL</td>
                <td>{auditData.sinDoc.resumen.reduce((s: number, r: any) => s + (r.SinDocumento || 0), 0)}</td>
                <td>{auditData.sinDoc.resumen.reduce((s: number, r: any) => s + (r.TotalAsientos || 0), 0)}</td>
                <td></td>
                <td>{fmt(auditData.sinDoc.resumen.reduce((s: number, r: any) => s + (r.MontoSinDoc || 0), 0))}</td>
              </tr></tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Descuadres */}
      <div className="kpi-card" style={{ marginBottom: '1rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC', marginBottom: '0.75rem' }}>
          ⚠️ Asientos descuadrados (Débito ≠ Crédito, diferencia &gt; S/1.00, excluye apertura y cierre) · {selectedYear}
        </div>
        {!auditData?.descuadres?.rows?.length ? (
          <div style={{ color: '#10B981', fontSize: '0.85rem' }}>✓ Todos los asientos están cuadrados. Sin hallazgos.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            {auditData.descuadres.rows.length >= 200 && (
              <div style={{ fontSize: '0.75rem', color: '#F59E0B', marginBottom: '0.5rem' }}>
                ⚠ Mostrando los 200 mayores descuadres. Puede haber más — revise en S10 directamente.
              </div>
            )}
            <table className="table-s10" style={{ fontSize: '0.8rem' }}>
              <thead><tr><th>Fecha</th><th>NroD (doc)</th><th>Líneas</th><th style={{ minWidth: 160 }}>Tercero</th><th>Débito</th><th>Crédito</th><th>Descuadre</th><th style={{ minWidth: 180 }}>Glosa</th></tr></thead>
              <tbody>
                {auditData.descuadres.rows.map((r: any, i: number) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.Fecha}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#2BB4BB' }}>{r.NroD || '—'}</td>
                    <td style={{ color: '#8B97A8', textAlign: 'center' }}>{r.Lineas}</td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.Tercero}>{r.Tercero || '—'}</td>
                    <td style={{ color: r.TotalDebito > 0 ? '#10B981' : '#8B97A8' }}>{r.TotalDebito > 0 ? fmt(r.TotalDebito) : '—'}</td>
                    <td style={{ color: r.TotalCredito > 0 ? '#EF4444' : '#8B97A8' }}>{r.TotalCredito > 0 ? fmt(r.TotalCredito) : '—'}</td>
                    <td style={{ fontWeight: 700, color: '#EF4444' }}>{fmt(r.Descuadre)}</td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.Glosa}>{r.Glosa || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Atípicos */}
      <div className="kpi-card" style={{ marginBottom: '1rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC', marginBottom: '0.75rem' }}>
          🔶 Asientos atípicos (Débito o Crédito &gt; 100,000 en moneda original) · {selectedYear}
        </div>
        {!auditData?.atipicos?.rows?.length ? (
          <div style={{ color: '#10B981', fontSize: '0.85rem' }}>✓ Sin asientos atípicos en este período.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            {auditData.atipicos.rows.length >= 200 && (
              <div style={{ fontSize: '0.75rem', color: '#F59E0B', marginBottom: '0.5rem' }}>
                ⚠ Mostrando los 200 de mayor monto. Puede haber más — revise en S10 directamente.
              </div>
            )}
            <table className="table-s10" style={{ fontSize: '0.8rem' }}>
              <thead><tr><th>Fecha</th><th>NroD</th><th>Cuenta</th><th style={{ minWidth: 160 }}>Desc. Cuenta</th><th style={{ minWidth: 160 }}>Glosa</th><th>Débito</th><th>Crédito</th><th style={{ minWidth: 140 }}>Tercero</th></tr></thead>
              <tbody>
                {auditData.atipicos.rows.map((r: any, i: number) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.Fecha}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#8B97A8' }}>{r.NroD || '—'}</td>
                    <td style={{ fontFamily: 'monospace', color: '#2BB4BB', fontSize: '0.72rem' }}>{r.CodCuenta}</td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.DesCuenta}>{r.DesCuenta || '—'}</td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.Glosa}>{r.Glosa || '—'}</td>
                    <td style={{ color: r.Debito > 0 ? '#10B981' : '#8B97A8' }}>{r.Debito > 0 ? fmt(r.Debito) : '—'}</td>
                    <td style={{ color: r.Credito > 0 ? '#EF4444' : '#8B97A8' }}>{r.Credito > 0 ? fmt(r.Credito) : '—'}</td>
                    <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.Tercero || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Conciliación ingresos */}
      <div className="kpi-card">
        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC', marginBottom: '0.75rem' }}>
          📊 Conciliación Ingresos vs Documentos Emitidos · {selectedYear}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#8B97A8', marginBottom: '0.75rem', lineHeight: 1.5 }}>
          Ingresos contables medidos por fecha de aplicación contable (clases 70–75, NroD ≠ NULL). Facturas medidas por fecha de emisión del documento. Diferencias de timing entre ambas fechas pueden generar discrepancias entre meses que no representan errores reales.
          {' '}Facturas en USD sin tipo de cambio registrado usan TC referencial S/3.80.
        </div>
        {!auditData?.conciliacion?.rows?.length ? (
          <div style={{ color: '#8B97A8', fontSize: '0.85rem' }}>Sin datos de conciliación.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-s10" style={{ fontSize: '0.8rem' }}>
              <thead><tr><th>Mes</th><th>Ingresos Contables</th><th>Facturas Emitidas</th><th>Notas de Crédito</th><th>Neto Docs</th><th>Diferencia</th></tr></thead>
              <tbody>
                {auditData.conciliacion.rows.map((r: any, i: number) => {
                  const diff = (r.IngresosContables || 0) - (r.NetoDocumentos || 0);
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{MESES[(r.Mes || 1) - 1]}</td>
                      <td>{fmt(r.IngresosContables)}</td>
                      <td style={{ color: '#10B981' }}>{fmt(r.FacturasEmitidas)}</td>
                      <td style={{ color: '#EF4444' }}>{fmt(r.NotasCredito)}</td>
                      <td>{fmt(r.NetoDocumentos)}</td>
                      <td style={{ fontWeight: 700, color: Math.abs(diff) < 1 ? '#10B981' : Math.abs(diff) < 10000 ? '#F59E0B' : '#EF4444' }}>
                        {Math.abs(diff) < 1 ? '✓' : fmt(diff)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr className="total-row">
                <td>TOTAL</td>
                {(['IngresosContables','FacturasEmitidas','NotasCredito','NetoDocumentos'] as const).map(k => (
                  <td key={k}>{fmt(auditData.conciliacion.rows.reduce((s: number, r: any) => s + (r[k] || 0), 0))}</td>
                ))}
                <td style={{ color: (() => {
                  const d = auditData.conciliacion.rows.reduce((s: number, r: any) => s + (r.IngresosContables||0) - (r.NetoDocumentos||0), 0);
                  return Math.abs(d) < 1 ? '#10B981' : Math.abs(d) < 50000 ? '#F59E0B' : '#EF4444';
                })() }}>
                  {fmt(auditData.conciliacion.rows.reduce((s: number, r: any) => s + (r.IngresosContables||0) - (r.NetoDocumentos||0), 0))}
                </td>
              </tr></tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
