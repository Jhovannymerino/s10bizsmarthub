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
        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC', marginBottom: '0.25rem' }}>
          🔴 Asientos sin documento fuente · {selectedYear}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#8B97A8', marginBottom: '0.75rem', lineHeight: 1.5 }}>
          En S10, cada asiento contable debería estar vinculado a un documento fuente (factura, recibo, voucher). Un asiento con <strong style={{ color: '#F8FAFC' }}>NroD = NULL</strong> significa que fue ingresado manualmente sin respaldo documental registrado en el sistema. Se analizan las clases de mayor riesgo: caja (10), cuentas por cobrar (12–17), tributos y obligaciones (40–46) e ingresos (70–75).
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
        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC', marginBottom: '0.25rem' }}>
          ⚠️ Asientos descuadrados · {selectedYear}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#8B97A8', marginBottom: '0.75rem', lineHeight: 1.5 }}>
          Todo documento contable debe cuadrar: Débito total = Crédito total. Un descuadre indica una contabilización incompleta o con error de monto que distorsiona los estados financieros. Se muestran documentos con diferencia <strong style={{ color: '#F8FAFC' }}>&gt; S/1.00</strong>, agrupados por documento fuente (NroD). Excluye asientos de apertura y cierre, que se verifican por separado. La columna <strong style={{ color: '#F8FAFC' }}>Doc.</strong> muestra el número de documento en S10 cuando es una factura o recibo identificable; de lo contrario muestra el ID interno (NroD).
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
              <thead><tr><th>Fecha</th><th>Doc. / NroD</th><th>Líneas</th><th style={{ minWidth: 160 }}>Tercero</th><th>Débito</th><th>Crédito</th><th>Descuadre</th><th style={{ minWidth: 180 }}>Glosa</th></tr></thead>
              <tbody>
                {auditData.descuadres.rows.map((r: any, i: number) => {
                  const docLabel = r.NumeroDocumento
                    ? (r.Serie ? `${r.Serie}-${r.NumeroDocumento}` : r.NumeroDocumento)
                    : (r.NroD || '—');
                  const isExternal = !!r.NumeroDocumento;
                  return (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap' }}>{r.Fecha}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: isExternal ? '#2BB4BB' : '#8B97A8' }}>{docLabel}</td>
                      <td style={{ color: '#8B97A8', textAlign: 'center' }}>{r.Lineas}</td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.Tercero}>{r.Tercero || '—'}</td>
                      <td style={{ color: r.TotalDebito > 0 ? '#10B981' : '#8B97A8' }}>{r.TotalDebito > 0 ? fmt(r.TotalDebito) : '—'}</td>
                      <td style={{ color: r.TotalCredito > 0 ? '#EF4444' : '#8B97A8' }}>{r.TotalCredito > 0 ? fmt(r.TotalCredito) : '—'}</td>
                      <td style={{ fontWeight: 700, color: '#EF4444' }}>{fmt(r.Descuadre)}</td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.Glosa}>{r.Glosa || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apertura y Cierre */}
      {(() => {
        const ac = auditData?.descuadres?.aperturaCierre;
        if (!ac || (!ac.apertura && !ac.cierre)) return null;
        const Card = ({ label, data }: { label: string; data: any }) => (
          <div style={{ flex: 1, minWidth: 260, background: 'rgba(255,255,255,0.03)', borderRadius: '0.5rem', padding: '1rem', border: `1px solid ${data?.cuadrado === false ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#F8FAFC', marginBottom: '0.75rem' }}>{label}</div>
            {!data ? (
              <div style={{ color: '#8B97A8', fontSize: '0.78rem' }}>No encontrado en el período.</div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: '#8B97A8' }}>Fecha</span><span>{data.fecha || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: '#8B97A8' }}>Líneas (NroD)</span><span style={{ color: '#8B97A8' }}>{data.nroDs}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: '#8B97A8' }}>Total Débito</span><span style={{ color: '#10B981' }}>{fmt(data.totalDebito)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#8B97A8' }}>Total Crédito</span><span style={{ color: '#EF4444' }}>{fmt(data.totalCredito)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.5rem', fontWeight: 600 }}>
                  <span style={{ color: '#8B97A8' }}>Balance</span>
                  <span style={{ color: data.cuadrado ? '#10B981' : '#EF4444' }}>
                    {data.cuadrado ? '✓ Cuadrado' : `⚠ Descuadre ${fmt(data.descuadre)}`}
                  </span>
                </div>
              </>
            )}
          </div>
        );
        return (
          <div className="kpi-card" style={{ marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC', marginBottom: '0.25rem' }}>
              🔑 Verificación Apertura y Cierre · {selectedYear}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#8B97A8', marginBottom: '0.75rem' }}>
              S10 registra cada cuenta como una línea separada (un NroD por cuenta). El balance se verifica sobre el total consolidado de todas las líneas.
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Card label="Asiento de Apertura" data={ac.apertura} />
              <Card label="Asiento de Cierre"   data={ac.cierre} />
            </div>
          </div>
        );
      })()}

      {/* Atípicos */}
      <div className="kpi-card" style={{ marginBottom: '1rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC', marginBottom: '0.25rem' }}>
          🔶 Asientos atípicos · {selectedYear}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#8B97A8', marginBottom: '0.75rem', lineHeight: 1.5 }}>
          Líneas de asiento contable con <strong style={{ color: '#F8FAFC' }}>Débito o Crédito superior a 100,000</strong> en moneda original. Montos de esta magnitud son inusuales en operaciones rutinarias y requieren verificación documental. No indica error por sí solo — un pago o cobro grande puede ser legítimo — pero debe tener respaldo. Excluye apertura y cierre. Se muestra el número de documento en S10 cuando corresponde a una factura o recibo identificable.
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
              <thead><tr><th>Fecha</th><th>Doc. / NroD</th><th>Cuenta</th><th style={{ minWidth: 160 }}>Desc. Cuenta</th><th style={{ minWidth: 160 }}>Glosa</th><th>Débito</th><th>Crédito</th><th style={{ minWidth: 140 }}>Tercero</th></tr></thead>
              <tbody>
                {auditData.atipicos.rows.map((r: any, i: number) => {
                  const docLabel = r.NumeroDocumento
                    ? (r.Serie ? `${r.Serie}-${r.NumeroDocumento}` : r.NumeroDocumento)
                    : (r.NroD || '—');
                  const isExternal = !!r.NumeroDocumento;
                  return (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap' }}>{r.Fecha}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: isExternal ? '#2BB4BB' : '#8B97A8' }}>{docLabel}</td>
                      <td style={{ fontFamily: 'monospace', color: '#2BB4BB', fontSize: '0.72rem' }}>{r.CodCuenta}</td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.DesCuenta}>{r.DesCuenta || '—'}</td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.Glosa}>{r.Glosa || '—'}</td>
                      <td style={{ color: r.Debito > 0 ? '#10B981' : '#8B97A8' }}>{r.Debito > 0 ? fmt(r.Debito) : '—'}</td>
                      <td style={{ color: r.Credito > 0 ? '#EF4444' : '#8B97A8' }}>{r.Credito > 0 ? fmt(r.Credito) : '—'}</td>
                      <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.Tercero || '—'}</td>
                    </tr>
                  );
                })}
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
