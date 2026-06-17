# S10 BizSmartHub — Guía de Uso

Dashboard financiero del Grupo (CMO GROUP, INTEGRAL, MEDARQ, AMERICANA) alimentado desde el ERP S10.

---

## 1. Acceso

- **URL:** https://s10bizsmarthub.bizwareapps.com
- Ingresa con tu correo y contraseña. Cada usuario ve solo las empresas asignadas.
- Si no recuerdas la clave, usa "¿Olvidaste tu contraseña?" en el login.

## 2. Navegación básica

En la parte superior siempre tienes:
- **Selector de empresa** — elige una empresa o **GRUPO** (consolidado de las 4).
- **Selector de año** — cambia el ejercicio (2022–2026).
- **Menú lateral** — las secciones (P&L, CxC, CxP, Caja, GAV, Balance, El Mayor, etc.).

> Consejo: si acabas de entrar y algo se ve raro o vacío, presiona **Ctrl + Shift + R** para cargar la última versión.

## 3. Las vistas principales

| Vista | Qué muestra |
|---|---|
| **P&L** | Estado de resultados: ingresos, costo, GAV, EBITDA, gastos financieros, diferencia de cambio, utilidad. Mensual + acumulado del año (YTD). |
| **CxC** | Cuentas por cobrar: cartera **pendiente** por cliente, con aging (vencido/vigente). |
| **CxP** | Cuentas por pagar: deuda **pendiente** por proveedor. Las notas de crédito **restan**. |
| **Posición de Caja** | Saldos y flujos por banco, mes a mes (ver punto 5). |
| **GAV** | Gastos administrativos y de ventas, por cuenta. |
| **Balance** | Balance general por cuenta (saldo inicial, movimiento, saldo final). |
| **El Mayor** | El libro mayor completo — la verdad contable detrás de todo (ver punto 4). |

## 4. Cómo validar cualquier cifra — **El Mayor** 🔎

El principio del sistema: **toda cifra es trazable hasta su asiento contable.** No tienes que creer en un número — puedes abrirlo y ver de dónde sale.

**Desde un número o una cuenta:**
1. Haz clic en un detalle (por ejemplo, una cuenta de GAV, un cliente en CxC, un proveedor en CxP).
2. En el modal que abre, pulsa **"Ver en el Mayor"**.
3. Verás todas las líneas del mayor que componen esa cifra.

**Desde El Mayor directamente** (menú lateral → *El Mayor*):
- Navega el **árbol de cuentas** (Clase → Grupo → Cuenta) a la izquierda.
- Filtra por mes, busca por glosa/tercero.
- Haz clic en cualquier **N° de asiento** → se abre la **partida doble completa** del comprobante, con el sello:
  - ✅ *"Asiento cuadrado — Débito = Crédito"*, o
  - ⚠️ un aviso si hay descuadre.
- Dentro del asiento, el ícono 🔗 abre el **documento de origen** (la factura) cuando existe.

> Así cualquier auditor o contador confirma un número en segundos, sin salir del sistema.

## 5. Conceptos clave (para no confundirse)

**Posición de Caja — "Saldo de cierre" vs "Flujo neto"**
Hay un selector arriba de la tabla:
- **Saldo de cierre** (por defecto) = cuánto **quedó** en cada banco al cierre de cada mes (el saldo acumulado). *Esto es lo que normalmente quieres ver.*
- **Flujo neto** = cuánto **se movió** ese mes (entradas − salidas). Útil para analizar movimiento, no saldo.

Ejemplo: si enero movió +34,430 y febrero +56,640, el **flujo** de febrero es 56,640, pero el **saldo de cierre** de febrero es 91,070 (acumulado). Ambos son correctos — son cosas distintas.

**El Mayor muestra el año completo; el P&L es "a la fecha" (YTD).**
Por eso un total del Mayor puede ser un poco mayor que el del P&L: el Mayor incluye asientos con fecha futura del mismo año que el P&L aún no cuenta. No es un descuadre.

**Notas de crédito (NC).** Las NC **reducen** el saldo (del cliente en CxC o del proveedor en CxP). Se muestran en rojo / negativas. Es correcto que resten.

**Ver lo pagado y lo anulado en CxC.** La *cartera* (pantalla principal de CxC) muestra solo lo **pendiente**. Pero al hacer **clic en un cliente** se abre su detalle con pestañas: **Pendientes · Vencidos · Vigentes · Saldados · Notas de crédito · Todos**, cada documento con su **Estado** (🟡 Pendiente / 🟢 Saldado / 🔴 NC) y un **buscador por N° de documento**. Así ves lo ya **pagado** (pestaña Saldados) y las **NC** que reducen el saldo, sin salir de CxC. Para el respaldo contable de cualquier documento, usa **"Ver en el Mayor"** en ese mismo detalle. *Nota:* cuando una factura quedó anulada por una NC **flotante** (sin aplicar en S10), verás la factura y su NC por separado (mismo monto, una en rojo) y el **Neto** del cliente en cero — S10 no guarda el amarre formal entre ambas, por eso no se marcan como un solo movimiento.

**Algunas líneas del Mayor no tienen documento.** Son contabilizaciones directas (aperturas, provisiones, reclasificaciones). Es normal que la columna de documento quede vacía.

## 6. Actualización de datos

Los datos se sincronizan automáticamente desde S10 de lunes a viernes (mañana y tarde), y un consolidado completo los domingos. No necesitas hacer nada.

## 7. Soporte

Ante cualquier duda o cifra que no cuadre, reporta a Jhovanny indicando: empresa, año, vista y el número observado. Con el Mayor casi siempre se confirma el origen al instante.
