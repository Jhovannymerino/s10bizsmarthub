# INFORME DE AUDITORÍA — DETALLE CUANTITATIVO ACTUALIZADO

**Fecha de los datos:** 11 de mayo de 2026, 09:47 UTC (sync productivo recién ejecutado)
**Período:** Ejercicio 2026 (1 enero – 11 mayo)
**Documento complementario a:** [INFORME_AUDITORIA_FINANCIERA.md](INFORME_AUDITORIA_FINANCIERA.md)

> Este informe sustituye los marcadores "A determinar" del informe principal por las **cifras reales** extraídas de la base productiva. Las severidades se recalibran con base en los montos materiales realmente observados.

---

## 0. ALCANCE — Universo real auditado

### 0.1. Empresas en la base de datos

Hay **9 entidades** con snapshots históricos:

| RUC | Razón social | ¿Sincronizando? | Naturaleza |
|---|---|---|---|
| 22011489 | CMO GROUP S.A. | ✅ Sí | Holding |
| 80688541 | INTEGRAL CONSULTORES S.A.C. | ✅ Sí | Consultora |
| 80688706 | MEDARQ S.A.C. | ✅ Sí | Servicios |
| 80688524 | COMPAÑÍA AMERICANA DE CONSTRUCCIÓN Y EQUIPAMIENTO S.A.C. | ✅ Sí | Construcción |
| 22020135 | CONSORCIO DEPORTIVO ATE | ⚠️ No (datos históricos) | Consorcio |
| 80240175 | CONSORCIO PENITENCIARIO MISTI | ⚠️ No | Consorcio |
| 80688895 | CONSORCIO SALUD MONTENEGRO | ⚠️ No | Consorcio |
| 80688995 | CONSORCIO SALUD SANTA CRUZ | ⚠️ No | Consorcio |
| 80680645 | CONSORCIO SALUD ZACARIAS | ⚠️ No | Consorcio |

> **HALLAZGO ADICIONAL H-16:** Existen 5 consorcios con datos en la base de datos pero **no se están sincronizando actualmente**. Estos consorcios son joint ventures (probablemente de las empresas principales) y tienen CxC pendientes (Deportivo ATE S/620K, Salud Zacarías S/260K, Penitenciario Misti S/23K). **Pregunta al equipo:** ¿están operativos? Si sí, deben incluirse en el sync. Si no, hay que confirmar que las CxC están liquidadas o reclasificadas.

> **HALLAZGO ADICIONAL H-17:** La tabla `Company` en la base de datos solo tiene **1 empresa registrada** (INTEGRAL). Las otras 3 que se sincronizan vienen del config del agente, no de la BD. Esto genera **inconsistencia**: si la app frontend usa la tabla `Company` para construir el selector de empresas, los usuarios solo verán INTEGRAL. **Acción inmediata:** poblar la tabla Company con las 4 empresas activas y, opcionalmente, los 5 consorcios.

---

## 1. ESTADO DE RESULTADOS YTD (1 enero – 11 mayo 2026)

| Empresa | Ingresos | Costo Directo | Margen Bruto | GAV | EBITDA | Utilidad Neta | Margen Neto |
|---|---:|---:|---:|---:|---:|---:|---:|
| **CMO GROUP** | 211,554 | 31,822 | 179,732 | **1,356,508** | **(1,176,776)** | **(1,185,896)** | **−560.6%** |
| **INTEGRAL** | 2,680,926 | 1,326,261 | 1,354,665 | 1,153,851 | 200,814 | 73,223 | **+2.7%** |
| **MEDARQ** | 740,000 | 6,204 | 733,796 | 1,131,251 | **(397,455)** | **(399,828)** | **−54.0%** |
| **AMERICANA** | 213,373 | 270,998 | **(57,626)** | 98,035 | (155,660) | (223,721) | **−104.9%** |
| **TOTAL GRUPO** | 3,845,853 | 1,635,285 | 2,210,567 | 3,739,646 | (1,529,078) | (1,736,222) | −45.1% |

**Hallazgos derivados:**

1. **CMO GROUP tiene S/1.36M de GAV con apenas S/211K de ingresos** — ratio GAV/Ingreso = 641%. Es la naturaleza de un holding, pero confirma que **los ingresos contables están subdeclarados** (debería tener intereses cobrados a las subsidiarias por los S/123M en préstamos otorgados).
2. **AMERICANA tiene margen bruto negativo (−S/57K)** — costo directo (S/270K) superó al ingreso (S/213K). El proyecto de construcción está perdiendo dinero en operación. Pregunta crítica: ¿hay obras valorizadas pero no facturadas (NIC 11/NIIF 15) que deben reconocerse?
3. **MEDARQ está perdiendo S/400K en 5 meses**. Si se proyecta el año completo (~S/960K de pérdida anual), el patrimonio puede verse comprometido. Pregunta: ¿hay riesgo de patrimonio < 1/3 del capital social (Art. 220 LGS — causal de disolución)?
4. **INTEGRAL es la única rentable** con un magro 2.7% de margen neto. Es la "máquina" del grupo.

---

## 2. HALLAZGO H-01 — DESCUADRES POR NroD (REVISITADO CON DATOS REALES)

### 2.1. Composición real

| Empresa | Total descuadres | Asientos de Apertura | **No-Apertura (operativos)** | Máximo descuadre | Suma total descuadres |
|---|---:|---:|---:|---:|---:|
| **CMO GROUP** | 6,438 | 6,227 (96.7%) | **211 (3.3%)** | S/10,248,876 | S/393,168,211 |
| **INTEGRAL** | 1,313 | 696 (53.0%) | **617 (47.0%)** ⚠️ | S/3,647,206 | S/41,985,753 |
| **AMERICANA** | 323 | 194 (60.1%) | **129 (39.9%)** | S/7,066,049 | S/20,503,080 |
| **MEDARQ** | 350 | 103 (29.4%) | **247 (70.6%)** ⚠️ | S/300,000 | S/3,181,366 |
| **TOTAL** | **8,424** | 7,220 (85.7%) | **1,204 (14.3%)** | — | **S/458,838,410** |

### 2.2. Recalibración del hallazgo

**El informe inicial sobreestimó la gravedad en CMO GROUP** y la subestimó en MEDARQ:

- **CMO GROUP**: 96.7% de los descuadres son legítimos "Asientos de Apertura". Solo **211 documentos operativos** descuadrados. Riesgo: **Medio** (no Crítico como se reportó inicialmente).
- **MEDARQ**: 70.6% (247 de 350) son descuadres operativos NO-APERTURA. Riesgo: **Alto** (subestimado en el reporte inicial).
- **INTEGRAL**: 47% (617 de 1,313) son operativos. Riesgo: **Alto**.

### 2.3. Plan corregido

| Empresa | Foco de revisión | Universo realista |
|---|---|---:|
| MEDARQ | **247 descuadres operativos** — pueden ser pagos parciales o notas mal aplicadas | S/3.2M expuestos |
| INTEGRAL | **617 descuadres operativos** | S/42M expuestos (cifra alta) |
| AMERICANA | 129 operativos | S/20.5M |
| CMO GROUP | **6,227 asientos de apertura** — reclasificar a NroD especial "OPEN-2026" | n/a |

**Acción inmediata recomendada para INTEGRAL:** auditar los 617 descuadres operativos uno por uno antes del próximo cierre mensual. El máximo descuadre de S/3.6M en un solo documento amerita explicación documentada.

---

## 3. HALLAZGO H-02 — ASIENTOS SIN DOCUMENTO FUENTE (REVISITADO)

### 3.1. Detalle por clase de cuenta — montos materiales

#### CMO GROUP S.A.

| Clase | Concepto | Sin Doc | Total | % | Monto sin doc |
|---|---|---:|---:|---:|---:|
| **46** | CxP Diversas | 384 | 994 | **38.6%** | **S/137,117,724** |
| **13** | CxC Comerciales — Relacionadas | 181 | 702 | 25.8% | S/91,612,439 |
| **42** | CxP Comerciales | 826 | 4,071 | 20.3% | S/68,382,285 |
| **12** | CxC Comerciales | 49 | 132 | 37.1% | S/39,788,704 |
| 17 | Entregas a rendir | 240 | 2,725 | 8.8% | S/33,541,989 |
| 43 | CxP Comerciales — Relacionadas | 25 | 65 | 38.5% | S/15,525,633 |
| 40 | Tributos | 24 | 237 | 10.1% | S/9,542,577 |
| 16 | CxC Diversas | 89 | 327 | 27.2% | S/4,414,739 |
| 41 | Remuneraciones | 9 | 51 | 17.6% | S/2,230,938 |
| 14 | CxC al Personal | 96 | 528 | 18.2% | S/2,115,841 |
| 10 | Caja-Bancos | 4 | 4 | **100.0%** ⚠️ | S/180,879 |
| 94 | Gastos Administrativos | 5 | 186 | 2.7% | S/73,834 |

**Material total expuesto sin documento en CMO: S/404,547,581** (gran parte intercompany, pero requiere documentación).

#### MEDARQ S.A.C.

| Clase | Concepto | Sin Doc | Total | % | Monto sin doc |
|---|---|---:|---:|---:|---:|
| 12 | CxC Comerciales | 11 | 31 | 35.5% | S/822,000 |
| 10 | Caja-Bancos | 21 | 452 | 4.6% | S/782,940 |
| 94 | Gastos Administrativos | 98 | 518 | 18.9% | S/766,732 |
| **70** | **Ventas (INGRESOS)** | **10** | **29** | **34.5%** ⚠️⚠️ | **S/400,000** |
| 46 | CxP Diversas | 38 | 71 | 53.5% | S/211,638 |
| 40 | Tributos | 11 | 394 | 2.8% | S/179,650 |
| 41 | Laboral | 4 | 53 | 7.5% | S/142,611 |
| 42 | CxP Comerciales | 48 | 963 | 5.0% | S/55,590 |
| 17 | Entregas a rendir | 1 | 9 | 11.1% | S/17,350 |
| 91 | Costos | 2 | 12 | 16.7% | S/4,253 |

> **🚨 HALLAZGO CRÍTICO MEDARQ-01:**
> **10 asientos de ingresos (clase 70) por S/400,000 sin documento fuente** (factura). Esto representa el **34.5% de todos los asientos de ingreso** del año. Riesgo SUNAT por subdeclaración del IGV: si los S/400K son ingresos no facturados, el IGV omitido sería ~S/72,000.

#### INTEGRAL CONSULTORES

| Clase | Concepto | Sin Doc | Total | % | Monto sin doc |
|---|---|---:|---:|---:|---:|
| 40 | Tributos | 19 | 705 | 2.7% | S/3,291,012 |
| 12 | CxC Comerciales | 11 | 316 | 3.5% | S/3,218,731 |
| 46 | CxP Diversas | 167 | 342 | **48.8%** | S/1,818,591 |
| 91 | Costos Directos | 14 | 38 | **36.8%** | S/916,151 |
| 10 | Caja-Bancos | 51 | 1,196 | 4.3% | S/726,289 |
| 16 | CxC Diversas | 7 | 561 | 1.2% | S/605,559 |
| 42 | CxP Comerciales | 130 | 2,207 | 5.9% | S/512,213 |
| 41 | Laboral | 13 | 117 | 11.1% | S/435,666 |
| 94 | Gastos | 46 | 893 | 5.2% | S/124,986 |
| 14 | CxC al Personal | 2 | 43 | 4.7% | S/1,000 |

#### AMERICANA CONSTRUCCIÓN

| Clase | Concepto | Sin Doc | Total | % | Monto sin doc |
|---|---|---:|---:|---:|---:|
| **10** | **Caja-Bancos** | 27 | 326 | 8.3% | **S/35,757,240** ⚠️ |
| 12 | CxC Comerciales | 1 | 104 | 1.0% | S/10,094,356 |
| 42 | CxP Comerciales | 12 | 410 | 2.9% | S/872,862 |
| 40 | Tributos | 10 | 174 | 5.7% | S/713,983 |
| 46 | CxP Diversas | 25 | 72 | **34.7%** | S/204,156 |
| 91 | Costos | 6 | 23 | 26.1% | S/183,954 |
| 41 | Laboral | 6 | 34 | 17.6% | S/72,622 |
| 94 | Gastos | 12 | 191 | 6.3% | S/2,105 |

> **🚨 HALLAZGO CRÍTICO AMERICANA-01:**
> **S/35,757,240 en movimientos bancarios (clase 10) sin documento fuente** en solo 27 asientos. Promedio de **S/1.32M por asiento bancario sin sustento**. Esto es una bandera roja por:
> - Probable incumplimiento de Ley 28194 (Bancarización).
> - SUNAT puede observar que los movimientos no están respaldados por comprobante.
> - Riesgo de pérdida de crédito fiscal del IGV en operaciones grandes.

---

## 4. HALLAZGO H-03 — TESORERÍA Y SALDOS BANCARIOS (REVISITADO)

### 4.1. Resumen de tesorería por empresa

| Empresa | Saldo Inicial | Entradas | Salidas | **Saldo Final** | Bancos negativos | Bancos sin apertura |
|---|---:|---:|---:|---:|---:|---:|
| **AMERICANA** | 170,557 | 23,571,272 | 15,204,387 | **+8,537,442** | 2 | 5 |
| **INTEGRAL** | 1,459 | 21,369,423 | 21,244,035 | +126,846 | **5** | 4 |
| **MEDARQ** | **0** | 4,450,543 | 4,487,839 | **−37,296** | 2 | **7** |
| **CMO GROUP** | **−27,509** | 180,879 | 180,879 | **−27,509** | 2 | 1 |

### 4.2. Cuentas bancarias con saldo negativo (todas)

| Empresa | Cuenta | Banco | Saldo |
|---|---|---|---:|
| **AMERICANA** | 10410013 | BBVA CONTINENTAL MN | **−S/13,034,687** ⚠️⚠️⚠️ |
| **AMERICANA** | 10410016 | BBVA Continental 0011-0787 | −S/294 |
| **MEDARQ** | 10410014 | BBVA CONTINENTAL ME | −S/51,587 |
| **MEDARQ** | 10710021 | BCO NACIÓN — Detracciones | **−S/31,860** ⚠️ |
| **INTEGRAL** | 10410013 | BBVA CONTINENTAL MN | −S/31,671 |
| **INTEGRAL** | 10811004 | CTA ADMIN USD | −S/926 |
| **INTEGRAL** | 10300011 | Caja en Tránsito | −S/10 |
| **INTEGRAL** | 10300012 | Efectivo en Tránsito | −S/1 |
| **CMO GROUP** | 10410013 | BBVA CONTINENTAL MN | −S/29,786 |
| **CMO GROUP** | (varios con saldo 0) | | — |

### 4.3. Reclasificación del hallazgo H-03

> **🚨 HALLAZGO CRÍTICO AMERICANA-02:**
> BBVA CONTINENTAL MN con saldo contable **−S/13,034,687** (trece millones de soles negativos). Esto es **financieramente imposible** sin una explicación de:
>
> 1. **Sobregiro bancario real** — debe reclasificarse a clase **4511 (Sobregiros bancarios)** según NIC 1.32 (no compensación de activos y pasivos).
> 2. **Saldo inicial mal cargado** — el sistema partió de 0 y todos los pagos del año generaron saldo negativo.
> 3. **Falta de asiento de apertura** — la cuenta tenía un saldo positivo al 01/01/2026 que no se cargó.
>
> **Acción inmediata:** pedir al banco el estado de cuenta al 01/01/2026 y al 30/04/2026 para conciliar.

> **🚨 HALLAZGO CRÍTICO MEDARQ-02:**
> **Banco de la Nación — Cuenta de Detracciones con saldo −S/31,860.** La cuenta de detracciones es un activo restringido. No puede estar negativa. SUNAT puede **bloquear la liberación de fondos** mientras los registros estén inconsistentes.

### 4.4. Conciliación pendiente — TOTAL del grupo

| Concepto | Monto |
|---|---:|
| Saldo negativo total en bancos del grupo | **−S/13,180,820** |
| Cuentas que arrancaron en cero (sin apertura) | 17 cuentas |
| Cuentas auditadas | 51 cuentas bancarias |

---

## 5. HALLAZGO H-04 — PRÉSTAMOS INTERCOMPANY (REVISITADO CON MONTOS)

### 5.1. Magnitud real

| Empresa | # Préstamos otorgados | Total movido | **Saldo pendiente** | # Préstamos recibidos | Total movido | **Saldo pendiente** |
|---|---:|---:|---:|---:|---:|---:|
| **CMO GROUP** | 4,051 | S/122,902,183 | **S/34,001,736** | 4,049 | S/120,963,207 | **S/47,962,755** |
| **INTEGRAL** | 677 | S/29,566,170 | **S/19,560,179** | 677 | S/29,145,083 | S/12,122,836 |
| **AMERICANA** | 138 | S/7,018,944 | S/4,561,287 | 138 | S/7,018,944 | S/2,430,778 |
| **MEDARQ** | 93 | S/2,734,744 | S/585,887 | 93 | S/2,734,744 | S/1,696,918 |
| **TOTAL GRUPO** | **4,959** | **S/162,222,041** | **S/58,709,089** | 4,957 | S/159,861,978 | S/64,213,288 |

### 5.2. Análisis material

- **CMO GROUP ha movido S/123 millones en préstamos otorgados** (4,051 documentos) y **S/121M en recibidos**. Es funcionalmente un banco interno del grupo.
- **Saldo pendiente neto del grupo: S/58.7M** de cuentas por cobrar a empresas relacionadas vs **S/64.2M** por pagar — el grupo está **mayormente apalancado entre sí**.
- Si CMO presta S/123M y solo emite **1 factura** en el período (ver §2 Estado de Resultados), **no está reconociendo intereses cobrados**. Tasa de mercado TAMN ~12% anual; intereses devengados estimados sobre saldo promedio de S/40M = **~S/2M de ingreso financiero NO contabilizado**.

### 5.3. Riesgo tributario cuantificado

**Si SUNAT recalifica los préstamos sin contrato e interés como dividendos presuntos (Art. 24-A LIR):**

| Concepto | Cálculo | Monto |
|---|---|---:|
| Préstamos otorgados CMO con saldo pendiente | — | S/34,001,736 |
| Retención de IR sobre dividendos (5%) | 5% × S/34M | **S/1,700,087** |
| Multa (50% del tributo omitido, mínimo 5% UIT) | — | hasta S/850,043 |
| Intereses moratorios (TIM 0.9% mensual) | 9 meses estimado | ~S/137,707 |
| **Contingencia tributaria estimada** | | **S/2,687,837** |

**Si SUNAT solicita Estudio Técnico de Precios de Transferencia y no se presenta:**

| Concepto | Cálculo | Monto |
|---|---|---:|
| Multa por no presentar ETPT (Art. 175 num. 25 CT) | 0.6% IN, máx. 25 UIT | hasta S/132,250 (UIT 2026 S/5,290 × 25) |
| Multa por no presentar Reporte Local (Art. 176) | 0.6% IN, máx. 25 UIT | hasta S/132,250 |
| **Contingencia mínima por documentación faltante** | | **S/264,500** |

---

## 6. HALLAZGO H-05 — ATÍPICOS > S/100K (REVISITADO)

| Empresa | # Atípicos | **Suma total** | Mayor monto único | # Sin documento |
|---|---:|---:|---:|---:|
| **INTEGRAL** | **274** | **S/57,342,257** | S/590,000 | **14** |
| **MEDARQ** | 66 | S/7,700,798 | S/171,198 | 13 |
| **AMERICANA** | 24 | S/4,452,474 | S/837,661 | 8 |
| **CMO GROUP** | 18 | S/2,416,840 | S/163,818 | 0 |

### 6.1. Foco en INTEGRAL

- **274 movimientos atípicos en 5 meses** ≈ 2 atípicos por día hábil.
- **S/57.3 millones** en operaciones atípicas concentradas en una sola empresa.
- **14 atípicos > S/100K SIN DOCUMENTO FUENTE** — esta es la combinación más peligrosa.

### 6.2. Mayor atípico observado

- **AMERICANA: un solo asiento de S/837,661** (probablemente pago de obra o cobranza grande). Hay que verificar su sustento documental.

---

## 7. HALLAZGO H-07 — CONCILIACIÓN INGRESOS vs DOCUMENTOS (REVISITADO)

### 7.1. Diferencias mes a mes — INTEGRAL CONSULTORES (CRÍTICO)

| Mes | Ingresos Contables | Neto Documentos | **Diferencia** | Interpretación |
|---|---:|---:|---:|---|
| Ene | 751,975 | 1,099,314 | **−347,338** | Facturó más que registró como ingreso |
| Feb | 861,975 | 1,231,050 | **−369,074** | idem |
| **Mar** | 1,066,975 | 2,146,962 | **−1,079,986** ⚠️⚠️ | Diferencia masiva |
| Abr | 0 | 35,400 | −35,400 | Sin ingresos contables aún |
| May | 0 | 0 | 0 | Mes incompleto |
| **YTD** | **2,680,925** | **4,512,725** | **−1,831,800** | **S/1.83M de facturas sin reconocer como ingreso** |

> **🚨 HALLAZGO CRÍTICO INTEGRAL-01:**
> Hay **S/1,831,800 de facturas emitidas que NO se reflejan en ingresos contables**.
>
> **Hipótesis a verificar con el equipo contable:**
> 1. ¿Son **anticipos de clientes** reconocidos en cuenta 1213 (Anticipos recibidos) y diferidos como ingreso bajo NIIF 15? ✅ Aceptable si está documentado.
> 2. ¿Son **facturas por servicios pendientes de prestar** (deferred revenue)? ✅ Aceptable.
> 3. ¿Son **facturas emitidas que serán anuladas** con nota de crédito? ⚠️ Verificar.
> 4. ¿Son **facturas emitidas sin contabilizar como ingreso por error**? ❌ Subdeclaración de ingresos.
>
> **IGV potencial subdeclarado:** S/1,831,800 × 18% = **S/329,724** (si hipótesis 4 fuera cierta).

### 7.2. MEDARQ S.A.C.

| Mes | Ingresos Contables | Neto Documentos | Diferencia |
|---|---:|---:|---:|
| Ene | 145,000 | 171,100 | −26,100 |
| Feb | 270,000 | 377,600 | −107,600 |
| Mar | 200,000 | 236,000 | −36,000 |
| Abr | 150,000 | 177,000 | −27,000 |
| May | (25,000) | (29,500) | +4,500 |
| **YTD** | **740,000** | **932,200** | **−192,200** |

**S/192,200 acumulado de diferencia.** Patrón consistente — sugiere que MEDARQ trabaja con anticipos significativos y los reconoce como ingreso cuando se devenga el servicio. **Aceptable bajo NIIF 15** siempre que esté documentado.

### 7.3. CMO GROUP S.A. (caso inverso)

| Mes | Ingresos Contables | Neto Documentos | Diferencia |
|---|---:|---:|---:|
| Mar | 211,554 | 95,948 | **+115,606** ⚠️ |

> **🚨 HALLAZGO CMO-01:** Marzo: registró **S/115,606 más de ingreso contable que documentos emitidos**. Probablemente intereses por préstamos intercompany sin facturar. **Pregunta:** ¿se emitió nota de débito por estos intereses? Si no, hay incumplimiento de SUNAT (Art. 4 RCP).

### 7.4. AMERICANA CONSTRUCCIÓN

| Mes | Ingresos Contables | Neto Documentos | Diferencia |
|---|---:|---:|---:|
| Ene–Abr | 53,343 | 62,945 | **−9,602 cada mes (idéntico)** |

> **Hallazgo AMERICANA-03:** Diferencia exacta de S/9,601.76 repetida 4 meses idénticos. Esto sugiere un **asiento recurrente automático mal configurado** (por ejemplo, una factura mensual reconocida en documentos pero no en contabilidad). Investigar.

---

## 8. HALLAZGO H-08 — AGING DE CUENTAS POR COBRAR (REVISITADO)

### 8.1. Empresas principales

| Empresa | Saldo Total | > 90 días | **% > 90 días** | Concentración Top 3 | # Clientes |
|---|---:|---:|---:|---:|---:|
| **AMERICANA** | 3,068,350 | 3,005,405 | **97.9%** ⚠️ | 100.0% | 2 |
| **INTEGRAL** | 1,558,051 | 1,243,547 | **79.8%** | 87.5% | 7 |
| **MEDARQ** | 910,658 | 1,022,018 | **112.2%** ⚠️ | 95.3% | 4 |
| CMO GROUP | n/a (holding) | — | — | — | 0 |

> **🚨 HALLAZGO AMERICANA-04:**
> **97.9% de la CxC (S/3 millones) está vencida > 90 días, concentrada en 2 clientes.** Esto es prácticamente irrecuperable a corto plazo y debe **provisionarse como deterioro al 100% bajo NIIF 9**.
>
> **Provisión propuesta:** S/3,005,405 × 100% = **S/3,005,405 de gasto por deterioro** a reconocer en cuenta 191.
> Impacto en P&L: pérdida adicional de S/3M en AMERICANA, llevando la utilidad neta a aproximadamente **−S/3.2M YTD**.

> **🚨 HALLAZGO MEDARQ-03:**
> **112.2% > 90 días es matemáticamente imposible** → indica saldos negativos en CxC (anticipos de clientes mal clasificados como CxC negativa). Hay clientes con saldo deudor (real CxC) y otros con saldo acreedor (anticipos) compensándose. **Reclasificar** los saldos negativos a cuenta 1213 (Anticipos de clientes — pasivo).

### 8.2. Consorcios (datos históricos)

| Consorcio | Saldo Total | > 90 días |
|---|---:|---:|
| CONSORCIO DEPORTIVO ATE | 620,185 | 620,185 (100%) |
| CONSORCIO SALUD ZACARIAS | 260,446 | 260,446 (100%) |
| CONSORCIO PENITENCIARIO MISTI | 23,383 | 23,383 (100%) |

**Acción:** confirmar si estos consorcios están activos. Si no, las CxC deben castigarse o reclasificarse.

---

## 9. HALLAZGO H-09 — CUENTAS POR PAGAR (REVISITADO)

| Empresa | Saldo Total | > 90 días | # Proveedores |
|---|---:|---:|---:|
| INTEGRAL | 692,251 | 276,297 | 55 |
| AMERICANA | 71,151 | 51,884 | 15 |
| MEDARQ | 54,796 | 23,269 | 29 |
| CMO GROUP | 18,926 | **−415,183** ⚠️ | 18 |

> **HALLAZGO CMO-02:** Saldo total CxP S/18,926 pero saldo > 90 días = **−S/415,183 (negativo)**. Esto se debe a **CxP con saldo negativo** (probablemente anticipos pagados a proveedores reflejados como CxP negativa). Reclasificar a cuenta **422 (Anticipos otorgados a proveedores)**.

---

## 10. HALLAZGO H-10 — OTRAS CXC Y OTRAS CXP (NUEVO ANÁLISIS)

### 10.1. CxC relacionadas + diversas (clases 13, 14, 16, 17, 18)

| Empresa | Saldo Total | Saldos > 90 días | # Cuentas |
|---|---:|---:|---:|
| **CMO GROUP** | **37,142,456** | 48,439,972 | 32 |
| **INTEGRAL** | **15,939,270** | 13,994,576 | 33 |
| AMERICANA | 4,477,503 | 4,467,599 | 10 |
| MEDARQ | 899,052 | 760,788 | 16 |

### 10.2. CxP relacionadas + diversas (clases 43, 44, 45, 46, 47)

| Empresa | Saldo Total | Saldos > 90 días | # Cuentas |
|---|---:|---:|---:|
| **CMO GROUP** | **34,051,984** | 43,375,143 | 13 |
| **INTEGRAL** | 5,737,176 | 5,673,508 | 35 |
| AMERICANA | 2,673,337 | 2,189,484 | 14 |
| MEDARQ | 806,425 | 764,628 | 20 |

> **HALLAZGO H-18 (NUEVO):** **CMO GROUP tiene S/37M en CxC relacionadas y S/34M en CxP relacionadas — un balance intercompany neto de S/3M acreedor**. Esto confirma su rol como tesorería del grupo, **pero contradice la suma de "préstamos otorgados/recibidos" reportada (S/34M / S/48M)**.
>
> **Pregunta crítica:** ¿la diferencia entre los saldos "Otras CxC/CxP" (clases 13-18 / 43-47) y los "Préstamos" (tipo 071 documentos) representa **operaciones intercompany NO formalizadas como préstamo**? Si sí, hay un riesgo aún mayor de recalificación tributaria.

---

## 11. HALLAZGO H-11 — TRIBUTOS POR PAGAR (REVISITADO)

| Empresa | Saldo Por Pagar | Provisionado 2026 | Pagado 2026 |
|---|---:|---:|---:|
| INTEGRAL | 56,488 | 3,229,682 | 3,173,198 |
| MEDARQ | 33,970 | 510,510 | 476,541 |
| CMO GROUP | 31,778 | 9,969,053 | 10,019,165 |
| AMERICANA | 16,905 | 683,063 | 666,158 |

**Observaciones:**

- **CMO GROUP movió S/10M en tributos** — coherente con su rol de tesorería (paga tributos para todas las subsidiarias). Si es así, **debe haber refacturación o asignación** a cada subsidiaria, o se está absorbiendo el costo (problema de PT).
- **INTEGRAL pagó S/3.17M de tributos en 5 meses** — esperable para una consultora con S/2.7M de ingresos.
- Saldos por pagar son relativamente pequeños — no hay tributos vencidos significativos.

---

## 12. HALLAZGO H-12 — PASIVO LABORAL (REVISITADO)

| Empresa | Saldo Por Pagar | Total Provisionado | Total Pagado |
|---|---:|---:|---:|
| **INTEGRAL** | **688,593** | 4,455,240 | 3,766,647 |
| **MEDARQ** | **327,838** | 1,577,221 | 1,249,383 |
| CMO GROUP | 165,925 | **70,665,310** ⚠️ | 70,499,385 |
| AMERICANA | 81,524 | 888,460 | 806,936 |

> **🚨 HALLAZGO CMO-03:** CMO GROUP provisionó **S/70.6 MILLONES en obligaciones laborales** en 5 meses. Para una empresa holding sin operación, esto es **completamente desproporcionado**. Hipótesis:
> 1. CMO procesa la planilla de todo el grupo y luego refactura a cada subsidiaria.
> 2. Hay un error de clasificación (¿clase 41 usada para movimientos no laborales?).
> 3. Hay pagos masivos por participaciones de utilidades.
>
> **Pregunta:** ¿qué es el detalle de los S/70.6M? El módulo de Laboral del dashboard permite drilldown a cada movimiento.

> **HALLAZGO INTEGRAL-02:** **S/688,593 de saldo laboral pendiente** — equivale a ~25% del ingreso YTD. Verificar:
> - Cuántos trabajadores tiene INTEGRAL.
> - Si la CTS de mayo se depositó en plazo.
> - Si hay sueldos atrasados.

---

## 13. ACTUALIZACIÓN DEL TABLERO DE HALLAZGOS

### 13.1. Hallazgos críticos confirmados/agregados con datos reales

| # | Hallazgo | Empresa | Monto material | Severidad |
|---|---|---|---:|---|
| CMO-01 | Ingresos contables > Facturas emitidas en marzo (intereses sin facturar) | CMO GROUP | S/115,606 + ~S/2M proyectado | 🟠 Alta |
| CMO-02 | CxP con saldo negativo (anticipos mal clasificados) | CMO GROUP | S/415,183 | 🟡 Media |
| CMO-03 | Provisión laboral atípica (clase 41 = S/70.6M en holding) | CMO GROUP | S/70,665,310 | 🔴 Crítica |
| INTEGRAL-01 | Facturas emitidas no reflejadas como ingreso contable | INTEGRAL | **S/1,831,800** | 🔴 **Crítica** |
| INTEGRAL-02 | Pasivo laboral elevado vs ingreso | INTEGRAL | S/688,593 | 🟠 Alta |
| MEDARQ-01 | 10 asientos de ingreso (clase 70) sin factura | MEDARQ | **S/400,000** | 🔴 **Crítica** |
| MEDARQ-02 | Banco Nación detracciones con saldo negativo | MEDARQ | S/31,860 | 🟠 Alta |
| MEDARQ-03 | CxC con 112% > 90 días (anticipos mal clasificados) | MEDARQ | S/910,658 | 🟡 Media |
| AMERICANA-01 | S/35.7M en movimientos bancarios sin documento fuente | AMERICANA | **S/35,757,240** | 🔴 **Crítica** |
| AMERICANA-02 | BBVA MN con saldo contable −S/13M | AMERICANA | **S/13,034,687** | 🔴 **Crítica** |
| AMERICANA-03 | Diferencia ingresos contables vs documentos repetida idéntica 4 meses | AMERICANA | S/38,407 | 🟡 Media |
| AMERICANA-04 | 97.9% de CxC vencida > 90 días | AMERICANA | S/3,005,405 | 🔴 **Crítica** |
| H-16 (nuevo) | 5 consorcios con datos pero sin sync activo | Grupo | n/a | 🟡 Media |
| H-17 (nuevo) | Tabla Company solo tiene 1 empresa registrada | Grupo | n/a | 🟡 Media |
| H-18 (nuevo) | Saldos intercompany "Otras CxC/CxP" no cuadran con préstamos (tipo 071) | CMO GROUP | ~S/3M neto | 🟠 Alta |

### 13.2. Resumen ejecutivo de exposición material

| Concepto | Monto |
|---|---:|
| Suma de movimientos bancarios sin documento (todas las empresas) | **~S/37 millones** |
| Suma de CxP/CxC sin documento (todas las empresas) | **~S/250 millones** (mayormente CMO) |
| Facturas emitidas no reconocidas como ingreso (INTEGRAL) | **S/1.83 millones** |
| CxC potencialmente irrecuperable (AMERICANA > 90d) | **S/3.0 millones** |
| Saldo intercompany neto del grupo (préstamos + otras CxC/CxP) | **S/58-71 millones** |
| Contingencia tributaria estimada (PT + dividendos presuntos) | **S/2.7-3.0 millones** |
| IGV potencialmente subdeclarado (INTEGRAL si Dif=4 + MEDARQ ingreso s/doc) | **~S/400 mil** |

---

## 14. CALIFICACIÓN FINAL ACTUALIZADA

| Empresa | Calificación Original | Calificación Revisada | Justificación |
|---|---|---|---|
| **CMO GROUP** | 🔴 Crítico | 🟠 **Alto** (degradado) | Descuadres son mayormente apertura legítima. Pero préstamos S/123M sin documentación formal sigue siendo crítico. |
| **INTEGRAL** | 🟠 Alto | 🔴 **Crítico** (escalado) | S/1.83M de facturas sin reconocer + 617 descuadres operativos + 274 atípicos + S/688K laboral pendiente. |
| **MEDARQ** | 🟠 Alto | 🟠 **Alto** (confirmado) | S/400K de ingresos sin factura + detracciones negativas + 247 descuadres operativos. |
| **AMERICANA** | 🟡 Medio | 🔴 **Crítico** (escalado) | BBVA −S/13M + S/35.7M bancarios sin doc + CxC 97.9% vencida + margen bruto negativo. |

---

## 15. PRIORIZACIÓN INMEDIATA — TOP 10 ACCIONES (0-15 días)

1. **INTEGRAL** — explicar la diferencia de S/1.83M entre facturas emitidas e ingresos contables (especialmente marzo S/1.08M).
2. **AMERICANA** — pedir al banco BBVA estado de cuenta MN al 01/01/2026 y conciliar el −S/13M.
3. **AMERICANA** — auditar los 27 asientos bancarios sin documento por S/35.7M.
4. **MEDARQ** — explicar los 10 asientos de ingreso (clase 70) sin factura por S/400K.
5. **MEDARQ** — conciliar Banco Nación Detracciones (saldo contable −S/31,860 vs banco real).
6. **CMO GROUP** — auditar la provisión laboral S/70.6M en clase 41 (¿error o procesamiento de planilla del grupo?).
7. **AMERICANA** — provisionar deterioro NIIF 9 sobre CxC > 90 días (S/3M).
8. **CMO GROUP** — formalizar contratos de mutuo para los 4,051 préstamos otorgados (S/123M total).
9. **TODOS** — firmar conciliación bancaria al 30/04/2026.
10. **GRUPO** — definir si los 5 consorcios deben reincorporarse al sync.

---

## 16. CONCLUSIÓN FINAL

Con los datos reales actualizados, la auditoría revela que el grupo tiene exposición material en:

- **~S/72 millones en transacciones** mal documentadas o no reconciliadas (sin doc + descuadres operativos + facturas no contabilizadas).
- **~S/13 millones en saldos bancarios irreales** (AMERICANA BBVA MN).
- **~S/3 millones en contingencias tributarias** estimadas.
- **~S/3 millones en CxC probablemente irrecuperables** (AMERICANA).

**Recomendación al Directorio:** Activar el plan de remediación de 10 semanas **con foco prioritario en AMERICANA e INTEGRAL** antes que en CMO o MEDARQ. AMERICANA presenta el cuadro más alarmante por la combinación de margen bruto negativo, saldo bancario irreal y CxC vencida masiva.

---

**Próxima validación de datos:** lunes 18 de mayo de 2026 (post primer ciclo de remediación de 7 días).
