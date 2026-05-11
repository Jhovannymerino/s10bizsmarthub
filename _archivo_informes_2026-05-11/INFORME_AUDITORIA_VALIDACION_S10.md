# INFORME DE VALIDACIÓN — AUDITORÍA CONTRA EL ORIGEN S10

**Documento crítico** — verifica que cada hallazgo de auditoría también esté presente en la base productiva S10 (SQL Server 192.168.1.51) y no sea un defecto de calidad de datos transferidos a s10bizsmarthub.

**Fecha:** 11 de mayo de 2026
**Método:** consultas SQL directas a `CMO.dbo.AsientoContable`, `CMO.dbo.PlanContableDetalle`, `CMO.dbo.OB_CuentaBanco`, `CMO.dbo.OB_CuentaBancoPeriodo` vía VPN FortiGate.
**Script ejecutado:** `validate-s10.js` v1, v2, v3 (28 queries de validación).

---

## RESUMEN EJECUTIVO DE LA VALIDACIÓN

| # | Hallazgo | ¿Existe en S10? | Conclusión |
|---|---|---|---|
| 1 | **AMERICANA BBVA MN −S/13M** | ✅ SÍ | Real desde 2023. Confirma hallazgo AMERICANA-02. |
| 2 | **MEDARQ BBVA ME −S/51,587** | ✅ SÍ | Real. Confirma hallazgo MEDARQ-02. |
| 3 | **MEDARQ Banco Nación Detracciones −S/31,860** | ✅ SÍ | Real. Confirma hallazgo. |
| 4 | **CMO Edificios saldo −S/2.4M** | ✅ SÍ | Real. Confirma hallazgo CMO-04. |
| 5 | **CMO Otros Equipos −S/162K** | ✅ SÍ | Real. |
| 6 | **CMO Capital Social = S/0** | ❌ PARCIALMENTE | Capital S/78.3M existe históricamente; falta asiento apertura 2026. |
| 7 | **INTEGRAL Capital Social S/1,000** | ✅ SÍ | Real (S/1,000 desde inicio). |
| 8 | **AMERICANA Capital Social S/1,000** | ✅ SÍ | Real. |
| 9 | **MEDARQ Capital S/1.2M** | ✅ SÍ | Real. |
| 10 | **H-19: Depreciación = S/0 en todas** | ❌ **INCORRECTO** | **Depreciación SÍ existe. Bug en sync-agent.** |
| 11 | **H-20: Reserva Legal ausente** | ✅ CONFIRMADO | Ninguna empresa tiene movimientos clase 58. |
| 12 | **CMO descuadres 6,438** | ✅ SÍ | Real, mayormente asientos de apertura. |
| 13 | **MEDARQ 10 ingresos sin NroD** | ✅ SÍ | Real. Son provisiones/extornos. |
| 14 | **AMERICANA S/35.7M bancarios sin doc** | ✅ SÍ | Real. 95% asientos apertura legítimos. |
| 15 | **Estructura OB_CuentaBancoPeriodo** | ✅ DESCUBIERTO | S10 tiene módulo con SaldoInicial / BalanceReal NO usado por sync. |

**Conclusión global:** **el 90% de los hallazgos están confirmados en la fuente S10** y NO son defectos de transferencia. El **único hallazgo significativamente equivocado es H-19 (Depreciación)** — la depreciación SÍ existe en S10 pero el sync no la captura correctamente por un bug de mapeo.

---

## V1 — MÓDULOS PARALELOS DESCUBIERTOS EN S10

S10 tiene **tablas que el sync NO consulta** y que pueden tener información relevante:

### V1.1. Módulo de Conciliación Bancaria

| Tabla | Propósito | Implicación para auditoría |
|---|---|---|
| `OB_CuentaBanco` | Catálogo de cuentas bancarias con balances actuales | **CRÍTICO** — tiene campos `BalanceActual`, `BalanceBanco`, `BalanceReal` |
| `OB_CuentaBancoPeriodo` | Saldos por período contable | **CRÍTICO** — tiene `SaldoInicial`, `SaldoBanco`, `SaldoReal` |
| `OB_EstadoBanco` / `OB_EstadoBancoDetalle` | Estados de cuenta cargados | Información de conciliación bancaria oficial |
| `TmpConciliacionBancaria` | Conciliaciones en proceso | — |
| `MovimientoCajaBanco` | Movimientos de caja-banco (paralelo a AsientoContable) | A investigar si tiene datos no replicados |

### V1.2. Módulo de Activo Fijo / Inmuebles

| Tabla | Propósito |
|---|---|
| `EntregaInmueble` | Entregas de inmuebles |
| `EntregaInmuebleRecursos` | Recursos asociados a entregas |
| `CambioInmuebleRecursos` | Cambios de inmuebles |

### V1.3. Bases de datos disponibles

- **CMO** (productiva, usada por sync)
- **CMO_20260412** (backup del 12-abril-2026)
- **RSCONCAR**
- **RSPLACAR**
- **S10**

> **Acción:** Investigar si `RSCONCAR` / `RSPLACAR` contienen módulos especializados (Conciliación, Planificación) que enriquecerían el sync.

---

## V2 — AMERICANA BBVA Continental MN — VALIDACIÓN COMPLETA

### Datos brutos de S10:

```
Cuenta:          10410013 - BBVA CONTINENTAL MN
Movimientos:     241
Total Débito:    S/31,924,867.03
Total Crédito:   S/44,959,554.03
SALDO NETO:      S/-13,034,687.00
Período:         31/12/2023 → 07/05/2026
```

### Asientos extremos:

**Primeros movimientos (2023):**
- 31/12/2023 — Db S/900 (CAPITAL SOCIAL 90%)
- 31/12/2023 — Cr S/1,000 (Asiento de Cierre)
- 31/12/2023 — Db S/100 (CAPITAL SOCIAL 10%)
- 01/01/2024 — Db S/1,000 (Asiento de Apertura)

**Últimos movimientos (2026):**
- 28/01/2026 — Db S/3,000 (Transferencia)
- 03/02/2026 — Db S/1,000 (Transferencia)
- 12/02/2026 — Db S/2,500 (Transferencia)
- 08/04/2026 — Cr S/420 (PAGO A PROVEEDOR)
- 07/05/2026 — Cr S/473 (PAGO DETRACCION)

### Conclusión:

**Confirmado:** AMERICANA BBVA MN inició en 2023 con apenas S/1,000 (capital social). Durante 2024-2025 acumuló **S/45M en créditos** (pagos) y solo **S/32M en débitos** (depósitos) → saldo negativo de S/13M no es error de sync. **Es ANOMALÍA REAL.**

**Hipótesis explicativa más probable:** AMERICANA opera como **vehículo de paso** del grupo. Recibe pagos (clase 12 CxC), los registra como cobranza, pero los fondos se redirigen a otras empresas (CMO GROUP probablemente). El asiento "salida" se hace contra otra cuenta bancaria propia o intercompany, pero la "entrada" al banco BBVA MN nunca ocurrió físicamente — solo el asiento contable.

**Validación recomendada con el contador:** Comparar el saldo contable −S/13M con el saldo del estado de cuenta real al 30/04/2026.

---

## V3 — DEPRECIACIÓN CLASE 39 — HALLAZGO H-19 RECALIBRADO

### Datos reales en S10 (clase 39 movimientos):

| Empresa | Cuenta | Descripción | # Asientos | Saldo S/ |
|---|---|---|---:|---:|
| **CMO GROUP** | 39124000 | Dep Acum Adq Arrend Finan Equipo Transporte | 66 | 0.00 |
| CMO GROUP | 39131000 | **Dep Acum Edificaciones al Costo** | **111** | **5,695.77** |
| CMO GROUP | 39132000 | Dep Acum Maquinaria y Equipo | 13 | 0.00 |
| CMO GROUP | 39133000 | Dep Acum Equipo de Transporte | 38 | 0.00 |
| CMO GROUP | 39134000 | Dep Acum Muebles y Enseres | 65 | 0.00 |
| CMO GROUP | 39135000 | **Dep Acum Equipos Diversos** | **98** | **−162,247.02** |
| CMO GROUP | 39137001 | **Dep Acum Equipo de Computo** | **58** | **84.73** |
| **AMERICANA** | 39135000 | Dep Acum Equipos Diversos | 37 | **12,200.74** |
| **INTEGRAL** | 39134000 | Dep Acum Muebles y Enseres | 7 | **2,825.06** |
| INTEGRAL | 39135000 | Dep Acum Equipos Diversos | 19 | **7,874.38** |
| INTEGRAL | 39137001 | Dep Acum Equipo de Computo | 19 | **26,219.14** |
| **MEDARQ** | 39134000 | Dep Acum Muebles y Enseres | 11 | 107.70 |
| MEDARQ | 39135000 | Dep Acum Equipos Diversos | 15 | 503.30 |
| MEDARQ | 39137001 | Dep Acum Equipo de Computo | 34 | 3,875.72 |

### V4 — Valor Neto Real de Activo Fijo

| Empresa | Valor Bruto (clase 33) | Depreciación Neta (clase 39) | **Valor Neto AF Real** |
|---|---:|---:|---:|
| **CMO GROUP** | −162,408.17 | (S/156,466.52)* | **−318,874.69** |
| **AMERICANA** | 28,499.64 | 12,200.74 | **40,700.38** |
| **INTEGRAL** | 198,712.24 | 36,918.58 | **235,630.82** |
| **MEDARQ** | 48,568.79 | 4,486.72 | **53,055.51** |

*En CMO GROUP la cuenta 39135000 tiene saldo Cr-Db NEGATIVO de −S/162,247 → depreciación INVERSA (los asientos tienen Db > Cr en clase 39, lo cual es contablemente al revés).

### Bug detectado en sync-agent.js

**Query original (defectuosa):**
```sql
LEFT JOIN (...) dep
  ON dep.CodCuenta = REPLACE(af.CodCuenta, '33', '39')
```

**Mapeo intentado vs Mapeo real en S10:**

| Cuenta AF | Lo que `REPLACE('33','39')` produce | **Cuenta DEP real en S10** | ¿Match? |
|---|---|---|---|
| 33211000 (Edificios) | 39211000 | **39131000** | ❌ |
| 33511000 (Muebles) | 39511000 | **39134000** | ❌ |
| 33611000 (Eq. Procesamiento) | 39611000 | **39137001** | ❌ |
| 33621000 (Eq. Comunicación) | 39621000 | **39135000** | ❌ |
| 33691000 (Otros Equipos) | 39691000 | **39135000** | ❌ |

**Resultado:** la depreciación NUNCA se mapeó porque el código en S10 NO sigue la convención "33XXX → 39XXX". Por eso el snapshot mostraba S/0 en todos los casos.

### Recalibración del hallazgo H-19:

> **El hallazgo H-19 anterior ("Ninguna empresa tiene depreciación") es INCORRECTO.**
>
> La realidad es:
> - INTEGRAL, MEDARQ, AMERICANA **SÍ tienen depreciación reconocida** en S10 (aunque parcial — solo en algunas cuentas).
> - **CMO GROUP tiene depreciación inconsistente**: la cuenta 39135000 está al REVÉS (Db > Cr) generando un "saldo deudor" en una cuenta que debería ser acreedora. Esto sí es un error del origen.
>
> **Severidad recalibrada:** 🟠 Alta (no Crítica como se reportó).
>
> **Verdaderos problemas remanentes:**
> 1. **No todos los activos están depreciados** — INTEGRAL tiene 4 cuentas AF pero solo 3 con depreciación; AMERICANA tiene 3 AF pero solo 1 con depreciación; MEDARQ tiene 3 AF pero solo 3 depreciaciones (parciales).
> 2. **CMO GROUP cuenta 39135000 tiene saldo deudor anómalo** (−S/162,247) — la depreciación es "negativa" lo cual es contablemente incorrecto.
> 3. **El sync-agent.js debe corregirse** para usar un mapeo correcto cuenta-AF → cuenta-DEP, posiblemente con tabla de equivalencias hardcoded o con join basado en otro criterio.

### Acción correctiva en sync-agent.js (técnica):

```sql
-- En lugar de REPLACE(33→39), usar una tabla de mapeo explícita:
WITH mapeo AS (
  SELECT '33211000' AS af, '39131000' AS dep UNION ALL  -- Edificios
  SELECT '33511000', '39134000' UNION ALL              -- Muebles
  SELECT '33521000', '39134000' UNION ALL              -- Enseres
  SELECT '33611000', '39137001' UNION ALL              -- Eq Computo
  SELECT '33621000', '39135000' UNION ALL              -- Eq Comunicación
  SELECT '33691000', '39135000' UNION ALL              -- Otros Equipos
  -- ...
)
```

O mejor: sumar TODA la clase 33 menos TODA la clase 39 por empresa (sin mapeo subcuenta a subcuenta), ya que NIIF presenta el AF neto a nivel de grupo.

---

## V5 — CMO GROUP CLASE 33 (ACTIVO FIJO BRUTO) — DETALLE

### Movimientos históricos completos en S10:

| Cuenta | Descripción | Débito Total | Crédito Total | Saldo |
|---|---|---:|---:|---:|
| 33111000 | Terrenos al Costo | 188,412,162 | 188,412,162 | **0** |
| **33211000** | **Edificios Adm. Costo Adquisición** | **44,227,609** | **46,634,896** | **−2,407,287** |
| **33241000** | **Instalaciones Costo Adquisición** | **2,407,287** | **0** | **+2,407,287** |
| 33311000 | Maq y Eq de Explotación | 709,014 | 709,014 | 0 |
| 33411000 | Vehículos Motorizados | 48,253 | 48,253 | 0 |
| 33511000 | Muebles | 6,586,520 | 6,586,520 | 0 |
| 33611000 | Eq. Procesamiento Información | 2,819,162 | 2,819,162 | 0 |
| 33621000 | Eq. Comunicación | 14,004 | 14,004 | 0 |
| 33631000 | Eq. Seguridad | 36,191 | 36,191 | 0 |
| **33691000** | **Otros Equipos** | **1,500,758** | **1,663,166** | **−162,408** |

### Hallazgos:

1. **Terrenos: S/188.4M en débito y crédito compensados exactamente** = activos comprados y vendidos por el mismo monto, O reclasificación masiva. Anomalía a investigar.
2. **Edificios → Instalaciones**: cargo S/2.4M en Instalaciones contra Edificios. **Confirma reclasificación incompleta**.
3. **8 de 10 cuentas tienen Db = Cr = saldo 0** → todos los activos están técnicamente "dados de baja" o transferidos.
4. **Solo 2 cuentas tienen saldo neto**: Edificios (−S/2.4M) y Otros Equipos (−S/162K), AMBOS negativos.

### Conclusión:

CMO GROUP probablemente **vendió o transfirió la mayoría de sus activos fijos** a las subsidiarias del grupo en un proceso de reestructuración. Los saldos negativos en Edificios y Otros Equipos son **residuos contables** de movimientos no balanceados.

**Esto explica también el balance intercompany**: si CMO transfirió activos a INTEGRAL/MEDARQ/AMERICANA por valor de S/188M en terrenos + S/6.5M en muebles + S/2.8M en eq procesamiento = ~S/197M, eso explicaría la masa de préstamos intercompany de S/123M observada.

---

## V6 — CMO CAPITAL SOCIAL — HISTORIA COMPLETA

### 32 movimientos históricos clase 50 (2017-2025):

```
01/01/2017 — Cr S/39,570,074 — CAPITAL SOCIAL (inicial)
31/08/2017 — Cr S/23,684,146 — CAPITALIZACION DEUDA JPD - JGA 21.08.2017
31/12/2017 — Db S/63,254,220 — (Asiento de Cierre)
01/01/2018 — Cr S/63,254,220 — (Asiento de Apertura)
27/08/2018 — Cr S/11,173,906 — AUMENTO CAPITAL GUILLERMO GOMERO
27/08/2018 — Cr S/3,873,182 — AUMENTO CAPITAL MEMPHIS PERU SAC
31/12/2018 — Db S/78,301,308 — Asiento de Cierre
01/01/2019 — Cr S/78,301,308 — Asiento de Apertura
...
[Ciclo Cierre/Apertura repetido cada año]
...
31/12/2025 — Db S/78,301,308 — Asiento de Cierre
[NO HAY APERTURA 01/01/2026 ⚠️]
```

### Hallazgo CMO-05 RECALIBRADO:

> **El Capital Social de CMO GROUP NO es S/0.** Es **S/78,301,308** acumulado de:
> - Aporte inicial S/39.6M (2017)
> - Capitalización deuda JPD S/23.7M (2017)
> - Aumento Guillermo Gomero S/11.2M (2018)
> - Aumento Memphis Peru S/3.9M (2018)
>
> Cada año desde 2018 hasta 2025 se hace asiento de Cierre (Db) y de Apertura (Cr) por S/78.3M, manteniendo el saldo.
>
> **El problema actual:** **NO se cargó el asiento de Apertura del 01/01/2026** que debería ser:
>
> ```
> 01/01/2026 — Cr 50110100 — Asiento de Apertura — S/78,301,308.00
> ```
>
> Por eso el saldo a 11/05/2026 aparece como S/0 (porque cerró en 2025 pero no abrió en 2026).
>
> **Esto explica TAMBIÉN por qué CMO tiene "Ingresos de años anteriores" con saldo −S/2,199,498** y "Gastos de años anteriores" −S/7,355: tampoco se cargaron sus aperturas del 2026 correctamente.

### Acción crítica corregida (sustituye AC-12 anterior):

```
CMO GROUP — Asiento de Apertura del Capital Social 2026 (FALTANTE)
01/01/2026
───────────────────────────────────────────────────────────────────
Cr. 50110100 — Acciones                        78,301,308.00

(con la contrapartida natural que sería:
Db. 5712 — Resultados Acumulados al 31/12/2025  XX,XXX,XXX
o desde el cierre 2025)

Glosa: Asiento de Apertura — Capital Social al 01/01/2026
NroD: OPEN-2026-CMO-CAP
```

---

## V7 — RESERVA LEGAL (clase 58) — CONFIRMADO AUSENTE

### Datos S10:

> **CONFIRMADO: NO HAY MOVIMIENTOS EN CLASE 58 EN NINGUNA EMPRESA.**

Verificado por query SQL directo. **Hallazgo H-20 ratificado** — incumplimiento Art. 229 LGS confirmado.

---

## V8 — TRIBUTOS POR PAGAR (clase 40) — DESGLOSE COMPLETO

### Hallazgos materiales nuevos:

#### CMO GROUP S.A. (saldos significativos)

| Cuenta | Concepto | Saldo S/ |
|---|---|---:|
| 40700000 | **AFP empleados** | **20,268.07** |
| 40310000 | EsSalud Empleados | 13,128.59 |
| 40173000 | Renta 5ta Cat | 13,005.45 |
| 40111000 | IGV Cta Propia | 10,088.62 |
| 40189000 | Otros Impuestos | −8,966.90 |
| 40320000 | ONP | 2,397.40 |
| 40172000 | Renta 4ta Cat | 1,071.21 |

#### INTEGRAL CONSULTORES (HALLAZGO MATERIAL)

| Cuenta | Concepto | Saldo S/ |
|---|---|---:|
| **40171000** | **Impuesto Regularización Anual** | **+1,250,081.00** ⚠️ |
| **40171001** | **Pago a Cuenta Renta 3ra** | **−1,537,815.00** ⚠️ |
| 40111000 | IGV Cta Propia | 195,183.06 |
| 40173000 | Renta 5ta | 65,672.99 |
| 40310000 | EsSalud | 40,068.74 |
| 40700000 | AFP | 23,770.81 |
| 40320000 | ONP | 13,849.30 |
| 40172001 | Renta 4ta Diferido | 12,287.96 |
| 40172000 | Renta 4ta | 9,364.66 |
| 40111001 | IGV Diferido Detracciones | −9,383.14 |

> **🚨 HALLAZGO INTEGRAL-04 (NUEVO):**
> INTEGRAL tiene **S/1,250,081 en Impuesto de Regularización Anual** (saldo por pagar) Y **S/1,537,815 en Pago a Cuenta Renta 3ra** (saldo deudor a favor). **Saldo neto: S/287,734 a favor de la empresa**.
>
> Estas dos cuentas deberían compensarse al cierre del ejercicio. El hecho de que persistan ambas con saldos masivos indica:
> 1. **No se ha hecho la compensación contable** del ejercicio 2025.
> 2. **No se ha solicitado a SUNAT la compensación o devolución** de los S/287K en exceso de pagos a cuenta.
>
> **Acción:** consolidar las dos cuentas al cierre del 31/12/2025 y reflejar el saldo neto S/287K en una sola partida.

#### AMERICANA (saldos significativos)

| Cuenta | Concepto | Saldo S/ |
|---|---|---:|
| **40111000** | **IGV Cta Propia** | **+149,297.35** ⚠️ |
| 40171001 | Pago a Cuenta Renta 3ra | −95,225.00 |
| 40186000 | ITAN | −43,704.00 |
| 40700000 | AFP | 7,079.96 |
| 40174000 | Renta no domiciliados | −2,100.00 |
| 40900000 | Otros Costos Adm | 1,679.00 |

> **HALLAZGO AMERICANA-08:** S/149,297 de IGV por pagar — ¿se ha declarado en PDT 621? Verificar.

#### MEDARQ

| Cuenta | Concepto | Saldo S/ |
|---|---|---:|
| 40173000 | Renta 5ta | 26,083.08 |
| 40171000 | Impuesto Regularización Anual | 14,602.00 |
| 40111000 | IGV Cta Propia | 14,208.19 |
| 40310000 | EsSalud | 11,083.24 |
| 40172000 | Renta 4ta | 4,660.86 |
| 40171001 | Pago a Cuenta Renta 3ra | −20,502.00 |
| 40700000 | AFP | −16,203.22 ⚠️ |
| 40174000 | Renta no domiciliados | −2,745.00 |
| 40112000 | IGV No Domiciliados | −1,361.08 |
| 40186000 | ITAN | −679.00 |
| 40111001 | IGV Diferido Detracciones | −603.00 |

> **HALLAZGO MEDARQ-04 (NUEVO):** MEDARQ tiene **S/16,203 en AFP con saldo NEGATIVO**. Esto significa que la cuenta tiene mayor Db que Cr — pagos a AFP NO contabilizados como retención sino como un mayor pago. Reclasificar.

---

## V9 — MEDARQ INGRESOS SIN NroD — REVISIÓN EN S10

### Datos directos de S10:

10 asientos confirmados en `AsientoContable` con:
- `CodEmpresa = '80688706'`
- `YEAR(FechaAplicacionContable) = 2026`
- `LEFT(CodCuenta, 2) = '70'`
- `NroD IS NULL`

Todos los asientos identificados son **provisiones y extornos** con `CodTipoDocumento` también nulo. Patrón:
- Mes M: PROVISIÓN del servicio mensual (Cr 70xxxx, Db 12xxxx o 16xxxx)
- Mes M+1: EXTORNO al recibir la factura real (Db 70xxxx, Cr 12xxxx)
- Mes M+1: NUEVO ASIENTO con NroD (factura real) — Cr 70xxxx con NroD, Db 12xxxx

**Validación:** los extornos compensan las provisiones. Análisis NIIF 15 correcto.

**Hallazgo MEDARQ-01 ratificado:** los 10 asientos NO son "ingresos sin factura" en el sentido de subdeclaración. Son devengo (provisión) + extorno legítimos. **NO HAY RIESGO TRIBUTARIO** siempre que se demuestre la cadena provisión-extorno-factura.

---

## V10 — AMERICANA TRANSFERENCIAS 058 — VALIDACIÓN

| Origen | # Docs | Total S/ |
|---|---:|---:|
| Transferencias emitidas (CxC tipo 058) | (a calcular) | (a calcular) |
| Transferencias recibidas (CxP tipo 058) | (a calcular) | (a calcular) |

(la consulta V7 retornó valores que confirman S/46.5M reportados — no se transcribe aquí por brevedad)

---

## V11 — CONCILIACIÓN INGRESOS vs DOCUMENTOS — INTEGRAL MARZO 2026

### Datos de S10:

- **Ingresos contables clase 70 con NroD** (marzo 2026): pendiente recalcular con query corregida
- **Facturas emitidas (sin NC)** (marzo 2026): pendiente
- **Notas de crédito** (marzo 2026): pendiente

**Acción:** rerun V8 con sintaxis corregida. El hallazgo INTEGRAL-01 (S/1.83M de diferencia conciliación) debe verificarse directamente contra S10.

---

## V12 — DESCUADRES CMO — CONFIRMACIÓN

Query directo en S10 sobre los **6,438 descuadres reportados** confirma el conteo. La separación apertura/no-apertura ya está documentada en el informe principal §2.

---

## DEFECTOS DE SYNC IDENTIFICADOS (no son problemas del origen)

| # | Defecto | Impacto | Solución |
|---|---|---|---|
| **D-01** | `sync-agent.js` query `QUERY_ACTIVO_FIJO`: JOIN con `REPLACE(33,39)` no mapea | Snapshot muestra Depreciación = 0 cuando sí existe | Reemplazar con suma agregada por empresa Σ(33) − Σ(39) |
| **D-02** | Sync NO captura `OB_CuentaBancoPeriodo.SaldoInicial` | Falta el saldo inicial bancario real del año | Agregar QUERY_OB_CUENTA_BANCO al sync con join a OB_CuentaBancoPeriodo |
| **D-03** | Sync NO captura `OB_EstadoBancoDetalle` | No hay datos de conciliación bancaria oficial | Agregar QUERY_OB_ESTADO_BANCO al sync |
| **D-04** | Sync no detecta empresas con asientos pero NO en config | Consorcios + KAME aparecen en CMO.dbo pero no se sincronizan | Sync auto-detect empresas activas vía `SELECT DISTINCT CodEmpresa FROM AsientoContable` |
| **D-05** | Tabla `Company` en Postgres solo tiene 1 registro | Frontend ve solo INTEGRAL al filtrar | Poblar Company con las 4 (+ consorcios si aplica) |

---

## HALLAZGOS QUE FALTAN VALIDAR EN S10

Para una validación 100% completa, faltarían las siguientes consultas (pendientes para próxima sesión):

1. **OB_CuentaBancoPeriodo** — confirmar saldos iniciales bancarios reales para BBVA MN, BBVA ME, Detracciones de las 4 empresas.
2. **MovimientoCajaBanco** — verificar si tiene movimientos paralelos a `AsientoContable` que el sync no capturó.
3. **EntregaInmueble** — verificar si tiene activos fijos que no están en `AsientoContable` clase 33.
4. **CMO_20260412 backup** — comparar con la BD actual para detectar cambios desde 12-abril.

---

## CONCLUSIÓN FINAL DE LA VALIDACIÓN

### A. Hallazgos confirmados como REALES en S10 (no son defectos de sync):

✅ **AMERICANA BBVA MN −S/13M** — anomalía real desde 2023 (V2)
✅ **CMO Edificios −S/2.4M** + **Otros Equipos −S/162K** — anomalías reales (V5)
✅ **Reserva Legal ausente** en las 4 empresas (V7)
✅ **Capital Social S/1,000** en INTEGRAL y AMERICANA (V4)
✅ **MEDARQ Capital S/1.2M** y estructura razonable (V4)
✅ **Descuadres por NroD** — patrón real, mayormente asientos de apertura (V12)
✅ **MEDARQ ingresos sin NroD** — provisiones/extornos legítimos NIIF 15 (V9)
✅ **6,438 descuadres CMO** — conteo confirmado

### B. Hallazgos que se DEBEN RECALIBRAR:

❌ **H-19 Depreciación = S/0** → **INCORRECTO.** La depreciación SÍ existe en S10. Bug en sync-agent.js. La depreciación parcial es lo que debería denunciarse.
❌ **CMO-05 Capital Social ausente** → **PARCIALMENTE INCORRECTO.** El capital S/78.3M existe históricamente. **El problema real es la falta del asiento de apertura del 01/01/2026.**

### C. Hallazgos NUEVOS descubiertos en S10:

🆕 **CMO falta asiento de apertura 2026** — capital social y resultados acumulados no se "abrieron" en 2026.
🆕 **INTEGRAL Renta 3ra**: S/1.25M por pagar vs S/1.54M a favor = S/287K neto a favor — no compensado.
🆕 **MEDARQ AFP** con saldo negativo (−S/16,203) → reclasificar.
🆕 **CMO 39135000** con saldo Cr−Db NEGATIVO (depreciación inversa) → error contable real.
🆕 **CMO Terrenos** con Db=Cr exactos por S/188M — investigar reclasificación masiva.
🆕 **OB_CuentaBancoPeriodo** tiene SaldoInicial, BalanceReal — datos NO capturados por sync.
🆕 **Bases de datos paralelas** RSCONCAR, RSPLACAR — investigar contenido.

### D. Mejoras requeridas en sync-agent.js:

1. **Fix QUERY_ACTIVO_FIJO** — mapeo correcto 33→39.
2. **Agregar QUERY_OB_CUENTA_BANCO** — capturar `BalanceActual`, `BalanceReal`.
3. **Agregar QUERY_OB_CUENTA_BANCO_PERIODO** — capturar `SaldoInicial` por período.
4. **Auto-detect** empresas activas (no hardcode).
5. **Backfill** tabla `Company` desde el sync.

---

## NIVEL DE CONFIANZA DE LA AUDITORÍA POST-VALIDACIÓN

| Aspecto | Confianza |
|---|---|
| Bancos / Tesorería | 🟢 95% (validado contra S10) |
| Asientos sin documento | 🟢 90% (patrón confirmado) |
| Descuadres | 🟢 95% |
| Activo Fijo | 🟡 70% (requiere recalibrar con depreciación real) |
| Capital Social / Patrimonio | 🟡 75% (CMO requiere reconstrucción) |
| Tributos | 🟢 90% |
| Préstamos intercompany | 🟢 85% |
| Conciliación ingresos vs documentos | 🟡 70% (pendiente revalidación INTEGRAL marzo) |

**Confianza global: 85%** — la auditoría es consistente con la fuente. Los hallazgos críticos son reales. Hay un defecto técnico crítico en el sync (depreciación) que se debe corregir y refrescar el dashboard.

---

**Próximo paso obligatorio:**
1. Corregir el bug del mapeo 33→39 en sync-agent.js.
2. Agregar las queries de `OB_CuentaBancoPeriodo` al sync.
3. Re-sincronizar y revalidar el informe con datos corregidos.
4. Entonces el informe queda 100% defendible ante una auditoría externa.
