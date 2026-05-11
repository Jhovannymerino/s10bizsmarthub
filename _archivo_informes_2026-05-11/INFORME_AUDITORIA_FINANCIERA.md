# INFORME DE AUDITORÍA FINANCIERA Y DE CONTROL CONTABLE

**Empresas auditadas:**
- CMO GROUP S.A. (RUC 22011489)
- INTEGRAL CONSULTORES S.A.C. (RUC 80688541)
- MEDARQ S.A.C. (RUC 80688706)
- COMPAÑÍA AMERICANA DE CONSTRUCCIÓN Y EQUIPAMIENTO S.A.C. (RUC 80688524)

**Período auditado:** Ejercicio 2026 (1 de enero al 11 de mayo) — con referencias comparativas 2025
**Fecha del informe:** 11 de mayo de 2026
**Fuente de datos:** S10 ERP — base de datos CMO.dbo (AsientoContable + vw_12DocumentosPorCobrar / vw_12DocumentosPorPagar)
**Plataforma de extracción:** BizSmartHub (sync agent con conexión VPN FortiGate a la base productiva)
**Marco normativo aplicado:** Plan Contable General Empresarial (PCGE — DS 011-2010-EF), Normas Internacionales de Información Financiera (NIIF), Código Tributario peruano, Ley del IGV, Ley del Impuesto a la Renta, Ley 28194 (Bancarización), Resolución de Superintendencia 286-2009/SUNAT (Libros Electrónicos), ISA 315 / 330 (riesgo y respuestas de auditoría).

---

## I. RESUMEN EJECUTIVO

### I.1. Naturaleza del trabajo

Esta es una **auditoría de control contable y de calidad de datos** sobre el sistema S10 — no es una auditoría de estados financieros con opinión, sino un diagnóstico de:

1. **Integridad** de los asientos (descuadres, contrapartidas, documentación fuente).
2. **Exactitud y valuación** de las cuentas principales (caja, CxC, CxP, tributos, laboral).
3. **Razonabilidad** de las cifras (atípicos, conciliación ingresos vs documentos).
4. **Cumplimiento normativo** preliminar (PCGE, Libros Electrónicos, bancarización, detracciones).

La auditoría se ejecutó mediante procedimientos analíticos automatizados sobre la totalidad de la base de datos (no muestreo). La cobertura es del **100% de los asientos** del período.

### I.2. Calificación general por empresa

| Empresa | Calificación | Hallazgos críticos | Riesgo tributario | Recomendación inmediata |
|---|---|---|---|---|
| **CMO GROUP S.A.** | 🔴 **CRÍTICO** | 6,438 documentos con descuadre | Alto | Auditoría forense de asientos de apertura y préstamos intercompany |
| **INTEGRAL CONSULTORES** | 🟠 **ALTO** | 274 atípicos > S/100K; 1,313 descuadres | Medio-Alto | Revisión de movimientos > S/100K y conciliación bancaria |
| **MEDARQ S.A.C.** | 🟠 **ALTO** | Bancos con saldo negativo; 350 descuadres | Medio | Regularizar saldos iniciales de cuentas bancarias |
| **AMERICANA CONSTRUCCIÓN** | 🟡 **MEDIO** | 323 descuadres; 24 atípicos | Medio | Revisión de aging de CxP y honorarios |

### I.3. Top 7 hallazgos críticos (transversales)

| # | Hallazgo | Empresas afectadas | Impacto | Severidad |
|---|---|---|---|---|
| **H-01** | Descuadres masivos por NroD (Débito ≠ Crédito agrupado por documento fuente) | Las 4 | Pérdida de integridad del Libro Diario; riesgo de cuestionamiento SUNAT | 🔴 Crítica |
| **H-02** | Asientos sin documento fuente (NroD = NULL) en clases de ingreso (70/75) y costo (94) | Las 4 | Incumplimiento PCGE; el Libro Diario debe referenciar documento | 🔴 Crítica |
| **H-03** | Saldos bancarios negativos por ausencia de asiento de apertura | MEDARQ (BBVA ME, BCO Nación), otras | Estados financieros no fidedignos; conciliación bancaria deficiente | 🟠 Alta |
| **H-04** | Volumen masivo de préstamos intercompany sin documentación clara (4,051 en CMO) | CMO GROUP principalmente | Riesgo de presunción SUNAT de dividendos; precios de transferencia | 🟠 Alta |
| **H-05** | 274 asientos atípicos > S/100K en una sola empresa (INTEGRAL) | INTEGRAL principalmente | Materialidad alta; necesita revisión por excepción | 🟠 Alta |
| **H-06** | Cuenta de detracciones Banco Nación con saldo negativo | MEDARQ (S/-31,860) | Riesgo de no liberación de fondos; saldo de detracciones es un activo restringido | 🟠 Alta |
| **H-07** | Falta de conciliación entre ingresos contables (clase 70) y facturas emitidas | Por validar empresa por empresa | Riesgo de subdeclaración del IGV / Renta | 🟠 Alta |

---

## II. METODOLOGÍA

### II.1. Marco de referencia normativo

| Norma | Aplicación |
|---|---|
| **PCGE — DS 011-2010-EF** | Estructura de cuentas obligatoria. Toda empresa peruana debe llevar contabilidad usando el PCGE. |
| **NIIF Plenas / NIIF PYMES** | Empresas con ingresos > 1,700 UIT (S/8.93M en 2026) deben aplicar NIIF plenas (Resolución 045-2010-EF/94). |
| **RS 286-2009/SUNAT** | Obligación del Libro Diario, Libro Mayor y Libro de Inventarios y Balances en formato electrónico (PLE) para sujetos con ingresos > 75 UIT. |
| **TUO Código Tributario — DS 133-2013-EF** | Prescripción 4 años. Multa por libros con atraso: 0.6% IN (Art. 175, num. 5). |
| **Ley 28194 (Bancarización)** | Pagos > S/3,500 (o US$ 1,000) deben canalizarse por medios bancarios. Sanción: pérdida del crédito fiscal y deducción tributaria. |
| **DS 155-2004-EF (Detracciones)** | Sistema de pago adelantado del IGV. La cuenta de detracciones (Banco Nación) NO PUEDE TENER SALDO NEGATIVO contablemente. |
| **ISA 315 (Identificación de Riesgo)** | Marco internacional para evaluar el riesgo de error material. |

### II.2. Procedimientos aplicados

1. **Pruebas analíticas globales** — análisis comparativo de magnitudes por empresa y por período.
2. **Pruebas de exhaustividad** — conteo de asientos vs documentos, verificación de pares Débito/Crédito por NroD.
3. **Pruebas de existencia** — validación de que cada asiento referencie un documento fuente (NroD ≠ NULL para operaciones materiales).
4. **Pruebas de corte (cut-off)** — verificación de que asientos del período se registran en el período correcto.
5. **Identificación de atípicos** — todos los movimientos > S/100,000 son revisados por excepción.
6. **Conciliación cruzada** — ingresos contables (clase 70) vs facturas emitidas (vw_12DocumentosPorCobrar).
7. **Aging de cuentas** — análisis de antigüedad de CxC, CxP, Otras CxC/CxP (bandas 0-30 / 31-60 / 61-90 / >90 días).

### II.3. Materialidad

- **Materialidad global del grupo:** S/100,000 (umbral para atípicos).
- **Materialidad de planeamiento por empresa:**
  - CMO GROUP: S/250,000 (holding con flujos altos)
  - INTEGRAL: S/150,000
  - MEDARQ: S/75,000 (5% de ingresos proyectados)
  - AMERICANA: S/100,000
- **Materialidad de desempeño:** 75% de la materialidad global = S/75,000.
- **Tolerancia para errores triviales (CTT):** S/5,000.

---

## III. CONTEXTO DE LAS EMPRESAS

| Empresa | Naturaleza | Operación principal | Clase de ingreso |
|---|---|---|---|
| **CMO GROUP S.A.** | Holding del grupo | Sin operación comercial directa; tesorería intercompany | 75 (Otros ingresos de gestión) |
| **INTEGRAL CONSULTORES** | Servicios | Consultoría profesional | 70 |
| **MEDARQ S.A.C.** | Servicios | Servicios profesionales (gestión de proyectos / arquitectura) | 70 |
| **AMERICANA CONSTRUCCIÓN** | Construcción y equipamiento | Servicios de construcción / equipamiento | 70 |

### III.1. Tamaño relativo de cada empresa (filas en BD productiva, 2026)

| Empresa | Asientos Clases 70-97 | Facturas emitidas | Facturas recibidas | Honorarios | CxP proveedores | Préstamos otorgados | Bancos |
|---|---:|---:|---:|---:|---:|---:|---:|
| CMO GROUP | 223 | 1 | 68 | 22 | 18 | 4,051 | 23 |
| INTEGRAL | 1,380 | 102 | 420 | 30 | 55 | 677 | 10 |
| MEDARQ | 640 | 19 | 264 | 17 | 29 | 93 | 8 |
| AMERICANA | 337 | 14 | 105 | 7 | 15 | 138 | 9 |

**Observaciones preliminares:**
- CMO GROUP emite apenas **1 factura** en lo que va del año pero tiene **4,051 documentos de préstamos otorgados** → confirma su naturaleza de "banca interna del grupo". Esto es esperable pero genera **alto riesgo de precios de transferencia** (ver §VII.3).
- INTEGRAL es la empresa con mayor actividad comercial: 102 facturas emitidas y 1,380 asientos de ingresos/costos.
- MEDARQ tiene una relación **264 facturas recibidas / 19 emitidas = 13.9** que merece análisis (¿demasiado gasto vs ingreso?).

---

## IV. HALLAZGOS POR ÁREA

---

### IV.A. CONTROL CONTABLE — INTEGRIDAD DEL LIBRO DIARIO

---

#### **HALLAZGO H-01: Descuadres masivos por documento fuente (NroD)**

**Diagnóstico técnico:**

Para cada `NroD` (identificador único del documento que originó el asiento) se sumaron las contrapartidas Débito y Crédito. Un Libro Diario íntegro debe cumplir Σ Débitos = Σ Créditos **para cada documento individual**, no solo a nivel del asiento entero.

| Empresa | Documentos con descuadre | Líneas afectadas (aprox) | Hallazgo |
|---|---:|---:|---|
| CMO GROUP S.A. | **6,438** | ~25,000 | Crítico |
| INTEGRAL | 1,313 | ~5,000 | Alto |
| MEDARQ | 350 | ~1,400 | Medio |
| AMERICANA | 323 | ~1,300 | Medio |

**Diagnóstico gerencial:**

El sistema S10 permite registrar asientos manuales donde el documento fuente está reflejado en **más de un asiento contable** (split journal), o asientos que ajustan parcialmente un documento previo. Estos descuadres por NroD pueden tener tres orígenes legítimos:

1. **Asientos de apertura del período** — el saldo inicial de cada cuenta se carga como una sola línea, lo cual técnicamente "descuadra" si no se considera la contrapartida en otra cuenta.
2. **Asientos de ajuste** que solo afectan una pierna de un documento ya registrado.
3. **Notas de crédito o débito posteriores** que comparten el NroD del documento original.

Sin embargo, **6,438 documentos en CMO GROUP** supera ampliamente lo razonable. Probablemente refleja:
- Asientos de cierre/apertura mal registrados (afectaron NroD en lugar de un asiento independiente).
- Pagos múltiples que comparten el mismo NroD del documento original.
- Errores de digitación que el sistema no rechazó.

**Riesgo regulatorio:**
- **SUNAT Libro Diario electrónico:** la presentación del PLE requiere que cada asiento esté cuadrado. SUNAT puede observar la subsanación de descuadres en una fiscalización (Art. 175 del CT — sanción 0.6% IN).
- **NIIF (NIC 1, Presentación de EEFF):** la integridad de los registros es presupuesto de la razonabilidad de los EEFF.

**Propuesta de solución:**

| Plazo | Acción |
|---|---|
| Inmediato | Generar reporte detallado de los 6,438 documentos descuadrados de CMO clasificados por glosa. Identificar si corresponden a "Asiento de Apertura" (legítimos) o a operaciones del año (errores). |
| 30 días | Reclasificar los asientos de apertura para que NO compartan NroD con documentos operativos. Crear un NroD especial "OPEN-{year}" o usar `NroD = NULL` con glosa explícita. |
| 60 días | Establecer control automático en S10 que rechace asientos donde Σ Débito ≠ Σ Crédito por NroD (a discutir con el proveedor del ERP S10). |
| Continuo | Reporte semanal de descuadres por NroD revisado por el Gerente Contable. |

**Preguntas para el equipo contable (CMO GROUP):**

1. ¿En qué momento se cargaron los asientos de apertura? ¿Fueron migrados desde otro sistema?
2. ¿Por qué los asientos de apertura usan NroD operativo en lugar de un identificador propio?
3. ¿Existe un control para impedir que dos asientos diferentes compartan el mismo NroD?
4. De los 6,438 descuadres, ¿cuántos corresponden a operaciones del año 2026 y cuántos a "Asiento de Apertura"?
5. ¿Quién aprueba los asientos manuales en el sistema S10? ¿Hay segregación entre quien los registra y quien los aprueba?

---

#### **HALLAZGO H-02: Asientos sin documento fuente (NroD = NULL) en clases materiales**

**Diagnóstico técnico:**

| Empresa | Asientos sin NroD (clases 10, 12-17, 40-43, 46, 70, 75, 91, 94) | Clases con más asientos sin NroD |
|---|---:|---|
| CMO GROUP | 1,932 | 12 (Anticipos clientes), 17 (Entregas a rendir), 42 (CxP) |
| INTEGRAL | 460 | 12, 42, 70, 94 |
| MEDARQ | 244 | 12, 42, 94 |
| AMERICANA | 99 | 12, 42, 94 |

**Diagnóstico gerencial:**

El campo `NroD` en S10 identifica el **documento fuente** (factura, boleta, recibo por honorarios, ticket de detracción, etc.) que originó el asiento. Cuando este campo es NULL, el asiento existe **sin respaldo documental dentro del sistema**.

**Esto tiene tres causas legítimas:**

1. **Asientos de apertura** ("Asiento de Apertura" en glosa) — el saldo inicial del período no proviene de un documento. ✅ Aceptable.
2. **Provisiones contables** (depreciación, amortización, vacaciones, gratificaciones truncas, CTS por pagar) — son cálculos internos. ✅ Aceptable.
3. **Reclasificaciones entre cuentas** del mismo balance. ✅ Aceptable.

**Y tres causas inaceptables:**

4. **Asientos de ingresos (clase 70/75) sin factura asociada** — riesgo de subdeclaración del IGV. ❌ Crítico.
5. **Asientos de gasto (clase 94, 60-68) sin comprobante** — gasto NO DEDUCIBLE (Art. 37 LIR). ❌ Crítico.
6. **Movimientos bancarios sin sustento** — riesgo SUNAT por bancarización (Ley 28194). ❌ Crítico.

**Riesgo regulatorio:**

- **Art. 19 Ley del IGV:** el crédito fiscal solo procede si el comprobante de pago está anotado en el Registro de Compras. Si el asiento de gasto no tiene NroD, el comprobante puede no estar registrado correctamente.
- **Art. 37 LIR:** la deducción del gasto requiere comprobante. Sin él, hay reparo tributario.
- **Ley 28194 Bancarización:** pagos > S/3,500 sin medio bancario pierden crédito fiscal y deducción. Asientos bancarios sin NroD pueden ocultar este incumplimiento.

**Propuesta de solución:**

| Acción | Responsable | Plazo |
|---|---|---|
| Drilldown por clase desde el dashboard BizSmartHub para revisar entrada por entrada | Gerente Contable | 7 días |
| Clasificar cada asiento sin NroD en "legítimo" (apertura/provisión) o "ilegítimo" (falta documento) | Equipo Contable | 30 días |
| Para los ilegítimos: adjuntar el documento fuente al asiento (modificación en S10) | Equipo Contable | 60 días |
| Política: ningún asiento de clases 60-68, 70, 75, 91, 94 puede registrarse sin NroD | Gerencia Financiera | Inmediato |
| Definir glosas estándar para "Asiento de Apertura {año}", "Provisión {tipo} {mes}", "Reclasificación {motivo}" | Gerencia Contable | 30 días |

**Preguntas para el equipo contable:**

1. De los **460 asientos sin NroD en INTEGRAL**, ¿cuántos están en clases 70 (ingresos)? Estos requieren factura emitida obligatoriamente.
2. ¿Por qué el sistema S10 permite registrar un asiento de ingreso sin documento fuente?
3. ¿Existen asientos manuales que reclasifican comisiones, intereses ganados, etc., que no tienen comprobante porque son cálculos internos? ¿Cómo se sustentan ante SUNAT?
4. ¿Quién registra los asientos de cierre mensual y bajo qué política?

---

#### **HALLAZGO H-03: Asientos atípicos > S/100,000**

**Diagnóstico técnico:**

Asientos individuales (una sola línea) con débito o crédito que excede S/100,000. Excluye automáticamente entradas con glosa "Apertura" o "Cierre".

| Empresa | # atípicos | Mayor monto observado | Concentración |
|---|---:|---|---|
| INTEGRAL | **274** | — (revisar tabla) | Muy alta |
| MEDARQ | 66 | — | Media |
| AMERICANA | 24 | — | Baja |
| CMO GROUP | 18 | — | Baja (esperado por ser holding) |

**Diagnóstico gerencial:**

INTEGRAL CONSULTORES tiene una concentración inusualmente alta de movimientos grandes. En consultoría profesional, los movimientos > S/100K suelen corresponder a:
- Pagos consolidados de honorarios al equipo.
- Distribución de utilidades o dividendos.
- Transferencias intercompany.
- Pagos de impuestos (Renta anual, IGV mensual de meses fuertes).

**Sin contexto adicional**, 274 movimientos en menos de 5 meses (~55 al mes, casi 3 por día hábil) sugiere que **se están realizando operaciones materiales sin segregación adecuada de aprobación**.

**Propuesta de solución:**

| Plazo | Acción |
|---|---|
| Inmediato | Listar los 274 atípicos con glosa, fecha, tercero y cuenta contable. Drilldown automatizado disponible en módulo de Auditoría. |
| 30 días | Para cada atípico, validar que exista: comprobante de pago, autorización por escrito (firma autorizada), y registro en libro caja. |
| 60 días | Definir política de aprobación: pagos > S/100K requieren doble firma. Pagos > S/250K requieren aprobación de Directorio. |
| Continuo | Reporte mensual de atípicos al Comité Financiero. |

**Preguntas para el equipo contable y financiero (INTEGRAL):**

1. ¿Cuál es la política actual de aprobación para pagos > S/100K?
2. ¿Existe segregación entre quien autoriza, quien ejecuta y quien registra en el ERP?
3. ¿Cuántos de los 274 atípicos corresponden a pagos a empresas relacionadas del grupo? Si > 50%, hay que evaluar precios de transferencia.

---

### IV.B. CICLO DE INGRESOS Y CUENTAS POR COBRAR

---

#### **HALLAZGO H-07: Conciliación ingresos contables vs documentos emitidos**

**Diagnóstico técnico:**

Se compara, mes a mes:
- Σ Crédito - Σ Débito en cuentas clase 70 (con `NroD IS NOT NULL`) = **Ingresos Contables**
- Σ Total facturas emitidas (vw_12DocumentosPorCobrar, excluyendo notas de crédito) − Σ Notas de Crédito = **Neto Documentos**
- **Diferencia = Ingresos Contables − Neto Documentos**

Si Diferencia ≈ 0 mensual: ✅ correcto.
Si Diferencia > 0: documento emitido pero NO contabilizado como ingreso.
Si Diferencia < 0: ingreso contable sin documento emitido (riesgo SUNAT alto).

**Diagnóstico gerencial:**

El módulo BizSmartHub muestra esta conciliación mes a mes en la pestaña **Auditoría → Conciliación Ingresos vs Documentos**.

Las diferencias que excedan ±S/10,000 mensual deben ser explicadas. Causas comunes:

1. **Facturas emitidas en el último día del mes pero contabilizadas el siguiente** — diferencia de corte (cut-off). Aceptable si se neutraliza el mes siguiente.
2. **Anticipos de clientes** (cuenta 122) — el ingreso contable solo se reconoce cuando se devenga, pero la factura puede haberse emitido antes.
3. **Servicios facturados pero no prestados** (deferred revenue / NIIF 15).
4. **Ingresos contabilizados sin emitir factura** — ¡ALERTA SUNAT! Indica facturación informal.
5. **Ingresos por intereses financieros, otros ingresos** — clase 77, 78 (no en clase 70).

**Riesgo regulatorio:**

- **NIIF 15** (Ingresos de actividades ordinarias procedentes de contratos con clientes): exige reconocimiento al transferir el control. Una factura emitida no necesariamente es ingreso devengado.
- **Art. 57 LIR:** ingresos se reconocen cuando se devenguen.
- **SUNAT — Cruce de información:** SUNAT compara el Registro de Ventas con la PDT 621 (IGV mensual). Diferencias > 5% generan observaciones.

**Propuesta de solución:**

| Acción | Empresa | Plazo |
|---|---|---|
| Generar conciliación mensual para los 5 meses de 2026 | Las 4 | Inmediato |
| Explicar toda diferencia > S/10K con detalle de partidas conciliatorias | Las 4 | 15 días |
| Documentar el procedimiento de cierre mensual con la conciliación como paso obligatorio | Las 4 | 30 días |
| Auditar a un cliente real de cada empresa: ¿el ingreso reconocido corresponde a una factura cobrada o por cobrar válida? | Las 4 | 45 días |

**Preguntas para el equipo contable:**

1. ¿Existe actualmente un procedimiento formal de conciliación ingresos contables vs facturas emitidas en el cierre mensual?
2. ¿Las notas de crédito se aplican en el período de la factura original o en el período de emisión de la nota? (NIIF 15 vs SUNAT).
3. ¿Se han emitido notas de crédito para anular facturas? Si sí, ¿cuántas y por qué motivo?

---

#### Análisis específico — MEDARQ:

- **19 facturas emitidas** vs **264 facturas recibidas** = ratio 1:14.
- Si MEDARQ es una empresa de servicios, esto sugiere que el modelo de negocio es: **muchos gastos pequeños / pocas facturaciones grandes (proyectos)**. Es razonable para una consultora de arquitectura que factura proyectos cerrados.
- **Pero:** verificar que esos 264 documentos recibidos no incluyan gastos personales o gastos no deducibles.

#### Análisis específico — INTEGRAL:

- **102 facturas emitidas** + **30 honorarios** = ~132 ingresos.
- **420 facturas recibidas** + **30 honorarios** = ~450 gastos.
- Ratio 1:3.4 — más razonable para una consultora con equipo grande de profesionales.

---

#### **HALLAZGO H-08: Antigüedad de Cuentas por Cobrar**

**Diagnóstico técnico:**

Aging de clase 12 (cuentas por cobrar comerciales):

| Empresa | 0-30 días | 31-60 | 61-90 | >90 días | % >90 días | Concentración Top 3 |
|---|---:|---:|---:|---:|---:|---:|
| CMO GROUP | (sin CxC operativas, sólo intercompany) | | | | | |
| INTEGRAL | A revisar en dashboard | | | | | |
| MEDARQ | A revisar | | | | | |
| AMERICANA | A revisar | | | | | |

**Diagnóstico gerencial:**

El dashboard muestra el DSO (Days Sales Outstanding) por empresa. Umbrales:
- DSO ≤ 60 días: 🟢 Saludable
- DSO 61-90 días: 🟡 Atención
- DSO > 90 días: 🔴 Crítico — provisión por deterioro probable (NIIF 9)

**Riesgo NIIF 9 (Instrumentos Financieros — Modelo de Pérdidas Esperadas):**

NIIF 9 exige reconocer una provisión por **pérdida crediticia esperada** desde el reconocimiento inicial de la CxC, no esperar al deterioro objetivo (como exigía la NIC 39). Las empresas deben tener una **matriz de provisión** con porcentajes por banda de antigüedad.

**Propuesta de solución:**

| Plazo | Acción |
|---|---|
| 30 días | Validar que cada empresa tenga una **matriz de provisión por deterioro** documentada (% por banda de antigüedad). |
| 60 días | Calcular provisión por deterioro al 31/12/2026 según matriz. Reconocer en cuenta 191 (Provisión por deterioro). |
| Continuo | Revisar mensualmente las CxC > 90 días para evaluar acción de cobranza o castigo. |

---

### IV.C. CICLO DE COMPRAS Y CUENTAS POR PAGAR

---

#### **HALLAZGO H-09: Antigüedad de Cuentas por Pagar (clase 42)**

**Diagnóstico técnico:**

| Empresa | # Proveedores | Acción recomendada |
|---|---:|---|
| INTEGRAL | 55 | Revisar Top 10 por saldo y antigüedad |
| MEDARQ | 29 | Revisar todos los proveedores con saldo > S/10K |
| CMO GROUP | 18 | Bajo volumen — revisión exhaustiva |
| AMERICANA | 15 | Revisión exhaustiva |

**Riesgo:**
- CxP > 90 días sin pago pueden ser refacturadas (intereses moratorios) → gasto financiero adicional.
- CxP > 4 años → prescripción (Art. 1989 Código Civil) → reconocer ingreso en cuenta 759 (Otros ingresos por prescripción).

**Preguntas para el equipo contable:**
1. ¿Existen CxP que ya prescribieron y siguen en libros? Si sí, hay que ajustarlas.
2. ¿Las CxP > 90 días han sido confirmadas con el proveedor (circularización)?

---

#### **HALLAZGO H-10: Honorarios profesionales recibidos (RUC con guion 4ta categoría)**

**Diagnóstico técnico:**

Recibos por Honorarios (tipo de documento 010) son rentas de **cuarta categoría** del IR. Requieren:

1. **Retención del 8%** si el monto excede S/2,000 por recibo (Art. 74 LIR).
2. Exclusión de retención: si el perceptor solicita suspensión y el ingreso anual no excede 7 UIT × 12 = S/4,725 × 12 (verificar UIT 2026).
3. **Registro en el PDT 621** mensual.

| Empresa | Honorarios recibidos 2026 |
|---|---:|
| INTEGRAL | 30 |
| MEDARQ | 17 |
| CMO GROUP | 22 |
| AMERICANA | 7 |

**Propuesta de solución:**
1. Listar cada recibo por honorarios con detalle: emisor, monto bruto, retención aplicada (8% si > S/2,000), monto neto.
2. Verificar que la retención fue declarada y pagada en el PDT-PLAME.
3. Para honorarios > S/3,500: verificar bancarización (Ley 28194).

---

### IV.D. TESORERÍA Y CONCILIACIÓN BANCARIA

---

#### **HALLAZGO H-03 (DETALLE): Saldos bancarios negativos — MEDARQ**

**Diagnóstico técnico:**

| Cuenta | Saldo Inicial 2026 | Entradas | Salidas | Saldo Final | Observación |
|---|---:|---:|---:|---:|---|
| BBVA CONTINENTAL ME (10410014) | 0 | 225,168 | 276,755 | **-51,587** | Saldo negativo |
| BBVA CONTINENTAL MN (10410013) | 0 | 1,395,021 | 1,354,683 | 40,338 | Normal |
| BCO NACIÓN DETRACCIONES (10710021) | 0 | 136,644 | 168,504 | **-31,860** | Saldo negativo CRÍTICO |
| Transf. Bancarias (10300010) | 0 | 175,901 | 171,348 | 4,553 | Normal |
| Caja Chica MN (10100021) | 0 | 4,260 | 3,000 | 1,260 | Normal |

**Diagnóstico gerencial:**

**SaldoInicial = 0 para TODAS las cuentas bancarias** = MEDARQ no tiene asientos de apertura de saldos bancarios. El sistema "asume" que las cuentas iniciaron en 0 el 1 de enero de 2026, lo cual es **financieramente imposible**.

**Realidad del origen:** la conciliación bancaria de MEDARQ no se inició desde el sistema. Los saldos contables están desconectados de la realidad del estado de cuenta bancario.

**Consecuencias:**

1. **BBVA ME -S/51,587 contable** mientras el banco probablemente muestra saldo positivo. → Estados financieros **no fidedignos**.
2. **BCO Nación Detracciones -S/31,860** — la cuenta de detracciones es un **activo restringido** que el banco devuelve a la empresa cuando se libera. Si contablemente está negativa, indica:
   - Se registraron pagos con detracción sin registrar la retención al cliente.
   - O el saldo inicial real es positivo y nunca se cargó.
   - Hay riesgo de que **SUNAT bloquee la liberación** porque los registros no cuadran con la realidad.

**Riesgo regulatorio:**

- **NIC 1.32 (Compensación):** activos y pasivos no se compensan a menos que una norma lo permita. Un saldo bancario "negativo" se debe presentar como **sobregiro pasivo** en clase 45 (Obligaciones financieras), no como activo negativo.
- **DS 155-2004-EF (Detracciones):** la cuenta de detracciones funciona como cuenta de ahorro restringida. No puede ser un pasivo contable.
- **SUNAT — Procedimiento de liberación de fondos:** SUNAT puede pedir conciliación entre el saldo en libros y el saldo del banco. Una diferencia > 5% genera observaciones.

**Propuesta de solución:**

| Plazo | Acción | Responsable |
|---|---|---|
| **Inmediato** | Pedir al banco el saldo contable al 1 de enero de 2026 de las 4 cuentas afectadas. | Tesorería |
| **Inmediato** | Pedir al banco el saldo al 30 de abril de 2026 para conciliar. | Tesorería |
| 15 días | Cargar **asiento de apertura** con el saldo inicial real de cada cuenta (cuenta 10x débito vs 591/592 crédito). | Contabilidad |
| 15 días | Generar conciliación bancaria al 30/04/2026 documentando partidas conciliatorias (cheques en tránsito, depósitos no acreditados). | Contabilidad |
| 30 días | Reclasificar cualquier saldo realmente negativo (sobregiro) a clase 45. | Contabilidad |
| Continuo | Conciliación bancaria mensual obligatoria, firmada por el contador y revisada por el Gerente Financiero. | Equipo |

**Preguntas para el equipo contable y financiero (MEDARQ):**

1. **¿Cuándo se implementó S10 en MEDARQ?** Si fue durante 2026, ¿por qué los saldos iniciales no se migraron?
2. **¿La empresa tiene línea de sobregiro con BBVA en ME?** Si sí, el sobregiro debe reflejarse en clase 4511 (Sobregiros bancarios), no en clase 10.
3. **¿Cuándo fue la última conciliación bancaria firmada por el contador?** ¿Existe un libro físico/electrónico de conciliaciones?
4. **Cuenta de detracciones:** ¿alguna vez se ha solicitado la liberación de fondos? ¿Cuál fue la respuesta de SUNAT?
5. **Estados de cuenta bancarios:** ¿se reciben y archivan mensualmente? ¿Quién los revisa?

---

### IV.E. TRIBUTOS POR PAGAR (Clase 40)

---

#### **HALLAZGO H-11: Saldos y movimientos de tributos**

**Diagnóstico técnico:**

| Empresa | # Cuentas tributarias activas | Transacciones tributarias 2026 |
|---|---:|---:|
| INTEGRAL | 14 | 705 |
| MEDARQ | 12 | 394 |
| CMO GROUP | 19 | 261 |
| AMERICANA | 11 | 174 |

**Cuentas tributarias clave a revisar:**

| Cuenta PCGE | Nombre | Riesgo |
|---|---|---|
| 4011 | IGV — Cuenta propia | Saldo acreedor = IGV por pagar; saldo deudor = crédito fiscal. |
| 4017 | Impuesto a la Renta (3ra cat.) | Por pagar |
| 4018 | Otros impuestos y contraprestaciones | EsSalud, ITAN, etc. |
| 4031 | Impuesto Selectivo al Consumo | Si aplica |
| 4032 | Impuesto Temporal a los Activos Netos | ITAN — pago a cuenta |
| 4071 | ESSALUD | Aporte empleador 9% |
| 4032 | ONP / AFP | Retención empleado |

**Propuesta de solución:**

| Acción | Plazo |
|---|---|
| Conciliación mensual de IGV: saldo contable cuenta 4011 vs declaración PDT 621 | Mensual |
| Verificar que el ITAN se haya provisionado (4% × Activos Netos > S/1M, descontados de pagos a cuenta) | Inmediato |
| Conciliación de retenciones 4ta y 5ta categoría con PDT-PLAME | Mensual |

**Preguntas:**

1. ¿Las declaraciones PDT 621, PDT-PLAME e ITAN están al día?
2. ¿Existen multas tributarias pendientes? Si sí, ¿están provisionadas en cuenta 6592 o 6411?
3. ¿La cuenta 4011 (IGV) tiene saldo deudor (a favor) o acreedor (por pagar)? Si es deudor por mucho tiempo, evaluar si se puede solicitar devolución o aplicar contra otros impuestos.

---

### IV.F. PASIVO LABORAL (Clase 41)

---

#### **HALLAZGO H-12: Obligaciones laborales (CTS, gratificaciones, vacaciones)**

**Diagnóstico técnico:**

| Empresa | # Conceptos laborales | Transacciones laborales |
|---|---:|---:|
| INTEGRAL | 5 | 117 |
| CMO GROUP | 6 | 58 |
| MEDARQ | 4 | 53 |
| AMERICANA | 4 | 34 |

**Cuentas clave clase 41 (PCGE):**

| Cuenta | Concepto | Periodicidad |
|---|---|---|
| 4111 | Sueldos y salarios por pagar | Mensual |
| 4115 | Vacaciones por pagar | Provisión mensual (1/12 del sueldo) |
| 4117 | CTS por pagar | Depósito mayo y noviembre |
| 4118 | Otras remuneraciones | — |
| 4121 | Participaciones por pagar (utilidades) | Anual (5% de utilidad para servicios) |

**Riesgo:**

- **CTS no depositada en plazo** (mayo y noviembre) — sanción de SUNAFIL (UIT 1-50 dependiendo de tamaño de empresa).
- **Vacaciones acumuladas > 1 año** — pérdida de derecho del empleador a no pagar el doble. Riesgo: trabajador puede exigir doble pago.
- **Participación 5%** (Decreto Legislativo 892) — empresas con > 20 trabajadores que generan rentas de 3ra categoría deben distribuir 5% de utilidad.

**Propuesta de solución:**

| Plazo | Acción |
|---|---|
| Inmediato | Verificar que la CTS de mayo 2026 se haya depositado dentro del plazo (15 mayo). |
| 30 días | Listar trabajadores con vacaciones acumuladas > 30 días. |
| Anual | Calcular y reservar la participación 5% si la empresa tiene > 20 trabajadores y utilidad. |

**Preguntas:**

1. ¿Cuántos trabajadores tiene cada empresa? ¿Aplica la obligación de participación 5%?
2. ¿La CTS de noviembre 2025 y mayo 2026 fueron depositadas en plazo?
3. ¿Existe alguna demanda laboral abierta? Si sí, ¿está provisionada (NIC 37)?

---

### IV.G. PRÉSTAMOS INTERCOMPANY Y TRANSFERENCIAS

---

#### **HALLAZGO H-04 (DETALLE): Préstamos otorgados y recibidos**

**Diagnóstico técnico:**

| Empresa | Préstamos otorgados | Préstamos recibidos | ¿Simétrico? |
|---|---:|---:|---|
| CMO GROUP | 4,051 | 4,049 | ✅ Casi simétrico |
| INTEGRAL | 677 | 677 | ✅ Simétrico |
| MEDARQ | 93 | 93 | ✅ Simétrico |
| AMERICANA | 138 | 138 | ✅ Simétrico |

**Diagnóstico gerencial:**

La **simetría perfecta** entre préstamos otorgados y recibidos entre las 4 empresas confirma que:

1. **CMO GROUP funciona como "banca interna"** del grupo — presta a las otras 3.
2. Las otras 3 reciben préstamos de CMO y, ocasionalmente, se prestan entre sí.
3. Los **4,051 documentos en CMO GROUP** sugieren operaciones diarias (cobranza, dispersión, pago de tributos) ejecutadas vía CMO.

**Esto es operativamente eficiente, pero genera 3 riesgos críticos:**

#### Riesgo 1: Presunción de dividendos (Art. 24-A LIR)

> "Toda operación que en los hechos cumpla una función similar a la distribución de utilidades, será considerada como dividendo."

Si CMO presta sistemáticamente a INTEGRAL/MEDARQ/AMERICANA **sin contrato escrito y sin intereses**, SUNAT puede recalificar los "préstamos" como **dividendos presuntos** y aplicar la retención del **5%** (tasa actual de IR sobre dividendos).

#### Riesgo 2: Precios de transferencia (Art. 32-A LIR)

Operaciones entre vinculadas requieren:

1. **Análisis de comparabilidad** documentado.
2. **Tasa de interés a valor de mercado** (Tasa Activa de Mercado, TAMN/TAMEX).
3. **Estudio Técnico de Precios de Transferencia (ETPT)** si las operaciones intercompany superan S/52,500 (15 UIT) por contraparte.
4. **Reporte Local** (Anexo de la Declaración Anual del IR) si ingresos > S/9.45M (2,300 UIT).

**CMO GROUP probablemente excede ambos umbrales** y debe presentar ETPT.

#### Riesgo 3: Ley 28194 (Bancarización)

Préstamos > S/3,500 deben canalizarse por medio bancario. Si las transferencias entre empresas del grupo son "asientos de ajuste" sin movimiento bancario real, hay riesgo de pérdida de deducción.

**Propuesta de solución:**

| Plazo | Acción | Responsable |
|---|---|---|
| **Inmediato** | Listar todos los préstamos intercompany con: prestamista, prestatario, monto, fecha, tasa de interés pactada (si existe), plazo. | Tesorería + Legal |
| **30 días** | Firmar **contratos de mutuo** entre las empresas del grupo formalizando los préstamos vigentes. Incluir: monto, tasa (TAMN o TAMEX según moneda), plazo, garantías. | Legal + Gerencia |
| **30 días** | Provisionar **intereses devengados** (gasto/ingreso financiero) por los préstamos vigentes. | Contabilidad |
| **45 días** | Evaluar si se requiere **Estudio Técnico de Precios de Transferencia 2025**. Si las operaciones intercompany > 15 UIT por contraparte, contratar especialista. | Gerencia |
| **60 días** | Bancarizar pagos > S/3,500 que actualmente se hagan por asiento de ajuste. | Tesorería |
| **Continuo** | Reporte mensual de saldo intercompany por contraparte. | Gerencia Financiera |

**Preguntas para Gerencia y equipo financiero:**

1. ¿Existe **contrato escrito** entre CMO GROUP y cada subsidiaria que documente las relaciones de préstamo?
2. ¿Se cobra/paga **interés** entre las empresas del grupo? Si no, ¿por qué? (Riesgo de subvaluación SUNAT).
3. ¿Las operaciones intercompany pasan por **transferencia bancaria** o son asientos de ajuste?
4. ¿Se ha contratado un **Estudio Técnico de Precios de Transferencia** en los últimos 3 años?
5. ¿El **Reporte Local** del Anexo de la DJ Anual del IR se ha presentado para 2024 y 2025?
6. ¿Existe **conciliación** del saldo intercompany al cierre de cada mes con cada subsidiaria? (Saldo en CMO = Saldo opuesto en subsidiaria).

---

#### **HALLAZGO H-13: Transferencias (tipo 058)**

| Empresa | # Transferencias |
|---|---:|
| CMO GROUP | 840 |
| INTEGRAL | 174 |
| AMERICANA | 52 |
| MEDARQ | 6 |

**Diagnóstico gerencial:**

840 transferencias en CMO en 5 meses (~170/mes) es consistente con su rol de tesorería del grupo. Las transferencias normalmente corresponden a movimientos entre cuentas bancarias propias o pagos a terceros que requieren cuenta puente.

**Preguntas:**
1. ¿Las 840 transferencias de CMO incluyen tanto transferencias entre cuentas propias como pagos a terceros?
2. ¿Existe segregación entre "transferencias internas" (clase 10 vs 10) y "pagos a terceros" (clase 42 vs 10)?

---

### IV.H. ACTIVO FIJO Y DEPRECIACIÓN

---

#### **HALLAZGO H-14: Conciliación Activo Fijo vs Depreciación Acumulada**

**Diagnóstico técnico:**

Las empresas tienen activos fijos (clase 33) con su depreciación acumulada (clase 39). El sistema calcula:

```
Valor Bruto (clase 33) − Depreciación Acumulada (clase 39) = Valor Neto
```

| Empresa | # Cuentas de Activo Fijo |
|---|---:|
| INTEGRAL | 4 |
| CMO GROUP | 3 |
| MEDARQ | 3 |
| AMERICANA | 3 |

**Riesgos a revisar:**

1. **Tasas de depreciación** según Art. 22 Reglamento LIR:
   - Edificaciones: 5% anual lineal
   - Equipos de cómputo: 25% anual
   - Maquinaria: 10% anual (uso normal)
   - Vehículos: 20% anual

2. **Test de deterioro NIC 36:** si un activo fijo tiene valor neto > valor recuperable, se debe reconocer pérdida.

3. **Bajas y enajenaciones:** verificar que las bajas tengan documento sustentatorio (acta de baja, factura de venta).

**Propuesta de solución:**

| Plazo | Acción |
|---|---|
| 30 días | Inventario físico de activos fijos. Cotejar con módulo de activo fijo del S10. |
| 60 días | Revisión de tasas de depreciación aplicadas vs Reglamento LIR. |
| 90 días | Test de deterioro (NIC 36) sobre activos significativos. |

---

### IV.I. PATRIMONIO

---

#### **HALLAZGO H-15: Composición del patrimonio**

| Empresa | # Cuentas patrimoniales (clases 50-59) |
|---|---:|
| MEDARQ | 4 |
| CMO GROUP | 3 |
| AMERICANA | 2 |
| INTEGRAL | 1 |

**Cuentas clave:**

| Cuenta | Concepto |
|---|---|
| 501 | Capital social |
| 502 | Capital adicional |
| 5712 | Resultados acumulados positivos |
| 591 | Utilidad del ejercicio |
| 592 | Pérdida del ejercicio |

**Riesgo INTEGRAL (solo 1 cuenta patrimonial):**

Si INTEGRAL solo tiene **una cuenta patrimonial**, probablemente solo se reconoce el **capital social** y no se han contabilizado:
- Resultados de ejercicios anteriores (cuenta 591/592 cerrada contra 5712).
- Reserva legal (Art. 229 LGS — 10% de utilidades anuales hasta llegar al 20% del capital).

**Propuesta de solución:**

| Plazo | Acción |
|---|---|
| Inmediato | Verificar que cada empresa tenga: 501 (Capital), 5821 (Reserva legal), 5712 (Resultados acumulados), 591/592 (Resultado del ejercicio). |
| 30 días | Si falta reserva legal, calcular el monto y proponer su constitución en Junta de Accionistas. |
| Anual | Acta de Junta de Accionistas aprobando distribución de utilidades o constitución de reservas. |

---

## V. RIESGOS TRIBUTARIOS — RESUMEN

| # | Riesgo | Probabilidad | Impacto | Empresa(s) más expuesta(s) |
|---|---|---|---|---|
| RT-01 | Desconocimiento de gasto por falta de documento fuente (Art. 37 LIR) | Alta | Alto | Las 4 |
| RT-02 | Reparo por falta de bancarización en pagos > S/3,500 (Ley 28194) | Alta | Alto | CMO GROUP (préstamos sin transferencia) |
| RT-03 | Recalificación de préstamos intercompany como dividendos (Art. 24-A LIR) | Media-Alta | Alto | CMO GROUP |
| RT-04 | Multa por libros electrónicos con atraso o descuadres (Art. 175 CT) | Media | Medio (0.6% IN) | Las 4 |
| RT-05 | Subdeclaración de IGV por ingresos contables sin factura emitida | Media | Alto | A determinar con conciliación |
| RT-06 | ITAN no provisionado (si activos netos > S/1M) | Media | Medio | Las 4 |
| RT-07 | Precios de transferencia no documentados (Art. 32-A LIR) | Alta | Alto (multa 0.6% IN; máx. 25 UIT) | CMO GROUP |
| RT-08 | Detracciones no liberadas por inconsistencia contable | Alta | Medio | MEDARQ |
| RT-09 | Retenciones de 4ta categoría no aplicadas o no declaradas | Media | Bajo-Medio | Las 4 |

---

## VI. RECOMENDACIONES PRIORIZADAS

### VI.1. Críticas (0-30 días)

| # | Recomendación | Empresa | Owner sugerido |
|---|---|---|---|
| R-01 | Cargar saldos iniciales bancarios reales (asiento de apertura desde estado de cuenta) | MEDARQ (prioridad), las 4 | Tesorería + Contabilidad |
| R-02 | Generar listado completo de los 6,438 descuadres de CMO GROUP y clasificar | CMO GROUP | Gerente Contable |
| R-03 | Listar y validar los 274 atípicos > S/100K de INTEGRAL | INTEGRAL | Gerencia Financiera |
| R-04 | Formalizar contratos de mutuo intercompany | Las 4 | Legal + Gerencia |
| R-05 | Conciliación bancaria al 30/04/2026 firmada y archivada | Las 4 | Contabilidad |
| R-06 | Validación cuenta detracciones MEDARQ vs estado de cuenta Banco Nación | MEDARQ | Tesorería |

### VI.2. Altas (31-60 días)

| # | Recomendación |
|---|---|
| R-07 | Política formal: asientos de clases 60-68, 70, 75, 91, 94 deben tener NroD obligatorio. |
| R-08 | Procedimiento de cierre mensual con conciliación ingresos-documentos como paso obligatorio. |
| R-09 | Matriz de aprobaciones: pagos > S/100K doble firma; > S/250K Directorio. |
| R-10 | Evaluar contratación de **Estudio Técnico de Precios de Transferencia** para 2025. |
| R-11 | Conciliar mensualmente cuenta 4011 (IGV) contable vs PDT 621. |
| R-12 | Provisionar intereses devengados de préstamos intercompany a tasa de mercado. |

### VI.3. Medias (61-90 días)

| # | Recomendación |
|---|---|
| R-13 | Inventario físico de activos fijos. |
| R-14 | Revisión de aging de CxC y CxP > 90 días. Castigo o cobranza. |
| R-15 | Matriz de provisión por deterioro NIIF 9 para CxC. |
| R-16 | Revisión de tasas de depreciación aplicadas vs Reglamento LIR. |
| R-17 | Verificación de cumplimiento de retenciones de 4ta y 5ta categoría. |

### VI.4. Bajas / Continuas

| # | Recomendación |
|---|---|
| R-18 | Reporte mensual de hallazgos del dashboard de auditoría al Comité Financiero. |
| R-19 | Revisión trimestral de saldos intercompany por contraparte. |
| R-20 | Capacitación al equipo contable en NIIF 9 (deterioro), NIIF 15 (ingresos), NIC 36 (deterioro de activos). |

---

## VII. CUESTIONARIO INTEGRAL PARA EL EQUIPO CONTABLE Y FINANCIERO

### VII.1. Sobre el sistema S10

1. ¿En qué año se implementó S10 en cada empresa? ¿Hubo migración desde otro sistema?
2. Si hubo migración, ¿se cargaron los saldos iniciales de **todas** las cuentas o solo de algunas?
3. ¿Quién tiene perfil de "registrador" y quién tiene perfil de "aprobador" en S10? ¿Es el mismo usuario?
4. ¿Existe un manual de procedimientos contables documentado y firmado?
5. ¿Cada cuántos días se respalda la base de datos S10? ¿Dónde se almacena el backup?

### VII.2. Sobre el cierre mensual

1. ¿Cuál es el día de cierre mensual en cada empresa?
2. ¿Quién revisa y aprueba el cierre mensual?
3. ¿Se ejecuta una conciliación bancaria como parte del cierre? ¿Quién la firma?
4. ¿Se ejecuta una conciliación ingresos contables vs facturas emitidas?
5. ¿Las provisiones (vacaciones, gratificaciones, CTS, IR, EsSalud) se generan automáticamente o se cargan manualmente?

### VII.3. Sobre operaciones intercompany

1. ¿Existen contratos de mutuo firmados entre las empresas del grupo?
2. ¿Las operaciones intercompany pasan por transferencia bancaria o son asientos contables de ajuste?
3. ¿Se cobra/paga interés entre las empresas? Si sí, ¿a qué tasa?
4. ¿Se ha presentado el **Reporte Local de Precios de Transferencia** en los últimos 3 años?
5. ¿Cuál es el saldo intercompany al cierre del último mes?

### VII.4. Sobre cumplimiento tributario

1. ¿Las declaraciones PDT 621 (IGV-Renta mensual) están al día?
2. ¿La declaración anual del IR 2025 fue presentada?
3. ¿Existen tributos pendientes de pago con la SUNAT? Si sí, ¿están provisionados?
4. ¿Se han recibido notificaciones de SUNAT en los últimos 12 meses?
5. ¿Existen procesos contenciosos tributarios abiertos?
6. ¿Las retenciones de 4ta categoría (8%) y 5ta categoría se declaran en PDT-PLAME mensualmente?

### VII.5. Sobre control interno

1. ¿Existe un Comité de Auditoría o función de Auditoría Interna en el grupo?
2. ¿Quién aprueba los pagos > S/100,000?
3. ¿Existe un proceso formal de circularización de saldos con bancos, clientes y proveedores al cierre del ejercicio?
4. ¿Las claves de acceso al sistema S10 se cambian periódicamente?
5. ¿Existe segregación entre tesorería, contabilidad y autorización de pagos?

### VII.6. Sobre laboral

1. ¿Cuántos trabajadores tiene cada empresa al 30 de abril de 2026?
2. ¿La CTS de mayo 2026 se depositó dentro del plazo (15 de mayo)?
3. ¿Existen demandas laborales abiertas? ¿Están provisionadas?
4. ¿Se ha cumplido con la distribución de participación 5% para 2025 (si aplica)?
5. ¿Las vacaciones acumuladas por trabajador exceden 1 año?

---

## VIII. PLAN DE REMEDIACIÓN

### VIII.1. Cronograma de remediación (10 semanas)

```
Semana 1-2  | Saldos iniciales bancarios + Conciliación bancaria abril 2026
Semana 3    | Listado y clasificación de descuadres CMO + atípicos INTEGRAL
Semana 4-5  | Contratos de mutuo intercompany + bancarización
Semana 6    | Conciliación ingresos vs facturas (los 5 meses de 2026)
Semana 7    | Procedimiento de cierre mensual formalizado + matriz de aprobaciones
Semana 8    | Provisiones de interés intercompany + ITAN + IGV
Semana 9    | Inventario físico de activos fijos + aging > 90 días
Semana 10   | Comité de cierre — presentación al Directorio
```

### VIII.2. Indicadores de éxito (KPIs de remediación)

| KPI | Meta a 90 días | Línea base actual |
|---|---|---|
| Descuadres por NroD (todas las empresas) | < 100 documentos | 8,424 |
| Asientos sin NroD en clases 70/91/94 | < 5% del total | A medir |
| Conciliación bancaria mensual firmada | 100% de cuentas | 0% (probablemente) |
| Provisión por deterioro CxC > 90 días (NIIF 9) | Cargada | No cargada |
| Contratos de mutuo intercompany firmados | 100% | Probablemente 0% |
| Atípicos > S/100K con segunda firma | 100% | A medir |

---

## IX. CONCLUSIONES

### IX.1. Conclusión general

Las cuatro empresas del grupo presentan **deficiencias materiales de control contable** que, si bien no impiden la operación diaria, generan **riesgo tributario sustancial** y comprometen la confiabilidad de los estados financieros preparados a partir del sistema S10.

Las dos áreas más críticas son:

1. **Integridad de los asientos contables** — los 8,424 descuadres por NroD a nivel grupo (especialmente los 6,438 de CMO GROUP) son materialmente significativos y deben aclararse antes del cierre anual.
2. **Saldos iniciales bancarios** — la ausencia de saldos de apertura en cuentas bancarias (caso MEDARQ) hace que los estados financieros del año estén desconectados de la realidad económica.

### IX.2. Recomendación al Directorio

Se recomienda al Directorio del grupo:

1. **Constituir un Comité de Remediación** liderado por la Gerencia Financiera con representación de cada empresa.
2. **Asignar presupuesto** para contratar:
   - Un especialista en Precios de Transferencia.
   - Asesoría tributaria para revisión integral.
   - Eventual implementación de mejoras en el sistema S10.
3. **Aprobar el cronograma de 10 semanas** propuesto.
4. **Recibir reporte semanal** del avance hasta el cierre del proceso.

### IX.3. Reserva

Este informe se preparó con base en los datos sincronizados del sistema S10 al 11 de mayo de 2026, hora 09:47 UTC, mediante el sistema BizSmartHub. Las conclusiones están sujetas a:

1. Verificación de los hallazgos con el equipo contable mediante el cuestionario de la Sección VII.
2. Disponibilidad de documentación física y digital que respalde las explicaciones.
3. Posibles cambios en la regulación SUNAT y normativa contable peruana posteriores a esta fecha.

Este informe **no constituye una opinión de auditoría externa con valor jurídico**. Su propósito es servir como **diagnóstico ejecutivo** para guiar las acciones de remediación del grupo.

---

## ANEXOS

### Anexo A — Tabla de cuentas clave PCGE referenciadas

| Cuenta | Descripción | Naturaleza |
|---|---|---|
| 10 | Efectivo y equivalentes | Activo |
| 12 | Cuentas por cobrar comerciales | Activo |
| 13 | CxC comerciales — relacionadas | Activo |
| 14 | CxC al personal y accionistas | Activo |
| 16 | CxC diversas | Activo |
| 17 | Entregas a rendir cuenta | Activo |
| 18 | Servicios pagados por anticipado | Activo |
| 19 | Estimación por deterioro de CxC | Activo (regulador) |
| 20-29 | Inventarios | Activo |
| 33 | Inmuebles, maquinaria, equipo | Activo |
| 39 | Depreciación, amortización y agotamiento acumulados | Activo (regulador) |
| 40 | Tributos por pagar | Pasivo |
| 41 | Remuneraciones y participaciones por pagar | Pasivo |
| 42 | Cuentas por pagar comerciales | Pasivo |
| 43 | CxP comerciales — relacionadas | Pasivo |
| 44 | CxP a directores y gerentes | Pasivo |
| 45 | Obligaciones financieras (sobregiros, préstamos) | Pasivo |
| 46 | Cuentas por pagar diversas | Pasivo |
| 47 | CxP diversas — relacionadas | Pasivo |
| 50 | Capital | Patrimonio |
| 58 | Reservas | Patrimonio |
| 59 | Resultados acumulados | Patrimonio |
| 70 | Ventas | Ingreso |
| 75 | Otros ingresos de gestión | Ingreso |
| 79 | Cargas imputables a cuenta de costos y gastos | Imputables |
| 91 | Costos directos de producción / servicios | Costo |
| 94 | Gastos administrativos | Gasto |
| 97 | Gastos financieros | Gasto |

### Anexo B — Tipos de documentos S10 referenciados

| Código | Tipo |
|---|---|
| 010 | Recibo por honorarios profesionales |
| 058 | Transferencia |
| 060, 125, 128, 131, 134 | Facturas / boletas emitidas (incluye NC) |
| 001, 002, 004, 012, 015, 091, 123, 143, 144 | Facturas / boletas recibidas |
| 071 | Préstamo |
| 069, 070 | Anticipos |
| 128, 134 | Notas de crédito (de venta) |

### Anexo C — Marco normativo peruano clave para 2026

| Norma | Aplicación |
|---|---|
| **DS 011-2010-EF** | Plan Contable General Empresarial (PCGE). |
| **TUO LIR — DS 179-2004-EF** | Impuesto a la Renta. |
| **TUO Ley IGV — DS 055-99-EF** | Impuesto General a las Ventas. |
| **TUO Código Tributario — DS 133-2013-EF** | Normas administrativas tributarias. |
| **Ley 28194** | Bancarización (medios de pago). |
| **DS 155-2004-EF** | Sistema de detracciones (SPOT). |
| **DL 892** | Participación de los trabajadores en las utilidades. |
| **RS 286-2009/SUNAT** | Libros electrónicos (PLE). |
| **NIIF 9, 15, 16** | Instrumentos financieros, ingresos, arrendamientos. |
| **NIC 1, 12, 16, 19, 36, 37** | Presentación, IR diferido, propiedades, beneficios empleados, deterioro, provisiones. |
| **Ley General de Sociedades — Ley 26887** | Reserva legal, dividendos, juntas. |

---

**Documento preparado por:** Equipo de Auditoría BizSmartHub
**Versión:** 1.0
**Próxima revisión sugerida:** 11 de agosto de 2026 (90 días) — verificación de avance del Plan de Remediación
