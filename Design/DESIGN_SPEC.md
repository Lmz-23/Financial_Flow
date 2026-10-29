# Financial Flow — Spec de diseño para implementación

Oct 3, 2026 · @leonardo muñoz

## Resumen

Financial Flow es una app móvil de finanzas personales para trabajadores independientes en LatAm, inspirada en el Cuadrante del Flujo de Dinero de Kiyosaki: distingue ingreso activo de ingreso pasivo, y calcula un Índice de Flujo de Caja = ingreso pasivo / gasto total del mes.

- **Dos niveles de usuario, un solo modelo de datos.** Quien solo quiere anotar ingresos y gastos, y quien ya piensa en términos de cashflow, usan el mismo backend — lo que cambia es solo qué widgets se muestran, nunca qué se guarda.
- **Activación instantánea de widgets opcionales** (Índice de Flujo de Caja, Deudas, Metas de ahorro). Activar nunca pide un formulario primero: la tarjeta aparece vacía de inmediato, invitando a agregar el primer dato. Desactivar oculta sin borrar nada.
- **Nudges contextuales:** marcar un ingreso como pasivo activa solo el Índice de Flujo de Caja; agregar la primera deuda o meta activa su widget correspondiente, sin que el usuario tenga que ir a buscarlo.

## Sistema de diseño

Colores, tipografía y espaciado viven como tokens en un [Design System de Claude](https://claude.ai/artifact/E8GHsXy9kCEnTdQq4rgnr9) — ahí está la fuente de verdad, con claro y oscuro. Resumen:

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| brand-primary | #0B3B36 | #4FC9A8 | Marca, botón principal, widget hero |
| signal-growth | #1E8F5D | #4FD399 | Ingreso pasivo, pagos de deuda, progreso de metas |
| signal-debt | #B5472E | #E08465 | Deuda, gasto |
| signal-goal | #A97723 | #D9A94E | Identidad de Metas de ahorro |
| surface-page / card | #F3F6F4 / #FFFFFF | #0B1512 / #121F1A | Fondo app / tarjeta |
| border-subtle | #D7E0DB | #27392F | Bordes, tarjetas de invitación |
| ink-primary / secondary | #0E211C / #51645D | #EAF2EE / #9EB3AB | Texto principal / secundario |

**Tipografía:** IBM Plex Sans para interfaz; IBM Plex Mono solo para montos — alinea cifras en columna como un estado de cuenta real.

**Espaciado:** escala 4 / 8 / 12 / 16 / 24 / 32 / 48 px. **Radio:** 4 (chips) · 8 (botones, inputs, tarjetas de invitación) · 14 (widgets estándar) · 22 (widget hero, hojas y modales) · 999 (píldoras, FAB).

Los widgets nunca llevan sombra — la jerarquía se expresa con `surface-raised` y `border-subtle`, nunca con sombra gris genérica.

## Inventario de pantallas

Todo el flujo conectado vive como una sola app interactiva en el [canvas de Design](https://claude.ai/artifact/8KnqJyYnxxu5gjVHyKjLF7), artboard `Dashboard.dc.html` ("App — todo conectado"), con 18 pantallas internas por cambio de estado. El mismo canvas también tiene pestañas sueltas de referencia visual estática (mismos nombres de pantalla) que NO comparten datos entre sí — son solo para revisar el look de una pantalla sin navegar la app; la fuente de verdad del comportamiento es siempre la App.

| Pantalla | Grupo | Qué hace |
| --- | --- | --- |
| Cuentas · Flujo esencial · Invitación · Todo listo | Onboarding | 4 pasos; el 3º activa Cashflow/Deudas/Metas opcionalmente |
| Dashboard | Panel | 4 widgets fijos + widgets opcionales activados + invitaciones a los inactivos |
| Detalle de cuenta | Cuentas | Editar nombre/saldo, ver movimientos de esa cuenta, eliminar |
| Agregar cuenta | Cuentas | Nombre, tipo, saldo inicial |
| Cashflow (detalle) | Cashflow | % calculado, desglose ingreso pasivo / gasto, atajo a marcar ingreso pasivo |
| Deudas (lista) | Deudas | Lista expandible con tasa, progreso y proyección; editar/eliminar |
| Registrar pago de deuda | Deudas | Cuota regular o abono extra; siempre gasto real |
| Agregar deuda | Deudas | Con calculadora de tasa en vivo si no se conoce |
| Metas (lista) | Metas | Progreso, Agregar dinero, Cerrar meta al cumplirse; editar/eliminar |
| Crear meta | Metas | Nombre, objetivo, ahorro inicial (sale de una cuenta) |
| Agregar a meta | Metas | Transferencia interna, no es gasto |
| Transacciones (lista) · Detalle de transacción | Transacciones | Ver todas, detalle, eliminar con reversión de saldo |
| Agregar transacción | Transacciones | Gasto/Ingreso, categorías con opción de crear nuevas, marca de ingreso pasivo |
| Agregar recurrente | Próximos pagos | Pago o ingreso recurrente, frecuencia, día de vencimiento real |
| Ajustes | Ajustes | Notificaciones, tema, cerrar sesión |
| Notificación push · Hoja de confirmación de pago | Notificaciones | Recordatorio 2 días antes; confirmación el día del vencimiento |

## Modelo de datos implícito

Esto es lo que el diseño asume que existe — no mapea 1:1 al schema actual del repo (`accounts`, `debtCards`, `debtLoans`, `transactions`, `recurringItems`), pero debería poder expresarse con él.

**Account** — `name`, `balance`.

**Debt** — `name`, `balance` (saldo pendiente), `rate` (tasa, conocida o estimada), `cuota` (pago mensual), `paidCount`/`totalCount` (pagos hechos de los programados, null si se desconoce el plazo), `dueLabel` (próxima fecha).

**Goal** (= pocket/bolsillo de ahorro) — `name`, `target`, `saved`, `eta`. `saved` no es un número libre: siempre que sube es porque se descontó de una `Account` (ver reglas de negocio).

**Transaction** — `label`, `date`, `amount`, `tipo` (ingreso | gasto), `category`, `account` (a cuál pertenece), `esPasivo` (bool, solo aplica a ingresos).

**RecurringPayment** ("Próximos pagos") — `name`, `amount`, `dueLabel` (fecha real, no relativa), `paid` (bool, requiere confirmación manual — nunca se marca solo), `tipo` (pago | ingreso).

## Reglas de negocio clave

La más importante, porque no es obvia: **deuda vs. meta se contabilizan distinto.**

- **Pagar una deuda (cuota o abono extra)** es siempre un gasto real: se descuenta de la cuenta elegida, genera una `Transaction` tipo gasto, y reduce `balance` de la deuda. No hay ambigüedad — el dinero salió.
- **Aportar a una meta** es una transferencia interna, no un gasto: se descuenta de la cuenta elegida (ya no aparece ahí como disponible) pero NO genera `Transaction` ni afecta el gasto del mes — el dinero se movió de la cuenta al bolsillo, pero sigue siendo del usuario.
- **Cerrar una meta cumplida** (`saved` ≥ `target`) es el único momento en que ese dinero se registra como gastado de verdad: genera la `Transaction`, suma al gasto del mes, y la meta se elimina de la lista. No vuelve a tocar ninguna cuenta — ese descuento ya pasó cuando se fue aportando.

Otras reglas:

- **Próximos pagos nunca se marcan solos.** El sistema notifica 2 días antes y el día del vencimiento pregunta, pero el usuario siempre puede confirmar manualmente sin esperar.
- **Activar un widget opcional es instantáneo** y sin formulario previo — aparece vacío, invitando a la primera acción. Desactivar solo oculta, nunca borra datos.
- **Agregar el primer dato activa el widget solo:** la primera deuda activa Deudas, la primera meta activa Metas, marcar un ingreso como pasivo activa el Índice de Flujo de Caja — sin que el usuario tenga que ir a buscar el interruptor.
- **Categorías de transacción son extensibles por el usuario** — hay una lista base, pero cualquiera puede crear una categoría propia (ej. "Viajes" para alguien que conduce) en el momento de registrar.
- **Renombrar una cuenta actualiza sus transacciones ya existentes** para que sigan apuntando a ella.

## Pendientes técnicos conocidos

Del análisis original del repo, antes de este trabajo de diseño:

| Pendiente | Estado | Cómo ayuda este diseño |
| --- | --- | --- |
| `getDebtPayments()` sin implementar (`CashflowService.ts`) | Placeholder, retorna 0 | Las reglas de negocio de esta spec (pago de deuda = gasto real con fecha/monto/cuenta) resuelven la ambigüedad de diseño que tenía pendiente — son las 3 opciones del TODO original, ya decididas |
| Autenticación | `default-user` hardcodeado en `initialize.ts` | Sin cambios — sigue pendiente de decidir |
| Trabajo sin commitear (onboarding, budget, settings, detalle de deuda/préstamo) | Según `git status` al inicio de esta conversación | Revisar si coincide o choca con las pantallas de esta spec antes de implementar |
| Presupuesto por categoría | Solo existe el global (`BudgetService.ts`) | Sigue siendo v1.1, fuera de este MVP |

## Enlaces

- [Design System — Financial Flow](https://claude.ai/artifact/E8GHsXy9kCEnTdQq4rgnr9): tokens de color, tipografía, espaciado y radio.
- [Canvas de Design — todas las pantallas](https://claude.ai/artifact/8KnqJyYnxxu5gjVHyKjLF7): la app interactiva completa (`Dashboard.dc.html`) más las pestañas sueltas de referencia visual.
