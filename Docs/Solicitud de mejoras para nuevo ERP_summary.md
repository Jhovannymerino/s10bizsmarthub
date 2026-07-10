# Solicitud de mejoras para nuevo ERP_summary


---

## 📋 Resumen General

Esta reunión corresponde a una sesión de coordinación entre el equipo de Integral y Giovanni, en la que se presentaron y discutieron diversas ideas y requerimientos funcionales para implementar en su plataforma de software de gestión contable, financiera y operativa. Los participantes (entre ellos Milka, Carola y otros colaboradores) expusieron un conjunto amplio de necesidades que abarcan desde provisiones contables y órdenes de compra, hasta control presupuestario, impuestos, activos fijos, reportería financiera, flujo de caja y gestión de recursos humanos. El objetivo central es automatizar, centralizar y optimizar los procesos contables y operativos de la empresa Integral, mejorando el control interno y el cumplimiento tributario.

---

## 🔑 Puntos Clave de la Reunión

### 📂 Provisiones de Ingresos y Costos Diferidos

- **Provisiones de ingresos por contrato**: Se propone que, al registrar un contrato de ingreso, el sistema permita adjuntar el contrato escaneado, ingresar el plazo del contrato, el monto total y el cliente. Con esa información, el sistema generaría automáticamente las provisiones mensuales de ingresos distribuidas a lo largo de la vigencia del contrato, facilitando el registro contable y el cálculo correcto de impuestos mes a mes.

- **Costos diferidos**: De manera análoga a los ingresos, cuando existen cargas diferidas como el alquiler de oficinas (ejemplo: una oficina a USD 7,000 y otra a USD 6,000 mensuales), se requiere ingresar los datos del contrato, el plazo y que el sistema realice la distribución o provisión mensual automáticamente, evitando registros manuales recurrentes.

- **Impacto tributario**: Esta funcionalidad ayudaría a tener disponibles los datos necesarios para la declaración mensual de impuestos, reflejando correctamente los ingresos y costos devengados.

---

### 🛒 Órdenes de Compra y de Servicio

- **Generación de órdenes en el sistema**: Se requiere poder crear órdenes de compra y de servicio directamente en la plataforma, consignando el proveedor, el tiempo de vigencia y demás condiciones del servicio. Esto permitirá tener un control previo de todas las operaciones antes de recibir la factura.

- **Vinculación automática de facturas**: Cuando llegue la factura del proveedor, el usuario no tendrá que registrarla manualmente. Al existir ya la orden de compra o servicio en el sistema, bastará con un clic para que el sistema genere automáticamente el registro de la factura, vinculándola con la orden correspondiente.

- **Control y cumplimiento SUNAT**: Esta funcionalidad garantiza que todas las operaciones cuenten con su respectiva orden de compra o servicio, lo cual es un requisito de SUNAT. Se podrá establecer montos mínimos y máximos, así como plazos, dado que algunos proveedores facturan de manera recurrente durante todo el año.

- **Registro previo del socio de negocio**: Antes de generar una orden, el sistema obliga a registrar correctamente al socio de negocio (proveedor/cliente) con todos sus datos, de modo que al crear la orden estos aparezcan automáticamente y luego en la factura también.

---

### 🏦 Detracciones

- **Configuración por tipo de servicio y porcentaje**: Las detracciones se manejarán como parámetros configurables dentro de la plataforma, asignando el porcentaje correspondiente según el tipo de servicio. Esto automatiza el cálculo y evita errores manuales en el cumplimiento de este obligación tributaria.

- **Generación de archivo TXT para pago**: Al igual que con los pagos a proveedores, se requiere poder generar un archivo TXT con las detracciones para subirlo directamente al banco y realizar el pago de forma eficiente.

---

### 🔄 Conciliaciones y Cuenta Administrada (SMO)

- **Casuística especial de cuenta administrada**: Integral maneja una cuenta bancaria administrada por fondos de SMO. Cuando se registra un ingreso de SMO, al asignarle el centro de costo o indicar que corresponde a SMO, ese ingreso se distribuye automáticamente a la cuenta administrada, la cual se utiliza exclusivamente para realizar pagos de SMO.

- **Control de saldo negativo**: El sistema debe vigilar permanentemente que el saldo de la cuenta administrada no se vuelva negativo. Si los fondos se consumen completamente (por ejemplo, en el CMO), el sistema debe generar automáticamente un préstamo de Integral para cubrir ese déficit, garantizando que la caja nunca quede en negativo.

---

### 🧾 Preliminar de Impuestos (IGV y Renta)

- **Generación automática de liquidaciones preliminares**: Antes de cerrar el mes, Carola necesita conocer con anticipación cuánto se deberá pagar por IGV y por Renta. El sistema debe generar un preliminar de impuestos con la información registrada a la fecha, incluyendo el total de ventas, compras y el crédito fiscal del mes anterior, para calcular el monto estimado a pagar.

- **Optimización del proceso actual**: Actualmente este proceso se realiza de forma manual, descargando información y calculando por separado. La automatización permitirá tener el preliminar disponible en cualquier momento con un solo clic, mejorando la planificación de tesorería.

---

### 🏢 Activos Fijos y Depreciación

- **Registro y depreciación mensual automática**: Se requiere registrar los activos de la empresa clasificándolos por tipo (inmuebles, maquinaria, equipos informáticos, muebles y enseres), asignarles la tasa de depreciación correspondiente y que el sistema calcule y registre automáticamente la depreciación mensual para cada categoría.

- **Control de equipos informáticos**: Para el caso específico de computadoras y equipos, se busca poder identificar a qué colaborador está asignado cada equipo y registrar sus características técnicas. Si bien esto es más un control de inventario que contable, complementa el registro de activos y facilita auditorías internas.

---

### 📚 Libros Electrónicos

- **Generación de TXT para libros contables**: Se requiere la generación de archivos en formato TXT para los libros electrónicos exigidos por SUNAT: Libro Diario, Libro Mayor, Registro de Compras y Registro de Ventas.

- **Control sobre el CIRE**: La empresa utiliza el CIRE (sistema de SUNAT), pero este puede incluir facturas que no han sido efectivamente recibidas o que tienen detracción pendiente de pago. Por normativa, no se pueden declarar facturas cuya detracción no haya sido pagada. Por ello, se necesita poder filtrar y controlar qué facturas del CIRE se incluyen en los libros electrónicos, generando los TXT desde el propio sistema con la información validada.

---

### 📊 Reportería Financiera y Contable

- **Estados financieros**: El sistema debe generar reportes de Estado de Situación Financiera y Estado de Resultados con información actualizada.

- **Análisis de cuentas por saldos**: Se requiere una opción que permita nETear los documentos con saldo cero, mostrando únicamente las partidas abiertas o pendientes. Esto facilita la presentación y revisión de cuentas sin necesidad de depurar manualmente las operaciones ya canceladas.

- **Cuentas por cobrar con múltiples criterios**: La reportería de cuentas por cobrar debe poder filtrarse y presentarse de diversas formas: por cliente, por antigüedad dentro de un cliente, consolidado por antigüedad, por monto, o incluyendo todo el historial de un cliente desde el inicio (facturas emitidas, fechas de pago y saldos pendientes).

---

### 🗂️ Centros de Costo y Análisis por Proyecto

- **Asignación de centros de costo**: Al momento de realizar registros contables, presupuestales o de flujo de caja, cada transacción deberá asociarse a un centro de costo (costo de venta, gasto administrativo, gasto de venta), permitiendo una reportería más clara y segmentada.

- **Imputación a proyectos**: Más allá del centro de costo, algunos gastos puntuales como viáticos, peritajes u honorarios específicos pueden imputarse directamente al proyecto al que corresponden. Esto habilita el análisis de rentabilidad por proyecto y responde a requerimientos de fiscalizaciones anteriores, donde SUNAT ha solicitado que cada costo esté relacionado con el ingreso que generó.

- **Relación costo-ingreso-personal**: Se busca poder identificar qué personal intervino en la generación de un ingreso específico y qué costos están relacionados con ese ingreso, lo que resulta útil tanto para análisis internos como para sustentar gastos ante la autoridad tributaria.

---

### 💰 Flujo de Caja y Presupuesto

- **Flujo de caja diario y proyectado**: Se requiere un flujo de caja que se actualice diariamente con los movimientos registrados, así como un flujo de caja proyectado que permita anticipar la situación financiera futura.

- **Control presupuestario con alertas**: El presupuesto debe estar integrado en el sistema y generar alertas automáticas cuando se esté superando lo presupuestado. Por ejemplo, en la planilla de sueldos pueden surgir cambios (aumentos, altas, bajas) que modifiquen el presupuesto inicial. La alerta no bloquea el proceso, pero notifica que se está excediendo el presupuesto y que se requiere aprobación o al menos que los responsables estén informados oportunamente, sin esperar un ajuste trimestral o semestral.

---

### ⚠️ Alertas Tributarias por Límites Legales

- **Gastos de representación**: Tributariamente, los gastos de representación tienen un límite porcentual sobre los ingresos. Si se excede ese límite, el exceso no es deducible para efectos del Impuesto a la Renta y tampoco se puede usar el IGV como crédito fiscal. El sistema debe generar una alerta cuando se esté aproximando o superando ese límite, pudiendo incluso reclasificar automáticamente el exceso como gasto no deducible.

- **Otros límites tributarios**: Se mencionan también los gastos por atenciones al personal, movilidad y viáticos como conceptos que tienen topes legales y que deben monitorearse. Establecer estos límites como parámetros en el sistema permitirá un control tributario proactivo.

---

### 👥 Recursos Humanos y Planilla

- **Personal por centro de costo**: La asignación del personal a centros de costo es fundamental para distribuir correctamente los gastos de planilla y relacionarlos con los ingresos generados.

- **Cálculo de utilidades y conceptos especiales**: El sistema S10 actualmente no calcula correctamente las utilidades y otros conceptos extraordinarios, obligando a hacerlo de forma manual. Se requiere que el nuevo sistema esté preparado para calcular correctamente estos conceptos.

- **Validación operativa de planilla**: La IA o el sistema podría automatizar la validación de los saldos de las cuentas contables con el operativo de planilla, proceso que actualmente se realiza de manera manual.

---

### 🏧 Pagos y Vinculación Bancaria (Net Cash)

- **Integración con Net Cash**: Al momento de que tesorería realice pagos a proveedores, el proceso sería: la orden de servicio ya está en el sistema, la factura está vinculada a ella, y al momento de pagar se genera un archivo TXT que se sube directamente al banco (Net Cash) para procesar el pago de múltiples proveedores a la vez.

- **Proceso integral de pagos**: Esto elimina pasos manuales, reduce errores y garantiza que cada pago esté respaldado por su respectiva orden y factura.

---

## ✅ Acuerdos Alcanzados

- Se implementará el módulo de provisiones de ingresos y costos diferidos con adjunto de contrato, plazo y distribución mensual automática.
- Las órdenes de compra y servicio serán obligatorias en el sistema, con registro previo del socio de negocio, y permitirán generar automáticamente el registro de la factura correspondiente.
- Las detracciones se configurarán como parámetros por tipo de servicio y porcentaje, con generación de TXT para pago bancario.
- Se desarrollará el módulo de preliminar de impuestos (IGV y Renta) para uso previo al cierre mensual.
- La depreciación de activos fijos se automatizará por tipo de bien y tasa, con control adicional de equipos informáticos por usuario.
- La reportería de cuentas por cobrar incluirá múltiples criterios de filtro y presentación.
- Se implementarán centros de costo e imputación a proyectos para análisis de rentabilidad.
- El flujo de caja diario y proyectado, junto con el presupuesto, tendrán alertas automáticas por exceso.
- Se configurarán alertas tributarias para gastos de representación, atenciones, movilidad y viáticos con sus respectivos topes legales.
- La integración con Net Cash permitirá generar TXT para pagos masivos a proveedores y detracciones.

---

## ❓ Pendiente de Definición / Requiere Mayor Análisis

- La casuística específica de la cuenta administrada SMO y la generación automática de préstamos de Integral ante saldo negativo requiere validación técnica y contable más detallada.
- Los montos mínimos y máximos para las órdenes de servicio deberán ser definidos por política interna de la empresa.
- Se coordinará con Giovanna para evaluar si existen requerimientos adicionales del área operativa de Recursos Humanos que impacten en el sistema.

---

## 📌 Acciones de Seguimiento

- [ ] Giovanni debe revisar y confirmar la viabilidad técnica de cada módulo presentado en la reunión.
- [ ] El equipo debe definir los montos mínimos y máximos de política para las órdenes de compra y servicio.
- [ ] Carola debe proveer los parámetros tributarios actualizados (tasas, límites de gastos de representación, movilidad, viáticos) para configurarlos en el sistema.
- [ ] Coordinar reunión con Giovanna para revisar requerimientos de Recursos Humanos que afecten el módulo operativo.
- [ ] Si existen requerimientos adicionales de RRHH, enviar un audio a Giovanni con las especificaciones.
- [ ] Validar con el área técnica el esquema de integración con Net Cash para pagos masivos y detracciones.
- [ ] Confirmar el esquema contable de la cuenta administrada SMO y la lógica de generación automática de préstamos.

---

## 💬 Citas Destacadas

- *"El sistema me haría provisiones entre los cinco meses o de acuerdo a lo que se pactara para que esté en la contabilidad y eso me ayude a poner en mis impuestos mes a mes la provisión de ingresos."*
- *"Cuando me llega la factura, yo ya no tendría que registrar manual la factura, sino como ya tengo mi orden de compra o de servicio en el sistema, como que le doy un clic y me arme el registro de la factura."*
- *"Eso nos permite tener un control que todas las operaciones cuenten con su orden de compra o servicio, que es un requisito de SUNAT."*
- *"Cuando hay gastos de representación, si se excede un porcentaje de los ingresos, también que nos genere una alerta para saber que ya no puedo tener más gastos de representación porque eso ya pasaría a ser no deducible."*
- *"Que haya una especie de control, no que nos limite, pero sí que salte la alerta para que finalmente se eleve a la aprobación que corresponde."*
- *"Poder tener un análisis de la rentabilidad incluso por proyecto."*

---

## 🤖 Sugerencias IA

- **Priorización por impacto tributario**: Se recomienda priorizar el desarrollo de los módulos de provisiones, preliminar de impuestos y alertas tributarias, ya que tienen impacto directo en el cumplimiento regulatorio ante SUNAT y reducen el riesgo de contingencias fiscales.

- **Arquitectura de parámetros tributarios**: Crear un módulo de configuración centralizado donde se gestionen todos los límites y tasas tributarias (IGV, Renta, detracciones, límites de gastos), de modo que cuando cambien las normas solo se actualice el parámetro sin modificar la lógica del sistema.

- **Trazabilidad costo-ingreso-proyecto**: Implementar desde el inicio un modelo de datos que vincule explícitamente cada transacción de costo con su ingreso relacionado y su proyecto, ya que esto no solo sirve para análisis interno sino para responder a requerimientos de fiscalización de SUNAT de manera ágil.

- **Automatización del flujo de pagos**: La cadena Orden de Servicio → Factura → Pago → TXT Bancario debe diseñarse como un flujo end-to-end automatizado, minimizando la intervención manual y garantizando que ningún pago se realice sin el respaldo documental correspondiente.

- **Gestión del cambio**: Dado el volumen de módulos presentados, se recomienda elaborar un plan de implementación por fases, comenzando con los procesos más críticos (impuestos, órdenes de compra, provisiones) y escalando progresivamente hacia los módulos de reportería avanzada y análisis de rentabilidad por proyecto.