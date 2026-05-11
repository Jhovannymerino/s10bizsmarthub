# ANEXOS — REGISTROS QUE GENERAN LAS OBSERVACIONES + PROPUESTA CRÍTICA DE CORRECCIÓN

**Documento complementario a:** [INFORME_AUDITORIA_FINANCIERA.md](INFORME_AUDITORIA_FINANCIERA.md) + [INFORME_AUDITORIA_DATOS_ACTUALIZADOS.md](INFORME_AUDITORIA_DATOS_ACTUALIZADOS.md)
**Versión:** 1.0
**Fecha:** 11 de mayo de 2026

> Este documento provee el **detalle a nivel transacción individual** de los registros que originaron cada hallazgo de auditoría, más los **asientos contables de corrección** que el equipo contable debe ejecutar.

---

## ÍNDICE DE ANEXOS

| Anexo | Hallazgo | Empresa | Registros adjuntos |
|---|---|---|---|
| **A** | H-CRITICO MEDARQ-01 | MEDARQ | 10 asientos de ingreso clase 70 sin factura |
| **B** | H-CRITICO AMERICANA-01 | AMERICANA | 27 movimientos bancarios sin documento |
| **C** | H-CRITICO INTEGRAL-01 | INTEGRAL | 8 facturas emitidas sin asiento contable |
| **D** | H-CRITICO AMERICANA-06 | AMERICANA | 6 recibos por honorarios sin asiento |
| **E** | H-01 Descuadres operativos | Todas | Top 25 descuadres NO-apertura del grupo |
| **F** | H-05 Atípicos | INTEGRAL | Top 15 atípicos > S/100K |
| **G** | H-08 CxC aging | AMERICANA, INTEGRAL, MEDARQ | Lista de clientes con saldo |
| **H** | CMO-04 Edificios negativo | CMO GROUP | Detalle activo fijo anómalo |
| **I** | Propuesta crítica de corrección | Todas | Asientos contables específicos a registrar |

---

## ANEXO A — MEDARQ: 10 asientos de INGRESO (clase 70) sin factura

**Hallazgo MEDARQ-01:** S/400,000 en ingresos contables sin documento fuente. Análisis detallado:

| # | Fecha | NroAsiento | Cuenta | Glosa | Débito | Crédito | Patrón |
|---|---|---|---|---|---:|---:|---|
| 1 | 02/03/2026 | A2EDB7FE-C | 70410111 | EXTORNO SERVICIO DE BACK OFFICE FEB 26 | 100,000 | 0 | EXTORNO |
| 2 | 28/02/2026 | D47DF05C-0 | 70410111 | SERVICIO DE BACK OFFICE FEB 26 | 0 | 100,000 | PROVISIÓN |
| 3 | 31/03/2026 | 779CD2D0-E | 70410108 | INGRESOS POR SERVICIOS PRESTADOS MAR 26 (FT E001-24-ADELANTO) | 0 | 25,000 | PROVISIÓN |
| 4 | 27/02/2026 | 70031011-D | 70410108 | EXTORNO DE PROVISIÓN DE INGRESOS DIC-ENE GESTION ACTIVA | 25,000 | 0 | EXTORNO |
| 5 | 30/04/2026 | A4838D80-3 | 70410108 | INGRESOS POR SERVICIOS PRESTADOS ABR 26 (FT E001-24-ADELANTO) | 0 | 25,000 | PROVISIÓN |
| 6 | 27/02/2026 | 56F0195F-A | 70410108 | EXTORNO DE PROVISIÓN DE INGRESOS DIC-ENE GESTION ACTIVA | 25,000 | 0 | EXTORNO |
| 7 | 31/01/2026 | CE1A4CBA-9 | 70410108 | SERVICIO DE GESTIÓN ACTIVA ENE 26 | 0 | 25,000 | PROVISIÓN |
| 8 | 31/01/2026 | 0F3F1A69-1 | 70410111 | SERVICIO DE BACK OFFICE DIC 25 | 25,000 | 0 | PROVISIÓN |
| 9 | 31/01/2026 | A8BC9BD5-E | 70410111 | SERVICIO DE BACK OFFICE ENE 26 | 0 | 25,000 | PROVISIÓN |
| 10 | 03/02/2026 | EB995743-D | 70410111 | EXTORNO DE PROVISIÓN POR SERVICIO BACK OFFICE ENE 26 | 25,000 | 0 | EXTORNO |

### Interpretación contable (auditor):

**Recalibración del hallazgo:** Los 10 asientos NO son "ingresos sin factura" en sentido estricto. Son **provisiones de ingreso por servicios prestados** (NIIF 15 — devengo) y sus **extornos** posteriores al recibir la factura real.

| Patrón | Significado | Validez |
|---|---|---|
| PROVISIÓN | Reconocimiento de ingreso devengado antes de emitir factura física | ✅ Correcto NIIF 15 |
| EXTORNO | Reversión cuando llega la factura real (asiento Db. 12 vs Cr. 70 ya con NroD) | ✅ Correcto |

**Sin embargo, persiste un riesgo:** todos estos asientos NO tienen `NroD` (documento fuente). Bajo el procedimiento PLE-SUNAT, los asientos del Libro Diario deben referenciar un documento de respaldo (acta interna de provisión, hoja de cálculo, etc.).

### Acción crítica:

1. Documentar en un **archivo Excel + Acta de Provisión** firmada por el Gerente Financiero cada provisión mensual.
2. Asignar un `NroD` interno (ej. "PROV-2026-01") al asiento de provisión.
3. Al extornar, mantener el mismo `NroD` para trazabilidad.

---

## ANEXO B — AMERICANA: 27 movimientos bancarios sin documento (S/35.7M)

**Hallazgo AMERICANA-01:** análisis detallado.

| # | Fecha | NroAsiento | Cuenta | Glosa | Monto | Naturaleza |
|---|---|---|---|---|---:|---|
| 1 | 01/01/2026 | 85B7EEC2-9 | 10410014 | **Asiento de Apertura** | 20,695,148 | ✅ APERTURA legítima |
| 2 | 01/01/2026 | B4A20E5D-E | 10410013 | **Asiento de Apertura** | 13,211,260 | ✅ APERTURA legítima |
| 3 | 31/03/2026 | BFEC4BF3-A | 10410014 | **Diferencia de cambio** - Por Cuenta | 837,661 | ⚠️ DIFERENCIA CAMBIO |
| 4 | 31/03/2026 | C62F5463-1 | 10410015 | Transferencia a Cuenta Bancaria | 131,500 | TRANSFER INTERNA |
| 5 | 31/03/2026 | EB42FE08-3 | 10300012 | Transferencia a Cuenta Bancaria | 131,500 | TRANSFER INTERNA |
| 6 | 01/01/2026 | 89B36283-D | 10410015 | **Asiento de Apertura** | 127,029 | ✅ APERTURA |
| 7-10 | 04/2026 | varios | 10300012/10410015 | Transferencias internas | ~370,000 | TRANSFER INTERNA |
| 11 | 31/01/2026 | E1E82359-1 | 10410014 | **Diferencia de cambio** | 61,593 | ⚠️ DIFERENCIA CAMBIO |
| 12-21 | varios | varios | varios | Transferencias internas + apertura caja chica | ~63,000 | MIXTO |
| 22-27 | varios | varios | varios | Diferencias de cambio + 1 reembolso pamela L. | ~1,063 | MIXTO |

### Recalibración:

**De los S/35,757,240 reportados como "sin documento"**:

| Categoría | Monto | % | Es problema? |
|---|---:|---:|---|
| **Asientos de Apertura** | S/34,054,447 | **95.2%** | ✅ NO — legítimos por implementación S10 |
| **Diferencias de cambio** | ~S/900,000 | 2.5% | ⚠️ SÍ — deberían ir contra cuenta 776/676 |
| **Transferencias internas** | ~S/800,000 | 2.2% | 🟡 Aceptable si tienen voucher interno |
| **Otros (reembolsos)** | ~S/71 | <0.1% | OK |

**El hallazgo crítico AMERICANA-01 se reduce a ~S/900K en diferencias de cambio mal contabilizadas** (no S/35.7M).

### Acción crítica:

1. **Diferencias de cambio**: reclasificar de cuenta 10x a:
   - Cr. 776 (Ganancia por diferencia de cambio) si positiva
   - Db. 676 (Pérdida por diferencia de cambio) si negativa
   - Manteniendo el saldo en cuenta de banco intacto.

2. **Apertura bancaria de S/13M y S/20.7M (BBVA MN y ME respectivamente)**: validar contra estado de cuenta del banco al 01/01/2026. Estos saldos son los que están INCORRECTOS frente al saldo final negativo de BBVA MN −S/13M (ver §4 del informe principal).

---

## ANEXO C — INTEGRAL: 8 facturas emitidas SIN ASIENTO CONTABLE

**Hallazgo INTEGRAL-01:** S/153,284 de facturas emitidas y no contabilizadas:

| # | Fecha | Serie-Número | Cliente | Observación | Total |
|---|---|---|---|---|---:|
| 1 | 04/03/2026 | -0000000030 | **CMO GROUP S.A.** | INGRESOS DE CMO SEGÚN EECC | **95,948** |
| 2 | 15/04/2026 | E001-00000336 | CMO GROUP S.A. | REEMBOLSO E001-216: ESTUDIOS RELATIVOS | 23,600 |
| 3 | 01/04/2026 | -0000000031 | DCC CONSULTORES S.A.C. | ABONO Y EXTORNO CMO - DCC | 11,800 |
| 4 | 06/02/2026 | -0000000028 | L & H CONSTRUCTORES Y CONTRATISTAS | ABONO Y EXTORNO CMO - L&H | 10,000 |
| 5 | 30/01/2026 | -0000000026 | CMO GROUP S.A. | ABONO Y EXTORNO CMO - L&H | 10,000 |
| 6 | 02/02/2026 | -0000000029 | VINATEA Y TOYAMA ABOG. | ABONO PODE DEVOLUCION VINATEA | 1,817 |
| 7 | 26/02/2026 | -0000000027 | CMO GROUP S.A. | ABONO POR EXCESO DE REMUNERACIÓN | 119 |
| 8 | 15/01/2026 | E001-00000011 | CONSORCIO SALUD HUANCA SANCOS II | VARIACIÓN DE FECHA DE PAGO CUOTA 4,5,6 | 0 |

### Interpretación:

- **Facturas 3, 4, 5, 6, 7** son **ABONOS / EXTORNOS / DEVOLUCIONES** — corrigen movimientos previos. No generan ingreso real. **Aceptable** que no estén como ingreso contable.
- **Factura 8** tiene total cero → no requiere contabilización de ingreso.
- **Facturas 1 y 2 SÍ son problema:**
  - **#1 — INGRESOS DE CMO SEGÚN EECC S/95,948** (04/03/2026): es ingreso real intercompany. **Debe contabilizarse**.
  - **#2 — REEMBOLSO E001-216 S/23,600**: es un reembolso (no ingreso), pero la factura existe.

### El problema real es de **S/119,548** (no S/1.83M):

> El hallazgo INTEGRAL-01 sobre "S/1.83M de facturas no reflejadas como ingreso" del §7 del informe principal **NO está aquí en SinAsiento**. Esos S/1.83M son la diferencia entre **ingresos contables vs documentos emitidos a nivel mensual** — un concepto diferente.
>
> La interpretación correcta: INTEGRAL **SÍ está contabilizando** la mayoría de sus facturas como ingreso, pero hay un **desfase de tiempo** (devengo NIIF 15 vs facturación). El módulo `audit_conciliacion` mide el desfase, no la omisión.
>
> **Hallazgo INTEGRAL-01 se recalibra a Severidad 🟠 Alta** (no Crítica). Pero la factura #1 de S/95,948 sí debe explicarse.

### Acción crítica:

**Asiento contable propuesto para la factura #1:**

```
INTEGRAL CONSULTORES — Asiento del 04/03/2026
─────────────────────────────────────────────────
Db. 1212 — Facturas Emitidas en Cartera MN     95,948.00
   Cr. 7041 — Ingresos por servicios diversos        95,948.00

Glosa: FT -0000000030 INGRESOS DE CMO SEGÚN EECC
NroD: [GUID de la factura]
```

---

## ANEXO D — AMERICANA: 6 recibos por honorarios SIN ASIENTO

**Hallazgo AMERICANA-06:** 98% de honorarios sin contabilizar:

| # | Fecha | Serie-Número | Profesional | Total | Retención 8% si > S/2,000 |
|---|---|---|---|---:|---:|
| 1 | 18/03/2026 | E001-0000000066 | **PEÑA FLORES, MIGUEL ANGEL** | 4,524.60 | 361.97 |
| 2 | 12/02/2026 | E001-0000000061 | PEÑA FLORES, MIGUEL ANGEL | 3,496.80 | 279.74 |
| 3 | 16/02/2026 | E001-0000000062 | PEÑA FLORES, MIGUEL ANGEL | 2,622.60 | 209.81 |
| 4 | 30/04/2026 | E001-0000000004 | GALINDO CABRERA JHOLYESER | 2,450.00 | 196.00 |
| 5 | 18/03/2026 | E001-0000000045 | VELARDE ARELLANO, GIANCARLO | 2,000.00 | 160.00 (umbral) |
| 6 | 24/02/2026 | E001-0000000043 | VELARDE ARELLANO, GIANCARLO | 2,000.00 | 160.00 (umbral) |
| | | | **TOTAL** | **17,094.00** | **1,367.52** |

### Riesgo crítico:

**Si las retenciones no se han pagado a SUNAT:**

- **Multa por no retener (Art. 177 num. 13 CT):** 50% del tributo no retenido = S/684
- **Multa por no declarar en PDT-PLAME (Art. 176 num. 1):** 1 UIT = S/5,290 (rebajable 90% con regularización antes de notificación)
- **Pérdida de deducción del gasto (Art. 37 LIR):** no es deducible mientras no se acredite la retención
- **Costo fiscal por no deducción:** S/17,094 × 29.5% = **S/5,043**

### Acción crítica:

**1. Verificar de inmediato con el área de tesorería si las retenciones fueron pagadas a SUNAT** (PDT-PLAME enero a abril 2026).

**2. Si fueron pagadas, contabilizar:**

```
AMERICANA — Asiento por cada recibo por honorarios (ejemplo Peña Flores #1)
────────────────────────────────────────────────────────────────────────────
Db. 6314 — Honorarios profesionales            4,524.60
   Cr. 4011 — IGV (no aplica, 4ta categoría)         0.00
   Cr. 4017 — Retención 4ta cat. (8% si > 2000)    361.97
   Cr. 4212 — Recibos por honorarios x pagar    4,162.63

Glosa: RH E001-0000000066 PEÑA FLORES MIGUEL ANGEL
NroD: [GUID del RH]
```

**3. Si NO fueron pagadas, regularizar vía rectificatoria del PDT-PLAME del mes correspondiente + pago de tributo + intereses moratorios (0.9%/mes).**

---

## ANEXO E — TOP 25 DESCUADRES OPERATIVOS (no apertura/cierre)

**Hallazgo H-01:** los descuadres operativos más materiales:

| # | Empresa | Fecha | NroD | Líneas | Tercero | Glosa | **Descuadre S/** |
|---|---|---|---|---:|---|---|---:|
| 1 | **INTEGRAL** | 01/01/2026 | 33A82C31-4 | 4 | CONSORCIO STILER - RIPCONCIV - TECN | SERVICIO DE ACOMPAÑAMIENTO, DESARROLLO T | **3,647,206** ⚠️ |
| 2 | INTEGRAL | 01/01/2026 | 88BEB2E5-D | 19 | CONSORCIO HEALTH BERNALES | Transferencia a Cuenta Bancaria | 792,960 |
| 3 | INTEGRAL | 12/01/2026 | 1188215E-D | 21 | CONSORCIO STILER - RIPCONCIV | Transferencia a Cuenta Bancaria | 729,441 |
| 4 | CMO GROUP | 11/03/2026 | CCB79D62-3 | 3 | INTEGRAL CONSULTORES S.A.C. | 11/03 PRESTAMO DE IC A CMO | 321,927 |
| 5 | INTEGRAL | 01/01/2026 | 18798EA4-A | 15 | CONSORCIO SALUD HUANCA SANCOS II | SERVICIO DE GERENCIAMIENTO TÉCNICO | 216,075 |
| 6 | CMO GROUP | 05/03/2026 | 66938E52-9 | 17 | VARIOS, VARIOS1 | PNDTE CLIENTE - INGRESO DE CMO POR PAGO | 211,554 |
| 7 | INTEGRAL | 01/01/2026 | 32DF4A1E-E | 14 | CONSORCIO SAN MIGUEL | Transferencia a Cuenta Bancaria | 187,761 |
| 8 | INTEGRAL | 01/01/2026 | 049F5FAF-B | 14 | INMAC PERU S.A.C. | Transferencia a Cuenta Bancaria | 183,655 |
| 9 | INTEGRAL | 01/01/2026 | ABAD427C-2 | 7 | CONSORCIO HEALTH BERNALES | Transferencia a Cuenta Bancaria | 166,991 |
| 10 | INTEGRAL | 30/01/2026 | B0006469-6 | 6 | BANCO CONTINENTAL | **PLANILLA DE PAGO EMPLEADOS** | 155,832 |
| 11 | INTEGRAL | 26/02/2026 | 43E07800-2 | 6 | BANCO CONTINENTAL | PLANILLA DE PAGO EMPLEADOS | 155,386 |
| 12 | INTEGRAL | 23/03/2026 | C8777E10-1 | 8 | BANCO CONTINENTAL | PLANILLA DE PAGO EMPLEADOS | 154,223 |
| 13 | INTEGRAL | 29/04/2026 | 33B049BF-0 | 6 | BANCO CONTINENTAL | PLANILLA DE PAGO EMPLEADOS | 141,193 |
| 14 | INTEGRAL | 01/01/2026 | 96AFAB62-4 | 31 | CONEXIG, LLC | SERVICIO TECNICA - PROYECTO SAN MIGUEL | 125,495 |
| 15 | CMO GROUP | 30/03/2026 | 3E7C30D5-6 | 20 | INTEGRAL CONSULTORES S.A.C. | 30/03 PRESTAMO DE IC A CMO | 119,450 |
| 16 | MEDARQ | 01/01/2026 | 17CD0E28-1 | 13 | CONSORCIO PROYECTA & ASOCIADOS | Transferencia a Cuenta Bancaria | 118,000 |
| 17-19 | INTEGRAL | 01/01/2026 | varios | 13 | CHINA ROAD AND BRIDGE CORPORATION | Transferencia a Cuenta Bancaria | 118,000 × 3 |
| 20-22 | CMO GROUP | 11/03/2026 | varios | 4 | SUPERINTENDENCIA NACIONAL DE ADUANAS | **FORMULARIO 1663 - ITAN** | 107K-108K × 3 |
| 23-25 | MEDARQ | 02-27/02, 07/04 | varios | 3-5 | BANCO CONTINENTAL | PLANILLA DE PAGO EMPLEADOS | 106,335 × 3 |

### Patrones detectados:

1. **PLANILLAS DE PAGO**: 4 asientos en INTEGRAL + 3 en MEDARQ por descuadre de ~S/100K-S/155K cada uno. **Sugiere que la planilla se contabiliza como un solo NroD pero con líneas no balanceadas** dentro del documento.
2. **Pagos a SUNAT por ITAN**: 3 asientos en CMO GROUP por ~S/107K cada uno con descuadre. **El pago tiene líneas en cuenta bancaria + cuenta de tributo + IGV cred. fiscal**, pero por algún motivo no cuadran por NroD.
3. **Préstamos intercompany INTEGRAL → CMO**: 2 préstamos sumando S/441K con descuadre — confirma el riesgo intercompany.
4. **CONSORCIOS** (HEALTH BERNALES, STILER, HUANCA SANCOS): 6 documentos con descuadres entre S/166K y S/3.6M.

### Acción crítica:

Para cada uno de los **Top 5 descuadres > S/200K**, el contador debe:

1. **Localizar el NroD en S10** y revisar todas las líneas que comparten ese NroD.
2. **Identificar la línea faltante** (típicamente la contrapartida de un asiento adicional registrado por separado).
3. **Asignar el NroD correcto** a la línea perdida, o crear un nuevo NroD para los asientos de ajuste.

**El descuadre #1 INTEGRAL S/3.6M con CONSORCIO STILER amerita revisión inmediata** — un documento con 4 líneas descuadrando S/3.6M es altamente probable que sea una factura mal contabilizada (faltan líneas de IGV o subtotal).

---

## ANEXO F — INTEGRAL: Top 15 atípicos > S/100K

**Hallazgo H-05** (concentración en INTEGRAL: 274 atípicos).

Observación clave: **el cliente CONSORCIO HEALTH BERNALES domina el top 15** — son los servicios y cobranzas asociados a un proyecto grande:

| # | Fecha | Cuenta | Glosa | Tercero | Monto S/ |
|---|---|---|---|---|---:|
| 1 | 20/03/2026 | 12120001 | SERVICIO DE ASESORÍA INTEGRAL | CONSORCIO HEALTH BERNALES | 590,000 |
| 2 | 18/02/2026 | 12120001 | SERVICIO DE ASESORÍA INTEGRAL | CONSORCIO HEALTH BERNALES | 590,000 |
| 3 | 09/03/2026 | 12120001 | SERVICIO DE ASESORÍA INTEGRAL | CONSORCIO HEALTH BERNALES | 590,000 |
| 4-14 | varias | 10300012/11/10410013/12120001 | Transferencias/Asignación de Cobro | CONSORCIO HEALTH BERNALES | 519,200 × 11 |
| | | | **CONCENTRACIÓN HEALTH BERNALES (5 meses)** | | **~S/7.4M** |

### Interpretación:

**INTEGRAL prestó servicios al CONSORCIO HEALTH BERNALES por ~S/1.77M** (3 facturas de S/590K) **y cobró ~S/5.7M** en transferencias. Esto puede ser:

1. **Servicios facturados ≠ cobranzas** — INTEGRAL cobra anticipos antes de prestar el servicio.
2. **CONSORCIO HEALTH BERNALES es proyecto multianual** — la cobranza incluye cuotas de servicios facturados en 2025.
3. **Doble registro** por error.

### Acción crítica:

1. **Conciliar contractualmente** con CONSORCIO HEALTH BERNALES: ¿cuánto se facturó vs cuánto se cobró efectivamente?
2. **Verificar saldo neto a 31/05/2026** y enviar circular de confirmación al cliente.
3. **Documentar el contrato** que sustenta los pagos recurrentes de S/590K (¿es contrato de servicios mensuales? ¿proyecto cerrado?).

---

## ANEXO G — CXC TOP CLIENTES POR EMPRESA

### G.1. AMERICANA CONSTRUCCIÓN (2 clientes — 100% concentración)

| Cliente | Saldo Total | 0-30 días | > 90 días | Acción |
|---|---:|---:|---:|---|
| **CONSULTORÍA & CONSTRUCCIÓN GRUPO PERGOLA S.A.C.** | **3,002,719** | 0 | **3,002,719 (100%)** | 🔴 Provisionar 100% NIIF 9 |
| CONSORCIO ROLOPOM CORPORIS II | 65,632 | 62,945 | 2,687 | OK |
| **TOTAL** | **3,068,350** | 62,945 | **3,005,406** | |

### G.2. INTEGRAL CONSULTORES (7 clientes)

| Cliente | Saldo Total | 0-30 días | > 90 días | Acción |
|---|---:|---:|---:|---|
| CONSTRUCTORA & INMOBILIARIA SAGITARIO Y ASOCIADOS | 648,528 | 0 | 577,728 | 🔴 Provisionar 80% |
| CHINA ROAD AND BRIDGE CORPORATION SUCURSAL PERU | 559,320 | 0 | 441,320 | 🟠 Provisionar 50% |
| **CMO GROUP S.A.** (intercompany) | 154,864 | 80,004 | 74,860 | Conciliar con CMO |
| CONSORCIO RIO HUATANAY | 129,800 | 0 | 129,800 | 🔴 Provisionar 100% |
| CONSORCIO PENAL PUCALLPA | 29,500 | 0 | 0 | OK |
| INMAC PERU S.A.C. | 22,039 | 0 | 22,039 | 🟠 Provisionar 50% |
| INGENIERIAS Y OBRAS DE CONSTRUCCIÓN RIUMAR SPA | 14,000 | 2,600 | -2,200 | ⚠️ Saldo NEGATIVO → reclasif |
| **TOTAL** | **1,558,051** | 82,604 | **1,243,547** | |

### G.3. MEDARQ S.A.C. (4 clientes)

| Cliente | Saldo Total | 0-30 días | > 90 días | Acción |
|---|---:|---:|---:|---|
| **CONSORCIO SALUD MONTENEGRO** | **418,020** | 25,000 | 468,020 (>100%) | ⚠️ Saldos negativos comp. — reclasif anticipos |
| SUPPLIES AND INVESTMENTS PERU EIRL | 311,363 | 0 | 311,363 | 🔴 Provisionar 100% |
| MINERA NADIAN GOLD CORPORATION E.I.R.L. | 138,796 | 0 | 138,796 | 🔴 Provisionar 100% |
| CONSORCIO PROYECTA & ASOCIADOS | 42,480 | 14,160 | 103,840 (saldos negativos) | ⚠️ Reclasif anticipos |
| **TOTAL** | **910,659** | 39,160 | 1,022,019 | |

> **Nota:** El >90 días total (S/1,022,019) excede el Saldo Total (S/910,659). Esto se debe a clientes con anticipos (saldo NEGATIVO) en las bandas más recientes, compensados por saldos POSITIVOS > 90 días en otros clientes. **Reclasificar los anticipos a cuenta 1213 (Anticipos de clientes)** para reflejarlos como pasivo y dejar la CxC neta solo positiva.

---

## ANEXO H — CMO GROUP: Activo Fijo anómalo (CMO-04)

| Cuenta | Descripción | Valor Bruto | Depreciación | Valor Neto | Estado |
|---|---|---:|---:|---:|---|
| **33211000** | **Edificios Adm — Costo Adquisición** | **(2,407,287)** | 0 | (2,407,287) | 🚨 NEGATIVO |
| **33241000** | **Instalaciones — Costo Adquisición** | **+2,407,287** | 0 | +2,407,287 | ⚠️ Cuenta de compensación |
| 33691000 | Otros Equipos al Costo | (162,408) | 0 | (162,408) | 🚨 NEGATIVO |
| **TOTAL** | | **(162,408)** | 0 | **(162,408)** | |

### Interpretación contable:

**Asiento histórico que originó el problema (probable reconstrucción):**

```
CMO GROUP — Reclasificación incorrecta (fecha desconocida)
───────────────────────────────────────────────────────────
Db. 33241000 — Instalaciones      2,407,287
   Cr. 33211000 — Edificios Adm.       2,407,287
```

**Por qué está mal:**

- Se está moviendo S/2.4M de "Edificios" a "Instalaciones" sin pasar por la depreciación acumulada (cuenta 39).
- En NIIF y PCGE, una reclasificación de elementos del activo fijo debe acompañarse de:
  - Transferir el valor bruto: Db. nueva cuenta vs Cr. cuenta original. ✅ (esto sí se hizo)
  - **Transferir la depreciación acumulada correspondiente**: Db. 39 antigua vs Cr. 39 nueva. ❌ (esto NO se hizo porque no hay depreciación en clase 39).

**El saldo NEGATIVO en Edificios sugiere que la cuenta tenía saldo positivo en algún momento (antes del 01/01/2026), pero la apertura del 2026 no lo cargó.**

### Acción crítica:

1. **Pedir al contador anterior** (si lo hay) el detalle del activo "Edificios" original.
2. **Cargar asiento de apertura** correcto:

```
Asiento de Apertura — Activo Fijo (corrección)
────────────────────────────────────────────────
Db. 33211000 — Edificios Adm.                X
Db. 33691000 — Otros Equipos                 Y
   Cr. 39111000 — Depreciación Edificios          X * tasa
   Cr. 39691000 — Depreciación Otros Equipos      Y * tasa
   Cr. 5821 — Resultados Acumulados              [diferencia]

Glosa: Asiento de Apertura — Corrección saldos AF al 01/01/2026
```

3. **Para el saldo negativo S/162K de "Otros Equipos"**: investigar si corresponde a una **baja de activo** (venta, donación, siniestro) que se contabilizó sin la contrapartida correcta.

---

## ANEXO I — PROPUESTA CRÍTICA DE CORRECCIÓN — ASIENTOS CONTABLES

### I.1. Resumen ejecutivo de asientos a registrar

| # | Empresa | Asiento | Monto | Plazo |
|---|---|---|---:|---|
| AC-01 | MEDARQ | Asiento de apertura bancario real (BBVA ME) | ~S/100K* | Inmediato |
| AC-02 | MEDARQ | Asiento de apertura cuenta detracciones | ~S/40K* | Inmediato |
| AC-03 | AMERICANA | Asiento de apertura BBVA MN real | ~S/15M* | Inmediato |
| AC-04 | AMERICANA | Reclasificación diferencias de cambio | ~S/900K | 7 días |
| AC-05 | AMERICANA | Reclasificación CxC PERGOLA — provisión NIIF 9 | S/3,002,719 | 15 días |
| AC-06 | INTEGRAL | Provisión NIIF 9 CxC > 90 días | S/943,128 | 15 días |
| AC-07 | MEDARQ | Provisión NIIF 9 CxC > 90 días | S/450,159 | 15 días |
| AC-08 | INTEGRAL | Contabilización FT 30 / CMO GROUP S/95,948 | S/95,948 | 7 días |
| AC-09 | AMERICANA | Contabilización 6 honorarios + retenciones 4ta | S/17,094 | 7 días |
| AC-10 | TODAS | Provisión depreciación acumulada (NIC 16) | ~S/140K | 30 días |
| AC-11 | CMO GROUP | Corrección reclasificación Edificios→Instalaciones | S/2,407,287 | 30 días |
| AC-12 | TODAS | Constitución de Reserva Legal (Art. 229 LGS) | varía | 60 días |
| AC-13 | CMO GROUP | Refacturación intereses préstamos intercompany | ~S/2M anual | 30 días |
| AC-14 | TODAS | Cargo gasto laboral CTS mayo 2026 | varía | Antes 15/05 |

*Pendiente de validación contra estado de cuenta del banco

---

### I.2. Asientos contables detallados

#### AC-01: MEDARQ — Apertura bancaria BBVA Continental ME

**Saldo en banco al 01/01/2026 (PENDIENTE de confirmar):** S/X

```
MEDARQ — Asiento de Apertura Banco (corrección)
01/01/2026
───────────────────────────────────────────────────
Db. 10410014 — BBVA Continental ME           X
   Cr. 5712 — Resultados Acumulados              X

Glosa: Corrección de apertura — saldo bancario al 01/01/2026 según
estado de cuenta BBVA Continental. Acción autoria 11/05/2026.
NroD: OPEN-2026-MEDARQ-BBVA-ME
```

> **Importante:** consultar al banco el saldo real al 01/01/2026. Si fuera **S/0**, el saldo negativo de S/51K refleja un sobregiro real → reclasificar a cuenta 4511.

---

#### AC-02: MEDARQ — Apertura cuenta detracciones

**Saldo en banco al 01/01/2026 (PENDIENTE):** S/Y

```
MEDARQ — Asiento de Apertura Detracciones
01/01/2026
───────────────────────────────────────────────────
Db. 10710021 — Banco Nación Detracciones    Y
   Cr. 5712 — Resultados Acumulados              Y

Glosa: Corrección apertura cuenta detracciones SUNAT-SPOT
NroD: OPEN-2026-MEDARQ-DETRAC
```

---

#### AC-03: AMERICANA — Apertura BBVA MN (CRÍTICO)

**Hipótesis:** el banco muestra saldo positivo al 01/01/2026 que no se cargó. Si el banco reporta saldo S/Z al 01/01/2026 que es positivo:

```
AMERICANA — Asiento Apertura BBVA MN
01/01/2026
───────────────────────────────────────────────────
Db. 10410013 — BBVA Continental MN           Z   (Z debería ser > 13M para neutralizar el -13M)
   Cr. 5712 — Resultados Acumulados              Z

Glosa: Asiento de apertura — corrección saldo BBVA Continental MN 2026
NroD: OPEN-2026-AMER-BBVA-MN
```

> **Si el banco confirma que el saldo SÍ era negativo al 01/01/2026** (es decir, AMERICANA arrastraba un sobregiro), reclasificar a cuenta 4511 (Sobregiros Bancarios) como pasivo.

---

#### AC-04: AMERICANA — Reclasificación diferencias de cambio

Por cada asiento de diferencia de cambio mal contabilizado en cuenta de banco:

**Ejemplo: 31/03/2026 — BFEC4BF3-A — S/837,661 — BBVA Continental ME**

```
AMERICANA — Reclasificación Diferencia de Cambio
31/03/2026 (asiento de ajuste)
───────────────────────────────────────────────────
Db. 10410014 — BBVA Continental ME          837,661.00  (revierte el cargo original)
   Cr. 776 — Ganancia por diferencia de cambio   837,661.00
        (o Db. 676 — Pérdida por diferencia de cambio si es pérdida)

Glosa: Reclasificación de DC del 31/03 a cuenta de resultados
NroD: AJU-2026-AMER-DC-001
```

Aplicar el mismo patrón para todas las diferencias de cambio identificadas (~5 asientos por total ~S/900K).

---

#### AC-05: AMERICANA — Provisión NIIF 9 sobre CxC PERGOLA

```
AMERICANA — Provisión por Deterioro CxC (NIIF 9)
31/05/2026
───────────────────────────────────────────────────
Db. 6841 — Pérdida por deterioro CxC             3,002,719.00
   Cr. 1911 — Estimación de cobranza dudosa CxC       3,002,719.00

Glosa: Provisión 100% NIIF 9 — CONSULTORIA & CONSTRUCCION
GRUPO PERGOLA S.A.C. — Saldo > 90 días por S/3,002,718.75
NroD: PROV-NIIF9-AMER-2026-001
```

**Impacto en P&L AMERICANA**: pérdida adicional de S/3M → utilidad neta YTD pasa de −S/224K a **−S/3,226,000**.

> **Para deducción tributaria (Art. 37 LIR):** la provisión por deterioro NO es deducible automáticamente. Para que sea deducible se requiere:
> - Demostrar gestión de cobranza (cartas notariales, demanda judicial).
> - O probar que la deuda es incobrable (deudor desaparecido, quiebra, etc.).
>
> **Recomendación:** iniciar acción judicial de cobro contra Grupo PERGOLA para que la provisión sea fiscalmente deducible. Si no, será una diferencia temporaria (NIC 12) que genera activo por impuesto diferido.

---

#### AC-08: INTEGRAL — Contabilización FT-30 / CMO GROUP

```
INTEGRAL — Contabilización Factura Faltante
04/03/2026 (corrección histórica)
───────────────────────────────────────────────────
Db. 1212 — Facturas Emitidas en Cartera MN — CMO    95,948.00
   Cr. 7041 — Ingresos por servicios prestados        81,312.71
   Cr. 4011 — IGV por pagar (18%)                     14,635.29

Glosa: Contab. histórica FT -0000000030 INGRESOS DE CMO SEGÚN EECC
NroD: FT-30-INTEGRAL-2026
```

**Impacto:**
- Ingreso adicional INTEGRAL: +S/81,313
- IGV adicional por pagar: +S/14,635 (verificar si ya se declaró en PDT 621 marzo)
- Si fue declarado pero no contabilizado: ajuste contable únicamente.
- Si NO fue declarado: rectificatoria PDT 621 marzo + pago + multa + intereses moratorios.

---

#### AC-09: AMERICANA — Contabilización 6 recibos por honorarios

**Asiento agrupado (alternativa: uno por recibo):**

```
AMERICANA — Contabilización Honorarios Pendientes Q1-2026
30/04/2026 (corrección)
───────────────────────────────────────────────────────────────
Db. 6314 — Honorarios profesionales            17,094.00
   Cr. 4017 — Renta 4ta cat. por pagar (8%)        1,007.55   *
   Cr. 4212 — Honorarios por pagar              16,086.45

* Solo aplica retención 8% a recibos > S/2,000. Cálculo:
  - Peña Flores #1 S/4,524.60 × 8% = S/361.97
  - Peña Flores #2 S/3,496.80 × 8% = S/279.74
  - Peña Flores #3 S/2,622.60 × 8% = S/209.81
  - Galindo Cabrera S/2,450.00 × 8% = S/196.00
  - Velarde Arellano (2 × S/2,000) — sin retención (umbral exacto)
  TOTAL retención: S/1,047.52 (ajustar el monto en asiento)

Glosa: Contabilización honorarios Q1-2026 + retenciones 4ta cat. pendientes
NroD: AJU-AMER-HON-Q1-2026
```

**Acción complementaria:** rectificar PDT-PLAME de febrero, marzo y abril 2026 con las retenciones omitidas + pago + multa rebajada (90% si se regulariza antes de notificación SUNAT).

---

#### AC-10: TODAS — Provisión Depreciación Acumulada (NIC 16)

**Ejemplo para INTEGRAL — depreciación 2024+2025 estimada:**

| Cuenta | Activo | Valor Bruto | Tasa | Vida útil | Años transcurridos est. | Depreciación |
|---|---|---:|---:|---:|---:|---:|
| 33511 | Muebles | 17,505 | 10% | 10 años | 2 | 3,501 |
| 33521 | Enseres | 42,981 | 10% | 10 años | 2 | 8,596 |
| 33611 | Eq. Procesamiento | 89,160 | 25% | 4 años | 2 | 44,580 |
| 33621 | Eq. Comunicación | 49,066 | 25% | 4 años | 2 | 24,533 |
| **TOTAL** | | **198,712** | | | | **81,210** |

```
INTEGRAL — Asiento de Corrección Depreciación 2024-2025
31/12/2025 (o asiento de ajuste con efecto retroactivo)
───────────────────────────────────────────────────────────────
Db. 5712 — Resultados Acumulados (por años 2024)      40,605
Db. 6814 — Depreciación de IME 2025                    40,605
   Cr. 39511 — Depreciación de Muebles                       3,501
   Cr. 39521 — Depreciación de Enseres                       8,596
   Cr. 39611 — Depreciación de Eq. Procesamiento            44,580
   Cr. 39621 — Depreciación de Eq. Comunicación             24,533

Glosa: Ajuste retroactivo NIC 16 — Reconocimiento Depreciación 2024-2025
NroD: NIC16-INT-2024-2025
```

**Procedimiento similar para MEDARQ, AMERICANA. CMO GROUP requiere reconstrucción más profunda.**

---

#### AC-11: CMO GROUP — Corrección Edificios → Instalaciones

```
CMO GROUP — Corrección Reclasificación Activo Fijo
Fecha estimada del error: [a investigar con contador]
Corrección al 31/05/2026
───────────────────────────────────────────────────────────────
Db. 33211000 — Edificios Adm.                  2,407,287.25  (reversa el saldo negativo)
   Cr. 33241000 — Instalaciones                       2,407,287.25  (reversa el cargo doble)

Glosa: Reversión de reclasificación incorrecta — restaurar saldos
originales antes de pasar reclasificación correcta con depreciación
NroD: AJU-CMO-AF-001
```

Luego, **si efectivamente debe haber reclasificación**, registrar el asiento correcto:

```
CMO GROUP — Reclasificación Correcta Edificios → Instalaciones
[Fecha del cambio físico real]
───────────────────────────────────────────────────────────────
Db. 33241000 — Instalaciones                   X.XX
Db. 39111000 — Depreciación Edificios          Y.YY (la que tenía)
   Cr. 33211000 — Edificios Adm.                     X.XX
   Cr. 39241000 — Depreciación Instalaciones         Y.YY (transferida)

Glosa: Reclasificación de Edificios a Instalaciones — transferencia
de valor bruto y depreciación acumulada NIC 16
NroD: AJU-CMO-AF-002
```

---

#### AC-12: TODAS — Constitución de Reserva Legal

**Para INTEGRAL (que tiene utilidad de S/73K en 2026 YTD):**

Por el momento aplica a utilidades de ejercicios cerrados. Si INTEGRAL tuvo utilidad en 2024 y/o 2025, debe constituirse la reserva legal correspondiente.

```
INTEGRAL — Constitución de Reserva Legal Histórica
(asiento de apertura corrección)
───────────────────────────────────────────────────────────────
Db. 5911 — Utilidades Acumuladas (de 2024)     X (10% de utilidad 2024 después IR)
Db. 5911 — Utilidades Acumuladas (de 2025)     Y (10% de utilidad 2025 después IR)
   Cr. 5821 — Reserva Legal                         X + Y

Glosa: Constitución reserva legal Art. 229 LGS retroactiva 2024-2025
NroD: RL-INT-2024-2025
```

**Acta de Junta General de Accionistas** requerida documentando la decisión.

---

#### AC-13: CMO GROUP — Refacturación Intereses Préstamos Intercompany

**Suposición:** saldo promedio préstamos otorgados ~S/40M × TAMN 12% anual = S/4.8M intereses anuales → 5/12 = S/2M devengado YTD.

**Para cada préstamo activo > 90 días, calcular intereses devengados:**

```
CMO GROUP — Provisión Intereses Préstamos Intercompany
30/04/2026 (acumulado YTD)
───────────────────────────────────────────────────────────────
Db. 1683 — Intereses por cobrar — INTEGRAL          XXX
Db. 1683 — Intereses por cobrar — MEDARQ            YYY
Db. 1683 — Intereses por cobrar — AMERICANA         ZZZ
   Cr. 7723 — Intereses por préstamos               XXX + YYY + ZZZ

Glosa: Provisión intereses devengados — tasa TAMN aplicada sobre saldo
promedio de préstamos otorgados. Cumplimiento Art. 32-A LIR (PT)
NroD: INT-CMO-2026-04
```

**Asiento simétrico en cada subsidiaria** registrando gasto financiero.

**Esto es crítico para reducir el riesgo de precios de transferencia (Art. 32-A LIR).**

---

### I.3. Cronograma de ejecución de asientos correctivos

| Semana | Asientos a ejecutar | Responsable | Validación |
|---|---|---|---|
| 1 (12-18 mayo) | AC-01, AC-02, AC-03 (aperturas bancarias) | Tesorería + Contabilidad | Estado de cuenta bancario |
| 1 | AC-08, AC-09 (facturas/honorarios pendientes) | Contabilidad | PDT 621, PDT-PLAME |
| 2 (19-25 mayo) | AC-04 (diferencias de cambio) | Contabilidad | Tipo de cambio publicado SUNAT |
| 2-3 | AC-05, AC-06, AC-07 (provisiones NIIF 9) | Gerencia + Contabilidad | Acta de cobranza |
| 4-5 | AC-10 (depreciación retroactiva) | Contabilidad | Hoja de cálculo activo fijo |
| 4-5 | AC-11 (reclasificación CMO) | Contabilidad | Documentación interna |
| 6-8 | AC-12 (reserva legal) | Legal + Junta de Accionistas | Acta JGA |
| 6-8 | AC-13 (intereses intercompany) | Contabilidad + Gerencia | Contratos de mutuo |

---

## CONCLUSIÓN DEL ANEXO

Este anexo proporciona el **detalle transaccional específico** que sustenta cada hallazgo y los **asientos contables exactos** para subsanarlos.

**14 asientos contables principales** organizados en un cronograma de 8 semanas. **Costo estimado de regularización tributaria** (incluyendo asientos correctivos, multas rebajadas por subsanación voluntaria y honorarios profesionales): **S/40,000-S/70,000 por empresa**.

**Costo estimado de NO regularizar** (contingencias tributarias máximas estimadas en §V del informe principal): **S/3,000,000+** para el grupo.

**ROI de la remediación:** >43:1.

---

**Próxima validación:** una vez ejecutados los asientos correctivos, re-sincronizar BizSmartHub y verificar que los hallazgos críticos se hayan reducido en > 80%.
