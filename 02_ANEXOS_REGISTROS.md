---
title: "Anexos de Registros — Evidencia Transaccional y Asientos Correctivos"
subtitle: "Soporte documental de los hallazgos de auditoría"
author: "Equipo de Auditoría BizSmartHub"
date: "11 de mayo de 2026"
---

\newpage

# ÍNDICE DE ANEXOS

| Anexo | Hallazgo | Empresa | Registros |
|:-:|---|---|---|
| **A** | Saldo bancario negativo BBVA MN | AMERICANA | 241 movimientos históricos resumidos + asiento de apertura |
| **B** | Facturas emitidas no contabilizadas | INTEGRAL | 8 facturas SinAsiento + análisis mensual |
| **C** | CxC vencida concentrada | AMERICANA | Detalle PERGOLA + provisión NIIF 9 |
| **D** | Pagos sin asignación a documento | INTEGRAL | 1 pago material |
| **E** | Honorarios sin asiento | AMERICANA | 6 recibos por honorarios pendientes |
| **F** | Ingresos sin documento fuente | MEDARQ | 10 asientos clase 70 |
| **G** | Movimientos bancarios sin documento | AMERICANA | 27 movs (mayoría apertura legítima) |
| **H** | Descuadres operativos por NroD | Grupo | Top 25 documentos con descuadre |
| **I** | Atípicos > S/100K | INTEGRAL | Top 15 atípicos |
| **J** | Activo Fijo CMO anómalo | CMO GROUP | Reclasificación Edificios → Instalaciones |
| **K** | Beneficiarios sin cuenta bancaria | Grupo | 36 beneficiarios identificados |
| **L** | Pagos compensación NC (M=4) e/o Canje Letra (M=6) | CMO | Top 30 históricos (NO violan Ley 28194) |
| **M** | Trabajadores pagados 2026 | Grupo | Top 15 por empresa |
| **N** | Depósitos CTS por mes | Grupo | Validación cumplimiento DL 650 |
| **O** | Propuesta de 14 asientos correctivos | Grupo | Asientos AC-01 a AC-14 |
| **P** | Cuestionario para Gerencia | Grupo | 30+ preguntas dirigidas |

\newpage

# ANEXO A — AMERICANA: BBVA Continental MN saldo −S/13M

## A.1. Datos del origen S10

```
Cuenta:          10410013 - BBVA CONTINENTAL MN
Movimientos:     241
Total Débito:    S/31,924,867.03
Total Crédito:   S/44,959,554.03
SALDO NETO:      S/-13,034,687.00
Período:         31/12/2023 → 07/05/2026
```

## A.2. Primeros y últimos movimientos

**Primeros movimientos (2023-2024):**

| Fecha | Glosa | Db | Cr |
|---|---|---:|---:|
| 31/12/2023 | CAPITAL SOCIAL 90% | 900 | 0 |
| 31/12/2023 | Asiento de Cierre | 0 | 1,000 |
| 31/12/2023 | CAPITAL SOCIAL 10% | 100 | 0 |
| 01/01/2024 | Asiento de Apertura | 1,000 | 0 |
| 31/12/2024 | Asiento de Cierre | 0 | 915 |

**Últimos movimientos (2026):**

| Fecha | Glosa | Db | Cr |
|---|---|---:|---:|
| 28/01/2026 | Transferencia a Cuenta Bancaria | 3,000 | 0 |
| 03/02/2026 | Transferencia a Cuenta Bancaria | 1,000 | 0 |
| 12/02/2026 | Transferencia a Cuenta Bancaria | 2,500 | 0 |
| 08/04/2026 | 08/04 PAGO A PROVEEDOR | 0 | 420 |
| 07/05/2026 | 07/05 PAGO DETRACCIÓN | 0 | 473 |

## A.3. Análisis

La cuenta inició en 2023 con apenas S/1,000 (capital social). Durante 2024-2026 acumuló **S/44.9M en pagos (créditos)** vs solo **S/31.9M en depósitos (débitos)** → saldo negativo de S/13M.

**Hipótesis:** AMERICANA opera como vehículo de paso del grupo. Recibe cobranzas (clase 12) registradas como CxC pero los fondos se redirigen sin reflejarse como depósito en este banco.

## A.4. Acción correctiva

Pedir al banco BBVA estado de cuenta al **01/01/2026** y al **30/04/2026**. Comparar saldo bancario real vs saldo contable −S/13M.

Si banco confirma saldo positivo → cargar asiento de apertura correctivo. Si banco confirma saldo negativo (sobregiro) → reclasificar a cuenta **4511 — Sobregiros bancarios** (pasivo).

\newpage

# ANEXO B — INTEGRAL: 8 facturas emitidas SIN asiento contable

## B.1. Listado completo

| # | Fecha | Serie-Número | Cliente | Observación | Total |
|---|---|---|---|---|---:|
| 1 | 04/03/2026 | -0000000030 | **CMO GROUP S.A.** | INGRESOS DE CMO SEGÚN EECC | **95,948** |
| 2 | 15/04/2026 | E001-00000336 | CMO GROUP S.A. | REEMBOLSO E001-216: ESTUDIOS | 23,600 |
| 3 | 01/04/2026 | -0000000031 | DCC CONSULTORES S.A.C. | ABONO Y EXTORNO CMO - DCC | 11,800 |
| 4 | 06/02/2026 | -0000000028 | L & H CONSTRUCTORES | ABONO Y EXTORNO CMO - L&H | 10,000 |
| 5 | 30/01/2026 | -0000000026 | CMO GROUP S.A. | ABONO Y EXTORNO CMO - L&H | 10,000 |
| 6 | 02/02/2026 | -0000000029 | VINATEA Y TOYAMA ABOG. | ABONO PODE DEVOLUCION VINATEA | 1,817 |
| 7 | 26/02/2026 | -0000000027 | CMO GROUP S.A. | ABONO POR EXCESO DE REMUNERACIÓN | 119 |
| 8 | 15/01/2026 | E001-00000011 | CONSORCIO SALUD HUANCA SANCOS II | VARIACIÓN DE FECHA DE PAGO | 0 |
| | | | **TOTAL** | | **S/153,284** |

## B.2. Conciliación mensual ingresos contables vs documentos emitidos

| Mes | Ingresos Contables | Documentos Emitidos | **Diferencia** | Estado |
|---|---:|---:|---:|---|
| Enero | 751,975 | 1,099,314 | **−347,338** | Facturó más que registró |
| Febrero | 861,975 | 1,231,050 | **−369,074** | idem |
| **Marzo** | 1,066,975 | 2,146,962 | **−1,079,986** | **Diferencia masiva** |
| Abril | 0 | 35,400 | −35,400 | Sin ingresos contables |
| Mayo (parcial) | 0 | 0 | 0 | — |
| **YTD** | **2,680,925** | **4,512,725** | **−1,831,800** | |

> **S/1,831,800 de facturas emitidas no se reflejan en ingresos contables.** Marzo solo: S/1.08M.

## B.3. Interpretación

Probables causas:
1. Anticipos recibidos reconocidos en cuenta 1213 (correcto NIIF 15)
2. Facturas por servicios pendientes de prestar (correcto NIIF 15)
3. Notas de crédito pendientes de aplicación
4. **Subdeclaración de ingresos** ❌ (riesgo SUNAT)

## B.4. Acción correctiva específica

Para la factura #1 (FT -0000000030 a CMO por S/95,948):

```
INTEGRAL — Asiento contable propuesto
Fecha: 04/03/2026
─────────────────────────────────────────────────
Db. 1212 — Facturas Emitidas en Cartera MN — CMO    95,948.00
   Cr. 7041 — Ingresos por servicios prestados        81,313.00
   Cr. 4011 — IGV por pagar (18%)                     14,635.00

Glosa: FT -0000000030 INGRESOS DE CMO SEGÚN EECC
```

\newpage

# ANEXO C — AMERICANA: CxC vencida 97.9% > 90 días

## C.1. Composición de la CxC

| Cliente | RUC | Saldo Total | 0-30 días | >90 días | Acción NIIF 9 |
|---|---|---:|---:|---:|---|
| **CONSULTORIA & CONSTRUCCION GRUPO PERGOLA S.A.C.** | — | **3,002,719** | 0 | **3,002,719 (100%)** | **🔴 Provisionar 100%** |
| CONSORCIO ROLOPOM CORPORIS II | — | 65,632 | 62,945 | 2,687 | OK |
| **TOTAL** | | **3,068,350** | 62,945 | **3,005,406** | |

## C.2. Asiento contable de provisión NIIF 9

```
AMERICANA — Provisión por Deterioro CxC (NIIF 9)
Fecha: 31/05/2026 (cierre del mes)
─────────────────────────────────────────────────
Db. 6841 — Pérdida por deterioro CxC             3,002,719.00
   Cr. 1911 — Estimación de cobranza dudosa CxC      3,002,719.00

Glosa: Provisión 100% NIIF 9 — CONSULTORIA & CONSTRUCCION
GRUPO PERGOLA S.A.C. — Saldo >90 días por S/3,002,718.75
NroD: PROV-NIIF9-AMER-2026-001
```

**Impacto en P&L AMERICANA:** utilidad neta YTD pasaría de −S/224K a **−S/3,226,000**.

## C.3. Deducibilidad tributaria

Para que la provisión sea deducible (Art. 37 LIR), se requiere demostrar:
- Gestión de cobranza documentada (cartas notariales, demanda judicial)
- O probar que el deudor está en estado de incobrabilidad

**Recomendación:** iniciar acción judicial de cobro contra Grupo PERGOLA. Si no se inicia, será una **diferencia temporaria (NIC 12)** que genera activo por impuesto diferido.

\newpage

# ANEXO D — INTEGRAL: 1 pago sin asignación documental

## D.1. Detalle único

| Fecha | Doc | Beneficiario | Monto | Glosa |
|---|---|---|---:|---|
| 05/03/2026 | 00003245 | L. CASTRO | S/1,200 | 05/03 PAGO A PROVEEDORES - L CASTRO |

## D.2. Estado de trazabilidad pago-documento del grupo

| Empresa | Pagos 2026 | Con Asignación | **Sin Asignación** | % Cobertura |
|---|---:|---:|---:|---:|
| **MEDARQ** | 201 | 201 | 0 | **100%** ✅ |
| **AMERICANA** | 91 | 90 | 1 | **99%** ✅ |
| **INTEGRAL** | 586 | 583 | 3 | **99.5%** ✅ |
| **CMO GROUP** | 0 | 0 | 0 | N/A |

> **La trazabilidad pago↔documento es excelente. Solo 1 pago material requiere asignación retroactiva.**

\newpage

# ANEXO E — AMERICANA: 6 honorarios SIN asiento contable

## E.1. Listado completo

| # | Fecha | Serie-Número | Profesional | Total | Retención 8% si > S/2,000 |
|:-:|---|---|---|---:|---:|
| 1 | 18/03/2026 | E001-0000000066 | PEÑA FLORES, MIGUEL ANGEL | 4,524.60 | 361.97 |
| 2 | 12/02/2026 | E001-0000000061 | PEÑA FLORES, MIGUEL ANGEL | 3,496.80 | 279.74 |
| 3 | 16/02/2026 | E001-0000000062 | PEÑA FLORES, MIGUEL ANGEL | 2,622.60 | 209.81 |
| 4 | 30/04/2026 | E001-0000000004 | GALINDO CABRERA JHOLYESER | 2,450.00 | 196.00 |
| 5 | 18/03/2026 | E001-0000000045 | VELARDE ARELLANO, GIANCARLO | 2,000.00 | — (umbral) |
| 6 | 24/02/2026 | E001-0000000043 | VELARDE ARELLANO, GIANCARLO | 2,000.00 | — (umbral) |
| | | | **TOTAL** | **17,094.00** | **1,047.52** |

## E.2. Asiento correctivo

```
AMERICANA — Contabilización Honorarios Q1-2026
Fecha: 30/04/2026 (asiento de corrección agrupado)
───────────────────────────────────────────────────────────
Db. 6314 — Honorarios profesionales              17,094.00
   Cr. 4017 — Renta 4ta cat. por pagar (8%)         1,047.52
   Cr. 4212 — Honorarios por pagar               16,046.48

Glosa: Contabilización honorarios Q1-2026 + retenciones
NroD: AJU-AMER-HON-Q1-2026
```

## E.3. Riesgo tributario

- Si retenciones NO fueron pagadas a SUNAT:
  - **Multa por no retener (Art. 177 num. 13 CT):** ~S/684
  - **Multa por no declarar PDT-PLAME:** hasta 1 UIT = S/5,290 (rebajable 90%)
  - **Pérdida de deducción del gasto:** S/17,094 × 29.5% = **S/5,043**

\newpage

# ANEXO F — MEDARQ: 10 asientos de INGRESO clase 70 sin factura

## F.1. Listado completo

| # | Fecha | NroAsiento | Cuenta | Glosa | Monto | Naturaleza |
|:-:|---|---|---|---|---:|---|
| 1 | 02/03/2026 | A2EDB7FE-C | 70410111 | EXTORNO SERVICIO DE BACK OFFICE FEB 26 | 100,000 | EXTORNO |
| 2 | 28/02/2026 | D47DF05C-0 | 70410111 | SERVICIO DE BACK OFFICE FEB 26 | 100,000 | PROVISIÓN |
| 3 | 31/03/2026 | 779CD2D0-E | 70410108 | INGRESOS POR SERVICIOS MAR 26 (FT E001-24-ADELANTO) | 25,000 | PROVISIÓN |
| 4 | 27/02/2026 | 70031011-D | 70410108 | EXTORNO DE PROVISIÓN DIC-ENE GESTIÓN ACTIVA | 25,000 | EXTORNO |
| 5 | 30/04/2026 | A4838D80-3 | 70410108 | INGRESOS POR SERVICIOS ABR 26 (FT E001-24-ADELANTO) | 25,000 | PROVISIÓN |
| 6 | 27/02/2026 | 56F0195F-A | 70410108 | EXTORNO DE PROVISIÓN DIC-ENE GESTIÓN ACTIVA | 25,000 | EXTORNO |
| 7 | 31/01/2026 | CE1A4CBA-9 | 70410108 | SERVICIO DE GESTIÓN ACTIVA ENE 26 | 25,000 | PROVISIÓN |
| 8 | 31/01/2026 | 0F3F1A69-1 | 70410111 | SERVICIO DE BACK OFFICE DIC 25 | 25,000 | PROVISIÓN |
| 9 | 31/01/2026 | A8BC9BD5-E | 70410111 | SERVICIO DE BACK OFFICE ENE 26 | 25,000 | PROVISIÓN |
| 10 | 03/02/2026 | EB995743-D | 70410111 | EXTORNO DE PROVISIÓN BACK OFFICE ENE 26 | 25,000 | EXTORNO |

## F.2. Interpretación

Los 10 asientos NO son "ingresos sin factura" en sentido estricto. Son **provisiones de ingreso por devengo (NIIF 15)** y sus **extornos** posteriores al recibir la factura real.

| Patrón | Significado | Validez |
|---|---|:-:|
| PROVISIÓN | Reconocimiento de ingreso devengado | ✅ Correcto NIIF 15 |
| EXTORNO | Reversión cuando llega la factura | ✅ Correcto |

## F.3. Acción

Documentar formalmente las provisiones mensuales:
1. Excel + Acta de Provisión firmada por Gerente Financiero
2. Asignar NroD interno "PROV-2026-MM" a cada asiento
3. Mantener el mismo NroD al extornar para trazabilidad

\newpage

# ANEXO G — AMERICANA: 27 movimientos bancarios sin documento

## G.1. Composición real (recalibrada)

De los S/35,757,240 reportados como "sin documento":

| Categoría | Monto | % | Es problema? |
|---|---:|---:|:-:|
| **Asientos de Apertura** | S/34,054,447 | **95.2%** | ✅ NO — legítimos por implementación S10 |
| **Diferencias de cambio** | ~S/900,000 | 2.5% | ⚠️ SÍ — deberían ir contra 776/676 |
| **Transferencias internas** | ~S/800,000 | 2.2% | 🟡 Aceptable si tienen voucher interno |
| **Otros** | ~S/71 | <0.1% | OK |

## G.2. Asiento correctivo para diferencias de cambio

```
AMERICANA — Reclasificación Diferencia de Cambio
Fecha: 31/03/2026 (ejemplo de un asiento)
───────────────────────────────────────────────────
Db. 10410014 — BBVA Continental ME          837,661.00  (revierte cargo original)
   Cr. 776 — Ganancia por dif. de cambio        837,661.00

Glosa: Reclasificación de DC del 31/03 a cuenta de resultados
NroD: AJU-2026-AMER-DC-001
```

\newpage

# ANEXO H — Top 25 descuadres operativos del grupo

| # | Empresa | Fecha | NroD | Líneas | Tercero | Glosa | **Descuadre S/** |
|:-:|---|---|---|:-:|---|---|---:|
| 1 | **INTEGRAL** | 01/01/2026 | 33A82C31-4 | 4 | CONSORCIO STILER - RIPCONCIV | SERVICIO DE ACOMPAÑAMIENTO | **3,647,206** |
| 2 | INTEGRAL | 01/01/2026 | 88BEB2E5-D | 19 | CONSORCIO HEALTH BERNALES | Transferencia | 792,960 |
| 3 | INTEGRAL | 12/01/2026 | 1188215E-D | 21 | CONSORCIO STILER | Transferencia | 729,441 |
| 4 | CMO GROUP | 11/03/2026 | CCB79D62-3 | 3 | INTEGRAL CONSULTORES | 11/03 PRÉSTAMO DE IC A CMO | 321,927 |
| 5 | INTEGRAL | 01/01/2026 | 18798EA4-A | 15 | CONSORCIO SALUD HUANCA SANCOS | SERVICIO DE GERENCIAMIENTO | 216,075 |
| 6 | CMO GROUP | 05/03/2026 | 66938E52-9 | 17 | VARIOS | PNDTE CLIENTE - INGRESO CMO | 211,554 |
| 7 | INTEGRAL | 01/01/2026 | 32DF4A1E-E | 14 | CONSORCIO SAN MIGUEL | Transferencia | 187,761 |
| 8 | INTEGRAL | 01/01/2026 | 049F5FAF-B | 14 | INMAC PERU S.A.C. | Transferencia | 183,655 |
| 9 | INTEGRAL | 01/01/2026 | ABAD427C-2 | 7 | CONSORCIO HEALTH BERNALES | Transferencia | 166,991 |
| 10 | INTEGRAL | 30/01/2026 | B0006469-6 | 6 | BANCO CONTINENTAL | **PLANILLA EMPLEADOS** | 155,832 |
| 11 | INTEGRAL | 26/02/2026 | 43E07800-2 | 6 | BANCO CONTINENTAL | PLANILLA EMPLEADOS | 155,386 |
| 12 | INTEGRAL | 23/03/2026 | C8777E10-1 | 8 | BANCO CONTINENTAL | PLANILLA EMPLEADOS | 154,223 |
| 13 | INTEGRAL | 29/04/2026 | 33B049BF-0 | 6 | BANCO CONTINENTAL | PLANILLA EMPLEADOS | 141,193 |
| 14 | INTEGRAL | 01/01/2026 | 96AFAB62-4 | 31 | CONEXIG, LLC | SERVICIO TECNICA - SAN MIGUEL | 125,495 |
| 15 | CMO GROUP | 30/03/2026 | 3E7C30D5-6 | 20 | INTEGRAL CONSULTORES | 30/03 PRÉSTAMO IC A CMO | 119,450 |
| 16 | MEDARQ | 01/01/2026 | 17CD0E28-1 | 13 | CONSORCIO PROYECTA & ASOCIADOS | Transferencia | 118,000 |
| 17-19 | INTEGRAL | 01/01/2026 | varios | 13 | CHINA ROAD AND BRIDGE | Transferencia | 118,000 × 3 |
| 20-22 | CMO GROUP | 11/03/2026 | varios | 4 | SUNAT | **FORMULARIO 1663 - ITAN** | 107K-108K × 3 |
| 23-25 | MEDARQ | varias | varios | 3-5 | BANCO CONTINENTAL | PLANILLA EMPLEADOS | 106,335 × 3 |

## H.1. Patrones detectados

1. **PLANILLAS** (4 en INTEGRAL + 3 en MEDARQ): descuadre porque planilla = un NroD pero líneas no balanceadas internamente
2. **ITAN SUNAT** (3 en CMO): descuadres en pagos a SUNAT (IGV crédito fiscal + tributo + banco)
3. **Préstamos intercompañía** (INTEGRAL → CMO): descuadres confirman riesgo intercompañía
4. **CONSORCIOS** (HEALTH BERNALES, STILER, HUANCA SANCOS): 6 documentos con descuadres entre S/166K y S/3.6M

## H.2. Resumen

| Empresa | Total descuadres | Apertura | **Operativos** | Suma |
|---|---:|---:|---:|---:|
| **CMO GROUP** | 6,438 | 6,227 (97%) | **211** | S/393M |
| **INTEGRAL** | 1,313 | 696 (53%) | **617** ⚠️ | S/42M |
| **AMERICANA** | 323 | 194 (60%) | 129 | S/20.5M |
| **MEDARQ** | 350 | 103 (29%) | **247** ⚠️ | S/3.2M |

\newpage

# ANEXO I — INTEGRAL: Top 15 atípicos > S/100K

Concentración masiva en **CONSORCIO HEALTH BERNALES**:

| # | Fecha | Cuenta | Glosa | Tercero | Monto S/ |
|:-:|---|---|---|---|---:|
| 1 | 20/03/2026 | 12120001 | SERVICIO DE ASESORÍA INTEGRAL | CONSORCIO HEALTH BERNALES | 590,000 |
| 2 | 18/02/2026 | 12120001 | SERVICIO DE ASESORÍA INTEGRAL | CONSORCIO HEALTH BERNALES | 590,000 |
| 3 | 09/03/2026 | 12120001 | SERVICIO DE ASESORÍA INTEGRAL | CONSORCIO HEALTH BERNALES | 590,000 |
| 4 | 28/02/2026 | 10300012 | Transferencia a Cuenta | CONSORCIO HEALTH BERNALES | 519,200 |
| 5 | 28/02/2026 | 10300011 | SERVICIO DE ASESORÍA INTEGRAL | CONSORCIO HEALTH BERNALES | 519,200 |
| 6 | 27/03/2026 | 12120001 | Asignación de Cobro | CONSORCIO HEALTH BERNALES | 519,200 |
| 7-15 | varias | varias | Transferencias y asignaciones | CONSORCIO HEALTH BERNALES | 519,200 × 9 |

## I.1. Análisis

INTEGRAL prestó servicios al CONSORCIO HEALTH BERNALES por **~S/1.77M** (3 facturas de S/590K) y registró cobros por **~S/5.7M** (11 transferencias de S/519K).

**Posibles explicaciones:**
1. Servicios facturados ≠ cobranzas (INTEGRAL cobra anticipos antes de prestar el servicio)
2. CONSORCIO HEALTH BERNALES es proyecto multianual (cobranzas incluyen 2025)
3. Doble registro por error

## I.2. Acción

1. **Conciliar contractualmente** con CONSORCIO HEALTH BERNALES
2. **Circularización**: enviar carta solicitando confirmación de saldo al 31/05/2026
3. **Documentar el contrato** que sustenta los pagos recurrentes de S/590K

\newpage

# ANEXO J — CMO GROUP: Activo Fijo con saldos negativos

## J.1. Detalle por cuenta

| Cuenta | Descripción | Db Acum | Cr Acum | **Saldo** | Estado |
|---|---|---:|---:|---:|---|
| 33111000 | Terrenos al Costo | 188,412,162 | 188,412,162 | 0 | Compensado |
| **33211000** | **Edificios Adm — Costo** | **44,227,608** | **46,634,896** | **(2,407,287)** | 🚨 NEGATIVO |
| **33241000** | **Instalaciones — Costo** | **2,407,287** | **0** | **+2,407,287** | ⚠️ Compensación |
| 33311000 | Maquinaria y Eq Explotación | 709,014 | 709,014 | 0 | Compensado |
| 33411000 | Vehículos Motorizados | 48,253 | 48,253 | 0 | Compensado |
| 33511000 | Muebles | 6,586,520 | 6,586,520 | 0 | Compensado |
| 33611000 | Eq Procesamiento Información | 2,819,162 | 2,819,162 | 0 | Compensado |
| 33621000 | Eq Comunicación | 14,004 | 14,004 | 0 | Compensado |
| 33631000 | Eq Seguridad | 36,191 | 36,191 | 0 | Compensado |
| **33691000** | **Otros Equipos** | **1,500,758** | **1,663,166** | **(162,408)** | 🚨 NEGATIVO |

## J.2. Asiento correctivo

```
CMO GROUP — Reversión de reclasificación incorrecta
Fecha: 31/05/2026 (corrección)
───────────────────────────────────────────────────
Db. 33211000 — Edificios Adm.            2,407,287.25  (reversa saldo negativo)
   Cr. 33241000 — Instalaciones                2,407,287.25  (reversa cargo doble)

Glosa: Reversión de reclasificación incorrecta — restaurar
saldos originales antes de pasar reclasificación correcta
NroD: AJU-CMO-AF-001
```

\newpage

# ANEXO K — 36 beneficiarios sin cuenta bancaria registrada

## K.1. AMERICANA (5 beneficiarios)

| Beneficiario | RUC | # Pagos | Monto Total | Último |
|---|---|:-:|---:|---|
| COMPAÑÍA AMERICANA (sí misma) | 80688524 | 1 | 25,350 | 13/02/2026 |
| MEJORADA ABOGADOS SOC. CIVIL | 80688888 | 1 | 6,152 | 13/02/2026 |
| JME SOLUCIONES E.I.R.L. | 80689020 | 1 | 5,712 | 12/02/2026 |
| TREINTA ONCE AGENCIA DE VIAJES | 80688759 | 1 | 5,329 | 22/02/2026 |
| PEÑA FLORES, MIGUEL ANGEL | 80689043 | 1 | 4,525 | 20/04/2026 |

## K.2. INTEGRAL (18 beneficiarios — top 10)

| Beneficiario | RUC | # Pagos | Monto Total | Último |
|---|---|:-:|---:|---|
| **INTEGRAL CONSULTORES (sí mismo)** | 80688541 | **8** | **608,142** | 14/04/2026 |
| CORNEJO DAVILA, VANINNA JUISA | 80688508 | 4 | 138,940 | 12/03/2026 |
| ALESSIA BOOKS S.A.C. | 80688736 | 4 | 95,906 | 01/04/2026 |
| MEDINA FLORES, JUAN CARLOS | 80688573 | 3 | 80,592 | 30/03/2026 |
| PANORAMICA TECHNOLOGY S.A.C. | 80688761 | 1 | 78,736 | 30/01/2026 |
| SCOTIABANK PERU S.A.A. | 22001355 | 1 | 46,185 | 30/01/2026 |
| CONEXIG, LLC | 80688774 | 1 | 37,250 | 06/02/2026 |
| IMAX INT'L S.A.C. | 22001793 | 1 | 13,135 | 30/03/2026 |
| DIAZ GALVEZ Y ASOC. CONTADORES | 80688812 | 2 | 12,690 | 30/04/2026 |
| PALOMINO ZARATE, RAQUEL | 80688947 | 1 | 10,000 | 20/04/2026 |

## K.3. MEDARQ (13 beneficiarios — top 7)

| Beneficiario | RUC | # Pagos | Monto Total | Último |
|---|---|:-:|---:|---|
| **ICYS S.A.C.** | 80688783 | 4 | 212,405 | 06/03/2026 |
| MALAGA GUZMAN, FELIX EDUARDO | 80688974 | 2 | 91,274 | 14/03/2026 |
| ROSSEL SEMINARIO LUCIA ROXANA | 80689031 | 1 | 35,400 | 06/03/2026 |
| MONTERO MORENO, LUIS WILFREDO | 80688752 | 1 | 25,029 | 14/03/2026 |
| ALVARADO LOZANO, ARNALDO | 80688751 | 1 | 25,029 | 14/03/2026 |
| CONSORCIO SALUD SANTA CRUZ | 80688995 | 1 | 24,405 | 09/02/2026 |
| A & M INGENIERIA Y SERVICIOS | 80689027 | 4 | 20,768 | 06/02/2026 |

## K.4. Implicación

Los pagos están **bancarizados** (transferencias = OK Ley 28194), pero el sistema NO tiene registrada la cuenta bancaria del beneficiario:

- Riesgo de duplicación de pagos
- Riesgo de fraude por cambio de cuenta de proveedor
- Limitación para validar transferencias en auditoría externa

**Recomendación:** dar de alta las 36 cuentas en `IdentificadorCuentaBanco` antes del próximo pago.

\newpage

# ANEXO L — CMO: Top 30 pagos con MedioDePago=4 (NO son efectivo)

## L.1. Aclaración importante

> **IMPORTANTE:** Estos 30 pagos eran inicialmente clasificados como "efectivo" (riesgo Ley 28194). Al revisar las glosas, se confirmó que **son aplicaciones de Notas de Crédito (compensaciones contables)**, NO pagos en dinero. Por lo tanto **NO violan Ley 28194**.

## L.2. Top 30 históricos

| # | Fecha | Doc | Monto S/ | Beneficiario | Glosa (extracto) |
|:-:|---|---|---:|---|---|
| 1 | 28/10/2020 | 9273 | 2,556,429 | DESCA PERU S.A.C. | APLICACION NC E001-27 CONTRA E001-117 |
| 2 | 26/08/2019 | 6194 | 867,543 | CODECON INGENIERIA | COMPENSACION F0381 CON N.C 12 |
| 3 | 30/11/2019 | 7048 | 582,685 | P & V INGENIEROS | APLICACION NC-001-19/ 001-114 |
| 4 | 31/01/2020 | 7727 | 435,007 | BROTENI S.A.C. | APLICACION NC 001-27 // E001 046 |
| 5 | 26/10/2021 | 11189 | 357,480 | MAVEGSA DRYWALL | APLICACION NC DE MAVEGSA |
| 6 | 30/06/2021 | 10873 | 342,728 | DESCA PERU | APLIC NC 28/ FT 112 DESCA |
| 7 | 05/05/2021 | 10490 | 341,722 | LA POSITIVA SEGUROS | APLICACION NC F038-12114 |
| 8 | 26/10/2021 | 11180 | 278,231 | SAEG PERU | APLICACION NC 79 |
| 9 | 01/04/2017 | 591 | 256,742 | MANT.CONST.PROYECTOS | APLICACION NC MANTTO |
| 10 | 31/10/2022 | 11428 | 209,159 | GLOBAL FACTORING | APLICACION NC GLOBAL FACTORING |
| ... | ... | ... | ... | ... | (20 más, todos con patrón APLICACION NC) |
| | | **TOTAL 57** | **S/8,217,819** | | |

## L.3. Marco legal

Las **compensaciones de obligaciones** están reguladas por el **Art. 1288 Código Civil**: "Por la compensación se extinguen las obligaciones recíprocas, líquidas, exigibles y de prestaciones fungibles y homogéneas..."

NO requieren bancarización porque **no son pago en dinero** — son **extinciones simultáneas de derechos**.

\newpage

# ANEXO M — Trabajadores pagados 2026 (top por empresa)

## M.1. INTEGRAL — Top 10

| Trabajador | RUC | # Pagos | Total |
|---|---|:-:|---:|
| GOMERO ROJAS, GUILLERMO ALBERTO | 22012320 | 12 | **S/108,689** |
| MEDINA FLORES, JUAN CARLOS | 80688573 | 3 | S/80,592 |
| CCORISAPRA MUÑOZ, ALEXNIEL | 22021112 | 2 | S/41,200 |
| BALAREZO ELIAS DE TIRADO, ANA G. | 22019621 | 10 | S/37,053 |
| MEDINA AIQUIPA, DAVID BERNABE | 22018389 | 1 | S/20,600 |
| TALLEDO GILVONIO MANUEL OMAR | 22020157 | 5 | S/12,590 |
| VELASQUEZ URREGO, JUAN CARLOS | 22020619 | 9 | S/12,520 |
| SANCHEZ BUTRON, EDWIN ALONSO | 80688865 | 2 | S/10,000 |
| PALOMINO ZARATE, RAQUEL | 80688947 | 1 | S/10,000 |
| MONTOYA ALVAREZ, RAFAEL Y. | 80688908 | 3 | S/9,912 |

## M.2. AMERICANA — Solo 4 personas naturales

| Trabajador | # Pagos | Total |
|---|:-:|---:|
| TALLEDO GILVONIO MANUEL OMAR | 3 | S/5,381 |
| VELARDE ARELLANO, GIANCARLO | 2 | S/4,000 |
| CASTRO BARRA, WILDER | 1 | S/3,000 |
| DEL POZO VALDEZ, JULIO ANTONIO | 1 | S/1,400 |

## M.3. Resumen del grupo

| Empresa | # Trabajadores | # Pagos | Total Pagado |
|---|:-:|:-:|---:|
| INTEGRAL | 19 | 64 | S/378,877 |
| MEDARQ | 16 | 27 | S/275,086 |
| AMERICANA | 4 | 7 | S/13,781 |
| CMO GROUP | **0** | **0** | **S/0** ⚠️ |

> **CMO GROUP — 0 pagos a personas naturales en 2026.** Anomalía a investigar (¿la planilla se paga vía las subsidiarias?).

\newpage

# ANEXO N — Cumplimiento CTS (DL 650) por empresa

## N.1. Plazos legales

- **CTS Primer Semestre:** depósito hasta el **15 de MAYO** de cada año
- **CTS Segundo Semestre:** depósito hasta el **15 de NOVIEMBRE** de cada año

## N.2. CMO GROUP S.A.

| Período | Monto | Clasificación |
|---|---:|---|
| 2025-05 | S/26,466 | ✅ **En plazo** |
| 2025-11 | S/55,309 | ✅ **En plazo** |
| 2025-12 | S/1,096,355 | (asiento de cierre, no depósito real) |

**Veredicto:** ✅ **Cumple plazos legales** en 2025.

## N.3. INTEGRAL CONSULTORES

| Período | Monto | Clasificación |
|---|---:|---|
| 2025-05 | S/53,571 | ✅ **En plazo** |
| 2025-11 | S/106,069 | ✅ **En plazo** |
| 2025-12 | S/46,298 | ⚠️ Fuera de plazo (probable ajuste) |

**Veredicto:** ✅ **Cumple plazos legales** en 2025.

## N.4. AMERICANA CONSTRUCCIÓN

| Período | Monto | Clasificación |
|---|---:|---|
| **2025-05** | **AUSENTE** | 🔴 **POSIBLE VIOLACIÓN** |
| 2025-11 | S/59,674 | ✅ En plazo |
| 2025-12 | S/12,145 | ⚠️ Fuera de plazo |

**Veredicto:** 🔴 **No hay registro de depósito CTS mayo 2025.** Posible multa SUNAFIL hasta S/275,080.

## N.5. MEDARQ S.A.C.

| Período | Monto | Clasificación |
|---|---:|---|
| **2025-05** | **AUSENTE** | 🔴 **POSIBLE VIOLACIÓN** |
| 2025-11 | S/19,374 | ✅ En plazo |
| 2025-12 | S/3,836 | ⚠️ Fuera de plazo |

**Veredicto:** 🔴 **No hay registro de depósito CTS mayo 2025.** Posible multa SUNAFIL hasta S/275,080.

\newpage

# ANEXO O — Propuesta de 14 asientos correctivos

## O.1. Resumen

| # | Empresa | Asiento | Monto | Plazo |
|:-:|---|---|---:|---|
| AC-01 | MEDARQ | Apertura bancaria BBVA ME | ~S/100K* | Inmediato |
| AC-02 | MEDARQ | Apertura Banco Nación Detracciones | ~S/40K* | Inmediato |
| AC-03 | AMERICANA | Apertura BBVA MN real | ~S/15M* | Inmediato |
| AC-04 | AMERICANA | Reclasif. diferencias de cambio | S/900K | 7 días |
| AC-05 | AMERICANA | Provisión NIIF 9 PERGOLA | S/3,002,719 | 15 días |
| AC-06 | INTEGRAL | Provisión NIIF 9 CxC >90 días | S/943,128 | 15 días |
| AC-07 | MEDARQ | Provisión NIIF 9 CxC >90 días | S/450,159 | 15 días |
| AC-08 | INTEGRAL | Contabilización FT-30 / CMO | S/95,948 | 7 días |
| AC-09 | AMERICANA | 6 honorarios + retenciones 4ta | S/17,094 | 7 días |
| AC-10 | TODAS | Depreciación acumulada retroactiva | ~S/140K | 30 días |
| AC-11 | CMO GROUP | Corrección Edificios → Instalaciones | S/2,407,287 | 30 días |
| AC-12 | TODAS | Constitución Reserva Legal | varía | 60 días |
| AC-13 | CMO GROUP | Intereses intercompañía TAMN 12% | ~S/2M | 30 días |
| AC-14 | CMO GROUP | **Apertura 2026 Capital Social** | **S/78,301,308** | Inmediato |

*Pendiente de validación contra estado de cuenta del banco

## O.2. AC-14 — Asiento crítico (apertura CMO faltante)

```
CMO GROUP — Asiento de Apertura del Capital Social 2026
Fecha: 01/01/2026 (retroactivo)
───────────────────────────────────────────────────────────────
Cr. 50110100 — Acciones                          78,301,308.00

(con la contrapartida correspondiente al cierre 2025 — verificar
asientos de cierre que no se "abrieron" en 2026)

Glosa: Asiento de Apertura — Capital Social al 01/01/2026
NroD: OPEN-2026-CMO-CAP
```

## O.3. Cronograma de ejecución

```
Semana 1-2  | AC-01, AC-02, AC-03 (aperturas bancarias) + AC-14 (apertura CMO)
Semana 1    | AC-08 (FT-30 INTEGRAL), AC-09 (honorarios AMERICANA)
Semana 2-3  | AC-04 (diferencias de cambio AMERICANA)
Semana 2-3  | AC-05, AC-06, AC-07 (provisiones NIIF 9)
Semana 4-5  | AC-10 (depreciación retroactiva)
Semana 4-5  | AC-11 (reclasificación CMO Edificios)
Semana 6-8  | AC-12 (Reserva Legal — requiere acta JGA)
Semana 6-8  | AC-13 (intereses intercompañía)
```

\newpage

# ANEXO P — Cuestionario integral para Gerencia

## P.1. Sobre operación general

1. ¿Quién es el responsable financiero/contable principal de cada empresa?
2. ¿Existe un Comité de Auditoría o función de Auditoría Interna?
3. ¿Cuándo fue la última auditoría externa independiente?
4. ¿Cuál es el cronograma formal de cierre mensual?

## P.2. Sobre S10 y procesos

5. ¿Por qué CMO GROUP no tiene pagos OB_Pago en 2026 (siendo el tesorero)?
6. ¿Quién procesa la planilla y en qué sistema externo?
7. ¿Por qué se abandonó la conciliación bancaria en 2022 (CMO) y nunca se inició (AMERICANA/MEDARQ)?
8. ¿Cuándo se cargará el asiento de apertura 2026 de CMO (Capital S/78.3M)?
9. ¿Por qué hay 8,424 descuadres por NroD en el grupo? (mayoría son asientos de apertura legítimos)

## P.3. Sobre cumplimiento tributario

10. ¿Se ha presentado la DJ Anual del IR 2025?
11. ¿Hay procesos contenciosos tributarios abiertos?
12. ¿Existe Estudio Técnico de Precios de Transferencia para 2024 o 2025?
13. ¿Se ha calculado y declarado el ITAN 2026?
14. ¿Las cuentas de Renta 3ra de INTEGRAL (S/1.25M por pagar vs S/1.54M a favor) se compensaron al cierre 2025?

## P.4. Sobre operaciones intercompañía

15. ¿Existen contratos de mutuo firmados entre las empresas del grupo?
16. ¿Se cobran intereses entre las empresas del grupo?
17. ¿Se han presentado los Reportes Locales de PT?
18. ¿Cuál es el saldo neto intercompañía al cierre del último mes? (debería cuadrar entre las 4)

## P.5. Sobre cumplimiento laboral

19. ¿Las participaciones DL 892 del ejercicio 2025 INTEGRAL se pagaron antes del 30/04/2026?
20. ¿AMERICANA y MEDARQ depositaron CTS en MAYO 2025?
21. ¿Por qué MEDARQ tiene S/196K en sueldos pendientes? ¿Los empleados reciben sus sueldos puntualmente?
22. ¿Cuántos trabajadores totales tiene cada empresa al 30/04/2026?
23. ¿Existen demandas laborales abiertas?

## P.6. Sobre la CxC vencida

24. ¿Cuál es el status legal de la cobranza a CONSULTORÍA & CONSTRUCCIÓN GRUPO PERGOLA (S/3M en AMERICANA)?
25. ¿Se ha iniciado acción judicial o solo gestión administrativa?
26. ¿Existen otros clientes con saldos materiales >90 días sin gestión documentada?

## P.7. Sobre tesorería y conciliación

27. ¿Por qué AMERICANA tiene saldo bancario contable −S/13M en BBVA MN?
28. ¿Existe línea de sobregiro con BBVA?
29. ¿Por qué MEDARQ tiene cuentas de detracciones con saldo negativo?
30. ¿Quién es responsable de la conciliación bancaria mensual?
31. ¿Existe un libro físico/electrónico de conciliaciones firmadas?

## P.8. Sobre control interno

32. ¿Quién aprueba los pagos > S/100,000? ¿Existe doble firma?
33. ¿Existe segregación entre tesorería, contabilidad y autorización?
34. ¿Las claves de S10 se cambian periódicamente?
35. ¿Existe un Comité de Pagos formal?

---

**Equipo de Auditoría BizSmartHub**
11 de mayo de 2026
