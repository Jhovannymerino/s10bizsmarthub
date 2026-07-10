# PTT-20260706-WA0071_summary


---

## 📋 Descripción General

Reunión de revisión entre dos colegas (uno de los cuales es Milka) para analizar las diferencias detectadas entre el sistema contable S10 y una nueva plataforma financiera. Se trata de una sesión de auditoría interna donde se identifican discrepancias en múltiples módulos contables: cuentas por pagar, cuentas por cobrar y estado de resultados. El objetivo es documentar y explicar cada diferencia encontrada antes de proceder a correcciones.

## 🔍 Puntos Clave de la Reunión

### 💰 Cuentas por Pagar (Cuenta 42)

- **Problema de moneda en proveedor S10**: Al revisar las cuentas por pagar del proveedor S10 (proveedor en dólares), se detectó una inconsistencia en el símbolo de moneda. En el escenario principal (vista general), la deuda de **S/ 684** aparece con el símbolo de soles, pero al ingresar al detalle del mismo proveedor, el sistema muestra el símbolo de dólares. Esto sugiere un error en la conversión o asignación de moneda en la plataforma.

- **Anticipos no reflejados**: Si existe un anticipo registrado para el proveedor S10, dicho anticipo **no está generando la operación correspondiente** en el reporte de cuentas por pagar de la nueva plataforma. Esto es un problema crítico porque los anticipos deberían visualizarse dentro de la cuenta 42, junto con las facturas no emitidas y las emitidas.

- **Descuadre general de la cuenta 42 en dólares**: Como consecuencia de los dos puntos anteriores (manejo incorrecto de la moneda y anticipos no reflejados), la **cuenta 42 en dólares no cuadra** entre el detalle que muestra el sistema S10 y lo que presenta la nueva plataforma. La diferencia aproximada es de **S/ 1,000,000** (un millón de soles), aunque se estima que podría explicarse en parte por los anticipos pendientes y por el tratamiento de las facturas en dólares sin conversión de moneda.

### 📥 Cuentas por Cobrar (Cuenta 12)

- **Diferencia mínima de S/ 1.60**: Se detectó una diferencia de **1 sol con 60 céntimos** a nivel de la cuenta 12 completa. Aunque es una diferencia pequeña, su origen aún no ha sido identificado porque no se ha logrado bajar el detalle en Excel ni cruzar la información a nivel de cliente individual.

- **Pendiente de análisis**: No se ha determinado qué cliente o transacción específica genera esta diferencia. Se requiere identificar cómo exportar o visualizar el detalle en Excel para poder realizar el cruce de información correspondiente.

### 📊 Estado de Resultados (a la fecha actual - julio)

- **Diferencia en ingresos totales**: En el sistema S10 figura un total de **S/ 7,200,000**, mientras que en la nueva plataforma aparece **S/ 7,100,000**. Esto representa una diferencia de **S/ 100,000** que debe ser investigada y justificada.

- **Gastos de venta no ubicados**: En el sistema S10 existe un rubro de **gastos de venta** que no ha podido ser identificado en la nueva plataforma. Este rubro no aparece en el estado de resultados de la nueva herramienta, lo cual representa una omisión contable importante.

- **Ingresos financieros ausentes**: Los **ingresos financieros** tampoco se encuentran reflejados en la nueva plataforma, lo que impide calcular el efecto neto de las operaciones financieras.

- **Diferencia en cambio incompleta**: En cuanto al efecto de diferencia en cambio, solo se encontró registrada la **pérdida por diferencia en cambio** (cuenta de gasto), pero **no los ingresos por diferencia en cambio**. Esto impide que el sistema calcule el efecto neto (ganancia/pérdida) de las operaciones en moneda extranjera, afectando la presentación correcta del estado de resultados.

## ✅ Consensos Alcanzados

- La diferencia más significativa en la cuenta 42 probablemente se debe al **tratamiento incorrecto de la conversión de moneda** para las facturas en dólares, específicamente del proveedor S10.
- Se confirma que la plataforma nueva **no estaría aplicando la conversión de moneda** para incrementar correctamente el saldo de la cuenta 42.
- Las diferencias identificadas en este audio se consideran **las últimas a revisar**, con las marcaciones ya realizadas en el documento Word compartido.

## ❓ Sin Consenso / Requiere Revisión Adicional

- El origen exacto de la diferencia de **S/ 1.60 en cuentas por cobrar** aún no está determinado.
- No está claro si la diferencia de **S/ 100,000 en el estado de resultados** se debe a los gastos de venta faltantes, a los ingresos financieros o a la diferencia en cambio incompleta.
- Falta confirmar si los **anticipos a proveedores** serán incorporados correctamente en la nueva plataforma.

## 📌 Acciones de Seguimiento

- [ ] Corregir el tratamiento de moneda (dólares) en el módulo de cuentas por pagar, especialmente para el proveedor S10, para que la conversión incremente correctamente el saldo de la cuenta 42.
- [ ] Incorporar los **anticipos a proveedores** en el reporte de cuentas por pagar de la nueva plataforma.
- [ ] Bajar el detalle de cuentas por cobrar en Excel para identificar el cliente o transacción que genera la diferencia de S/ 1.60 en la cuenta 12.
- [ ] Agregar el rubro de **gastos de venta** en el estado de resultados de la nueva plataforma.
- [ ] Registrar los **ingresos financieros** y el **ingreso por diferencia en cambio** para que el efecto neto sea calculado correctamente.
- [ ] Revisar las marcaciones en el documento Word compartido y validar que todas las diferencias listadas estén siendo atendidas.

## 💬 Citas Destacadas

- *"En el escenario principal se ve la deuda de 684 con el símbolo soles, pero cuando entro al detalle sale el símbolo dólares."*
- *"Si yo tuviera un anticipo a ese S10, no me está generando esa operación en este reporte de cuentas por pagar."*
- *"En el S10 tengo 7,200,000 y en la plataforma 7,100,000."*
- *"Solamente en cuanto a diferencia en cambio se encontró la pérdida... pero no la de ingresos para que haga un efecto neto."*
- *"Aparentemente no estaría tomando la conversión de la moneda para incrementar el saldo de la cuenta 42."*

## 🤖 Sugerencias de IA

- **Prioridad de corrección**: Se recomienda abordar primero el problema de conversión de moneda en la cuenta 42, ya que es la diferencia más grande (aprox. S/ 1,000,000) y tiene efecto en cadena sobre otros módulos.
- **Validación de anticipos**: Conviene revisar si el módulo de anticipos de la nueva plataforma está correctamente configurado para integrarse con el reporte de cuentas por pagar y no generar descuadres futuros.
- **Exportación a Excel**: Para facilitar el cruce de información en cuentas por cobrar, se sugiere establecer un procedimiento estándar para exportar detalles por cuenta contable desde la nueva plataforma.
- **Revisión del estado de resultados**: Antes de cerrar el período, verificar que todos los rubros del S10 (gastos de venta, ingresos financieros, diferencia en cambio neta) tengan su equivalente en la nueva plataforma para garantizar la integridad de los reportes financieros.