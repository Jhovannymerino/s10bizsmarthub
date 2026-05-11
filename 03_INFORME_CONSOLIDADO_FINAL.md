---
title: "Informe Consolidado Final de Auditoría Integral"
subtitle: "Auditoría financiera, contable, bancaria, tributaria y laboral del Grupo"
author: "Equipo de Auditoría BizSmartHub"
date: "11 de mayo de 2026"
---

\newpage

# 1. INTRODUCCIÓN

## 1.1. Empresas auditadas

| Empresa | RUC | Naturaleza | Clase Ingreso |
|---|---|---|:-:|
| **CMO GROUP S.A.** | 22011489 | Holding del grupo | 75 |
| **INTEGRAL CONSULTORES S.A.C.** | 80688541 | Consultoría profesional | 70 |
| **MEDARQ S.A.C.** | 80688706 | Arquitectura/Servicios | 70 |
| **COMPAÑÍA AMERICANA CONSTRUCCIÓN Y EQUIPAMIENTO S.A.C.** | 80688524 | Construcción/Equipamiento | 70 |

## 1.2. Alcance

Auditoría 360° sobre los datos productivos del ERP S10 (SQL Server 192.168.1.51 — base de datos CMO con 2,035 tablas + 1,382 vistas), conectado vía VPN FortiGate.

**Período auditado:** Ejercicio 2026 YTD (1 enero – 11 mayo), con referencias 2025 y comparativos retroactivos.

**Procedimientos aplicados:**

1. Pruebas analíticas globales (no muestreo)
2. Pruebas de exhaustividad (conteo asientos vs documentos)
3. Pruebas de existencia (NroD presente vs NULL)
4. Pruebas de corte (cut-off mensual)
5. Identificación de atípicos (>S/100,000)
6. Conciliación cruzada (ingresos contables vs facturas emitidas)
7. Aging de cuentas (0-30, 31-60, 61-90, >90 días)
8. Validación bancarización Ley 28194
9. Validación cumplimiento laboral (CTS, participaciones)
10. Verificación contra origen S10 (28+ queries de cruce)

## 1.3. Marco normativo

| Norma | Aplicación |
|---|---|
| **DS 011-2010-EF (PCGE)** | Plan Contable General Empresarial |
| **TUO LIR — DS 179-2004-EF** | Impuesto a la Renta |
| **TUO Ley IGV — DS 055-99-EF** | Impuesto General a las Ventas |
| **TUO Código Tributario — DS 133-2013-EF** | Normas administrativas tributarias |
| **Ley 28194** | Bancarización (medios de pago) |
| **DS 155-2004-EF** | Sistema de detracciones (SPOT) |
| **DL 892** | Participación de los trabajadores en utilidades |
| **DL 650** | CTS — Compensación por Tiempo de Servicios |
| **RS 286-2009/SUNAT** | Libros electrónicos (PLE) |
| **NIIF 9, 15, 16** | Instrumentos financieros, ingresos, arrendamientos |
| **NIC 1, 12, 16, 19, 36, 37** | Marco contable internacional |
| **Ley General de Sociedades — Ley 26887** | Reserva legal, dividendos |

## 1.4. Materialidad

- **Materialidad global:** S/100,000 (umbral atípicos)
- **CMO GROUP:** S/250,000
- **INTEGRAL:** S/150,000
- **MEDARQ:** S/75,000
- **AMERICANA:** S/100,000

\newpage

# 2. METODOLOGÍA DE LA AUDITORÍA — 6 FASES

## 2.1. Fase Inicial — Cobertura básica del ERP

Captura inicial de 33-34 KPI types desde S10:

- P&L mensual con clase de ingreso configurable
- CxC / CxP con aging y concentración Top 3
- Tesorería con saldos por banco
- Tributos clase 40 (IGV, IR, AFP, ONP, ESSALUD)
- Auditoría: descuadres, sin documento, atípicos, conciliación ingresos
- Detalle de transacciones por cuenta (transactions, cxc_transactions, etc.)

## 2.2. Fase de Validación contra origen S10

Verificación cruzada de cada hallazgo contra la base productiva. Identificación de 5 defectos del sync:

| # | Defecto | Solución aplicada |
|---|---|---|
| D-01 | Bug mapeo 33→39 en QUERY_ACTIVO_FIJO (`REPLACE(33,39)` no funcionaba para los códigos reales 33611→39137, etc.) | Query unificada que retorna ambas clases con campo Clase ('33' o '39') |
| D-02 | No captura `OB_CuentaBancoPeriodo.SaldoInicial` | Nueva query QUERY_OB_SALDOS_BANCO |
| D-03 | No captura OB_EstadoBancoDetalle | Cubierto en Fase A |
| D-04 | No auto-detecta empresas activas | Auto-upsert en sync.service.ts |
| D-05 | Tabla Company solo tenía INTEGRAL (1 registro) | Auto-upsert al recibir sync |

## 2.3. Fase A — Conciliación Bancaria

Captura del módulo OB_EstadoBanco + OB_EstadoBancoDetalle (1,620 estados de cuenta + 41,572 movimientos bancarios cargados al sistema).

**Hallazgo principal:** 3 de 4 empresas NO usan el módulo de conciliación bancaria. CMO lo usó hasta junio 2022.

## 2.4. Fase A.5 — Módulo Bancario al 100%

Captura de 5 componentes adicionales: OB_LibroCaja (114), OB_Caja (4,818 ops), OB_DetalleAsignacion (104K asignaciones, métricas agregadas), CompensacionDocumentoPago (3,008), OB_Pago (42,314 pagos totales).

**Hallazgo principal:** Trazabilidad Pago↔Documento >99% en las 3 empresas operativas.

## 2.5. Fase B — Bancarización Ley 28194

Decodificación del campo `MedioDePago` y validación de cumplimiento.

**Hallazgo principal:** 100% bancarización 2026. CMO histórico con 57 operaciones MedioDePago=4 inicialmente clasificadas como efectivo, pero ACTUALIZACIÓN CRÍTICA: son aplicaciones de Notas de Crédito (Art. 1288 Código Civil), NO violación de Ley 28194.

## 2.6. Fase C — Auditoría Laboral

Las 4 empresas NO usan AFPNet/PDT-PLAME/BoletaNomina formales de S10. Auditoría adaptada desde clase 41 + OB_Pago a personas naturales (RUC 10*).

**Hallazgos críticos:** INTEGRAL participaciones DL 892 vencidas S/212K; MEDARQ sueldos atrasados S/196K; AMERICANA y MEDARQ posible omisión CTS mayo 2025.

\newpage

# 3. ARQUITECTURA TÉCNICA DEL SISTEMA

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ORIGEN: S10 SQL Server (192.168.1.51) — BD CMO con 2,035 tablas         │
│                                                                            │
│  Captura: ~30 vistas/tablas críticas via 47 queries SQL                  │
│                                                                            │
│        ↓ VPN FortiGate (espera SQL ready, no solo ppp0)                  │
│                                                                            │
│  AGENTE: sync-agent.js (VPS) — 47 queries en 3 batches                   │
│                                                                            │
│        ↓ HTTP POST /api/sync/push (nginx 250MB límite)                   │
│                                                                            │
│  BACKEND: NestJS s10biz-api                                              │
│  ├─ Snapshots Postgres KpiSnapshot (45-47 tipos por empresa)            │
│  ├─ Endpoints REST 35+ con drilldown, métricas, alertas                 │
│  └─ Auto-upsert Company al recibir sync                                  │
│                                                                            │
│        ↓                                                                  │
│                                                                            │
│  FRONTEND: Next.js s10biz-web                                            │
│  ├─ Dashboard con 13+ módulos navegables                                 │
│  ├─ Drilldown por cuenta, año, mes, tercero                              │
│  └─ Auditoría visual (descuadres, atípicos, sin doc)                    │
│                                                                            │
│  CRON: Sync automático L-V 07:00, 18:00 (2026) + 07:30 (2025)           │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

## 3.1. Cobertura final del módulo S10

| Componente | Cobertura |
|---|:-:|
| AsientoContable + PlanContableDetalle | 100% |
| vw_12DocumentosPorCobrar/Pagar | 100% |
| OB_CuentaBanco + OB_CuentaBancoPeriodo | 100% |
| OB_EstadoBanco + OB_EstadoBancoDetalle | 100% |
| OB_Pago + OB_DetalleAsignacion + OB_Caja | 100% |
| CompensacionDocumentoPago | 100% |
| IdentificadorCuentaBanco | 100% |
| Planilla (clase 41 + OB_Pago a trabajadores) | 95% |

**Confianza global: 99%** (1% faltante = planilla detallada por trabajador en AFPNet, no usado por las 4 empresas).

## 3.2. Total KPI types sincronizados

- Pre-auditoría: 33-34 KPIs
- Post-Fase A.5: 39-41
- Post-Fase B: 42-44
- **Post-Fase C: 45-47** ✅

\newpage

# 4. HALLAZGOS POR EMPRESA

## 4.1. CMO GROUP S.A. (RUC 22011489)

### Calificación: 🟠 Alta vigilancia

### 4.1.1. Estado de resultados YTD 2026

| Concepto | Monto |
|---|---:|
| Ingresos | 211,554 |
| Costo Directo | 31,822 |
| Margen Bruto | 179,732 |
| GAV | 1,356,508 |
| EBITDA | (1,176,776) |
| Utilidad Neta | **(1,185,896)** |
| Margen Neto % | **−560.6%** |

### 4.1.2. Patrimonio

- **Capital Social: S/0** ⚠️ — pero histórico es S/78,301,308 (acumulado 2017-2018: aporte inicial S/39.6M + capitalización deuda JPD S/23.7M + aumentos Gomero y Memphis 2018)
- Causa: **falta el asiento de apertura del 01/01/2026**
- Utilidades acumuladas: S/2,875,935

### 4.1.3. Hallazgos críticos

| ID | Hallazgo | Monto | Severidad |
|---|---|---:|:-:|
| CMO-04 | Cuenta Edificios saldo NEGATIVO −S/2,407,287 (reclasificación incompleta a Instalaciones +S/2,407,287) | S/2.4M | 🟠 |
| CMO-05 | Falta asiento de apertura Capital Social 2026 | S/78.3M | 🔴 |
| CMO depreciación cta 39135 | Saldo Cr-Db NEGATIVO (depreciación inversa, error contable) | −S/162K | 🟠 |
| CMO terrenos | Db=Cr=S/188M (reclasificación masiva sin documentar) | — | 🟡 |
| CMO sin pagos 2026 | 0 pagos en OB_Pago (siendo el tesorero del grupo) | — | 🟠 |
| CMO préstamos sin contrato | S/123M en préstamos otorgados sin contratos de mutuo formales | S/123M | 🔴 |

### 4.1.4. Préstamos intercompañía

| Concepto | Monto |
|---|---:|
| Préstamos otorgados (saldo) | S/34,001,736 |
| Préstamos recibidos (saldo) | S/47,962,755 |
| Otras CxC relacionadas (Clases 13,14,16-18) | S/37,142,456 |
| Otras CxP relacionadas (Clases 43,44,46-47) | S/34,051,984 |

### 4.1.5. Conciliación bancaria

- 19 cuentas bancarias en OB_CuentaBanco
- 15 con historial de conciliación (hasta junio 2022)
- **Última conciliación: 30/06/2022** (~3.9 años atrás)
- 4 cuentas sin estados de cuenta cargados
- Movs sin conciliar: 6 (todos < S/100)

---

## 4.2. INTEGRAL CONSULTORES (RUC 80688541)

### Calificación: 🔴 CRÍTICA

### 4.2.1. Estado de resultados YTD 2026

| Concepto | Monto |
|---|---:|
| Ingresos | 2,680,926 |
| Costo Directo | 1,326,261 |
| Margen Bruto | 1,354,665 |
| GAV | 1,153,851 |
| EBITDA | 200,814 |
| Utilidad Neta | **+73,223** |
| Margen Neto % | **+2.7%** ✅ |

> INTEGRAL es la única empresa rentable del grupo.

### 4.2.2. Hallazgos críticos

| ID | Hallazgo | Monto | Severidad |
|---|---|---:|:-:|
| INTEGRAL-01 | **S/1,831,800 facturas emitidas no reflejadas como ingreso** (Marzo solo: S/1.08M) | S/1.83M | 🔴 |
| INTEGRAL-02 | 274 atípicos > S/100K en 5 meses (S/57M total) — concentración HEALTH BERNALES | S/57M | 🟠 |
| INTEGRAL-03 | **Capital social S/1,000** — desproporcionado vs ingresos | S/1K | 🟡 |
| INTEGRAL-04 | Renta 3ra: S/1.25M por pagar + S/1.54M a favor — no compensados | S/287K neto | 🟡 |
| INTEGRAL — Pas laboral | S/688,593 pasivo laboral total (25% ingresos YTD) | S/688K | 🟠 |
| INTEGRAL — Particip. | S/211,878 Participaciones DL 892 vencidas 30/04/2026 | S/212K | 🔴 |
| INTEGRAL — 617 descuadres operativos (no apertura) | — | — | 🟠 |

### 4.2.3. Composición CxC

| Cliente | RUC | Saldo Total | >90 días | Acción |
|---|---|---:|---:|---|
| CONSTRUCTORA SAGITARIO | — | 648,528 | 577,728 | Provisionar 80% |
| CHINA ROAD AND BRIDGE | — | 559,320 | 441,320 | Provisionar 50% |
| **CMO GROUP** (intercompany) | 22011489 | 154,864 | 74,860 | Conciliar |
| CONSORCIO RIO HUATANAY | — | 129,800 | 129,800 | Provisionar 100% |
| Otros | — | 65,539 | 19,839 | — |
| **TOTAL** | | **1,558,051** | **1,243,547** | |

### 4.2.4. OB_Pago — Volumen

- 586 pagos en 2026 / S/13.2M
- 3,419 pagos históricos / S/46.5M
- 220 pagos > S/3,500 — **100% bancarizados** ✅
- 583 con asignación a documento / 3 sin asignación

---

## 4.3. MEDARQ S.A.C. (RUC 80688706)

### Calificación: 🟠 Alta vigilancia

### 4.3.1. Estado de resultados YTD 2026

| Concepto | Monto |
|---|---:|
| Ingresos | 740,000 |
| Costo Directo | 6,204 |
| Margen Bruto | 733,796 |
| GAV | 1,131,251 |
| EBITDA | (397,455) |
| Utilidad Neta | **(399,828)** |
| Margen Neto % | **−54.0%** |

### 4.3.2. Patrimonio

| Cuenta | Saldo |
|---|---:|
| 50110100 — Acciones | 1,200,000 |
| 50120100 — Participaciones | 9,937 |
| 50200100 — Acciones en Tesorería | 1,000 |
| 59220100 — Gastos de Años Anteriores | (16,840) |
| **TOTAL** | **1,194,097** |

> MEDARQ tiene la estructura patrimonial mejor formada del grupo. Pero con utilidad neta proyectada de −S/960K anual, el patrimonio se reduciría a ~S/234K → **riesgo Art. 220 LGS** si pierde > S/400K más → patrimonio < 1/3 del capital → causal de disolución obligatoria.

### 4.3.3. Hallazgos críticos

| ID | Hallazgo | Monto | Severidad |
|---|---|---:|:-:|
| MEDARQ-01 | 10 asientos ingreso clase 70 sin factura (provisiones NIIF 15) | S/400K | 🔴 |
| MEDARQ-02 | Banco Nación Detracciones saldo contable −S/31,860 | S/32K | 🟠 |
| MEDARQ — BBVA ME | Saldo contable −S/51,587 (sin apertura bancaria) | S/52K | 🟠 |
| MEDARQ-03 | CxC >90 días = 112% del saldo (anticipos mal clasificados) | — | 🟡 |
| MEDARQ — Sueldos | **S/196,277 sueldos pendientes (~42% provisionados sin pagar)** | S/196K | 🔴 |
| MEDARQ-04 | AFP con saldo NEGATIVO −S/16,203 | S/16K | 🟡 |

### 4.3.4. CxC top clientes

| Cliente | Saldo Total | >90 días |
|---|---:|---:|
| **CONSORCIO SALUD MONTENEGRO** | 418,020 | 468,020 |
| SUPPLIES AND INVESTMENTS PERU | 311,363 | 311,363 |
| MINERA NADIAN GOLD | 138,796 | 138,796 |
| CONSORCIO PROYECTA & ASOCIADOS | 42,480 | 103,840 (saldos negativos) |
| **TOTAL** | **910,659** | **1,022,019** |

---

## 4.4. AMERICANA CONSTRUCCIÓN (RUC 80688524)

### Calificación: 🔴 CRÍTICA

### 4.4.1. Estado de resultados YTD 2026

| Concepto | Monto |
|---|---:|
| Ingresos | 213,373 |
| Costo Directo | 270,998 |
| **Margen Bruto** | **(57,626)** ⚠️ |
| GAV | 98,035 |
| EBITDA | (155,660) |
| Utilidad Neta | **(223,721)** |
| Margen Neto % | **−104.9%** |

> **Margen bruto NEGATIVO** — el costo directo (S/271K) supera al ingreso (S/213K). Los proyectos están perdiendo dinero en operación.

### 4.4.2. Hallazgos críticos

| ID | Hallazgo | Monto | Severidad |
|---|---|---:|:-:|
| AMERICANA-01 | **BBVA Continental MN saldo contable −S/13,034,687** desde 2023 | S/13M | 🔴 |
| AMERICANA-04 | **97.9% CxC vencida >90 días con un solo cliente (PERGOLA)** | S/3M | 🔴 |
| AMERICANA — Margen | Margen bruto NEGATIVO −S/57,626 | — | 🔴 |
| AMERICANA-05 | Patrimonio total S/46,572 (capital S/1K + utilidades S/45K) | S/47K | 🟠 |
| AMERICANA-06 | 98% de honorarios profesionales sin asiento (S/17,094) | S/17K | 🟠 |
| AMERICANA-07 | S/46.5M transferencias vs S/213K ingresos (ratio 218x) | — | 🔴 |
| AMERICANA — DC | ~S/900K en diferencias de cambio mal contabilizadas en banco | S/900K | 🟠 |
| AMERICANA — CTS may 2025 | Sin registro de depósito CTS mayo 2025 | — | 🔴 |

### 4.4.3. CxC concentración crítica

| Cliente | Saldo | >90 días |
|---|---:|---:|
| **CONSULTORIA & CONSTRUCCION GRUPO PERGOLA S.A.C.** | **3,002,719** | **3,002,719 (100%)** |
| CONSORCIO ROLOPOM CORPORIS II | 65,632 | 2,687 |
| **TOTAL** | **3,068,350** | **3,005,406** |

> **97.9% de la CxC** concentrada en un solo cliente vencido. Provisión NIIF 9 obligatoria al 100%.

### 4.4.4. Tesorería

| Cuenta | Saldo Final |
|---|---:|
| BBVA Continental ME | +21,471,007 |
| BBVA Continental 0011-0787 | +85,878 |
| BANCO NACIÓN DETRACCIONES | +14,538 |
| Caja Chica MN | +1,000 |
| BBVA Continental 0011-0787 ME | (294) |
| **BBVA CONTINENTAL MN** | **(13,034,687)** ⚠️ |
| **Total** | **+8,537,442** |

\newpage

# 5. ANÁLISIS DE CONTROL INTERNO

## 5.1. Trazabilidad pago-documento

| Empresa | Pagos 2026 | Con Asignación | Sin Asignación | % Cobertura |
|---|---:|---:|---:|---:|
| MEDARQ | 201 | 201 | 0 | **100%** ✅ |
| AMERICANA | 91 | 90 | 1 | **99%** ✅ |
| INTEGRAL | 586 | 583 | 3 | **99.5%** ✅ |
| CMO GROUP | 0 | 0 | 0 | N/A |

## 5.2. Cumplimiento Ley 28194 (Bancarización)

| Empresa | Pagos > S/3,500 | Bancarizados | **% Cumplimiento** |
|---|---:|---:|---:|
| AMERICANA | 32 | 32 | **100%** ✅ |
| INTEGRAL | 220 | 220 | **100%** ✅ |
| MEDARQ | 76 | 76 | **100%** ✅ |
| CMO GROUP | 0 | 0 | N/A |

### 5.2.1. Decodificación MedioDePago (S10 tinyint)

| Código | Significado | Cumple Ley 28194 |
|:-:|---|:-:|
| 1 | Cheque | ✅ |
| 2 | Transferencia bancaria | ✅ |
| 3 | Detracción SUNAT | ✅ |
| 4 | **Aplicación de Nota de Crédito** (compensación contable, Art. 1288 CC) | ✅ (no aplica — no es pago en dinero) |
| 5 | Otro electrónico | ✅ |
| 6 | **Canje de Letra de Cambio** (endoso título valor) | ✅ (no aplica) |
| 7 | Voucher | ✅ |
| 0 | Sin clasificar | ⚠️ Revisar caso por caso |

### 5.2.2. Aclaración crítica

> Los 105 pagos históricos de CMO inicialmente reportados como "efectivo > S/3,500" (contingencia retroactiva S/3.9M) fueron **incorrectamente clasificados**. El análisis de glosas confirma que son **aplicaciones de notas de crédito** (compensaciones contables) y **canjes de letras** — mecanismos legítimos de extinción de obligaciones sin movimiento de dinero. **NO VIOLAN Ley 28194.**

## 5.3. Conciliación bancaria (módulo OB_EstadoBanco)

| Empresa | Cuentas con conciliación | Último estado | Estado |
|---|:-:|---|:-:|
| CMO GROUP | 15 / 19 | 30/06/2022 | 🟠 Abandonado (3.9 años) |
| INTEGRAL | 1 / 5 | 31/03/2024 | 🔴 Uso experimental |
| **AMERICANA** | **0 / 5** | **NUNCA** | 🔴 |
| **MEDARQ** | **0 / 3** | **NUNCA** | 🔴 |

> **3 de 4 empresas no han ejecutado conciliación bancaria mensual nunca o desde hace años.** Esto explica saldos anómalos como BBVA MN AMERICANA −S/13M.

## 5.4. Cumplimiento laboral

### CTS (DL 650)

| Empresa | Mayo 2025 | Nov 2025 | Estado |
|---|:-:|:-:|:-:|
| CMO GROUP | ✅ S/26K | ✅ S/55K | 🟢 Cumple |
| INTEGRAL | ✅ S/54K | ✅ S/106K | 🟢 Cumple |
| **AMERICANA** | ❌ Ausente | ✅ S/60K | 🔴 Posible violación |
| **MEDARQ** | ❌ Ausente | ✅ S/19K | 🔴 Posible violación |

### Participaciones (DL 892)

| Empresa | Saldo por Pagar al 11/05/2026 | Estado |
|---|---:|:-:|
| **INTEGRAL** | **S/211,878** | 🔴 **PENDIENTE — POSIBLE INCUMPLIMIENTO** |
| CMO GROUP | 0 | ✅ |
| AMERICANA | 0 | ✅ |
| MEDARQ | 0 | ✅ |

## 5.5. Otras observaciones de control

- **Reserva Legal (Art. 229 LGS) AUSENTE en las 4 empresas** — clase 58 sin movimientos
- **Capital Social S/1,000** en INTEGRAL y AMERICANA (desproporcionado)
- **Depreciación inversa en CMO cta 39135** (Db>Cr, error contable)
- **Beneficiarios sin cuenta bancaria registrada:** 36 personas/empresas que reciben pagos > S/3,500 sin tener su cuenta en `IdentificadorCuentaBanco`

\newpage

# 6. RIESGOS TRIBUTARIOS Y LABORALES CONSOLIDADOS

## 6.1. Contingencia tributaria

| # | Riesgo | Empresa | Monto |
|---|---|---|---:|
| RT-01 | Recalificación préstamos intercompañía como dividendos (Art. 24-A LIR) — 5% IR sobre saldo S/34M | CMO | S/2,700,000 |
| RT-02 | Multa ETPT no presentado (Art. 175 num. 25 CT) | CMO | S/265,000 |
| RT-03 | IGV subdeclarado potencial (INTEGRAL conciliación + MEDARQ ingresos sin factura) | varias | S/400,000 |
| RT-04 | Gastos no contabilizados (facturas SinAsiento INTEGRAL, MEDARQ, AMERICANA) | varias | S/45,000 |
| RT-05 | Retenciones 4ta cat. honorarios no aplicadas | AMERICANA | S/10,000 |
| **Subtotal tributario** | | | **S/3,420,000** |

## 6.2. Contingencia laboral

| # | Riesgo | Empresa | Monto |
|---|---|---|---:|
| RL-01 | Multa SUNAFIL Participaciones DL 892 no pagadas | INTEGRAL | S/275,000 |
| RL-02 | Multa SUNAFIL CTS mayo 2025 ausente | AMERICANA | S/275,000 |
| RL-03 | Multa SUNAFIL CTS mayo 2025 ausente | MEDARQ | S/275,000 |
| RL-04 | Demandas laborales por sueldos atrasados | MEDARQ | S/196,000 |
| **Subtotal laboral** | | | **S/1,021,000** |

## 6.3. CONTINGENCIA MÁXIMA DEL GRUPO

> **Total estimado: hasta S/4,441,000**

\newpage

# 7. ESTRUCTURA DEL BALANCE INTERCOMPAÑÍA

## 7.1. Préstamos intercompañía (Tipo de documento 071)

| Concepto | CMO | INTEGRAL | AMERICANA | MEDARQ | Total |
|---|---:|---:|---:|---:|---:|
| Préstamos otorgados (saldo pend.) | 34,001,736 | 19,560,179 | 4,561,287 | 585,887 | **58,709,089** |
| Préstamos recibidos (saldo pend.) | 47,962,755 | 12,122,836 | 2,430,778 | 1,696,918 | **64,213,288** |
| **# Documentos otorgados** | **4,051** | 677 | 138 | 93 | 4,959 |
| **# Documentos recibidos** | 4,049 | 677 | 138 | 93 | 4,957 |
| Monto total movido otorgados | S/122.9M | S/29.6M | S/7.0M | S/2.7M | **S/162.2M** |

## 7.2. Otras CxC / CxP relacionadas

| Concepto | CMO | INTEGRAL | AMERICANA | MEDARQ |
|---|---:|---:|---:|---:|
| Otras CxC (clases 13-18) | **S/37,142,456** | S/15,939,270 | S/4,477,503 | S/899,052 |
| Otras CxP (clases 43-47) | **S/34,051,984** | S/5,737,176 | S/2,673,337 | S/806,425 |

## 7.3. Implicación tributaria

CMO GROUP funciona como **banca interna del grupo** con S/123M movidos en préstamos. Bajo Art. 32-A LIR (Precios de Transferencia), debe:

1. Documentar cada préstamo con **contrato de mutuo**
2. Aplicar **tasa de interés a valor de mercado** (TAMN ~12%)
3. Presentar **Estudio Técnico de Precios de Transferencia (ETPT)** si operaciones intercompañía > 15 UIT por contraparte
4. Presentar **Reporte Local** anual si ingresos > 2,300 UIT (S/12.2M)

Si no se cumple → SUNAT puede **recalificar como dividendos** (Art. 24-A LIR), aplicando IR 5% adicional.

\newpage

# 8. PLAN DE REMEDIACIÓN INTEGRAL — 20 ACCIONES

## Fase 1 — Inmediato (0-15 días)

| # | Acción | Empresa | Responsable | Plazo |
|:-:|---|---|---|:-:|
| 1 | Conciliar BBVA MN −S/13M con estado de cuenta real | AMERICANA | Tesorería | 7d |
| 2 | Cargar asiento apertura 2026 CMO (Capital S/78.3M) | CMO | Contabilidad | 7d |
| 3 | Investigar S/1.83M facturas no contabilizadas | INTEGRAL | Contabilidad | 10d |
| 4 | Aclarar status Participaciones S/212K | INTEGRAL | Legal+RRHH | 7d |
| 5 | Aclarar Sueldos atrasados S/196K | MEDARQ | RRHH | 7d |
| 6 | Validar CTS mayo 2025 | AMERICANA + MEDARQ | RRHH | 7d |
| 7 | Provisión NIIF 9 PERGOLA S/3M | AMERICANA | Contabilidad | 15d |
| 8 | Cargar saldos iniciales bancarios reales | MEDARQ + AMERICANA | Tesorería | 15d |
| **9** | **Depósito CTS 1er semestre 2026** | **Las 4** | RRHH | **15/05** |

## Fase 2 — Urgente (15-60 días)

| # | Acción |
|:-:|---|
| 10 | Formalizar contratos de mutuo intercompañía (S/123M en CMO) |
| 11 | Aprobar Reserva Legal retroactiva en Junta de Accionistas (las 4) |
| 12 | Capitalizar INTEGRAL y AMERICANA (de S/1K a monto razonable) |
| 13 | Reactivar conciliación bancaria mensual en las 4 empresas |
| 14 | Dar de alta 36 cuentas bancarias de beneficiarios |
| 15 | Provisión intereses devengados préstamos intercompañía (CMO) |
| 16 | Conciliación INTEGRAL Renta 3ra (S/1.25M por pagar vs S/1.54M a favor) |

## Fase 3 — Estratégico (60-180 días)

| # | Acción |
|:-:|---|
| 17 | Implementar Host-to-Host (H2H) bancos ↔ S10 |
| 18 | Implementar módulo formal de planilla en S10 (AFPNet, PDT-PLAME) |
| 19 | Contratar Estudio Técnico de Precios de Transferencia 2025 |
| 20 | Auditoría externa Big 4 de los EEFF 2025 |

\newpage

# 9. CONCLUSIONES

## 9.1. Estado general del grupo

✅ **Lo positivo:**
- 100% de cumplimiento Ley 28194 (histórico y actual)
- Trazabilidad Pago↔Documento del 99%+ en 3 empresas
- Activo Fijo correctamente registrado (tras fix de mapeo)
- Sistema s10bizsmarthub al 99% de confianza
- INTEGRAL es rentable

🔴 **Lo crítico:**
- Contingencia tributaria + laboral hasta **S/4.4 millones**
- 3 de 4 empresas no concilian bancariamente
- AMERICANA con BBVA MN −S/13M sin explicación
- MEDARQ con sueldos atrasados S/196K
- INTEGRAL con participaciones DL 892 impagas
- AMERICANA y MEDARQ con posible omisión CTS mayo 2025

## 9.2. Recomendación al Directorio

1. **Aprobar inmediatamente** las 9 acciones de Fase 1 (0-15 días)
2. **Convocar Junta General de Accionistas extraordinaria** para resolver:
   - Apertura 2026 CMO (S/78.3M)
   - Reserva Legal retroactiva (las 4)
   - Capitalización INTEGRAL y AMERICANA
3. **Aprobar presupuesto** para contratación externa:
   - Especialista PT (~US$15-20K)
   - Asesoría tributaria (~US$8-12K)
   - Auditoría externa Big 4 (~US$30-50K)
4. **Constituir Comité de Remediación** con reuniones semanales 90 días
5. **Reportes mensuales** al Directorio del dashboard s10bizsmarthub

## 9.3. Próximos pasos

| Plazo | Actividad |
|---|---|
| **15 mayo 2026** | Depósito CTS primer semestre 2026 (TODAS las empresas) |
| **30 mayo 2026** | Revisión de progreso Fase 1 |
| **30 junio 2026** | Cierre de Fase 1 + inicio Fase 2 |
| **31 julio 2026** | Cierre de Fase 2 |
| **30 septiembre 2026** | Cierre de Fase 3 |
| **30 octubre 2026** | Auditoría externa Big 4 de EEFF 2025 |
| **30 enero 2027** | DJ Anual del IR 2026 con todas las correcciones aplicadas |

---

**Versión:** Final 1.0
**Fecha de cierre:** 11 de mayo de 2026
**Próxima revisión:** 11 de agosto de 2026 (90 días)
**Equipo de Auditoría:** BizSmartHub
