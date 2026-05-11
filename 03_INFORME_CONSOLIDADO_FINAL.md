---
title: "Informe Consolidado Final de Auditoría Integral"
subtitle: "REVISADO POST-VALIDACIÓN FORENSE 11/05/2026"
author: "Equipo de Auditoría BizSmartHub"
date: "11 de mayo de 2026 (rev. 16:50)"
---

\newpage

# 0. NOTA DE REVISIÓN POST-VALIDACIÓN

> **Este documento fue actualizado el 11/05/2026 tras una validación forense de 25 queries × 4 empresas (100 queries) ejecutadas directamente contra S10 SQL Server productivo.** Ver `05_VALIDACION_FORENSE_S10.docx` para detalle metodológico.
>
> **Cambios materiales:**
>
> | Hallazgo previo | Veredicto S10 | Acción |
> |---|---|---|
> | "CMO falta apertura 2026" | 🔴 REFUTADO | Removido — la apertura sí existe (9,700 asientos, S/592M) |
> | "CMO Capital S/78.3M" | 🟡 CORREGIDO | No hay cta 50; verdadero issue: patrimonio neto **−S/2.87M** (Art. 220 LGS) |
> | "Préstamos intercompañía S/123M" | 🔴 REFUTADO | S/123M era movido histórico; saldo cta 17 CMO = S/34M; intercompañía 4 auditadas = **S/20M consolidado** |
> | "BBVA MN −S/13M desde 2023" | 🟡 CORREGIDO | Origen real: enero 2026 (no 2023). Ver §4.4 |
>
> **7 hallazgos NUEVOS detectados** (N01–N07): patrimonio negativo CMO, activo fijo neto negativo CMO, 9,809 asientos futuros CMO, origen BBVA −S/13M, INTEGRAL→CMO S/11.1M, CTS mayo 2026 pendiente, crédito Renta INTEGRAL S/287K.
>
> **Contingencia recalculada:** S/4.96M | Créditos recuperables: S/427K | **NETA: S/4.54M**.

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

### 4.1.2. Patrimonio (CORREGIDO post-validación V03/V19)

| Cuenta | Saldo |
|---|---:|
| Capital Social (cta 50) | **(no existe en S10)** ⚠️ |
| Reserva Legal (cta 58) | (ausente) |
| 59110100 Utilidades Acumuladas | +S/5,082,789 |
| 59120100 Ingresos Años Anteriores | −S/2,199,498 |
| 59220100 Gastos Años Anteriores | −S/7,355 |
| Otras (no detalladas individualmente) | −S/5,751,871 |
| **TOTAL Patrimonio Neto** | **−S/2,875,935** 🔴 |

> **Riesgo Art. 220 LGS:** CMO tiene patrimonio neto NEGATIVO. Esto es causal de disolución obligatoria si las pérdidas reducen el patrimonio a menos de 1/3 del capital. Como CMO **no tiene capital cta 50 registrado**, técnicamente opera con capital S/0 y patrimonio negativo → situación contablemente insostenible.
>
> **Acción urgente:** Verificar con Registros Públicos el capital social inscrito y cargar el asiento de reclasificación si fuera necesario. Convocar Junta General de Accionistas extraordinaria.

### 4.1.3. Hallazgos críticos (corregidos)

| ID | Hallazgo | Monto | Severidad |
|---|---|---:|:-:|
| CMO-01 | **Patrimonio neto NEGATIVO −S/2.87M (Art. 220 LGS)** ⭐ NUEVO | −S/2.87M | 🔴 |
| CMO-02 | **Valor neto activo fijo NEGATIVO −S/5,942** (cls 33 y 39 ambas negativas) ⭐ NUEVO | −S/6K | 🔴 |
| CMO-03 | **9,809 asientos con fecha futura por S/1,182M** ⭐ NUEVO | S/1,182M | 🟠 |
| CMO-04 | Cuenta Edificios saldo NEGATIVO −S/2,407,287 (reclasificación incompleta a Instalaciones) | S/2.4M | 🟠 |
| CMO-05 | ~~Falta asiento de apertura Capital Social 2026~~ **REFUTADO** | — | — |
| CMO-06 | Depreciación cta 39135 inversa | −S/162K | 🟠 |
| CMO-07 | Sin pagos 2026 en OB_Pago (siendo el tesorero del grupo) | — | 🟠 |
| CMO-08 | **Préstamos intercompañía a entidades NO auditadas (~S/31M)** — recalibrado, NO los S/123M previos | S/31M | 🟠 |

### 4.1.4. Préstamos intercompañía (CORREGIDO post-validación V14)

| Concepto | Monto |
|---|---:|
| Préstamos otorgados saldo neto cta 17 | S/34,001,736 |
| Préstamos recibidos saldo neto cta 47 | S/47,962,755 |
| Otras CxC relacionadas (Clases 13,14,16-18) | S/37,142,456 |
| Otras CxP relacionadas (Clases 43,44,46-47) | S/34,051,984 |
| **CxC intercompañía DEMOSTRADO con las 3 empresas auditadas** | **S/2,740,547** |
| **Resto de préstamos otorgados (a accionistas u otras entidades no auditadas)** | **~S/31M** |

> **CORRECCIÓN MAYOR:** El monto "S/123M en préstamos sin contrato" del informe previo era el **monto movido histórico acumulado** (NumeroMovido × monto promedio), NO el saldo neto. El saldo neto real cta 17 CMO es **S/34M**. De ese, solo S/2.74M corresponde a las 3 empresas auditadas; el resto (~S/31M) son préstamos a accionistas/relacionados fuera del alcance.

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
| AMERICANA-01 | **BBVA Continental MN saldo contable −S/13,034,687** (origen ENERO 2026, no desde 2023) — Ver Anexo T | S/13M | 🔴 |
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

## 6.1. Contingencia tributaria (recalculada post-validación)

| # | Riesgo | Empresa | Monto |
|---|---|---|---:|
| RT-01 | Recalificación dividendos presuntos Art. 24-A LIR — 29.5% sobre INTEGRAL→CMO S/11.1M (mayor exposición individual) | CMO | **S/3,272,000** |
| RT-02 | Multa ETPT no presentado (Art. 175 num. 25 CT) | CMO | S/265,000 |
| RT-03 | IGV subdeclarado potencial (recalculado tras compensación crédito INTEGRAL) | varias | S/350,000 |
| RT-04 | Gastos no contabilizados (facturas SinAsiento INTEGRAL, MEDARQ, AMERICANA) | varias | S/45,000 |
| RT-05 | Retenciones 4ta cat. honorarios no aplicadas | AMERICANA | S/10,000 |
| **Subtotal tributario** | | | **S/3,942,000** |

## 6.2. Contingencia laboral

| # | Riesgo | Empresa | Monto |
|---|---|---|---:|
| RL-01 | Multa SUNAFIL Participaciones DL 892 no pagadas | INTEGRAL | S/275,000 |
| RL-02 | Multa SUNAFIL CTS mayo 2025 ausente | AMERICANA | S/275,000 |
| RL-03 | Multa SUNAFIL CTS mayo 2025 ausente | MEDARQ | S/275,000 |
| RL-04 | Demandas laborales por sueldos atrasados (exacto S/196,277) | MEDARQ | S/196,000 |
| **Subtotal laboral** | | | **S/1,021,000** |

## 6.3. Créditos tributarios recuperables (NUEVO — post-validación)

| # | Crédito | Empresa | Monto |
|---|---|---|---:|
| CT-01 | Renta 3ª Categoría neto a favor | INTEGRAL | −S/287,734 |
| CT-02 | ITAN a favor | AMERICANA | −S/43,704 |
| CT-03 | Pago a cuenta Renta a favor | AMERICANA | −S/95,225 |
| **Subtotal créditos** | | | **−S/426,663** |

## 6.4. CONTINGENCIA NETA DEL GRUPO

> **Contingencia bruta máxima: S/4,963,000**
> **Créditos recuperables: −S/426,663**
> **Contingencia NETA: S/4,536,337**

\newpage

# 7. ESTRUCTURA DEL BALANCE INTERCOMPAÑÍA

## 7.1. Préstamos intercompañía — saldos y movimientos (validados V14)

| Concepto | CMO | INTEGRAL | AMERICANA | MEDARQ | Total |
|---|---:|---:|---:|---:|---:|
| Préstamos otorgados (saldo neto cta 17) | 34,001,736 | 19,560,179 | 4,561,287 | 585,887 | **58,709,089** |
| Préstamos recibidos (saldo neto cta 47) | 47,962,755 | 12,122,836 | 2,430,778 | 1,696,918 | **64,213,288** |
| **# Documentos otorgados** | **4,051** | 677 | 138 | 93 | 4,959 |
| **# Documentos recibidos** | 4,049 | 677 | 138 | 93 | 4,957 |
| Monto total **movido** otorgados (acumulado histórico) | S/122.9M | S/29.6M | S/7.0M | S/2.7M | **S/162.2M** |

> **IMPORTANTE:** Las cifras "S/122.9M movido CMO" y "S/162.2M total movido" son **acumulados de transacciones históricas**, NO saldos netos actuales. El **saldo neto vigente cta 17 CMO es S/34M**.

## 7.2. Intercompañía DEMOSTRADO entre las 4 empresas auditadas (V14)

Filtrando solo terceros que son las otras 3 empresas del grupo auditadas:

| Empresa origen | Hacia CMO | Hacia INTEGRAL | Hacia AMERICANA | Hacia MEDARQ | Total |
|---|---:|---:|---:|---:|---:|
| CMO | — | −S/7,293 | S/2,747,840 | — | **S/2,740,547** |
| INTEGRAL | **S/11,102,290** ⚠️ | — | S/1,430,971 | S/301,786 | **S/12,835,047** |
| AMERICANA | S/2,037,487 | S/1,790,102 | — | S/585,184 | **S/4,412,772** |
| MEDARQ | — | — | S/17,350 | — | S/17,350 |
| **TOTAL** | **S/13,139,777** | **S/1,782,810** | **S/4,196,161** | **S/886,970** | **~S/20M** |

## 7.3. Otras CxC / CxP relacionadas (saldos brutos)

| Concepto | CMO | INTEGRAL | AMERICANA | MEDARQ |
|---|---:|---:|---:|---:|
| Otras CxC (clases 13-18) | **S/37,142,456** | S/15,939,270 | S/4,477,503 | S/899,052 |
| Otras CxP (clases 43-47) | **S/34,051,984** | S/5,737,176 | S/2,673,337 | S/806,425 |

## 7.4. Implicación tributaria (recalculada)

CMO GROUP funciona como **banca interna del grupo** con saldo neto cta 17 = **S/34M** (no los S/123M previamente reportados — esa cifra era movido histórico).

Bajo Art. 32-A LIR (Precios de Transferencia), debe:

1. Documentar cada préstamo con **contrato de mutuo**
2. Aplicar **tasa de interés a valor de mercado** (TAMN ~12%)
3. Presentar **Estudio Técnico de Precios de Transferencia (ETPT)** si operaciones intercompañía > 15 UIT por contraparte
4. Presentar **Reporte Local** anual si ingresos > 2,300 UIT (S/12.2M)

Si no se cumple → SUNAT puede **recalificar como dividendos** (Art. 24-A LIR), aplicando IR 29.5%.

**Contingencia recalculada:** la base imponible máxima identificable es **INTEGRAL→CMO S/11.1M** (mayor exposición individual probada). 29.5% × S/11.1M = **S/3.27M de contingencia tributaria por dividendos presuntos**.

\newpage

# 8. PLAN DE REMEDIACIÓN INTEGRAL — 20 ACCIONES

## Fase 1 — Inmediato (0-15 días) — Revisada post-validación

| # | Acción | Empresa | Responsable | Plazo |
|:-:|---|---|---|:-:|
| 1 | Identificar el asiento contable origen del −S/13M BBVA MN (enero 2026) | AMERICANA | Tesorería | 7d |
| 2 | **Convocar Junta Extraordinaria — Patrimonio NEGATIVO Art. 220 LGS** | CMO | Directorio | 7d |
| 3 | Investigar S/1.83M diferencia ingresos vs facturas (timing/anticipos) | INTEGRAL | Contabilidad | 10d |
| 4 | Aclarar status Participaciones S/212K | INTEGRAL | Legal+RRHH | 7d |
| 5 | Aclarar Sueldos atrasados S/196K | MEDARQ | RRHH | 7d |
| 6 | Validar CTS mayo 2025 | AMERICANA + MEDARQ | RRHH | 7d |
| 7 | Provisión NIIF 9 PERGOLA S/3M | AMERICANA | Contabilidad | 15d |
| 8 | Cargar saldos iniciales bancarios reales | MEDARQ + AMERICANA | Tesorería | 15d |
| **9** | **Depósito CTS 1er semestre 2026 — TODAS** | **Las 4** | RRHH | **15/05** |
| 10 | Auditar los 9,809 asientos futuros CMO (S/1,182M) | CMO | Auditoría int. | 15d |
| 11 | **Compensar INTEGRAL Renta 3ª a favor S/287K vs IGV S/195K** — ahorro inmediato | INTEGRAL | Tributos | 7d |
| 12 | Verificar con Registros Públicos capital social inscrito de CMO | CMO | Legal | 7d |

## Fase 2 — Urgente (15-60 días)

| # | Acción |
|:-:|---|
| 13 | Reconstruir registro Activo Fijo CMO (valor neto −S/5,942 anómalo) |
| 14 | Formalizar contrato de mutuo INTEGRAL→CMO S/11.1M con tasa TAMN |
| 15 | Formalizar contratos restantes de préstamos intercompañía |
| 16 | Aprobar Reserva Legal retroactiva en Junta de Accionistas (las 4) |
| 17 | Capitalizar INTEGRAL y AMERICANA (de S/1K a monto razonable) |
| 18 | Capitalización urgente CMO o decisión de disolución |
| 19 | Reactivar conciliación bancaria mensual en las 4 empresas |
| 20 | Dar de alta 36 cuentas bancarias de beneficiarios |
| 21 | Provisión intereses devengados préstamos intercompañía |
| 22 | Solicitar devolución/compensación SUNAT créditos AMERICANA (S/139K) |

## Fase 3 — Estratégico (60-180 días)

| # | Acción |
|:-:|---|
| 17 | Implementar Host-to-Host (H2H) bancos ↔ S10 |
| 18 | Implementar módulo formal de planilla en S10 (AFPNet, PDT-PLAME) |
| 19 | Contratar Estudio Técnico de Precios de Transferencia 2025 |
| 20 | Auditoría externa Big 4 de los EEFF 2025 |

\newpage

# 9. CONCLUSIONES

## 9.1. Estado general del grupo (revisado post-validación)

✅ **Lo positivo (confirmado contra S10):**
- 100% de cumplimiento Ley 28194 (histórico y actual)
- Trazabilidad Pago↔Documento del 99%+ en 3 empresas (validado V16)
- Partida doble cuadrada en las 4 empresas (V01)
- Identificadores únicos consistentes (V21)
- Bancarización: AMERICANA, INTEGRAL, MEDARQ 100% compliance
- INTEGRAL es rentable + tiene crédito tributario neto S/287K

🔴 **Lo crítico:**
- **CMO Patrimonio neto NEGATIVO −S/2.87M (Art. 220 LGS)** ⭐ NUEVO
- **CMO Valor neto Activo Fijo NEGATIVO −S/5,942** ⭐ NUEVO
- **CMO 9,809 asientos futuros por S/1,182M — verificar legitimidad** ⭐ NUEVO
- Contingencia tributaria + laboral neta **S/4.54 millones**
- 3 de 4 empresas no concilian bancariamente
- AMERICANA BBVA MN −S/13M con origen identificado en enero 2026
- MEDARQ sueldos atrasados S/196K
- INTEGRAL participaciones DL 892 impagas S/212K
- AMERICANA y MEDARQ CTS mayo 2025 omitido
- CTS mayo 2026 pendiente en TODAS (vence 15/05) ⭐ NUEVO

## 9.2. Recomendación al Directorio

1. **Aprobar inmediatamente** las 12 acciones de Fase 1 (0-15 días)
2. **Convocar Junta General de Accionistas extraordinaria URGENTE** para resolver:
   - **CMO: Patrimonio negativo −S/2.87M (Art. 220 LGS)** — capitalización o disolución
   - Verificación con Registros Públicos del capital social inscrito de CMO
   - Reserva Legal retroactiva (las 4)
   - Capitalización INTEGRAL y AMERICANA
3. **Aprobar presupuesto** para contratación externa:
   - Especialista PT (~US$15-20K)
   - Asesoría tributaria (~US$8-12K) — prioritaria para compensación crédito INTEGRAL
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

**Versión:** Final 2.0 (post-validación forense)
**Fecha de cierre original:** 11 de mayo de 2026
**Fecha de revisión:** 11 de mayo de 2026 (16:50 — post-validación 100 queries S10)
**Próxima revisión:** 11 de agosto de 2026 (90 días)
**Equipo de Auditoría:** BizSmartHub

**Documentos complementarios:**
- `01_RESUMEN_GERENCIAL.docx` (Directorio)
- `02_ANEXOS_REGISTROS.docx` (Evidencia transaccional)
- `04_TRAZABILIDAD_HISTORICA.docx` (Proceso histórico de auditoría)
- `05_VALIDACION_FORENSE_S10.docx` ⭐ **(Validación finding-by-finding contra S10 productivo)**
