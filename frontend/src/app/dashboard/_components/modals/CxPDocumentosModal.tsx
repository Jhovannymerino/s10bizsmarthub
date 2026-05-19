'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { API } from '../../_lib/constants';
import { fmt } from '../../_lib/formatters';
import { SortState, sortRows, toggleSort, searchRows } from '../../_lib/sort';
import { SortTh, searchInputStyle } from '../../_lib/SortTh';
import { DocPaymentsModal } from './DocPaymentsModal';

const fUSD = (v: number) => `$ ${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function getMoneda(d: any): 'USD' | 'PEN' {
  const raw = String(d.Moneda ?? d.CodMoneda ?? '01').trim();
  return raw === '02' || raw === '2' ? 'USD' : 'PEN';
}

function fMon(moneda: 'USD' | 'PEN', v: number) {
  return moneda === 'USD' ? fUSD(v) : fmt(v);
}

// Tipos que NO son facturas reales a pagar: anticipos ya pagados, préstamos, instrumentos
// financieros y movimientos administrativos.
function isOtro(d: any): boolean {
  const t = String(d.DesTipo || d.TipoDoc || '').toUpperCase();
  return (
    t.includes('ANTICIPO') ||
    t.includes('PRESTAMO') ||
    t.includes('PRÉSTAMO') ||
    t.includes('TRANSFERENCIA BANCARIA') ||
    t.includes('ENTREGA A RENDIR') ||
    t.includes('COMPROBANTE DE RETEN') ||
    t.includes('PLANILLA DE PAGOS') ||
    t.includes('AJUSTES POR REDONDEO') ||
    t.includes('FONDO ROTATORIO') ||
    t.includes('REQUERIMIENTO DE PAGOS') ||
    t.includes('BENEFICIO SOCIAL') ||
    t.includes('LIQUIDACION DE BENEF') ||
    t.includes('RETENCION POR RECUPERAR') ||
    t.includes('RETENCIÓN POR RECUPERAR') ||
    t.includes('DEVOLUCIONES')
  );
}

const OTRO_LABEL: Record<string, string> = {
  ANTICIPO: 'Anticipo ya pagado — pendiente de aplicar en S10',
  PRESTAMO: 'Préstamo financiero — reclasificar a cuenta 45',
  PRÉSTAMO: 'Préstamo financiero — reclasificar a cuenta 45',
  'TRANSFERENCIA BANCARIA': 'Instrumento de pago — verificar si está aplicado',
  'ENTREGA A RENDIR': 'Adelanto de gastos por rendir',
  'COMPROBANTE DE RETENCION': 'Retención tributaria',
  'COMPROBANTE DE RETENCIÓN': 'Retención tributaria',
  'PLANILLA DE PAGOS EXTORNO': 'Extorno de pago — revisar conciliación',
  'AJUSTES POR REDONDEO': 'Ajuste contable de redondeo',
  'RECIBO FONDO ROTATORIO': 'Fondo rotatorio por rendir',
  'RETENCION POR RECUPERAR': 'Retención a recuperar',
  'RETENCIÓN POR RECUPERAR': 'Retención a recuperar',
  DEVOLUCIONES: 'Devolución pendiente de aplicar',
};

function getOtroLabel(d: any): string {
  const t = String(d.DesTipo || d.TipoDoc || '').toUpperCase();
  for (const [key, label] of Object.entries(OTRO_LABEL)) {
    if (t.includes(key)) return label;
  }
  return 'Documento no estándar — revisar en S10';
}

export function CxPDocumentosModal({ companyId, proveedor, codProveedor, onClose }: {
  companyId: string; proveedor: string; codProveedor: string; onClose: () => void;
}) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'vencido' | 'vigente' | 'otros' | 'pagado'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ col: '', dir: 'asc' });
  const [pagosDrill, setPagosDrill] = useState<{ nroD: string; label: string; totalPagado: number } | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const params = new URLSearchParams({ codProveedor: String(codProveedor) });
    fetch(`${API}/kpi/${companyId}/cxp-docs?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setDocs(d.docs || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId, codProveedor]);

  const facturas = docs.filter(d => !isOtro(d));
  const otros = docs.filter(d => isOtro(d));
  const pendientes = facturas.filter(d => (d.Saldo ?? 0) > 0);
  const pagados = facturas.filter(d => (d.Saldo ?? 0) <= 0);

  const baseFiltered = filter === 'otros'
    ? otros
    : filter === 'pagado'
    ? pagados
    : pendientes.filter(d => {
        if (filter === 'vencido') return (d.DiasVencido ?? 0) > 0;
        if (filter === 'vigente') return (d.DiasVencido ?? 0) <= 0;
        return true;
      });

  const filtered = useMemo(
    () => sortRows(searchRows(baseFiltered, search), sort.col, sort.dir),
    [baseFiltered, search, sort]
  );

  const totalPEN = filtered.filter(d => getMoneda(d) === 'PEN').reduce((s, d) => s + (d.Saldo ?? 0), 0);
  const totalUSD = filtered.filter(d => getMoneda(d) === 'USD').reduce((s, d) => s + (d.Saldo ?? 0), 0);
  const hasMixed = totalPEN > 0 && totalUSD > 0;

  const otrosPEN = otros.filter(d => getMoneda(d) === 'PEN').reduce((s, d) => s + (d.Saldo ?? 0), 0);
  const otrosUSD = otros.filter(d => getMoneda(d) === 'USD').reduce((s, d) => s + (d.Saldo ?? 0), 0);

  const diasColor = (dias: number) => {
    if (dias <= 0) return '#10B981';
    if (dias <= 30) return '#F59E0B';
    if (dias <= 60) return '#F97316';
    return '#EF4444';
  };

  const btnStyle = (active: boolean, accent?: string) => ({
    padding: '0.25rem 0.75rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.78rem',
    border: active
      ? `1px solid ${accent === 'amber' ? 'rgba(245,158,11,0.5)' : accent === 'green' ? 'rgba(16,185,129,0.5)' : 'rgba(32,126,131,0.5)'}`
      : '1px solid rgba(255,255,255,0.1)',
    background: active
      ? (accent === 'amber' ? 'rgba(245,158,11,0.15)' : accent === 'green' ? 'rgba(16,185,129,0.15)' : 'rgba(32,126,131,0.2)')
      : 'rgba(255,255,255,0.04)',
    color: active ? (accent === 'amber' ? '#F59E0B' : accent === 'green' ? '#10B981' : '#2BB4BB') : '#8B97A8',
  });

  const showingOtros = filter === 'otros';
  const onSort = (col: string) => setSort(s => toggleSort(s, col));

  return (
    <>
    {pagosDrill && (
      <DocPaymentsModal
        companyId={companyId}
        nroD={pagosDrill.nroD}
        docLabel={pagosDrill.label}
        totalPagado={pagosDrill.totalPagado}
        onClose={() => setPagosDrill(null)}
      />
    )}
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div style={{ background: '#0D1A2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', maxWidth: '95vw', width: 1100, maxHeight: '85vh', overflow: 'auto', padding: '1.5rem' }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#F8FAFC' }}>{proveedor}</div>
            <div style={{ fontSize: '0.78rem', color: '#8B97A8', marginTop: '0.2rem' }}>
              {showingOtros
                ? `Anticipos y otros · ${filtered.length} registros`
                : filter === 'pagado'
                ? `Documentos pagados · ${filtered.length} registros`
                : `Documentos a pagar · ${filtered.length} de ${pendientes.length} (facturas, recibos, boletas, letras, etc.)`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#8B97A8' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={btnStyle(filter === 'all')} onClick={() => setFilter('all')}>
            Todos ({pendientes.length})
          </button>
          <button style={btnStyle(filter === 'vencido')} onClick={() => setFilter('vencido')}>
            Vencidos ({pendientes.filter(d => (d.DiasVencido ?? 0) > 0).length})
          </button>
          <button style={btnStyle(filter === 'vigente')} onClick={() => setFilter('vigente')}>
            Vigentes ({pendientes.filter(d => (d.DiasVencido ?? 0) <= 0).length})
          </button>
          {pagados.length > 0 && (
            <button style={btnStyle(filter === 'pagado', 'green')} onClick={() => setFilter('pagado')}>
              Pagados ({pagados.length})
            </button>
          )}
          {otros.length > 0 && (
            <button style={btnStyle(filter === 'otros', 'amber')} onClick={() => setFilter('otros')}>
              Anticipos y Otros ({otros.length})
            </button>
          )}
          <input
            type="text" placeholder="Buscar..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={searchInputStyle}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#8B97A8' }}>
            {showingOtros ? 'Sin anticipos ni otros documentos.' : 'Sin documentos en esta categoría.'}
          </div>
        ) : (
          <>
            {showingOtros && (
              <div style={{
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: '0.5rem', padding: '0.6rem 0.85rem', marginBottom: '0.75rem',
                fontSize: '0.75rem', color: '#F59E0B',
              }}>
                Estos documentos <strong>no se suman al saldo pendiente</strong> de la deuda comercial.
                Representan pagos ya realizados (anticipos), préstamos financieros u otros movimientos administrativos que deben revisarse o reclasificarse en S10.
                {(otrosPEN > 0 || otrosUSD > 0) && (
                  <span style={{ marginLeft: '1rem', fontWeight: 700 }}>
                    Monto referencial:{' '}
                    {otrosPEN > 0 && fmt(otrosPEN)}
                    {otrosPEN > 0 && otrosUSD > 0 && ' + '}
                    {otrosUSD > 0 && fUSD(otrosUSD)}
                  </span>
                )}
              </div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table className="table-s10" style={{ fontSize: '0.78rem' }}>
                <thead>
                  <tr>
                    <SortTh col="DesTipo" label="Tipo" sort={sort} onSort={onSort} />
                    {showingOtros && <th>Observación</th>}
                    <SortTh col="Numero" label="Serie / N°" sort={sort} onSort={onSort} />
                    <SortTh col="FechaDocumento" label="Fecha Doc." sort={sort} onSort={onSort} />
                    <SortTh col="FechaVencimiento" label="Vencimiento" sort={sort} onSort={onSort} />
                    <SortTh col="DiasVencido" label="Días Venc." sort={sort} onSort={onSort} style={{ textAlign: 'right' }} />
                    <th style={{ textAlign: 'center' }}>Moneda</th>
                    <SortTh col="Total" label="Total" sort={sort} onSort={onSort} style={{ textAlign: 'right' }} />
                    <SortTh col="Pagado" label="Pagado" sort={sort} onSort={onSort} style={{ textAlign: 'right' }} />
                    <SortTh col="Detraccion" label="Detracción" sort={sort} onSort={onSort} style={{ textAlign: 'right' }} />
                    <SortTh col="Saldo" label="Saldo" sort={sort} onSort={onSort} style={{ textAlign: 'right' }} />
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d: any, i: number) => {
                    const moneda = getMoneda(d);
                    const isUSD = moneda === 'USD';
                    return (
                      <tr key={i} style={{
                        background: showingOtros
                          ? 'rgba(245,158,11,0.04)'
                          : isUSD ? 'rgba(74,222,128,0.03)' : undefined,
                      }}>
                        <td style={{ color: showingOtros ? '#F59E0B' : '#8B97A8', fontSize: '0.72rem' }}>{d.DesTipo || d.TipoDoc}</td>
                        {showingOtros && (
                          <td style={{ fontSize: '0.70rem', color: '#8B97A8', maxWidth: 200 }}>
                            {getOtroLabel(d)}
                          </td>
                        )}
                        <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
                          {d.Serie ? `${d.Serie}-${d.Numero}` : d.Numero || '—'}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{d.FechaDocumento}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{d.FechaVencimiento}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: diasColor(d.DiasVencido ?? 0) }}>
                          {(d.DiasVencido ?? 0) > 0 ? `+${d.DiasVencido}` : 'Vigente'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            fontSize: '0.70rem', fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                            background: isUSD ? 'rgba(74,222,128,0.15)' : 'rgba(226,92,26,0.15)',
                            color: isUSD ? '#4ade80' : '#E25C1A',
                          }}>
                            {isUSD ? '$ USD' : 'S/ PEN'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>{fMon(moneda, d.Total ?? 0)}</td>
                        <td style={{ textAlign: 'right' }}>
                          {(d.Pagado ?? 0) > 0 && d.NroD ? (
                            <button
                              onClick={e => { e.stopPropagation(); setPagosDrill({ nroD: String(d.NroD), label: d.Serie ? `${d.Serie}-${d.Numero}` : (d.Numero || String(d.NroD)), totalPagado: d.Pagado }); }}
                              title="Ver detalle de pagos"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2BB4BB', textDecoration: 'underline', textDecorationStyle: 'dotted', fontSize: '0.78rem', padding: 0 }}>
                              {fMon(moneda, d.Pagado)}
                            </button>
                          ) : (
                            <span style={{ color: '#8B97A8' }}>{fMon(moneda, d.Pagado ?? 0)}</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', color: (d.Detraccion ?? 0) > 0 ? '#F59E0B' : '#8B97A8' }}>
                          {(d.Detraccion ?? 0) > 0 ? fMon(moneda, d.Detraccion) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: (d.Saldo ?? 0) > 0 ? '#F8FAFC' : '#8B97A8' }}>
                          {fMon(moneda, d.Saldo ?? 0)}
                        </td>
                        <td style={{ fontSize: '0.70rem', color: '#8B97A8' }}>{d.Estado || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {!showingOtros && (
                  <tfoot>
                    <tr className="total-row">
                      <td colSpan={9} style={{ textAlign: 'right' }}>SALDO PENDIENTE</td>
                      <td style={{ textAlign: 'right' }}>
                        {hasMixed ? (
                          <>
                            <div>{fmt(totalPEN)}</div>
                            <div style={{ color: '#4ade80', fontSize: '0.72rem' }}>{fUSD(totalUSD)}</div>
                          </>
                        ) : totalUSD > 0 ? fUSD(totalUSD) : fmt(totalPEN)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}
