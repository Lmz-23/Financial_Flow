# Arquitectura técnica: Financial Flow MVP

Especificación de referencia del diseño objetivo del MVP. Escrita el 2026-10-03; última actualización: 2026-10-08 (HEAD `3642b5f` más el commit pendiente de F5a-fix, que no puede citarse a sí mismo; rama `develop`; el commit de este documento tampoco puede citarse a sí mismo), con las decisiones del usuario y lo implementado entre F0 y F3 y la fase F2b (incluidas sus pasadas bis y ter, el endurecimiento de la propiedad del usuario y su guarda estructural por AST, ya commiteada). Sincronizado además con las decisiones del usuario del 2026-10-07 sobre el Índice de Flujo de Caja, el título del resumen semanal y el tope del ETA (puntos 29 a 32 de 10.2), y con las decisiones del 2026-10-08 (meses restantes de una deuda con tasa y plan de notificaciones: puntos 33 a 37 de 10.2) y con las decisiones del usuario del 2026-10-08 posteriores a F4 y F5a (puntos 38 a 41 de 10.2) y del cierre de F4-fix y F5a-fix (puntos 42 a 45 de 10.2).

## Tabla de contenidos

- [Convenciones del documento](#convenciones-del-documento)
- [Estado de implementación](#estado-de-implementación)
  - [Pendientes para la próxima sesión](#pendientes-para-la-próxima-sesión)
    - [Resuelto: un `update` que reasigne `userId` y las FK sin `userId`](#resuelto-un-update-que-reasigne-userid-y-las-fk-sin-userid)
    - [Decisión 33: meses restantes de una deuda con tasa](#decisión-33-meses-restantes-de-una-deuda-con-tasa)
- [0. Problemas del repo que condicionan el diseño](#0-problemas-del-repo-que-condicionan-el-diseño)
- [1. Resumen ejecutivo](#1-resumen-ejecutivo)
- [2. Modelo de datos objetivo](#2-modelo-de-datos-objetivo)
  - [2.1 Tablas](#21-tablas)
  - [2.2 Estrategia por tipo de hecho](#22-estrategia-por-tipo-de-hecho)
  - [2.3 Mapeo de lo viejo a lo nuevo](#23-mapeo-de-lo-viejo-a-lo-nuevo)
- [3. Reglas de negocio: invariantes y contratos](#3-reglas-de-negocio-invariantes-y-contratos)
  - [3.1 Saldos derivados](#31-saldos-derivados)
  - [3.2 Reporte del mes](#32-reporte-del-mes)
  - [3.3 Invariantes](#33-invariantes)
  - [3.4 Contratos de operaciones](#34-contratos-de-operaciones)
  - [3.5 Propiedad del usuario y convención de repositorios](#35-propiedad-del-usuario-y-convención-de-repositorios)
  - [3.6 Errores tipados](#36-errores-tipados)
  - [3.7 Definiciones del ETA de una meta](#37-definiciones-del-eta-de-una-meta)
- [4. Capas y módulos](#4-capas-y-módulos)
  - [4.1 Estructura](#41-estructura)
  - [4.2 Qué se conserva, se retira o se crea](#42-qué-se-conserva-se-retira-o-se-crea)
  - [4.3 Estado de la interfaz](#43-estado-de-la-interfaz)
  - [4.4 Mecanismo de migraciones](#44-mecanismo-de-migraciones)
- [5. Sistema de tema](#5-sistema-de-tema)
- [6. Mapa de pantallas y navegación](#6-mapa-de-pantallas-y-navegación)
- [7. Notificaciones y recurrentes](#7-notificaciones-y-recurrentes)
- [8. Estrategia de pruebas](#8-estrategia-de-pruebas)
- [9. Plan por fases](#9-plan-por-fases)
- [10. Riesgos, decisiones aprobadas y verificaciones de Expo](#10-riesgos-decisiones-aprobadas-y-verificaciones-de-expo)
  - [10.1 Riesgos arquitectónicos](#101-riesgos-arquitectónicos)
  - [10.2 Decisiones aprobadas](#102-decisiones-aprobadas)
  - [10.3 Verificaciones de Expo](#103-verificaciones-de-expo)
- [11. Decisiones del usuario](#11-decisiones-del-usuario)
- [12. Desviaciones aprobadas](#12-desviaciones-aprobadas)
  - [12.1 F1 (datos): restricciones adicionales y más estrictas](#121-f1-datos-restricciones-adicionales-y-más-estrictas)
  - [12.2 Desviaciones y ampliaciones posteriores](#122-desviaciones-y-ampliaciones-posteriores)

---

## Convenciones del documento

- **SUPUESTO**: decisión de diseño tomada sin evidencia y que no está cubierta por las decisiones aprobadas de las secciones 10.2 y 11. Las decisiones ya aprobadas no llevan esta etiqueta y citan su número (por ejemplo, "D6").
- **NO VERIFICADO**: no se ha comprobado en código ni en documentación.
- **[EXPO-DOC]**: hay que confirmarlo en https://docs.expo.dev/versions/v56.0.0/ antes de implementar.
- **VERIFICADO (2026-10-03)**: comprobado contra la documentación de Expo v56 y las fuentes instaladas (informe de investigación del 2026-10-03).
- **VERIFICADO EN CÓDIGO (2026-10-07)**: comprobado leyendo el código real del repo (`src/**`, `test/**`, archivos de configuración) al actualizar este documento. Salvo que se indique otra cosa, lo descrito como "implementado" está en este nivel; que además se haya ejecutado (tests, `tsc`, lint, `expo export`) lo declaran los informes de cada fase, no esta lectura.
- **Código/comentarios obsoletos**: cuando un comentario del código contradice una decisión posterior del usuario, prevalece este documento y la sección 11 (se anota en la sección 12).

---

## Estado de implementación

Este documento describe el **diseño objetivo**. Las desviaciones aprobadas durante la implementación se anotan en la sección final [Desviaciones aprobadas](#12-desviaciones-aprobadas).

Estado a fecha 2026-10-08 (HEAD `3642b5f` más el commit pendiente de F5a-fix):

| Fase | Contenido | Estado | Commits |
|---|---|---|---|
| F0 | Configuración (higiene del repo) | Completada, revisada, verificada y commiteada | `641f393` |
| F1 | Datos (esquema, migración `0000`, cliente, semilla) | Completada, revisada, verificada y commiteada | `0e7fb57` |
| F2a | Reglas puras | Completada, revisada, verificada y commiteada | `a6cc855` |
| F2b | Dominio: repositorios, servicios y `createDomain`, con las pasadas bis y ter y el refuerzo de la propiedad del usuario | Completada, revisada, verificada y commiteada (incluida la guarda estructural por AST y la corrección de comentarios obsoletos) | `e86bd95` (repositorios); `fd60fcd` (servicios y pruebas); `560bb12` (F2b-bis: ocurrencias validadas contra la serie, cuentas archivadas protegidas, ETA de metas); `8b0609f` (F2b-ter: desarchivar cuentas, tope del ETA, validación de fechas); `9e5ae32` (propiedad del usuario en servicios y repositorios); `58b0502` (prueba aleatoria con modelo de referencia independiente); `119a972` (guarda estructural de propiedad por AST); `0b34f13` (corrección de comentarios obsoletos del empate quincenal y del ETA) |
| F3 | Tema: tokens, `ThemeProvider`, fuentes, primitivas `ds/` | Completada, revisada, verificada y commiteada | `6303bb5` |
| F4 | Plataforma (notificaciones): `src/platform/notifications.ts` y `test/unit/platform/notifications.test.ts` | Implementada, revisada (aprobada con observaciones) y verificada. F4-fix (captura de errores de los manejadores y reintento) resuelto, revisado y verificado. Pendiente de dispositivo y de conectar al arranque (ver más abajo) | `a1556fc` (F4); `3642b5f` (F4-fix) |
| F5a | Navegación y Dashboard: `src/app-services/`, stores, hooks, `src/lib/`, `src/navigation/routes.ts`, `src/components/dashboard/`, `app/(app)/`, `app/_layout.tsx` con `Stack.Protected`; borrado de `app/(tabs)/` | Implementada, revisada (aprobada con observaciones) y verificada. F5a-fix (menor 3, menor 6 y texto de aviso de próximos pagos) resuelto, revisado y verificado | `5768984` (F5a); F5a-fix: (hash pendiente: se completa en la próxima actualización) |
| F5b | Funcionalidades (por carpetas) | Pendiente (fuera de este ciclo) | |
| F6 | Limpieza | Pendiente (fuera de este ciclo) | |

**Verificación de F4, F5a, F4-fix y F5a-fix (2026-10-08, informes del ciclo):** vitest 42 archivos / 837 tests en verde; `tsc` en 208 errores (la base heredada era 276 antes de F5a), ninguno en archivos nuevos; lint en 219 problemas (36 errores, 183 avisos; antes de F5a eran 273), ninguno nuevo. El ciclo de F4-fix y F5a-fix se verificó con vitest, `tsc` y lint contra esa base; **no se verificó render real ni dispositivo**. En ese momento el bundle de Metro fallaba solo por rutas viejas (primer fallo: `app/debt/add-card.tsx`); ya no es así (ver «Estado del árbol»). Limitación: la verificación no incluyó dispositivo (ver pendientes de dispositivo de F4 y de F5a).

Otros commits relacionados: `450af15` (documento de arquitectura inicial), `8357447` (ajuste de dominio: el quincenal ajusta la primera fecha y `formatCOP` sin espacio) y `4e50130` (ajuste de UI: primitivas `ds` en unidades menores). Las actualizaciones posteriores de este documento se commitean aparte y no se citan aquí. El commit `e7fd4a5` es el snapshot previo al rediseño y el tag `pre-mvp` apunta a él (el tag existe en `.git/refs/tags/pre-mvp`; que apunte exactamente a `e7fd4a5` lo declara el usuario y no se ha comprobado leyendo el objeto).

**Estado del árbol (importante).** Tras F5a, los hooks de dominio (`useAccounts`, `useDebts`, `useTransactions`) están reescritos y `app/(tabs)/` se borró, pero las pantallas y componentes antiguos restantes (`app/**` fuera de `app/(app)/`, `src/components/**` previos al rediseño) siguen importando módulos ya retirados (bolsillos, presupuesto, `cashflow` antiguo, repositorios de tarjetas y préstamos). Esas rutas rotas provocaban que el bundle de Metro no resolviera (primer fallo: `app/debt/add-card.tsx`).

**Estado actual (verificado):** las 12 rutas antiguas rotas se aparcaron en `_parked/` (raíz del repo, excluida de tsconfig y eslint; commit «chore(app): aparcar 12 rutas rotas en _parked/ para que el bundle compile»), de modo que `expo export --platform android` compila. Los archivos aparcados se retiran, o se rehacen en su paso de F5b, y `_parked/` se elimina en F6. Cifras vigentes: `tsc` 90 errores, eslint 126 problemas, vitest 853/853 (43 archivos). Las cifras de `tsc` (208) y lint (219) del informe de F4/F5a-fix citadas arriba son las de ese ciclo y quedan superadas por estas. El dominio, la capa de datos, el tema, las primitivas `ds/`, el adaptador de notificaciones y la capa `app-services/` están verificados con vitest.

La guarda estructural de repositorios por AST (`test/helpers/repositoryAst.ts`, `test/unit/repositoryOwnership.test.ts`) está commiteada (`119a972`) y verificada; sus límites están en [3.5](#35-propiedad-del-usuario-y-convención-de-repositorios). La corrección de los comentarios obsoletos del código está hecha (ver [12.2](#122-desviaciones-y-ampliaciones-posteriores)).

`.claude/agent-memory/` estuvo versionada del 2026-10-07 al 2026-10-25. Al retirar AIEOS se borró y quedó en `.gitignore`; el estado de traspaso entre sesiones vive ahora en `docs/ESTADO.md`.

### Pendientes para la próxima sesión

Esta subsección es el único lugar donde se listan; el resto del documento los enlaza. F4, F5a, F4-fix y F5a-fix están implementadas, revisadas y verificadas; lo que sigue es lo pendiente tras ese ciclo.

**RESUELTOS en F4-fix y F5a-fix (ya no son pendientes):**

- **F4-fix** (`3642b5f`): en `src/platform/notifications.ts` los errores de los manejadores se capturan con `console.warn` sin datos financieros; el arranque en frío limpia siempre la última respuesta; una notificación fallida se reintenta. 4 tests nuevos. Quedan dos menores: una carrera residual baja entre el listener y el arranque en frío, y un test con un aserto que depende del orden de microtareas.
- **F5a-fix, menor 3:** `invalidateAfterCommit` en `src/app-services/effects.ts`: un fallo de `refreshSettings` o de `invalidate` posterior al COMMIT nunca rompe el comando. 3 tests.
- **F5a-fix, menor 6 (constantes mágicas):** resuelto según las decisiones 42 a 44 de [10.2](#102-decisiones-aprobadas).
- **Texto fijo «Te avisamos 2 días antes…»** que contradecía la decisión 34 para ingresos: resuelto por la decisión 45 (`upcomingNoticeText` en `src/lib/upcomingNotice.ts`).

**PRODUCTO (por fases)**

- **F4-integración (pendiente):** `registerNotificationReconciler` en `src/app-services/notificationsPort.ts` (marcado `F4-INTEGRATION`) queda **sin conectar a propósito**. Falta registrarlo en el arranque con un cierre que arme el `ReconcileInput` y conectar `subscribeToNotificationResponses` con `onSnooze` = `commands.recurring.snooze`.
- **F4, pendiente de dispositivo:** entrega y botones de la notificación; canal de Android; arranque en frío; que WEEKLY con `weekday` 1 sea domingo; que `content.data` vuelva intacto; el límite de ~64 de iOS; y la decisión de que ambas acciones usen `opensAppToForeground: true` (si «Todavía no» no abriera la app con la app cerrada, el aplazamiento se perdería). La fuente de la API fueron los tipos instalados de expo-notifications 56.0.18 (no hubo acceso a los docs web).
- **Estado vacío de «Próximos pagos» (pendiente de decisión de diseño del usuario):** con la lista vacía el widget se muestra con un contenedor de filas vacío que añade unos 14 px bajo el título (inferido por lectura del código, no medido).
- **Verificar en dispositivo el render del Dashboard con los nuevos tokens:** Deudas 18/24 (decisión 42), +2 px en las filas y +4 px entre widgets (decisión 43) y +2 px de holgura del FAB (decisión 44). Este ciclo no verificó render real.
- **F5a, retirar en F6:** re-export TEMPORAL de `useCategories` / `useCategoriesByType` en `src/hooks/index.ts`. `AccountWithBalance` ya no se exporta de `hooks/useAccounts`; lo importa `forms/AccountPicker` (heredado): migrar en F5b/F6.
- **F5a, menores a decidir al conectar F4:** cualquier cambio de `settings` dispara reconcile (incluido tema y widgets). Algunos widgets del Dashboard usan `Pressable`/`View` de react-native directamente (desviación del criterio literal «solo primitivas ds», sin colores fijos).
- **F5a, pendiente de dispositivo:** `Stack.Protected` y su redirect al completar el onboarding; modo oscuro; rutas de destino (inexistentes hasta F5b); y que no haya bucle de renders ni doble consulta en StrictMode en `useDomainQuery`.
- **F5a, textos inferidos que el usuario podría querer cambiar:** fechas «Hoy/Ayer/día de semana/15 oct», «Vencido», «Sin definir».
- **F5b:** pantallas por carpetas: cuentas, transacciones, deudas, metas, recurrentes, onboarding de 4 pasos y ajustes. Se parte en 5 ciclos, cada uno con su Review y su Verification (el quinto, F5b-5, es el detalle de Cashflow, por decisión del usuario del 2026-10-08):
  - **F5b-1 (onboarding; prioridad alta, decisión 41 de 10.2):** sin él, con BD limpia, la app arranca en una ruta inexistente `onboarding`. Incluye la pantalla de error con reintento si `initializeApp` falla (`app/_layout.tsx` ~L38-44), resuelta **junto con** un error boundary para consultas que lancen en render (`useDomainQuery`): una sola solución, no dos parches.
  - **F5b-2:** cuentas y movimientos.
  - **F5b-3:** deudas, metas y recurrentes. Incluye el texto confirmado para `monthsRemaining = null` (decisión 38; si se detecta un problema de longitud o espacio, se consulta al usuario antes de cambiarlo) y la edición de un próximo pago en la pantalla de recurrentes (decisión 39).
  - **F5b-4:** Ajustes, con la etiqueta del interruptor «Recordatorios de pagos y cobros» (decisión 35), que **no existe en código**.
  - **F5b-5 (detalle de Cashflow; decisión del usuario, 2026-10-08):** ciclo propio, al final de F5b (después de F5b-1 a F5b-4), con su Review y su Verification. Rehace `app/(app)/cashflow.tsx` (origen: `cashflow/index.tsx`, hoy aparcado en `_parked/`), apoyada en `ReportService`, que reemplaza a `CashflowService`.
  - **Premisa a revisar en F5b-3 (edición/confirmación de recurrentes):** el usuario decidió que a los ingresos no se les ofrece «marcar» (decisión 45), pero la decisión 34 solo trata de avisos y la ruta `/recurring/[id]/confirm` podría aplicar a ingresos. Si se puede confirmar un ingreso como recibido, hay que revisar la frase de cierre «También puedes marcarlo tú mismo cuando quieras.».
- **Backend-coder (ítem aparte, decisión 40):** `RecurringService.upcoming()` debe exponer la fecha de la ocurrencia confirmada para poder llamar a `unconfirm` al desmarcar un pago (D14).
- **F6 (limpieza):** retirar el shim de `colors`, las primitivas antiguas de `src/components/ui/`, `src/domain/utils/` con su `formatCOP` homónima (ver [5](#5-sistema-de-tema)), hooks y pantallas antiguos, el alias de `expo-sqlite` y `test/mocks/expo-sqlite.ts` en `vitest.config.ts` (siguen presentes), y endurecer a `error` las reglas de ESLint de fronteras y de `colors` (hoy `warn`).
- **Contratos de F5 que NO aplican al Dashboard y siguen para F5b** (`GoalView.eta` por `kind`, `monthsRemaining = null`, Desarchivar, `refundPreview` / `RefundAccountRequiredError`, `normalizeAnchor`, `MoneyInput`); la lista siguiente es la de F5b. **Contratos que F5 debe implementar** (detalle en [3.4](#34-contratos-de-operaciones) y [6](#6-mapa-de-pantallas-y-navegación)):
  - "Desarchivar" al atrapar `AccountArchivedError`.
  - Elegir cuenta activa de destino al eliminar una meta con aportes de cuentas archivadas (`RefundAccountRequiredError`).
  - `normalizeAnchor` en vivo en "Agregar recurrente".
  - `MoneyInput`: ignorar el dígito que desborda en vez de vaciar el campo y tratar el separador "." como no-op lógico (probar en dispositivo; ver [5](#5-sistema-de-tema)).
  - Mostrar `GoalView.eta` según su `kind` ([3.7](#37-definiciones-del-eta-de-una-meta)).
  - Usar `accountArchived` en `refundPreview`.
  - Distinguir los dos significados de `DebtView.monthsRemaining = null` (falta la cuota, o la cuota no cubre el interés / la proyección supera 600 meses). La plantilla del diseño (`Design/Dashboard.dc.html` ~L996-998) solo tiene un texto para `null` («Agrega la cuota para ver la proyección.»), falso para una deuda con cuota que no avanza. El texto para la cuota que no cubre el interés **está definido** (decisión 38 de 10.2): «Tu cuota actual no alcanza a cubrir el interés mensual — la deuda no va a bajar con este pago.». Detalle en [Decisión 33: meses restantes de una deuda con tasa](#decisión-33-meses-restantes-de-una-deuda-con-tasa).

**GUARDA Y PRUEBAS**

#### Resuelto: un `update` que reasigne `userId` y las FK sin `userId`

> **RESUELTO (2026-10-18, rama `fix/propiedad-datos`).** Antes ningún mecanismo detectaba un `update` que cambiara el `userId` de una fila hacia otro usuario existente (mutación **i1s**), y la BD aceptaba una fila de B que referenciara una de A (FK de una sola columna). Ahora hay tres cerrojos:
>
> 1. **Guarda AST, regla R7** (`test/helpers/repositoryAst.ts`): el `.set(...)` de cada `db.update(...)` no puede contener `userId`/`user_id` (literal, shorthand, spread, `set.userId = ...`, `set[k] = ...`, `Object.assign`). Trata de forma explícita los `.set(set)` de `debtRepository`, `goalRepository` y `recurringRepository` y la clave calculada `[WIDGET_COLUMN[widget]]` de `settingsRepository`. La mutación i1s y dos variantes (`.set(set)` y spread) están en `test/unit/repositoryOwnership.test.ts`.
> 2. **Test de estado final** (`test/integration/repositories/ownership.test.ts`): tras el control positivo de cada mutador como A, ninguna fila de las 8 tablas con dueño cambió de `user_id` (con B existente).
> 3. **Triggers en la BD** (`src/database/migrations/0001_owner_triggers.sql`, migración custom de drizzle-kit): `OWNER_IMMUTABLE` en las 8 tablas con dueño y `OWNER_MISMATCH` en las 12 referencias entre tablas con dueño. Detalle en [3.5](#35-propiedad-del-usuario-y-convención-de-repositorios).
>
> **Por qué triggers y no FK compuestas `(id, userId)` (decisión del usuario, 2026-10-18).** SQLite no permite añadir FK a una tabla existente: habría que reconstruir `recurring_items`, `transactions`, `goal_contributions` y `balance_adjustments`. El migrador de drizzle corre todo dentro de `BEGIN…COMMIT` (`drizzle-orm/sqlite-core/dialect.js`), donde `PRAGMA foreign_keys=OFF` no tiene efecto, así que el `DROP` de `recurring_items` dispararía el `ON DELETE SET NULL` y vaciaría `transactions.recurring_item_id` en silencio. Además, un `SET NULL` compuesto pondría también `user_id` a NULL (es NOT NULL), y las categorías del sistema (`user_id` NULL) no admiten FK compuesta. Los triggers son aditivos, no tocan filas existentes ni cambian ningún `ON DELETE`.

Resto de pendientes de guarda y pruebas:

- Test de `getViewById` con varias cuentas que aserte `accountName` (los JOIN no se verifican).
- Alinear R5 y R6 con sus falsos positivos documentados: `userId` dentro de `values` fuera de `insert`, y un array de condiciones que recibe el filtro solo por `.push`.
- Un segundo `.where` fuera de la cadena y las asignaciones posteriores al `export const` solo los cubre el comportamiento.
- Sustituir `parseDiagnostics` (API interna de TypeScript) cuando haya una alternativa pública.
- Comentarios `SUPUESTO` restantes (actualizado 2026-10-07, tras las decisiones del usuario; VERIFICADO EN CÓDIGO):
  - `src/domain/rules/statement.ts`: **sin SUPUESTOS**.
  - `src/domain/rules/notificationPlan.ts`: **sin SUPUESTOS**; su cabecera ya cita las decisiones 34 a 37 y la 31 (VERIFICADO EN CÓDIGO 2026-10-08; ver [7](#7-notificaciones-y-recurrentes)).
  - `src/domain/rules/amortization.ts`: **ya no conserva ninguno** (decisión 33, 2026-10-08): [Decisión 33: meses restantes de una deuda con tasa](#decisión-33-meses-restantes-de-una-deuda-con-tasa).
- RESUELTO (commit `051bdba`; VERIFICADO EN CÓDIGO 2026-10-08: ya no hay «SUPUESTO» en `test/unit/rules/` ni «20.001» en `amortization.test.ts`): los títulos de test con «SUPUESTO» ya decididos (`goalEta.test.ts`, tope de 1200 meses; `recurrence.test.ts`, empate quincenal) y el comentario de cuota de `amortization.test.ts`.
- Texto fijo heredado con erratas en `app/cashflow/index.tsx` L272 («Tu ingreso pasivo cubre el 100% de tus gastos. LosAssets que tengasgenerarán ingresos sin necesidad de trabajar.»). Es la pantalla antigua, hoy aparcada en `_parked/` (se rehace en F5b-5 como `app/(app)/cashflow.tsx`; `_parked/` se elimina en F6), de modo que el texto defectuoso no sobrevive a la rehecha; no usa `describeCashflowIndex` y no contradice el «100%» literal. No requiere corrección.
- Nota sobre el «100%» literal: con índices superiores a 100% el mensaje de libertad financiera subestima el valor real (con 150% dice «cubre el 100%»). Consecuencia asumida por el usuario (punto 30 de 10.2); si más adelante se quiere mostrar el porcentaje real, es un cambio de copy del usuario, no un error.
- Líneas "Mutador(es)" casi duplicadas en las cabeceras de `adjustmentRepository`, `goalContributionRepository` y `transactionRepository`.
- `goalEta.ts:8` mide 125 caracteres.
- Contador de operaciones omitidas (`stats.skipped`) e instantes exactos de borde de mes en la prueba aleatoria; comparaciones parciales de `debts.list` y `recurring.list` en ella.

La propiedad entre tablas (antes «FK compuestas `(id, userId)`») quedó resuelta el 2026-10-18 con triggers; ver [la nota de arriba](#resuelto-un-update-que-reasigne-userid-y-las-fk-sin-userid).

#### Decisión 33: meses restantes de una deuda con tasa

> **DECISIÓN CONFIRMADA POR EL USUARIO (2026-10-08): opción 3** (punto 33 de 10.2). Con tasa conocida (tasa > 0), `remainingMonths` devuelve solo la simulación `projectPayoff` (`null` si `NEVER` o `CAPPED`), sin `max` contra `totalCount − paidCount`; sin tasa o con tasa 0 se mantiene `ceil(saldo / cuota)` y el `max` con el plan si `totalCount > 0`. Verificado con ejecución el 2026-10-08 (vitest 34 archivos / 774 tests en verde, 6 mutaciones muertas, revisión aprobada). El resto de esta subsección se conserva como historial de la decisión: afecta a cuántos meses dice la app que faltan para terminar de pagar una deuda; el origen fue el comentario `SUPUESTO` de `src/domain/rules/amortization.ts` (ya retirado: el archivo no conserva SUPUESTOS). Lo descrito sobre el código en esta subsección se verificó el 2026-10-07 (estado previo a la decisión); las cifras de la tabla las ejecutó el orquestador con las funciones reales y no se re-ejecutaron al escribir este documento (salvo las del diseño literal, comprobables a mano).

**Qué hacía el código antes de la decisión** (historial; el comportamiento vigente es el de la decisión 33 y los pasos 3 y 4 de abajo ya no se aplican así con tasa > 0). `remainingMonths` (`src/domain/rules/amortization.ts`, L119-140; la llama `DebtService` para `DebtView.monthsRemaining`) recibe un objeto con `saldo`, `cuota`, `tasa` (mensual, decimal), `totalCount` (pagos pactados, si se conocen) y `paidCount` (pagos hechos). Calcula, en este orden:

1. Sin cuota (o cuota ≤ 0): no hay respuesta (`null`).
2. Saldo ≤ 0: 0 meses.
3. **Cálculo base.**
   - Con tasa mayor que 0: se simula la deuda mes a mes (`projectPayoff`). Cada mes se suma el interés (saldo × tasa mensual), se resta la cuota y se repite hasta que lo que se debe cabe en una sola cuota; la cantidad de meses simulados es el resultado. Si la cuota no supera el interés del primer mes, el saldo nunca baja (`NEVER`) y no hay respuesta (`null`). Si la simulación pasa de 600 meses (`CAPPED`) tampoco hay respuesta (`null`).
   - Sin tasa o con tasa 0: se divide el saldo entre la cuota y se redondea hacia arriba (`ceil(saldo / cuota)`); el interés se ignora.
4. **Plan pactado.** Si la deuda tiene `totalCount` mayor que 0, el resultado es el **mayor** entre «pagos pactados menos pagos hechos» y el cálculo base: `max(totalCount − paidCount, base)`.

**Qué hacía el diseño original** (`Design/Dashboard.dc.html` ~L993): siempre `max(totalCount − paidCount, ceil(saldo / cuota))` (o solo `ceil(saldo / cuota)` si no hay plan). El diseño **ignoraba el interés** porque no tenía simulación con interés. El implementador **supuso** que el `max` con el plan debía seguir aplicándose cuando el cálculo base sí incluye interés. Esa es la decisión que falta.

**Ejemplos** (pesos COP; la función es agnóstica de la unidad):

| Caso | Datos | Código (antes de la decisión) | Diseño literal | Solo simulación (= decisión 33 con tasa) |
|---|---|---|---|---|
| Préstamo bien configurado | saldo 1.934.953, cuota 100.000, tasa 1,8 %, plan 36, pagados 12 | 24 | 24 | 24 |
| Tarjeta sin plan | saldo 3.000.000, cuota 90.000, tasa 2,3 % | 64 | 34 | 64 (sin plan, coincide con el actual) |
| Tarjeta que casi no baja | cuota 75.000 (mismo saldo y tasa) | 112 | 40 | 112 (ídem) |
| Préstamo con tasa conocida y sin plan | saldo 8.000.000, cuota 400.000, tasa 1,8 % | 26 | 20 | 26 (ídem) |
| Cuota que no cubre el interés | saldo 5.000.000, cuota 80.000, tasa 2 % | `null` | 63 (la deuda nunca se paga) | `null` |
| Abono extra con el plan sin actualizar | saldo 934.953, cuota 100.000, tasa 1,8 %, plan 36, pagados 12 | 24 | (no informado) | 11 |
| Saldo pequeño | saldo 30.000, cuota 100.000, tasa 2 %, plan 6, pagados 2 | 4 | (no informado) | 1 |

Las columnas «Solo simulación» de las filas sin plan se deducen de la regla (sin `totalCount` el código actual ya es solo la simulación); las de las dos últimas filas y la primera las informó el orquestador. El «Diseño literal» de las filas sin plan es comprobable a mano: 3.000.000 / 90.000 → 34; 3.000.000 / 75.000 → 40; 8.000.000 / 400.000 → 20; 5.000.000 / 80.000 → 63 (62,5 redondeado hacia arriba).

**Alternativas.**

1. **(Descartada.) Mantener lo actual** (con tasa: la simulación y, además, el plan como piso). Riesgo: mostrar un plazo **mayor** que el real, en dos situaciones: abonos extra con el plan sin actualizar (el plan sigue diciendo 24 aunque la simulación ya da 11) y saldos pequeños (4 frente a 1). Es el menor de los riesgos, porque un plazo mayor al real es el error menos dañino para el usuario.
2. **(Descartada.) Volver a la fórmula literal del diseño** (ignora el interés). Muestra un plazo **menor** que el real: 30 meses menos en la tarjeta de 90.000 (34 frente a 64), 72 menos en la de 75.000 (40 frente a 112) y 63 meses en una deuda que en realidad nunca se paga. Es el error más dañino para el usuario.
3. **(ELEGIDA, 2026-10-08)** **Con tasa conocida, usar solo la simulación, y el `max` con el plan solo cuando no hay tasa.** Corrige los abonos extra y los saldos pequeños, pero puede mostrar un plazo menor que el del plan contractual si el préstamo tiene seguros o cargos que el modelo no incluye.

**Decisión del usuario (2026-10-08): alternativa 3.** Se descartan la 1 y la 2 (la recomendación previa del orquestador era la 1). Verificado con ejecución el 2026-10-08: vitest 34 archivos / 774 tests en verde, 6 mutaciones muertas y revisión aprobada. Motivo del usuario: en 7 de 9 escenarios probados las alternativas 1 y 3 daban lo mismo; donde cambiaba (abono extra sin actualizar el plan, saldo pequeño) el `max` ocultaba progreso real; y el riesgo de seguros o cargos no modelados no aplica porque la deuda no los modela.

**Ejemplos nuevos con la decisión aplicada** (los dos casos que cambian; cifras informadas por el usuario/orquestador):

| Caso | Datos | Antes | Ahora |
|---|---|---|---|
| Abono extra con el plan sin actualizar | saldo 934.953, cuota 100.000, tasa 1,8 %, plan 36, pagados 12 | 24 | 11 |
| Saldo pequeño | saldo 30.000, cuota 100.000, tasa 2 %, plan 6, pagados 2 | 4 | 1 |

**Rarezas encontradas, aún pendientes** (no son decisiones):

- **(a) `null` con dos significados (contrato de F5).** `remainingMonths` devuelve `null` tanto si falta la cuota como si la cuota no cubre el interés (o la simulación pasa de 600 meses). La plantilla del diseño (`Design/Dashboard.dc.html` ~L996-998) solo conoce un texto para `null`, «Agrega la cuota para ver la proyección.», que es falso para una deuda con cuota que no avanza. **F5 debe distinguir los dos casos** (puede deducirlos de `installmentMinor` y del saldo; el servicio hoy no los distingue).
- **(b) Rareza de redondeo en deudas con «no sé la tasa».** Tras pagar 3 cuotas exactas (saldo 932.544, cuota 180.000, tasa estimada 8,14 %), el código da 8 meses y el plan dice 7: un mes espurio por un residuo. No se pudo determinar si ocurre con saldos reales en unidades menores. (`projectPayoff` ya trata un residuo menor a media unidad como liquidado, L76-79.)
- **(c) Comentario de prueba incorrecto.** Resuelto en `051bdba` (el comentario de cuota de `test/unit/rules/amortization.test.ts`).
- **(d) `totalCount` con tasa conocida.** El diseño guarda `totalCount` 0 cuando la tasa es conocida (`Dashboard.dc.html` L1414) y el repo guarda `null` (sección 2.1, tabla `debts`). El efecto es equivalente: `remainingMonths` trata ambos como «sin plan».

**VERIFICACIÓN EN DISPOSITIVO / DEVELOPMENT BUILD** (nada de esto se ha podido comprobar)

- `UPDATE/DELETE ... RETURNING` sobre expo-sqlite (SQLite 3.50.3; plan B con `run()` y `changes`).
- `migrate()` y `PRAGMA foreign_keys` sobre expo-sqlite real.
- Fuentes IBM Plex en iOS.
- Notificaciones, categorías con acciones y `getLastNotificationResponseAsync` en arranque en frío (detalle de lo pendiente de F4 en [Pendientes](#pendientes-para-la-próxima-sesión)).
- `Stack.Protected` (y su redirect al completar el onboarding) y `formSheet`.
- Modo oscuro en caliente.
- Alineación de versiones de Expo: 14 paquetes desalineados y `@react-native-async-storage/async-storage` en `^3.1.1` frente a la `2.2.0` que espera el SDK (según el informe de verificación; no se ha vuelto a ejecutar `expo install --check`).

**PROCESO**

1. Dos veces se perdió o llegó solo como resumen el informe completo de un agente en segundo plano (el registro del agente tenía líneas demasiado largas para extraerlo). Revisar cómo se entregan los informes antes de que pase con algo de más peso; los agentes deben terminar con **un único mensaje final autocontenido**.
2. Los límites de uso cortaron a agentes en mitad de ediciones (F2b-ter y la pasada mínima). Tras un corte, comprobar el estado real en disco (`git status`, `git diff` y tests) y reanudar con un agente que inspeccione.
3. El hook `pipeline-advance.sh` solo leía `last_assistant_message`; el usuario ya lo corrigió para leer el transcript del subagente.
4. El estado del pipeline (`.claude/pipeline-state.json`) lo edita solo el usuario.

Los supuestos 1 a 20 están aprobados (sección 10.2) y R1 y R2 están resueltos (sección 10.1). Las decisiones posteriores (2026-10-04 a 2026-10-08) están en las secciones 10.2 (21 a 49) y 11. La decisión sobre los meses restantes de una deuda con tasa quedó **cerrada** el 2026-10-08 (decisión 33; ver su subsección más arriba).

---

## 0. Problemas del repo que condicionan el diseño

Comprobados leyendo el código del estado previo al rediseño (commit `e7fd4a5`, "snapshot pre-mvp"; el tag `pre-mvp` existe). Esta lista describe el estado **anterior**: lo que ya se resolvió se indica en cada punto.

1. **El saldo de bolsillo "Sin asignar" es siempre 0.** `PocketRepository.getAllByAccountWithBalances` busca la clave `'__null__'`, que nunca se escribe. El test de integridad no lo detecta porque trabaja con repositorios simulados que reimplementan la lógica (`test/unit/integrity.test.ts`).
2. **Los saldos iniciales se cuentan como ingreso del mes.** El onboarding guarda el saldo inicial como Transaction `INCOME` "Saldo inicial" (`app/(auth)/onboarding/accounts.tsx:104-113`).
3. **Los pagos de deuda se cuentan mal.** Caen en `lifeExpenses` y `getDebtPayments()` devuelve 0 (`CashflowService.ts:123-181`). Además, la categoría "Pago de deuda" se identifica por su nombre (`RecurringService.ts:62-89`).
4. **Ninguna operación es atómica.** No se usa `db.transaction` en ningún repositorio ni servicio. `createTransfer` hace un insert y dos selects por separado.
5. **La fecha del siguiente vencimiento deriva.** `calculateNextDueDate` parte de `now` y no de la fecha del vencimiento. Además, `setMonth` desborda (31 de enero pasa a 3 de marzo).
6. **La derivada de Newton está mal.** `DebtService.calculateInterestRate` usa `(1+r)^-(n-1)` donde corresponde `(1+r)^-(n+1)`. Casi siempre acaba cayendo al método de bisección.
7. **El esquema y los comentarios no coinciden.** Los montos se guardan como `real`, aunque `IntegrityService` dice "integers (cents)" y compara con igualdad estricta.
8. **Hay datos y nombres duplicados.**
   - Los ajustes viven a la vez en la tabla `users` y en `useUserStore` (zustand + AsyncStorage).
   - Hay dos `useTheme`: `src/theme/index.ts` devuelve el objeto Theme y `src/store/useUserStore.ts:99` devuelve el modo, reexportado en `src/hooks/index.ts`.
   - `themed-text.tsx` y `themed-view.tsx` importan `@/hooks/use-theme`, que no existe.
9. **`colors.accentYellow` no existe.** Se usa en unos 25 sitios: `debt/*`, `budget`, `cashflow`, `pockets`, `more`, `settings`, `transaction-detail`, `add-account` y `CashflowIndexGauge`.
10. **Las capas están mezcladas.**
    - Las pantallas importan `database` y `schema` directamente (por ejemplo, onboarding/expenses y complete).
    - `RecurringService` importa `lib/expo/notifications`, un módulo nativo, y por eso los tests necesitan simulaciones.
11. **Navegación y configuración.**
    - `app/(tabs)/` tiene `pockets.tsx` y `settings.tsx` sin `Tabs.Screen`; probablemente aparecen como pestañas extra (NO VERIFICADO).
    - `app.json` no incluía el plugin `expo-notifications`. **Resuelto en F0**: ya está en `app.json`, junto con el plugin `expo-font` con los cinco `.ttf` de IBM Plex.
    - Migraciones: había un `.ts` que copiaba a mano el `.sql` (`initialize.ts:34-46`). **Resuelto**: `initialize.ts` aplica `migrations.js` generado por drizzle-kit (ver 4.4).
12. **Huecos en el diseño.**
    - "Agregar deuda" no pide fecha de pago (`dueLabel: 'Sin definir'`, Dashboard.dc.html:1410). Se resuelve con un campo de fecha opcional (D7).
    - La hoja "Ya pagué" no tiene selector de cuenta. Se resuelve: siempre pide cuenta y preselecciona la predeterminada del recurrente (D8).
    - La pantalla "Agregar recurrente" no pide la cuenta predeterminada (`defaultAccountId`). Se resuelve: debe pedir ese campo (D8).
    - El paso 2 del onboarding no pide fecha. D7 lo resolvía con un campo de fecha opcional; en F5b-1 se decidió **no** añadirlo (A12, decisión 46): la fecha se completa en Recurrentes (F5b-3).
    - DESIGN_SPEC dice que cerrar una meta genera una Transaction; la decisión del usuario sobre el cierre de metas lo anula (sección 11).

---

## 1. Resumen ejecutivo

La propuesta es un **libro de movimientos local con saldos siempre derivados**, nunca almacenados. Hay cuatro tipos de hecho, cada uno en su propia tabla:

- **Transaction**: ingreso o gasto real. Es lo único que entra en los reportes del mes.
- **GoalContribution**: transferencia interna de una cuenta a una meta.
- **BalanceAdjustment**: corrección o saldo de apertura de una cuenta, deuda o meta.
- **Cierre de meta**: un cambio de estado con una foto del monto (`spentAmount`, `spentAt`).

Los saldos de cuenta, deuda y meta, `paidCount` y el Índice se calculan agregando esos hechos. Que cada hecho viva en una tabla distinta y que el tipo de gasto sea un campo con valores excluyentes hace que no pueda haber doble conteo.

**Principios:**
- **P1. Una sola fuente de verdad.** SQLite guarda los datos financieros y los ajustes. Zustand solo sirve de caché de ajustes y de estado efímero de la interfaz.
- **P2. Saldos derivados y nunca editados.** Toda edición manual genera un BalanceAdjustment con valor anterior, valor nuevo y diferencia.
- **P3. Distinción estructural.** Un pago de deuda se reconoce por `transactions.kind = 'DEBT_PAYMENT'`, nunca por la categoría.
- **P4. Cada operación es una transacción de BD síncrona** dentro de un caso de uso del dominio. Los efectos secundarios (notificaciones, refresco de la interfaz) se ejecutan después del COMMIT y son idempotentes.
- **P5. Dominio sin Expo.** Los servicios reciben la BD inyectada. Así se prueban contra SQLite real en node (better-sqlite3) con las mismas migraciones.
- **P6. Montos como INTEGER en unidades menores**, con CHECK `> 0`. El sentido lo da el `type`, no el signo.
- **P7. Borrar revierte exactamente lo que el hecho aplicó.** Como los saldos son derivados, borrar un hecho deshace su efecto sin código adicional.
- **P8. Se retira todo lo que el MVP no usa** (pockets, presupuesto, distribución). El historial queda en git.
- **P9. La propiedad del usuario se impone en la consulta.** Todo método por id de todo repositorio exige `userId` y lo filtra en el `WHERE`; un id ajeno es indistinguible de uno inexistente (sección 3.5).
- **P10. Una cuenta archivada no cambia de saldo por ningún motivo.** Ninguna operación que cree, borre o redirija movimientos de una cuenta archivada se acepta; para tocarla hay que desarchivarla (sección 3.4).

---

## 2. Modelo de datos objetivo

Base de datos limpia: `0000` regenerado (`src/database/migrations/0000_harsh_excalibur.sql`, esquema) + `0001_owner_triggers.sql` (triggers de propietario, migración custom; 3.5). El archivo de BD cambia de nombre a `financial-flow-v1.db` (ver [4.4](#44-mecanismo-de-migraciones)).

**Convenciones del esquema real (`src/database/schema.ts`):**

- Dinero: INTEGER en unidades menores.
- Instantes (`createdAt`, `updatedAt`, `date`, `spentAt`, `archivedAt`, `snoozedUntil`, `targetDate`, `onboardingCompletedAt`): INTEGER epoch en **milisegundos** (`mode: 'timestamp_ms'`). En las tablas de abajo, "int (epoch ms)" significa esto.
- Fechas de calendario sin hora (`anchorDate`, `nextDueDate`, `occurrenceDate`): TEXT `'YYYY-MM-DD'` en hora local, con CHECK de patrón `GLOB` (NULL pasa el CHECK).
- Ids: TEXT PK generado en JS con `newId()`. Booleanos: INTEGER 0/1.
- Cada columna enum de texto lleva además un CHECK `IN (...)`.
- Todas las FK a `users` son `ON DELETE RESTRICT`, salvo `categories.userId` (`CASCADE`).
- Las FK **no** incluyen `userId`; la propiedad entre tablas la imponen triggers (ver la invariante en [3.5](#35-propiedad-del-usuario-y-convención-de-repositorios)).

Los CHECK adicionales que F1 aplicó respecto del diseño original se detallan en [12](#12-desviaciones-aprobadas).

### 2.1 Tablas

**users** (una fila, `id='default-user'`; también guarda los ajustes)

| Campo | Tipo | Notas |
|---|---|---|
| id | text PK | |
| currency | text default 'COP' | |
| themePreference | text enum light/dark/system default 'system' | |
| notifyPaymentReminders | bool default true | |
| notifyWeeklySummary | bool default true | |
| reminderHour | int default 9 | SUPUESTO: hora local de los avisos |
| widgetCashflow, widgetDebts, widgetGoals | int **nullable**, tres estados: NULL = nunca decidido, 1 = activo, 0 = apagado por el usuario | |
| onboardingCompletedAt | int nullable | |
| createdAt, updatedAt | int | |

CHECK: `themePreference IN ('light','dark','system')`, `reminderHour BETWEEN 0 AND 23` y cada `widget*` `IN (0, 1)` (NULL pasa).

**accounts**
- Campos: id, userId FK, name, type (`CASH`, `SAVINGS`, `CHECKING`, `DIGITAL_WALLET`: los cuatro tipos que muestra el diseño, Dashboard.dc.html:1260), order, archivedAt nullable, createdAt, updatedAt.
- **Sin columna de saldo.**
- Se retiran `institution`, `color`, `icon` y `cashflowClass` (D18).
- CHECK `type IN (...)`. Índice `(userId)`.

**categories**
- Campos: id, userId nullable (NULL = categoría base), name, type INCOME/EXPENSE, order, isActive, createdAt.
- Semilla con las listas del diseño. Gasto: Comida, Transporte, Servicios, Salud, Otro. Ingreso: Sueldo, Freelance, Ventas, Regalo, Otro.
- Se elimina la categoría "Deudas" de la semilla: el pago de deuda no usa categoría.
- `UNIQUE(userId, type, name)` (`uq_categories_user_type_name`). En SQLite los NULL son distintos entre sí, así que ese índice **no** protege las categorías base (userId NULL): por eso hay además un UNIQUE parcial `uq_categories_system_type_name` sobre `(type, name) WHERE userId IS NULL`. CHECK `type IN ('INCOME','EXPENSE')`.

**transactions**

| Campo | Tipo / restricción |
|---|---|
| id, userId | |
| accountId | FK accounts **ON DELETE RESTRICT** |
| type | 'INCOME' / 'EXPENSE' |
| kind | 'STANDARD' / 'DEBT_PAYMENT' |
| amountMinor | int CHECK > 0 |
| description | text |
| date | int (epoch ms) |
| categoryId | FK SET NULL, nullable |
| isPassive | bool default 0, CHECK (isPassive=0 OR type='INCOME') |
| debtId | FK debts RESTRICT, nullable |
| debtPaymentType | 'INSTALLMENT' / 'EXTRA', nullable |
| debtPrincipalAppliedMinor | int nullable, CHECK 0 ≤ x ≤ amountMinor |
| recurringItemId | FK SET NULL, nullable |
| occurrenceDate | text 'YYYY-MM-DD', nullable |
| createdAt, updatedAt | |

CHECK: `kind='DEBT_PAYMENT'` ⇔ (type='EXPENSE' AND debtId, debtPaymentType y debtPrincipalAppliedMinor no nulos). Se implementa en dos CHECK: `ck_tx_debt_payment` (⇒) y `ck_tx_standard_no_debt` (`kind='STANDARD'` ⇒ los tres campos de deuda NULL; cierra el "si y solo si"). Otros CHECK: `ck_tx_occurrence_required` (si `recurringItemId` no es NULL, `occurrenceDate` es obligatoria: si no, el UNIQUE parcial no la cubriría), `ck_tx_payment_type`, `ck_tx_type`, `ck_tx_kind` y `ck_tx_occurrence_date` (patrón `GLOB`).

Índices: `(userId, date)`, `(accountId)`, `(debtId)`, `(categoryId)`, y el **UNIQUE parcial `(recurringItemId, occurrenceDate) WHERE recurringItemId IS NOT NULL`**.

Se eliminan: `TRANSFER`, `pocketId`, `status`, `isConfirmed` y los campos `transferTo*`. SUPUESTO: el MVP no tiene transacciones pendientes; lo pendiente vive en los recurrentes. Que no haya transferencias entre cuentas es la decisión D9.

**debts**
- Campos: id, userId, name, installmentMinor (nullable: la cuota puede estar "sin definir"), monthlyRate (real, nullable), rateSource ('KNOWN' / 'ESTIMATED' / 'UNKNOWN'), initialPaidCount (int default 0), totalCount (int nullable), archivedAt (nullable), createdAt, updatedAt.
- **Sin columna de saldo.**
- La fecha de pago (`dueLabel`) se deriva del recurrente vinculado (ver más abajo).
- CHECK: `installmentMinor` NULL o > 0; `monthlyRate` NULL o ≥ 0; `rateSource IN (...)`; `initialPaidCount ≥ 0`; `totalCount` NULL o > 0. Índice `(userId)`.

**goals**
- Campos: id, userId, name, targetMinor (CHECK > 0), status ('ACTIVE' / 'SPENT'), spentAt (nullable), spentAmountMinor (nullable), targetDate (nullable, opcional), createdAt, updatedAt.
- CHECK: `status='SPENT'` ⇔ (spentAt y spentAmountMinor no nulos). El esquema lo impone en los dos sentidos: una meta `ACTIVE` tiene `spentAt` y `spentAmountMinor` NULL. Además `spentAmountMinor` NULL o ≥ 0.
- `targetDate` es un instante `timestamp_ms` (medianoche local de la fecha elegida); el servicio recibe `'YYYY-MM-DD'` y lo convierte. No hay CHECK sobre `targetDate` en el esquema (la validación está en el servicio; ver 3.4, GoalService).
- Índice `(userId)`.

**goal_contributions**
- Campos: id, userId, goalId FK RESTRICT, accountId FK RESTRICT, amountMinor (CHECK > 0), date (epoch ms), createdAt.
- Índices: `(goalId)` y `(accountId)`.

**balance_adjustments**
- Campos: id, userId, targetType ('ACCOUNT' / 'DEBT' / 'GOAL'), accountId / debtId / goalId (FKs nullables), previousMinor, newMinor, deltaMinor, reason ('OPENING' / 'MANUAL' / 'ARCHIVE_CLOSE'), createdAt.
- CHECK: exactamente un FK no nulo y que coincida con `targetType`.
- CHECK: `deltaMinor = newMinor - previousMinor`.
- CHECK: `targetType='ACCOUNT' OR newMinor >= 0`. Deudas y metas nunca quedan negativas; las cuentas sí pueden (D12).
- Se usan tres FKs reales en lugar de una referencia polimórfica para que SQLite haga cumplir la integridad referencial.
- Los tres FK (`accountId`, `debtId`, `goalId`) son **`ON DELETE CASCADE`**: el ajuste es un hecho sobre su objetivo y no tiene sentido sin él. Los servicios solo borran cuenta, deuda o meta cuando no tienen movimientos (y borran los ajustes de forma explícita).
- CHECK adicionales: `targetType IN (...)` y `reason IN (...)`. Índices `(accountId)`, `(debtId)` y `(goalId)`.
- El esquema solo admite los motivos `OPENING`, `MANUAL` y `ARCHIVE_CLOSE`; no hay un motivo propio para "reembolso de meta" (ver GoalService.remove en 3.4).

**recurring_items**

| Campo | Tipo / restricción |
|---|---|
| id, userId | |
| type | 'INCOME' / 'EXPENSE' |
| kind | 'STANDARD' / 'DEBT_INSTALLMENT' |
| debtId | FK debts RESTRICT, **UNIQUE**, nullable |
| name | nullable (para deudas se toma el nombre de la deuda) |
| amountMinor | nullable (para deudas se toma la cuota de la deuda) |
| isPassive | bool |
| categoryId | nullable |
| defaultAccountId | FK SET NULL, nullable. Cuenta predeterminada: es solo una sugerencia. La pantalla "Agregar recurrente" **debe pedir** este campo y la hoja "Ya pagué" siempre pide cuenta, preseleccionando esta (D8) |
| frequency | 'WEEKLY' / 'BIWEEKLY' / 'MONTHLY' (se retira ANNUAL: el diseño solo tiene 3 opciones). **BIWEEKLY ("quincenal") = los días 15 y último día de cada mes; no es cada 14 días (D6)** |
| anchorDate | text 'YYYY-MM-DD', nullable. Se guarda **ya normalizada** (para BIWEEKLY es siempre 15 o último día; ver 3.4) |
| nextDueDate | text nullable (NULL = "sin fecha", por ejemplo lo creado en onboarding) |
| snoozedUntil | int nullable |
| status | 'ACTIVE' / 'PAUSED' |
| createdAt, updatedAt | |

CHECK: `kind='DEBT_INSTALLMENT'` ⇔ (debtId no nulo AND type='EXPENSE' AND amountMinor IS NULL AND name IS NULL).

CHECK: `kind='STANDARD'` ⇒ (amountMinor > 0 AND name no nulo).

CHECK adicionales: `isPassive = 0 OR type = 'INCOME'` (`recurring_items.isPassive` solo en INCOME; `ck_rec_passive_income`), `type`, `kind`, `frequency` y `status` con `IN (...)`, y patrón `GLOB` en `anchorDate` y `nextDueDate`. El "si y solo si" de `kind='DEBT_INSTALLMENT'` ⇔ `debtId` no nulo es un CHECK propio (`ck_rec_kind_debt`). Índices: UNIQUE `(debtId)` (`uq_rec_debt`), `(userId, status)`, `(categoryId)` y `(defaultAccountId)`.

**Relaciones:** users 1–N con todo. accounts 1–N con transactions, goal_contributions y adjustments. debts 1–N con transactions y adjustments, y 1–0..1 con recurring_items. goals 1–N con contributions y adjustments. recurring_items 1–N con transactions (una por ocurrencia).

**PRAGMA foreign_keys = ON** al abrir la conexión, tanto en Expo como en tests (si no, RESTRICT no se aplica). VERIFICADO (2026-10-03): expo-sqlite **no** lo trae activo por defecto y se activa por conexión; better-sqlite3 sí lo trae activo, pero los tests lo ejecutan igualmente de forma explícita (`test/helpers/db.ts`). VERIFICADO EN CÓDIGO (2026-10-07): `src/database/client.ts` ejecuta `PRAGMA foreign_keys = ON` justo tras abrir la conexión y **falla cerrado** (lanza) si al releerlo no vale 1.

### 2.2 Estrategia por tipo de hecho

- **Transacciones:** solo ingresos y gastos reales. Sin edición en el MVP (el diseño solo ofrece eliminar; D9). Se corrige eliminando y creando de nuevo.
- **Aportes:** una fila por aporte con su cuenta de origen. Nunca son Transaction.
- **Ajustes:** el saldo de apertura de cuentas y deudas es un ajuste con reason `OPENING`. Así el saldo inicial deja de contarse como ingreso (corrige el problema 2). El "ahorro inicial" de una meta **no** es ajuste: es un aporte, porque sale de una cuenta.
- **Estado de meta:** pasa de `ACTIVE` a `SPENT` una sola vez y no se puede revertir. Se guarda una foto del monto (`spentAmountMinor`) en ese momento. Una vez gastada, sus aportes y ajustes quedan inmutables.

### 2.3 Mapeo de lo viejo a lo nuevo

| Viejo | Nuevo |
|---|---|
| users.theme ('dark'/'light'), notificationsEnabled, reminderDaysBefore, onboardingCompleted | users.themePreference (+system), notifyPaymentReminders, notifyWeeklySummary, reminderHour, onboardingCompletedAt, widget* |
| useUserStore.settings (AsyncStorage) | Se elimina la persistencia; queda como caché en memoria de users |
| accounts.type (6 valores), institution, color, icon, cashflowClass, isActive | type (4 valores del diseño), archivedAt; el resto se retira |
| Saldo inicial como Transaction INCOME | balance_adjustments reason OPENING |
| pockets (+ goalAmount, targetDate) | goals + goal_contributions; pockets se retira |
| transactions.pocketId, TRANSFER, transferTo*, status, isConfirmed | Se retiran |
| transactions.amount real con signo | amountMinor int > 0 + type |
| Pasivo derivado de recurringItems.incomeSource | transactions.isPassive (y recurring_items.isPassive como plantilla) |
| "Pago de deuda" por nombre de categoría | transactions.kind='DEBT_PAYMENT' + debtId |
| debt_cards + debt_loans | debts (entidad única; saldo derivado: ajustes − capital aplicado) |
| debt_loans.currentBalance / debt_cards.usedAmount | Ajuste OPENING + pagos |
| debt_loans.totalInstallments / remainingInstallments | totalCount + initialPaidCount + COUNT(cuotas) |
| interestRateMonthly / Annual | monthlyRate + rateSource |
| paymentDayOfMonth / paymentDay / cutoffDay / creditLimit / minPaymentPercent / isAutoDebit | Recurrente vinculado (fecha); el resto se retira (el diseño no muestra cupo, corte ni pago mínimo; D18) |
| recurring_items.accountId (NOT NULL) | defaultAccountId nullable |
| incomeSource EARNED/PASSIVE | isPassive |
| ANNUAL, dayOfWeek, dayOfMonth, month | frequency (WEEKLY / BIWEEKLY / MONTHLY) + anchorDate + nextDueDate (texto con fecha local) |
| isAutoConfirm, isAutoDebit, PENDING_CONFIRM, PENDING_PAYMENT, lastExecutedAt | Se retiran ("nunca se marcan solos"); lo pagado se ve por las transacciones de cada ocurrencia |
| budgets_monthly, distribution_rules | Se retiran (ver [4.2](#42-qué-se-conserva-se-retira-o-se-crea)) |

---

## 3. Reglas de negocio: invariantes y contratos

### 3.1 Saldos derivados

Notación: Σ = suma; "adj" = balance_adjustments; los montos son unidades menores.

- **Disponible de una cuenta**: `Σ adj(cuenta).delta + Σ ingresos de la cuenta − Σ gastos de la cuenta − Σ aportes desde la cuenta`
- **Saldo de una deuda**: `Σ adj(deuda).delta − Σ capital aplicado por los pagos de esa deuda` (siempre ≥ 0; ver I2)
- **Ahorro de una meta (saved)**: `Σ aportes a la meta + Σ adj(meta).delta`
- **Pagos hechos de una deuda (paidCount)**: `initialPaidCount + número de pagos de esa deuda con debtPaymentType='INSTALLMENT'`
- **Total de "Resumen de cuentas"** = Σ disponible de las cuentas no archivadas (igual que el diseño, línea 971).
- **Patrimonio neto** (detalle de Cashflow) = Σ disponible + Σ saved de metas activas − Σ saldo de deudas no archivadas.

### 3.2 Reporte del mes

Mes calendario, hora local del dispositivo, intervalo [inicio, inicio del mes siguiente).

```
ingresoTotal(m)  = Σ amount  de transacciones INCOME con fecha en m
ingresoPasivo(m) = Σ amount  de transacciones INCOME, isPassive=1, con fecha en m
ingresoActivo(m) = ingresoTotal − ingresoPasivo
gastoVida(m)     = Σ amount  de transacciones EXPENSE, kind='STANDARD', con fecha en m
gastoDeuda(m)    = Σ amount  de transacciones EXPENSE, kind='DEBT_PAYMENT', con fecha en m
                   (monto completo, incluido el sobrante de un abono mayor al saldo)
gastoMetas(m)    = Σ spentAmountMinor de metas SPENT con spentAt en m
gastoTotal(m)    = gastoVida + gastoDeuda + gastoMetas
Índice(m)        = gastoTotal > 0 ? ingresoPasivo / gastoTotal
                 : (ingresoPasivo > 0 ? "sin gastos" : null)
```

**Decisión confirmada (D1):** las metas cerradas (SPENT) suman al gasto total que alimenta el denominador del Índice de Flujo de Caja. Cerrar una meta baja el Índice en el mes del cierre. Se muestra como tercera categoría del desglose ("Metas cumplidas").

**Contrato del Índice** (`src/domain/rules/statement.ts`; VERIFICADO EN CÓDIGO 2026-10-07). `computeCashflowIndex(ingresoPasivo, gastoTotal)` devuelve:
- `RATIO` con `ratio = ingresoPasivo / gastoTotal` si `gastoTotal > 0` (ratio 1 = 100%).
- `NO_EXPENSES` si `gastoTotal = 0` e `ingresoPasivo > 0` ("sin gastos").
- `NONE` si ambos son 0 (la fórmula de arriba lo llama `null`).

Funciones de presentación:
- `cashflowPercent`: `Math.round(ratio * 100)` para `RATIO`; 0 para los demás.
- `formatCashflowIndex`: «42%» (con `RATIO`), «Sin gastos» (`NO_EXPENSES`) o «—» (`NONE`).
- `isFinancialFreedom`: verdadero para `NO_EXPENSES` y para `RATIO` con ratio ≥ 1. **Decisión del usuario (2026-10-07, punto 29 de 10.2):** `NO_EXPENSES` cuenta como libertad financiera, porque el ingreso pasivo cubre el 100% de un gasto de 0. Antes era SUPUESTO.
- `describeCashflowIndex` (mensaje bajo el Índice), con estos textos **exactos** (el guion largo es U+2014):

| Caso | Texto | Origen |
|---|---|---|
| `NO_EXPENSES` | «No tienes gastos registrados este mes, así que tu ingreso pasivo ya los cubre por completo.» | Decisión del usuario (2026-10-07) |
| `NONE`, o porcentaje redondeado = 0 | «Aún no tienes ingreso pasivo registrado. En cuanto marques uno, este número empieza a moverse.» | Diseño (sin cambios) |
| Libertad financiera (`RATIO` con ratio ≥ 1) | «Tu ingreso pasivo cubre el 100% de tus gastos — esto es libertad financiera en el método Cashflow.» | Decisión del usuario (2026-10-07) |
| `RATIO` por debajo de 100% | «Tu ingreso pasivo cubre el X% de tus gastos del mes. Cuando llegue a 100%, eso es libertad financiera en el método Cashflow.» (X = `cashflowPercent`) | Diseño (sin cambios) |

El «100%» del mensaje de libertad financiera es **literal**, no el porcentaje real (decisión del usuario, punto 30 de 10.2): con un índice de 150% el mensaje dice «cubre el 100%». Es una consecuencia asumida; el texto subestima el valor real con índices superiores a 100% (ver pendientes). Nota de borde: un ratio de 0,996 redondea a 100% y no es libertad financiera (se evalúa el ratio sin redondear), así que mostraría «cubre el 100%» en la rama previa; ese caso no fue evaluado por el usuario (deducido de leer el código, no ejecutado).

**Por qué no hay doble conteo:**
- `kind` divide los gastos de transactions en dos grupos que no se solapan, y ningún pago de deuda está en `gastoVida`.
- Los aportes y los ajustes viven en otras tablas y nunca entran en estas sumas.
- `gastoMetas` sale de una tabla distinta de transactions, se fija una sola vez (paso irreversible ACTIVE → SPENT) y es independiente de cuántas cuentas aportaron. Cuenta para el usuario en conjunto, no por cuenta, así que no hace falta una cuenta única. Como los aportes nunca son gasto, el dinero de una meta solo se cuenta como gasto una vez, en el mes del cierre.
- En el detalle de una cuenta, los aportes aparecen como "Apartado para meta X" (transferencia), nunca como gasto.

Desglose para la pantalla Cashflow: { ingresoActivo, ingresoPasivo, gastoVida, gastoDeuda, gastoMetas, gastoTotal, Índice, netCashflow = ingresoTotal − gastoTotal }. El pago de deuda se muestra como categoría separada en el desglose, pero suma al gasto total. El widget "Flujo del mes" usa ingresoTotal y gastoTotal.

### 3.3 Invariantes

Los comprueba IntegrityService y los tests.

- **I1. Conservación global.** Σ disponible de todas las cuentas (incluidas las archivadas) + Σ saved de metas activas + Σ spentAmount de metas gastadas = Σ ajustes de cuentas + Σ ajustes de metas + Σ ingresos − Σ gastos. Los aportes se cancelan entre ambos lados.
- **I2. Deudas.** El saldo de cada deuda es ≥ 0. En cada pago, `0 ≤ capital aplicado ≤ monto`.
- **I3. Metas gastadas.** `spentAmountMinor` es igual al saved derivado. Se garantiza porque sus aportes y ajustes no se pueden modificar.
- **I4. Recurrentes.** Como mucho una transacción por (recurrente, ocurrencia); lo garantiza el UNIQUE parcial. Un recurrente de cuota de deuda nunca se confirma por el camino genérico.
- **I5. Clasificación.** `isPassive=1` ⇒ INCOME. `kind='DEBT_PAYMENT'` ⇒ EXPENSE con debtId. Lo garantizan los CHECK.
- **I6. Widgets.** Los flags solo se activan automáticamente desde NULL. Desactivar pone 0 y no borra nada.

**Bolsillos:** se retiran. El diseño no los menciona, las metas ocupan su función de ahorro apartado y el invariante "cuenta = sin asignar + Σ bolsillos" queda reemplazado por I1. Mantenerlos crearía dos conceptos de "apartar dinero" con dos identidades contables que reconciliar. Si en v1.1 se necesitan sobres de gasto, se pueden reintroducir con el mismo patrón de aportes. IntegrityService se reescribe para I1–I6. Se ejecuta en desarrollo al arrancar y en los tests, y nunca bloquea al usuario.

### 3.4 Contratos de operaciones

Todas son síncronas dentro de `db.transaction(tx => …)` (`runOperation` en `src/domain/services/shared.ts`, que además lanza `TypeError` si el callback devuelve una promesa). Devuelven `{ result, effects }`, donde `effects` son `{ refresh, reschedule }`: las claves de la interfaz que hay que refrescar (`accounts`, `transactions`, `debts`, `goals`, `recurring`, `settings`, `statement`, sin duplicados) y los ids de recurrentes a reprogramar; la capa de aplicación los ejecuta después del COMMIT y los servicios nunca los ejecutan. Cuando una operación indica autoActivate(widget), esa activación va en la misma transacción. Las consultas de solo lectura (`list`, `get`, `summary`, etc.) no abren transacción ni devuelven `effects`.

El dominio se construye con `createDomain(db, { userId?, now? })` (`src/domain/createDomain.ts`): `userId` por defecto `'default-user'` y `now` por defecto `Date.now()`; devuelve `accounts`, `transactions`, `debts`, `goals`, `recurring`, `settings`, `onboarding`, `reports` e `integrity`. El reloj inyectable `ctx.now()` es el único reloj de los servicios.

**Validaciones de borde comunes** (`shared.ts`):
- Montos: enteros seguros en unidades menores (`assertPositiveMinor`, `assertNonNegativeMinor`, `assertInteger`), con `ValidationError`.
- Nombres: `cleanName` recorta y rechaza vacíos.
- Fechas `'YYYY-MM-DD'`: `assertLocalDate(value, label)` exige formato y día existentes y rechaza años `< MIN_LOCAL_DATE_YEAR` (constante `MIN_LOCAL_DATE_YEAR = 100`) con `ValidationError`. Motivo: `localDateToEpochMs` usa `new Date(y, …)`, que interpreta los años 0 a 99 como 1900 a 1999 y guardaría silenciosamente otra fecha; `src/domain/dates.ts` no se modificó y la defensa está en el borde del servicio. Se aplica en todos los puntos de entrada con fecha de calendario: `targetDate` de metas (crear y actualizar), `occurrenceDate` (`confirmOccurrence` y `registerPayment`), `anchorDate` de recurrentes (crear y actualizar; incluye el onboarding, que reutiliza `createStandardRecurringIn`) y `nextDueDate` de deudas (crear y actualizar).
- Instantes: `assertEpochMs` exige entero seguro y rango de `Date` (±8,64e15 ms) con `ValidationError`.

**AccountService**
- `create({name, type, openingMinor})`: inserta la cuenta y, si el saldo inicial no es 0, un ajuste OPENING (anterior 0). El saldo inicial puede ser negativo.
- `update(id, {name?, balanceMinor?})`, en una transacción:
  - Rechaza una cuenta archivada con `AccountArchivedError` (una cuenta archivada no cambia de saldo).
  - Renombrar actualiza solo `accounts.name`. Las transacciones apuntan por id, así que el nombre nuevo aparece en todas sin más.
  - Si cambia el saldo: calcula el saldo actual dentro de la transacción y crea un ajuste MANUAL con anterior, nuevo y diferencia. Si la diferencia es 0, no hace nada.
- `remove(id)` (D2):
  - Sobre una cuenta **ya archivada** devuelve `ValidationError` ("La cuenta ya esta archivada"); sobre una inexistente o ajena, `NotFoundError`.
  - Si la cuenta no tiene transacciones ni aportes, borrado real junto con sus ajustes; los recurrentes que la tenían como predeterminada quedan sin cuenta.
  - Si tiene movimientos, se **archiva**:
    1. marca `archivedAt`;
    2. si el disponible no es 0, crea un ajuste ARCHIVE_CLOSE que lo deja en 0 (queda registrado);
    3. desvincula los recurrentes;
    4. el historial sigue en los reportes; la cuenta desaparece de listas, selectores y del total.
  - Resultado: `{ outcome: 'DELETED' | 'ARCHIVED' }`.
- **`unarchive(id)`** (decisión del usuario entre 2026-10-04 y 2026-10-07; la fecha exacta no está registrada):
  - Quita `archivedAt` **sin crear ajustes**: el ARCHIVE_CLOSE que la dejó en 0 queda como historial y el disponible sigue en 0. La cuenta vuelve a listas, selectores y total, y puede recibir movimientos.
  - Errores: `NotFoundError` si no existe o es de otro usuario; `ValidationError` si la cuenta no está archivada (SUPUESTO: no hay un error tipado específico).
  - Efectos: `refresh ['accounts', 'goals']` (los aportes y reembolsos de metas exponen `accountArchived`); no refresca `statement`.
  - DESCARTADO por el usuario: desarchivar automáticamente al intentar operar. La UI ofrece "Desarchivar" a partir de `AccountArchivedError.accountId` y reintenta (pantalla pendiente de F5).
- **Regla de las cuentas archivadas (decisión del usuario entre 2026-10-04 y 2026-10-07):** una cuenta archivada no cambia de saldo por ningún motivo. Se rechaza con `AccountArchivedError` (mensaje: "La cuenta está archivada. Desarchívala para modificar su saldo.") toda operación que crearía, borraría o movería dinero de ella: crear transacciones, ajustar el saldo, aportar a una meta, pagar una deuda, confirmar una ocurrencia y **borrar una transacción de esa cuenta** (esto último cubre `TransactionService.remove`, `RecurringService.unconfirm` y el borrado de la transacción de un pago de deuda, que pasan por `removeTransactionIn`). La única excepción es la redirección de aportes al eliminar una meta (ver GoalService), que no toca el saldo de la archivada sino que compensa sus aportes con un `ARCHIVE_CLOSE`.

**TransactionService**
- `create({type, accountId, amountMinor, categoryId|newCategoryName, isPassive, date, description})`:
  - Si viene una categoría nueva, la crea en la misma transacción (o reutiliza una existente con el mismo nombre y tipo). `categoryId` y `newCategoryName` son excluyentes (`ValidationError`).
  - Valida que la cuenta exista, sea del usuario y no esté archivada (`NotFoundError` / `AccountArchivedError`).
  - Si `isPassive` (solo ingresos), autoActivate(cashflow).
  - Siempre crea `kind='STANDARD'`. Los pagos de deuda solo entran por DebtService.
- `remove(id)`:
  - Borra la transacción. Saldo de cuenta, saldo de deuda, paidCount y reportes se revierten solos porque son derivados.
  - **Se rechaza con `AccountArchivedError` si la cuenta de la transacción está archivada.**
  - Si estaba ligada a una ocurrencia, `nextDueDate = min(nextDueDate, occurrenceDate)` y se limpia `snoozedUntil`, **solo si** el recurrente existe, tiene ancla (no NULL) y la ocurrencia pertenece a su serie actual (`isOccurrenceOfSeries`); si no, `nextDueDate` no se toca.
  - `removeTransactionIn` (exportada desde `TransactionService.ts`) es el **único camino de reversión**: lo usan `TransactionService.remove` y `RecurringService.unconfirm`.

**DebtService**
- `create({name, balanceMinor, installmentMinor?, rate: {known: r} | {unknown: {months}}, nextDueDate?, initialPaidCount?})`:
  - Inserta la deuda y, si el saldo es > 0, un ajuste OPENING. `initialPaidCount` es opcional y vale 0 por defecto (SUPUESTO de F2b).
  - Tasa estimada: `estimateMonthlyRate(saldo, cuota, meses)`, `rateSource=ESTIMATED`, `totalCount=meses`. Si no hay solución (sin cuota, saldo 0 o `cuota × meses ≤ saldo`) la tasa queda desconocida: `rateSource=UNKNOWN`, `monthlyRate` NULL (SUPUESTO). El texto de la pantalla es "Calculamos la tasa con la fórmula estándar de amortización."
  - Tasa conocida: `rateSource=KNOWN`, `totalCount` NULL.
  - Si hay cuota y fecha, crea el recurrente vinculado (`DEBT_INSTALLMENT`). Su frecuencia es MONTHLY (SUPUESTO: la arquitectura original no la definía).
  - autoActivate(debts).
- `update(id, {name?, balanceMinor?, installmentMinor?, nextDueDate?})`: un cambio de saldo es un ajuste MANUAL con nuevo ≥ 0. `nextDueDate` actualiza o crea el recurrente vinculado: **la fecha dada pasa a ser el ancla** y `nextDueDate` del recurrente queda en la primera ocurrencia desde ese ancla que no tenga transacción ligada (puede ser posterior a la fecha dada si esa ocurrencia ya estaba pagada). Crearlo exige que haya cuota (`ValidationError` si no).
- **`registerPayment({debtId, accountId, amountMinor, type: INSTALLMENT|EXTRA, date})`**, en una transacción:
  1. Calcula el saldo actual de la deuda.
  2. `capital aplicado = min(monto, saldo)`.
  3. Inserta una transacción EXPENSE `kind=DEBT_PAYMENT` por el **monto completo** (un abono mayor al saldo cuenta completo como gasto y la deuda queda en 0; ver sección 11).
  4. Si `type=INSTALLMENT` y hay recurrente vinculado con fecha: la transacción se liga a esa ocurrencia y se avanza `nextDueDate`.
  5. Rechaza el pago si la deuda está archivada. Si el saldo ya es 0, se rechaza con "Deuda liquidada" (D13).
  6. Rechaza el pago si la cuenta está archivada (`AccountArchivedError`).
  - Entrada opcional `occurrenceDate` (cuota que cubre; por defecto la `nextDueDate` del recurrente) y `description` (por defecto `Pago <nombre de la deuda>`). `EXTRA` ignora `occurrenceDate`.
  - Recurrente vinculado **sin fecha** (ancla NULL): sin `occurrenceDate`, el pago se registra **sin ligar** a ninguna ocurrencia (`linkedToOccurrence=false`); con `occurrenceDate` explícita se lanza `OccurrenceNotInSeriesError` (sin ancla no hay serie y una ocurrencia ajena a la serie nunca se acepta). SUPUESTO: con ancla pero sin `nextDueDate`, una ocurrencia explícita de la serie sí se liga.
  - Resultado: `{ transactionId, principalAppliedMinor, overpaymentMinor, newBalanceMinor, linkedToOccurrence }`.
  - **Orden de validaciones** (fijado por `test/integration/domain/validation_order.test.ts`; se lanza el primer error que aplique): 1 deuda inexistente o ajena (`NotFoundError`) o archivada (`DebtArchivedError`); 2 monto (`ValidationError`); 3 cuenta inexistente o ajena (`NotFoundError`) o archivada (`AccountArchivedError`); 4 fecha del pago fuera de rango (`ValidationError`); 5 deuda liquidada (`DebtSettledError`); 6 `occurrenceDate` mal formada o con año < 100 (`ValidationError`); 7 fuera de la serie (`OccurrenceNotInSeriesError`); 8 ya confirmada (`OccurrenceAlreadyConfirmedError`).
- `remove(id)` (D3):
  - Sin pagos: borrado real junto con ajustes y recurrente.
  - Con pagos: se archiva y se borra el recurrente (las transacciones que lo referenciaban quedan con `recurringItemId` NULL). Los pagos siguen como gasto de deuda del mes en que ocurrieron (`kind` no depende de que la deuda exista).
  - Una deuda ya archivada se rechaza con `DebtArchivedError`.
- Consultas: `list()` (deudas no archivadas con `balanceMinor`, `paidCount`, `nextDueDate`, `recurringId` y `monthsRemaining`), `get(id)` y `payments(debtId)` (del más reciente al más antiguo); con un id ajeno devuelven `undefined` / `[]` (ver 3.5).
- Funciones puras: `estimateMonthlyRate` usa **bisección con cota superior que se va duplicando**, igual que el diseño (líneas 1213-1224). Devuelve null si `cuota × meses ≤ saldo`. Se retira Newton (problema 6). `projectPayoff` se conserva; `calculateAvailableCredit`, `calculateMinPayment` y `calculateBillingInfo` se retiran.
- La proyección usa `projectPayoff(saldo, cuota, tasa)` cuando hay tasa y `ceil(saldo/cuota)` cuando no (D16). El prototipo ignora el interés. `DebtService` calcula `monthsRemaining` con `remainingMonths` (`src/domain/rules/amortization.ts`), que, **con tasa conocida (tasa > 0), devuelve solo la simulación `projectPayoff`** (`null` si `NEVER`/`CAPPED`), sin `max` contra el plan; sin tasa o con tasa 0 usa `ceil(saldo/cuota)` y aplica `max(totalCount − paidCount, base)` si `totalCount > 0` (decisión 33, 2026-10-08): ver [Decisión 33: meses restantes de una deuda con tasa](#decisión-33-meses-restantes-de-una-deuda-con-tasa). Contrato para F5: `monthsRemaining = null` significa dos cosas distintas (falta la cuota o la cuota no cubre el interés / supera 600 meses), y la pantalla debe distinguirlas.
- **Riesgo de modelo:** un pago reduce el saldo por su monto completo y no se modela interés devengado, igual que el diseño (línea 1451). Las diferencias con el extracto del banco se corrigen con un ajuste.

**GoalService**
- `create({name, targetMinor, initialMinor?, accountId?, targetDate?})`: inserta la meta y, si hay ahorro inicial, un aporte (el ahorro inicial exige `accountId`; `ValidationError` si falta). `targetDate` es `'YYYY-MM-DD'` (pasa por `assertLocalDate`) y se guarda como medianoche local en epoch ms. autoActivate(goals).
- `contribute({goalId, accountId, amountMinor, date})`: solo para metas ACTIVE (`GoalNotActiveError` si no). Inserta un aporte; no crea transacción. Se rechaza si el monto supera el disponible de la cuenta (`InsufficientFundsError`, D12) y si la cuenta está archivada (`AccountArchivedError`).
- `update(id, {name?, targetMinor?, savedMinor?, targetDate?})`: un cambio de saved es un ajuste MANUAL de la meta y no toca cuentas. `targetDate` `null` la limpia; sin definir, no cambia. Solo para metas ACTIVE.
- **`close(id)`**: requiere ACTIVE y saved ≥ objetivo (D11; `GoalNotReachedError` si no). Fija `status=SPENT`, `spentAt=now` y `spentAmountMinor=saved`. No pide cuenta, no crea transacción y no mueve dinero. El monto suma a `gastoMetas` del mes del cierre (D1). Refresca `goals` y `statement`.
- **`remove(id, { refundAccountId? })`** (D4, ampliada por la regla de cuentas archivadas):
  - Meta gastada: se rechaza con `GoalNotActiveError` (reescribiría gasto histórico) y ya no aparece en la lista.
  - Meta activa: borra en una transacción la meta, sus aportes y sus ajustes. El dinero de cada aporte vuelve a su cuenta de origen gracias al registro por aporte, **sin pedir nada**, cuando esa cuenta está activa.
  - Los aportes que salieron de cuentas **archivadas** no bloquean el borrado, pero una archivada no cambia de saldo, así que ese dinero se redirige a una **cuenta ACTIVA de destino que elige el usuario** (`refundAccountId`; un único destino para todas las cuentas archivadas de origen). En la misma transacción se crean: por cada cuenta archivada de origen, un ajuste `ARCHIVE_CLOSE` de −X (deja su disponible como estaba antes de borrar los aportes), y en el destino un único ajuste `MANUAL` de +total. Ninguno es ingreso ni gasto. El esquema solo admite los motivos OPENING, MANUAL y ARCHIVE_CLOSE, por eso se reutilizan estos dos.
  - Sin destino válido (no indicado, inexistente, archivado, de otro usuario o la propia cuenta archivada) se lanza `RefundAccountRequiredError` con `totalMinor`, `byAccount` (desglose por cuenta archivada: `accountId`, `accountName`, `amountMinor`) e `invalidAccountId` (la cuenta indicada que no sirvió, o `null` si no se indicó ninguna). Es la única excepción documentada a "un id ajeno es un `NotFoundError`" (ver 3.5). Sin aportes de cuentas archivadas, `refundAccountId` se ignora y ni se valida.
  - Resultado: `{ refunds, redirectedMinor, refundAccountId }`.
- **`refundPreview(id)`**: devuelve `{ refunds, requiresDestinationMinor }`. Cada reembolso lleva `accountId`, `accountName`, `amountMinor` y `accountArchived`; `requiresDestinationMinor` es la suma de los aportes de cuentas archivadas, es decir, lo que exige elegir destino. La interfaz confirma antes de borrar: "Se devolverán $a a Efectivo, $b a Ahorros" y, si `requiresDestinationMinor > 0`, pide la cuenta de destino (pantalla pendiente de F5). Con un id ajeno o inexistente devuelve `refunds: []` y `requiresDestinationMinor: 0` (SUPUESTO, coherente con ids inexistentes).
- Consultas: `list(status?)`, `get(id)` y `contributions(goalId)` (aportes del más antiguo al más reciente, con `accountName`, `accountArchived` y `date` en epoch ms). `GoalView.targetDate` es epoch ms y `GoalView.eta` es `null` en metas SPENT.
- ETA de una meta (D20): regla pura `goalEta` en `src/domain/rules/goalEta.ts`. Definiciones y tope en [3.7](#37-definiciones-del-eta-de-una-meta).

**RecurringService**
- `create / update / remove` para el tipo STANDARD (los recurrentes `DEBT_INSTALLMENT` se gestionan desde DebtService; operar sobre ellos aquí lanza `NotSupportedError`). Un recurrente de ingreso con `isPassive` activa el Índice (SUPUESTO). Solo un ingreso puede ser pasivo (`ValidationError`); la categoría debe existir y ser del tipo del recurrente.
- `create` y `update` reciben `defaultAccountId`, que la pantalla "Agregar recurrente" debe pedir (D8). Es solo una sugerencia: no sustituye la elección de cuenta al confirmar. Si se indica, debe ser una cuenta activa del usuario.
- `create` y `update` guardan el ancla **ya normalizada** con `normalizeAnchor` (ver más abajo). `update` que cambia la frecuencia o la fecha reubica `nextDueDate` en la primera ocurrencia sin transacción desde la nueva ancla y limpia `snoozedUntil`; con ancla NULL deja el recurrente "sin fecha".
- `remove` deja las transacciones con `recurringItemId` NULL.
- **`confirmOccurrence({recurringId, occurrenceDate, accountId, amountMinor?, date?})`**:
  - `accountId` es obligatorio: la hoja "Ya pagué" siempre pide cuenta, preseleccionando `defaultAccountId` si existe (D8).
  - Si el recurrente es de deuda, lanza `UseDebtPaymentFlow` y la interfaz redirige a Registrar pago de deuda.
  - Rechaza recurrentes pausados (`RecurringPausedError`), recurrentes sin fecha (`RecurringWithoutDateError`; SUPUESTO: sin ancla no hay serie contra la cual validar) y ocurrencias ajenas a la serie (`OccurrenceNotInSeriesError`, validada con `isOccurrenceOfSeries`).
  - Si no: inserta la transacción (type y isPassive del recurrente, `recurringItemId`, `occurrenceDate`), avanza `nextDueDate` y limpia `snoozedUntil`.
  - **Orden de validaciones** (fijado por `validation_order.test.ts`; se lanza el primer error que aplique): 1 recurrente inexistente o ajeno (`NotFoundError`); 2 cuota de deuda (`UseDebtPaymentFlow`); 3 pausado; 4 sin fecha; 5 sin cuenta (`AccountRequiredError`); 6 `occurrenceDate` mal formada o con año < 100 (`ValidationError`); 7 fuera de la serie; 8 cuenta inexistente (`NotFoundError`) o archivada (`AccountArchivedError`); 9 ya confirmada (`OccurrenceAlreadyConfirmedError`); 10 monto o fecha del pago (`ValidationError`).
- **Avanzar `nextDueDate`:** siguiente fecha calculada sin partir de `now` (nunca desde `now`) y que no tenga ya una transacción ligada.
  - Mensual: se calcula desde `anchorDate`; conserva el día del ancla y, si el mes es más corto, usa el último día (31 de enero → 28 de febrero → 31 de marzo).
  - Semanal: se calcula desde `anchorDate`; +7 días.
  - Quincenal (BIWEEKLY): los días 15 y último día del mes (D6). La secuencia es fija: 15 → último día del mes → 15 del mes siguiente → … El último día es 28 o 29 en febrero, 30 o 31 según el mes. **No es +14 días.** Esta regla no depende del día del ancla.
  - **Primera fecha de un quincenal (ambigüedad resuelta por el usuario):** si la primera fecha elegida no es el 15 ni el último día del mes, se **ajusta a la fecha válida más cercana** (`nearestBiweeklyDate`; candidatas: último día del mes anterior, 15, último día y 15 del mes siguiente, midiendo la distancia en días de calendario). En un **empate gana la fecha posterior** (decisión CONFIRMADA por el usuario; no se adelanta un pago). Solo hay dos empates: el día 23 de los meses de 31 días (8 y 8 días) y el 22 de febrero de un año bisiesto (7 y 7). Una fecha del 1 al 7 se ajusta hacia atrás, al último día del mes anterior. El ajuste es idempotente: una fecha ya válida no cambia.
  - **Contrato entre capas:** `normalizeAnchor(anchor, frequency)` (pura, `src/domain/rules/recurrence.ts`) devuelve `{ date, adjusted, original }`; para MONTHLY y WEEKLY no cambia nada. La pantalla "Agregar recurrente" debe llamarla **en vivo** cada vez que cambie la fecha o la frecuencia y mostrar la fecha ajustada mientras el usuario elige (nunca en silencio tras guardar). Los servicios guardan el ancla ya normalizada, e `iterateOccurrences` normaliza por defensa, de modo que datos sin normalizar nunca producen una primera ocurrencia inválida.
  - `isOccurrenceOfSeries(anchor, frequency, date)` (aritmética de calendario O(1)) valida la pertenencia a la serie: una fecha anterior al ancla (normalizado en BIWEEKLY) no pertenece.
  - Si el usuario fija la fecha de un recurrente de deuda con `DebtService.update({ nextDueDate })`, esa fecha es el ancla (ver DebtService).
- `unconfirm(recurringId, occurrenceDate)`: delega en `removeTransactionIn`, con un solo camino de reversión. Desmarcar el círculo en Próximos pagos borra la transacción (D14). `NotFoundError` si esa ocurrencia no está confirmada. Se rechaza con `AccountArchivedError` si la cuenta de la transacción está archivada.
- `snooze(recurringId)`: aplica la política de [7](#7-notificaciones-y-recurrentes).
- **Consulta `upcoming()`** (usa el usuario del contexto): recurrentes activos con fecha, excluyendo los de deudas con saldo 0 o archivadas (se deriva, no hay estado que sincronizar). El nombre y el monto de los de deuda vienen de la deuda. Estado de cada ítem: pendiente, vencido o "pagado" (hay transacción para una ocurrencia del mes actual y la siguiente fecha cae fuera del mes; SUPUESTO de presentación). Valores del código: `PENDING`, `OVERDUE`, `PAID`.
- **Consulta `pendingOccurrences()`**: entrada del plan de notificaciones de F4 (`planNotifications`); instantes en epoch ms y cuotas de deudas liquidadas marcadas `debtSettled`.

**Por qué no se duplica en Próximos pagos:** la cuota de una deuda es un recurrente con `debtId` UNIQUE, nombre y monto nulos (se toman de la deuda) y su fecha es la única fuente del `dueLabel` de la deuda. Ese recurrente lo crea DebtService, no "Agregar recurrente". Mitigación: "Agregar recurrente" pregunta "¿Es la cuota de una deuda?" y, si sí, vincula con una deuda existente en vez de crear un ítem nuevo.

**SettingsService**
- `setTheme`, `setNotifications`, `setWidget(w, on)` (desactivar pone 0).
- `autoActivate(tx, w)` = `UPDATE … SET w=1 WHERE w IS NULL`. Los widgets se activan solo con la primera entidad, siguiendo el spec y no el prototipo, que activa siempre (`debtActive: true`) (D10).

**OnboardingService**
- `complete(draft)`: una sola transacción con las cuentas (con OPENING), los recurrentes de ingreso y gasto del paso 2 (`nextDueDate` NULL; en F5b-1 el paso 2 no pide fecha, decisión 46 / A12, aunque el servicio acepta una), los flags del paso 3 (1 para el widget activado; NULL, sin escribir, para el no activado, decisión 46 / A9; verificado en `OnboardingService.ts`) y `onboardingCompletedAt`.
- El borrador vive en un store zustand no persistido. Volver atrás no duplica nada. Si la app se cierra a mitad, se pierde el borrador (son 4 pasos cortos; aceptado por el usuario el 2026-10-08, A6, decisión 46).
- Los recurrentes del onboarding quedan "sin fecha" y Próximos pagos invita a completarla (la fecha se completa en Recurrentes, F5b-3). Hasta entonces no hay notificaciones (D7).

**Atomicidad:** la frontera de la transacción es siempre el método del servicio. Los repositorios exponen consultas síncronas (`.get()`, `.all()`, `.run()`) que reciben el `tx` como parámetro. No hay `await` dentro de una transacción. better-sqlite3 lanza error si el callback devuelve una promesa, así que los tests detectan un uso asíncrono por error.

VERIFICADO (2026-10-03): `db.transaction` de drizzle sobre expo-sqlite es **síncrona**: el callback es síncrono, usa solo `tx.*` y no lleva `await`. `withExclusiveTransactionAsync` de expo-sqlite no es la vía.

Los tests de atomicidad (`test/integration/domain/atomicity.test.ts`) instalan triggers `RAISE(ABORT)` en la BD (`failOn` en `test/integration/domain/_helpers.ts`) para forzar un fallo a mitad de cada operación y comprueban que no queda ningún efecto.

### 3.5 Propiedad del usuario y convención de repositorios

**Regla de servicios.** Un id de **otro usuario** se trata como inexistente: `NotFoundError`, indistinguible del de un id que no existe y sin efectos en la BD, en todos los puntos de entrada de los servicios. Las lecturas con id ajeno devuelven `undefined` o `[]` (`get`, `payments`, `contributions` y `refundPreview`; SUPUESTO, coherente con el comportamiento con ids inexistentes). **Única excepción documentada:** `RefundAccountRequiredError` con `invalidAccountId` (al eliminar una meta, una cuenta de destino ajena se reporta como "destino no válido", no como `NotFoundError`).

**Refuerzo en los repositorios (decisión expresa del usuario).** Ya hubo un bug real: `accounts.remove` y `accounts.get` aceptaban ids ajenos. Por eso la propiedad no se delega solo en el servicio:

- **Convención `(db, userId, id, ...)`:** TODOS los métodos por id de TODOS los repositorios exigen `userId` como segundo parámetro y lo incluyen **en el `WHERE` de la consulta**. Única excepción: `insert(db, v)`, que recibe `v.userId`. Los métodos de lista y agregados reciben `(db, userId, ...)` y filtran igual.
- **Mutadores:** devuelven el número de filas afectadas con `.returning({ id }).all().length` (0 = id inexistente o ajeno). Esto exige `UPDATE ... RETURNING` y `DELETE ... RETURNING`, disponibles desde SQLite 3.35: `expo-sqlite` 56.0.5 empaqueta SQLite 3.50.3 y el `better-sqlite3` de test (13.0.3 en `package.json`), 3.53.4 (versiones de SQLite tomadas del informe de verificación; NO re-comprobadas en esta lectura). **NO probado en dispositivo.** Plan B si `RETURNING` fallara en expo-sqlite: `run()` y el campo `changes`.
- **Defensa en profundidad:** los servicios mantienen sus comprobaciones previas con `NotFoundError`; la comprobación del repositorio es un segundo cerrojo, no un sustituto.
- **Comprobado por el analizador AST en los 10 repositorios** (los `*Repository.ts` en disco): `accountRepository`, `adjustmentRepository`, `categoryRepository`, `debtRepository`, `goalContributionRepository`, `goalRepository`, `recurringRepository`, `reportRepository`, `settingsRepository` y `transactionRepository`. De ellos, 8 tienen `insert` (todos salvo `reportRepository` y `settingsRepository`). En los servicios hay 18 llamadas `<x>.insert(...)`, en 5 de los 12 archivos de `src/domain/services/*.ts` (el analizador inspecciona los 12; `AccountService` 4, `DebtService` 5, `GoalService` 5, `RecurringService` 2 y `TransactionService` 2).

**Invariante de la BD: la propiedad la imponen triggers** (`src/database/migrations/0001_owner_triggers.sql`; drizzle no modela triggers, así que el esquema tipado no los ve y `schema.ts` lo señala en cada tabla con dueño). Las FK siguen siendo de una columna; encima:

- **`trg_<tabla>_user_id_immutable`** en las 8 tablas con dueño (`accounts`, `categories`, `debts`, `goals`, `recurring_items`, `transactions`, `goal_contributions`, `balance_adjustments`): un `UPDATE` que cambie `user_id` aborta con `OWNER_IMMUTABLE: <tabla>.user_id`.
- **`trg_<tabla>_owner_ins` / `_owner_upd`** en las 4 tablas hijas, para sus 12 referencias (`recurring_items`: `debt_id`, `category_id`, `default_account_id`; `transactions`: `account_id`, `category_id`, `debt_id`, `recurring_item_id`; `goal_contributions`: `goal_id`, `account_id`; `balance_adjustments`: `account_id`, `debt_id`, `goal_id`): si el padre existe y es de otro usuario, aborta con `OWNER_MISMATCH: <tabla>.<columna>`. Una categoría del sistema (`user_id` NULL) se acepta desde cualquier usuario. Si el padre no existe, el trigger no interviene y responde la FK de siempre.
- Error: `SQLITE_CONSTRAINT_TRIGGER`. Es la **última** línea: los servicios siguen validando **todos** los ids embebidos con el `userId` del contexto antes de escribir (`NotFoundError`), y la guarda estructural exige `userId: ctx.userId` en cada `insert` de los servicios. En el flujo normal el trigger nunca salta.
- **`trg_<tabla>_owner_replace`** en las 8 tablas con dueño: un `INSERT` con un `id` que ya existe con otro `user_id` aborta con `OWNER_IMMUTABLE`. Cierra `INSERT OR REPLACE` / `REPLACE INTO` cuando el choque es por `id`, que en SQLite borra e inserta sin disparar el trigger de `UPDATE` (hallazgo de la revisión de seguridad, 2026-10-18). **Límite conocido (revisión de seguridad, 2026-10-25):** no cubre un `REPLACE` que choque por un `rowid` explícito ni un `UPDATE OR REPLACE` que cambie `id`; ambos pueden borrar filas de otro usuario (y poner en NULL sus referencias `SET NULL`). Ninguno es alcanzable desde drizzle ni desde los repositorios. Endurecimiento propuesto, pendiente de decisión: un trigger que haga `id` inmutable y comparar también el `rowid` en `_owner_replace`.
- En `UPDATE`, `_owner_upd` solo valida las columnas que **cambian** (`NEW.col IS NOT OLD.col`): una fila anterior a 0001 con una referencia cruzada no bloquea editar otra columna ni el `SET NULL` de un borrado. La migración no audita filas previas (con un único usuario local no pueden existir); antes de abrir multiusuario conviene una consulta de auditoría de referencias cruzadas.
- Los `ON DELETE` no cambian (los `SET NULL` disparan el `_owner_upd` con la columna en NULL, que pasa). Rollback: `DROP TRIGGER` de los 24 `trg_*`.
- **Migraciones futuras que reconstruyan una tabla con dueño** (patrón de drizzle-kit `__new_` + `DROP` + `RENAME`): tienen que hacer `DROP TRIGGER` de todos los `trg_*` antes y recrearlos después, en la misma migración; quitar solo los de la propia tabla no basta, porque fallan los de las hijas que la referencian. Con los triggers vivos, reconstruir una tabla padre (`accounts`, `goals`…) falla con «error in trigger … no such table» y la migración se revierte, así que la app no arranca; reconstruir una hoja (`transactions`) pasa pero borra triggers sin avisar (revisión de código, 2026-10-25, probado en SQLite 3.53). El test de `owner_triggers.test.ts` que cuenta los 24 triggers detecta la pérdida.
- **NO probado en dispositivo** (expo-sqlite): los tests usan better-sqlite3. Ver R10.
- Probado en `test/integration/schema/owner_triggers.test.ts`, incluida la actualización de una BD con datos que solo tenía la migración 0000 (los datos quedan idénticos y `foreign_key_check` vacío). Por qué no FK compuestas: [pendientes](#resuelto-un-update-que-reasigne-userid-y-las-fk-sin-userid).

**Guarda estructural por AST** (`test/helpers/repositoryAst.ts`, ejecutada por `test/unit/repositoryOwnership.test.ts`). VERIFICADO EN CÓDIGO (2026-10-07): commiteada en `119a972` y verificada. Sustituye a la versión anterior, que usaba reflexión sobre `fn.toString()` y expresiones regulares sobre líneas.

- **Cómo funciona.** El analizador usa la API de `typescript` (`ts.createSourceFile` y recorrido de nodos): es un análisis **sintáctico y por nombres**; no resuelve tipos ni símbolos, no ejecuta ni importa nada, y los comentarios y las cadenas **no existen en el árbol**, así que no hay heurísticas de texto. El test lo aplica al código real, descubierto **en disco** (cada `src/database/repositories/*Repository.ts` y cada `src/domain/services/*.ts`, de modo que un archivo nuevo no escapa por no estar en una lista), comprueba que el analizador ve exactamente las funciones que expone el objeto cargado (`Object.keys`) y también prueba el propio analizador con fuentes sintéticas aceptadas y rechazadas y con mutaciones en memoria del código real.
- **Reglas para cada `*Repository.ts`:**
  - **R1, exportación.** El archivo exporta un solo valor, `export const <archivo> = { ... }` (literal de objeto; se admiten `as`, `satisfies` y paréntesis). Ninguna función suelta exportada, ni `export *`, ni `export default`; los `export type` e `interface` sí se admiten. Cada miembro es un método o una flecha; spread, getters/setters, claves calculadas o referencias (`f,`) fallan.
  - **R2, firma.** Primer parámetro: el identificador `db` (sin valor por defecto, sin `?`, sin `...`). Segundo parámetro: el identificador `userId` de tipo `string`, sin desestructurar, sin valor por defecto, sin `?` ni `...`. Del tercero en adelante, libres, siempre que no redeclaren `userId`. La función no puede ser `async` ni generadora. **Única excepción por nombre: `insert(db, v)`**, cuyo segundo parámetro es un identificador simple.
  - **R3, consultas.** Cada raíz `select`, `selectDistinct`, `update` o `delete` (subconsultas incluidas) debe colgar de `db` y tener **exactamente un** `.where(...)` (con dos, el último sustituye al primero en drizzle) cuyo argumento filtre por usuario (R4). Cualquier otro uso de `db` falla: `db.query`, `db.run`, `db.transaction`, alias, desestructuración o pasarlo a una función cualquiera; solo se admite como receptor de esas operaciones y de `insert`, y como primer argumento de una delegación `<x>Repository.f(db, userId, ...)`.
  - **R4, qué cuenta como filtro.** Un `eq(col, userId)` (en cualquier orden) con `col` igual a `<tabla>.userId` o `users.id`. En `and(...)` y `or(...)` basta **un** argumento que filtre (necesario para `categoryRepository`: categorías propias o del sistema). Un ternario filtra si filtran **ambas** ramas. Un helper del propio archivo (`owned`, `targetWhere`) cuenta si la propia guarda lo verifica con el mismo método (tiene un parámetro `userId`, todos sus `return` filtran y se le pasa `userId` en esa posición). Una plantilla `sql` con un tramo `${userId}` y un tramo con una columna de propietario. Un identificador local `const` cuyo inicializador filtra. **No se desciende a subconsultas**: una subconsulta que filtra no hace que filtre la consulta exterior.
  - **R5, usos de `userId`.** Todo uso de `userId` como referencia de valor debe ser argumento directo de `eq(...)`, de un helper verificado, de una delegación `<x>Repository.f(db, userId, ...)` o un tramo de una plantilla `sql`. Fallan los comentarios que simulan uso, `void userId`, `userId.length`, los ternarios con `userId`, las variables sin uso real y las redeclaraciones. Una función sin consultas debe delegar con `userId` en segunda posición.
  - **R6, inserciones.** `.values(...)` recibe un literal de objeto con **una única** propiedad `userId`, sin spread ni claves calculadas, cuyo valor es `v.userId` (en `insert`) o `userId` (en otra función).
  - **R7, `update`.** Exactamente un `.set(...)`, sin `userId`/`user_id`: un literal sin esa propiedad ni spread (claves calculadas solo `[MAPA[k]]` con un `const` literal del archivo sin `userId`), o un `const` local con un literal así cuyos únicos usos son `x.campo = ...` y el propio `.set(x)`. Cualquier otra forma falla por no verificable.
- **Reglas para los servicios (`src/domain/services/*.ts`):**
  - **S1.** Toda llamada `<x>.insert(...)` (cualquier receptor; incluye alias de repositorio y `tx` como primer argumento) exige un segundo argumento que sea un literal de objeto con **una única** propiedad `userId` cuyo valor es exactamente `ctx.userId`: sin spread, sin claves calculadas, sin ternarios, sin `ctx!.userId` ni `ctx?.userId`. Si el argumento es una variable, falla con un mensaje que explica que no es verificable. El formato de líneas no importa.
  - **S2.** `x['insert'](...)`, una referencia a `.insert` sin llamarla (`const f = repo.insert`) y `{ insert } = repo` también fallan.
- **Límites de la guarda** (lo que NO verifica):
  - No verifica la **semántica** del filtro: `or(eq(t.userId, userId), sql\`1=1\`)` pasa porque basta un disyunto; no comprueba que la tabla de la columna sea la consultada ni el operador fuera de `eq`.
  - El `sql` solo exige que existan un `${userId}` y una columna de propietario, sin relacionarlos entre sí; y cualquier `<x>.userId` cuenta como columna de propietario.
  - R7 solo mira el `.set(...)` de las cadenas `db.update(...)` de los repositorios; un `UPDATE` por SQL crudo fuera de ellos lo para el trigger `OWNER_IMMUTABLE`.
  - Las consultas dentro de helpers de módulo no se analizan (solo que sus `return` filtren y sus usos de `userId`).
  - Los JOIN no se verifican: solo el `where` de la consulta.
  - `eq`, `and`, `or` y `sql` se reconocen por NOMBRE, no por su origen en `drizzle-orm`.
  - Los alias de `userId` no se siguen (usar un alias como filtro falla por R5, de forma conservadora).
  - Los valores devueltos (por ejemplo, los conteos de filas de los mutadores) no los ve la guarda.
  - Que `ctx.userId` sea el correcto depende de `createDomain`.
  - Que las referencias entre tablas sean del mismo usuario no lo ve la guarda: lo impone la BD con triggers (ver la invariante más arriba).
  - **Fragilidad:** el analizador detecta errores de sintaxis con `parseDiagnostics`, una API **interna** de TypeScript (no pública); puede romperse al actualizar `typescript` (el repo usa `~6.0.3`).
- **Lo no cubierto por el AST lo cubren los tests de comportamiento y el fuzz:** `test/integration/repositories/ownership.test.ts` (un caso por función de cada repositorio, llamando a los repositorios directamente con el `userId` de B y ids de A, con un control positivo con el de A para que no sea vacuo; la lista de funciones se deriva dinámicamente con `Object.keys` de cada repositorio cargado desde disco, de modo que una función nueva sin caso rompe el test); `test/integration/domain/ownership.test.ts` (todos los puntos de entrada con id, con un segundo usuario aislado creado con `secondUserDomain`) y la prueba aleatoria (sección 8).

### 3.6 Errores tipados

`src/domain/services/errors.ts`: todos extienden `DomainError` y llevan un `code` (`DomainErrorCode`); la UI distingue por `code` o por `instanceof`.

| Clase | `code` | Cuándo | Campos extra |
|---|---|---|---|
| `ValidationError` | `VALIDATION` | Entrada inválida (monto, nombre vacío, fecha, combinación no permitida, cuenta no archivada al desarchivar, cuenta ya archivada al eliminar) | |
| `NotFoundError` | `NOT_FOUND` | Id inexistente **o de otro usuario** | `entity`, `entityId` |
| `AccountArchivedError` | `ACCOUNT_ARCHIVED` | Operación que cambiaría el saldo de una cuenta archivada | `accountId` |
| `AccountRequiredError` | `ACCOUNT_REQUIRED` | `confirmOccurrence` sin cuenta | |
| `InsufficientFundsError` | `INSUFFICIENT_FUNDS` | Aporte mayor al disponible (D12) | `accountId`, `availableMinor`, `requestedMinor` |
| `DebtSettledError` | `DEBT_SETTLED` | Pago a una deuda con saldo 0 (D13) | `debtId` |
| `DebtArchivedError` | `DEBT_ARCHIVED` | Operación sobre una deuda archivada | `debtId` |
| `GoalNotActiveError` | `GOAL_NOT_ACTIVE` | Aporte, ajuste, segundo cierre o borrado de una meta SPENT | `goalId` |
| `GoalNotReachedError` | `GOAL_NOT_REACHED` | Cerrar una meta con saved < objetivo (D11) | `savedMinor`, `targetMinor` |
| `OccurrenceAlreadyConfirmedError` | `OCCURRENCE_ALREADY_CONFIRMED` | La ocurrencia ya tiene transacción | `recurringId`, `occurrenceDate` |
| `OccurrenceNotInSeriesError` | `OCCURRENCE_NOT_IN_SERIES` | La fecha no pertenece a la serie (ancla + frecuencia) | `recurringId`, `occurrenceDate` |
| `RecurringWithoutDateError` | `RECURRING_WITHOUT_DATE` | Confirmar un recurrente sin fecha | `recurringId` |
| `RecurringPausedError` | `RECURRING_PAUSED` | Confirmar un recurrente pausado | `recurringId` |
| `RefundAccountRequiredError` | `REFUND_ACCOUNT_REQUIRED` | Eliminar una meta con aportes de cuentas archivadas sin un destino activo válido | `goalId`, `totalMinor`, `byAccount`, `invalidAccountId` |
| `UseDebtPaymentFlow` | `USE_DEBT_PAYMENT_FLOW` | Confirmar por el camino genérico la cuota de una deuda (I4) | `debtId`, `recurringId`, `occurrenceDate` |
| `OnboardingAlreadyCompletedError` | `ONBOARDING_ALREADY_COMPLETED` | Repetir el onboarding | |
| `NotSupportedError` | `NOT_SUPPORTED` | Operación fuera del alcance del servicio (p. ej. editar una cuota de deuda como recurrente genérico) | |

### 3.7 Definiciones del ETA de una meta

Elegidas durante F2b-bis y F2b-ter porque la especificación no las daba. La precedencia y las definiciones del ETA son **decisiones del usuario** (sección 10.2, punto 25, y sección 11). El tratamiento de **exactamente 1200 meses** (se incluye; ver el tope más abajo) es **decisión del usuario del 2026-10-07** (sección 10.2, punto 32); antes era SUPUESTO. La cabecera de `src/domain/rules/goalEta.ts` ya cita esa decisión (corregida en `0b34f13`; ver [12.2](#122-desviaciones-y-ampliaciones-posteriores)). Regla pura `goalEta` en `src/domain/rules/goalEta.ts`: no lee el reloj ni la BD; solo cuentan los **aportes** (no los ajustes) con fecha ≤ `now`.

Resultado (`GoalEta`): `{ kind: 'REACHED' }`, `{ kind: 'BY_TARGET_DATE', date, overdue, monthsLeft, requiredMonthlyMinor }`, `{ kind: 'BY_PACE', date, monthsLeft, monthlyAverageMinor }` o `{ kind: 'UNKNOWN' }` ("por calcular").

- **Precedencia:** `REACHED` > `BY_TARGET_DATE` > `BY_PACE` > `UNKNOWN`. `REACHED` si ahorro ≥ objetivo.
- **BY_TARGET_DATE** (hay `targetDate`; gana sobre el ritmo): `monthsLeft` = el menor `k ≥ 1` con `hoy + k meses ≥ targetDate` (día ajustado al último del mes si hace falta: 31 ene + 1 mes = 28 feb); una fecha objetivo hoy cuenta como 1. `requiredMonthlyMinor = ceil(falta / monthsLeft)`. Si la fecha ya pasó: `overdue = true`, `monthsLeft = 0` y `requiredMonthlyMinor` = lo que falta. Se calcula en O(1) (equivalente al bucle original; según el informe de la fase, verificado con 7.037.994 casos contra una referencia independiente, y corrige un fallo cerca del año 9999; esa corrida no se repitió al escribir este documento). Una `targetDate` que no es una fecha válida da `UNKNOWN`.
- **BY_PACE** (sin `targetDate`): ventana = aportes en `[00:00 local del mes calendario de hace 2 meses, now]`, sumados y **divididos siempre entre 3** (el mes actual parcial cuenta como mes entero: sesgo conservador a principios de mes). `monthsLeft = ceil(3 × falta / suma)`; fecha estimada = hoy + `monthsLeft` meses; `monthlyAverageMinor = round(suma / 3)`.
- **Tope (100 años):** si `monthsLeft` supera `MAX_PACE_MONTHS = 1200`, o no es un entero seguro, o la fecha resultante no es un `LocalDate` válido de 4 dígitos, el resultado es `UNKNOWN`. 1200 se incluye y 1201 es `UNKNOWN` (decisión del usuario, 2026-10-07; el tope es `monthsLeft > 1200`).
- **UNKNOWN** también si no hay `targetDate` ni aportes en la ventana.
- `GoalView.eta` es `null` en metas SPENT.

---

## 4. Capas y módulos

### 4.1 Estructura

Estructura **diseño objetivo**, con el estado real a 2026-10-07 anotado en cada línea (VERIFICADO EN CÓDIGO):

```
src/
  database/
    client.ts            ← openDatabaseSync + PRAGMA + drizzle (única importación de expo-sqlite)  [existe]
    schema.ts, types.ts  ← esquema; tipos AppDatabase y DbOrTx                                      [existen]
    ids.ts, seed.ts      ← newId(); semilla (usuario 'default-user' y categorías base)              [existen]
    initialize.ts        ← migrate(db, migrations) + seed                                           [existe]
    migrations/          ← generado por drizzle-kit (.sql + meta + migrations.js), no se edita a mano [existe]
    repositories/        ← accountRepository, adjustmentRepository, categoryRepository, debtRepository,
                           goalContributionRepository, goalRepository, recurringRepository,
                           reportRepository (consultas agregadas), settingsRepository,
                           transactionRepository, mapping.ts, index.ts                              [existen]
  domain/
    money.ts, dates.ts   ← unidades menores, formato es-CO (formatCOP), límites de mes, fecha local [existen]
    rules/               ← puras: amortization.ts, recurrence.ts, statement.ts, notificationPlan.ts,
                           goalEta.ts                                                               [existen]
    services/            ← Account, Transaction, Debt, Goal, Recurring, Settings, Onboarding,
                           Report (antes Cashflow), Integrity; errors.ts, shared.ts, index.ts       [existen]
    createDomain.ts      ← createDomain(db, { userId?, now? }): inyecta la BD (Expo en la app,
                           better-sqlite3 en tests)                                                 [existe]
    entities/            ← vacío (solo `.gitkeep`)                                                   [existe, vacío]
    utils/               ← currency.ts y date.ts ANTIGUOS (formateadores viejos); se retiran en F6.
                           OJO: currency.ts exporta OTRA `formatCOP` (homonimia, ver 5)             [existen]
  platform/              ← notifications.ts (adaptador expo-notifications); fonts (las fuentes se cargan
                           en app/_layout.tsx, no hay archivo de fuentes en platform/)               [existe: notifications.ts (F4)]
  app-services/          ← comandos: llaman al dominio y después ejecutan efectos (commands, effects,
                           domain, startup, notificationsPort, index)                               [existe (F5a)]
  store/                 ← useSettingsStore (caché de users), useInvalidation; useOnboardingDraft
                           (no existe aún); conviven los stores antiguos useUserStore, useUIStore y
                           useNotificationStore                                                     [parcial: F5a]
  hooks/                 ← un hook por dominio: useDomainQuery (base), useAccounts, useMonthStatement,
                           useDebts, useGoals, useUpcoming, useTransactions; se suscriben a claves
                           de invalidación. Re-export temporal de useCategories/useCategoriesByType
                           en index.ts (se retira en F6)                                            [existen (F5a)]
  lib/                   ← dateLabels.ts, dashboardFormat.ts                                        [existen (F5a)]
  navigation/            ← routes.ts                                                                [existe (F5a)]
  components/dashboard/  ← widgets del Dashboard                                                    [existen (F5a)]
  theme/                 ← tokens.ts (copia local de design-tokens.json), ThemeProvider.tsx,
                           theme.ts, fontFamilies.ts, fontAssets.ts, navigationTheme.ts, index.ts;
                           shim temporal: colors.ts, spacing.ts, typography.ts, shadows.ts          [existen]
  components/ui/ds/      ← primitivas nuevas del Design System: Text, Amount, Button, Widget,
                           InviteCard, Input, MoneyInput, Pill, SegmentedControl, ProgressBar,
                           Sheet, ListRow, AccountPicker (+ constants, tone, utils, useFocusRing)   [existen]
  components/ui/         ← primitivas ANTIGUAS (Button, Input, ProgressBar, Card, Modal, …); se retiran en F6
app/                     ← solo pantallas: usan hooks y comandos (`app/(app)/` con `_layout` e `index` (Dashboard) desde F5a;
                           el resto sigue siendo pantallas antiguas; `app/_layout.tsx` monta el
                           ThemeProvider, carga las fuentes con useFonts y usa `Stack.Protected`)
```

Las primitivas nuevas viven en `ui/ds/` mientras `ui/` conserve las antiguas; cuando las pantallas se rehagan (F6) se borran las antiguas y `ds/` sube un nivel.

Reglas de ESLint `no-restricted-imports` (`eslint.config.js`), hoy en nivel **`warn`** (se endurecen a `error` en F6): `app/**` no importa `src/database/**` ni `drizzle-orm`; `src/domain/**` no importa `expo-*`, `react-native`, `src/platform` ni `src/database/client`; y el import de `colors` estático (shim) está avisado en `app/**` y en `src/components/**` fuera de `src/components/ui/**`.

**Refresco de la interfaz:** un store de invalidación por clave (`accounts`, `transactions`, `debts`, `goals`, `recurring`, `settings`, `statement`). Cada comando lo actualiza después del COMMIT y los hooks vuelven a consultar. Mantiene el patrón actual (sin caché financiero) y no añade dependencias.
- Alternativa descartada: `useLiveQuery` de drizzle con el listener de cambios de expo-sqlite. VERIFICADO (2026-10-03): `useLiveQuery` exige `enableChangeListener: true`. No se usa: no está verificado con agregados y JOINs y acopla los hooks al driver.
- Otra alternativa: TanStack Query. Es sólida pero añade una dependencia. Queda como opción si crece la complejidad.

### 4.2 Qué se conserva, se retira o se crea

- **Se conserva y adapta:** `projectPayoff` y la bisección de `DebtService` (pasan a `rules/amortization.ts`); `CashflowService` se reescribe como `ReportService`; la idea de `RecurringService` (reescrito); `lib/expo/notifications` (pasa a ser adaptador); `domain/utils/currency` y `date`; los componentes de formulario (se reestilizan); `debtService.test.ts` (se adapta).
- **Se retira (código, tablas y pantallas):**
  - Presupuesto y distribución (fuera del MVP, v1.1): `BudgetService`, `DistributionService`, `useBudget`, `budgets_monthly`, `distribution_rules`, `app/(tabs)/budget.tsx`, `app/settings/distribution.tsx`. Justificación: ambos servicios dependen de `debtCards`, `debtLoans` y `pockets`, que desaparecen. Conservarlos "inertes" obligaría a reescribirlos solo para que compilen. Además, el presupuesto de v1.1 es por categoría, distinto del actual global, así que el costo de reintroducirlos es casi el mismo que hacerlos de nuevo. El commit `e7fd4a5` (snapshot pre-mvp) es la referencia y el tag `pre-mvp` existe.
  - Pockets completo: repositorio, hooks, `app/pockets/*`, `app/(tabs)/pockets.tsx`, `PocketPicker`.
  - `debtCardRepository` y `debtLoanRepository` (se unifican en la entidad única Debt).
  - `useIntegrityCheck`, mientras sea solo para depuración.
  - `themed-text`, `themed-view`, `app-tabs*`, `animated-icon*`, `hint-row`, `web-badge`, `external-link`: restos de la plantilla con imports rotos (NO VERIFICADO uno por uno).
  - `test/mocks/expo-sqlite.ts`, `test/unit/integrity.test.ts` y la parte simulada de `cashflowService.test.ts`.
  - Persistencia de `useUserStore` en AsyncStorage.
- **Presupuesto en la interfaz:** como no hay tab bar, no se muestra nada. Opcionalmente, una fila deshabilitada "Presupuesto · Próximamente" en Ajustes que no navega ni guarda. Se recomienda omitirla, porque el diseño no la tiene.
- **Dependencias retiradas:** `tamagui` y `victory-native` no se importaban en `app/` ni en `src/` y se retiraron en F0 (sección 11); ya no figuran en `package.json`. El original dejaba NO VERIFICADO que no hubiera uso indirecto.
- **Pendiente de retirada (F6):** los formateadores de moneda viejos de `src/domain/utils/currency.ts` y de las pantallas antiguas (el único formateador vigente es `formatCOP` de `src/domain/money`, ver [5](#5-sistema-de-tema); ojo con la homonimia con la `formatCOP` vieja de `utils/currency.ts`), el alias de `expo-sqlite` y `test/mocks/expo-sqlite.ts` en `vitest.config.ts`, el shim de `colors` y las primitivas antiguas de `src/components/ui/`.

### 4.3 Estado de la interfaz

Zustand solo para: caché de ajustes (se carga desde SQLite al iniciar y se escribe a través del servicio), invalidación, borrador del onboarding y estado efímero de la interfaz. Nunca para saldos.

### 4.4 Mecanismo de migraciones

- `drizzle.config.ts` con `driver: 'expo'`: drizzle-kit genera `.sql`, `meta/_journal.json` y **`migrations.js`**, que importa los `.sql`. VERIFICADO (2026-10-03); VERIFICADO EN CÓDIGO (2026-10-07): `drizzle.config.ts` (`dialect: 'sqlite'`, `driver: 'expo'`, `out: ./src/database/migrations`) y `src/database/migrations/migrations.js` existen.
- En el bundle: `babel-plugin-inline-import` para `.sql` en `babel.config.js` (`['inline-import', { extensions: ['.sql'] }]`) y `sourceExts` con `'sql'` en `metro.config.js`. VERIFICADO (2026-10-03); ambos archivos ya están configurados (F0). `babel.config.js` mantiene `babel-preset-expo`, que activa React Compiler por `experiments.reactCompiler` de `app.json`.
- En ejecución: `initializeDatabase()` (`src/database/initialize.ts`) llama a `migrate(db, migrations)` de `drizzle-orm/expo-sqlite/migrator` y luego a `seedDatabase`; es idempotente y devuelve una promesa compartida, y `app/_layout.tsx` la espera antes de renderizar. [EXPO-DOC: si `useMigrations` sigue vigente en SDK 56; no lo cubrió el informe.]
- En tests: `drizzle-orm/better-sqlite3/migrator` con `migrationsFolder` apuntando a los mismos `.sql`. La fuente única es `schema.ts`; drizzle-kit genera el `.sql` y `migrations.js`. El espejo `.ts` manual **no debe existir** (y ya no existe).
- Protección contra divergencias: `npm run db:check` = `drizzle-kit check && node scripts/check-migrations.js`. El script copia las migraciones a un directorio temporal bajo `node_modules/.cache`, ejecuta `drizzle-kit generate` sobre la copia y **falla cerrado**: falla si genera algo nuevo (el esquema diverge de las migraciones), si `drizzle-kit` falla o su salida indica un error, o si no puede confirmar positivamente "nothing to migrate"; no modifica el repo. Regenerar: editar `schema.ts`, `npm run db:generate` y versionar el resultado. Está pensado para CI y antes de hacer commit (no existe carpeta `.github` en el repo y no se comprobó ningún otro mecanismo automático: NO VERIFICADO que se ejecute fuera de la invocación manual).
- **Riesgo con instalaciones de desarrollo:** un dispositivo con la BD vieja tiene `__drizzle_migrations` con el hash anterior del `0000`. Mitigación: cambiar el nombre del archivo (`financial-flow-v1.db`). Con eso se parte de una BD limpia sin pasos manuales (base de datos limpia con migración regenerada).

---

## 5. Sistema de tema

La paleta del Design System reemplaza la actual.

- **Tokens:** `src/theme/tokens.ts` es una **copia local y tipada** de `Design/design-tokens.json` (la fuente de verdad; decisión: copiar para no depender de la carpeta `Design/` en el bundle). Es un archivo puro, sin imports de react-native ni expo. `test/unit/theme/tokens.test.ts` compara la copia con el JSON y falla si divergen, así que cualquier cambio de diseño debe replicarse en `tokens.ts`. Los colores se exponen en camelCase: surfacePage, surfaceCard, surfaceRaised, borderSubtle, inkPrimary, inkSecondary, inkOnBrand, brandPrimary, signalGrowth, signalDebt, signalGoal y focusRing (resolviendo la referencia `{brand-primary}`), en versión clara y oscura. También tipografía (display-lg…amount-sm), espaciado (space-1…7), radios (xs, sm, md, lg, full) y la sombra solo para hojas (`shadowSheet`). Es una única fuente de verdad sin generación de código.
- **ThemeProvider único** (`src/theme/ThemeProvider.tsx`, montado en `app/_layout.tsx`): `scheme = resolveScheme(preference, useColorScheme())`, es decir, `preference === 'system'` sigue al sistema (y si este no informa, claro) y `'light'`/`'dark'` mandan. Expone `useTheme()` → `{ scheme, colors, type, space, radius, shadowSheet }`. `preference` entra por prop (por defecto `'system'`) y un contexto mínimo (`useThemeController`) permite cambiarla; con preferencia explícita fuerza `Appearance.setColorScheme` para que teclado y controles nativos coincidan. Alimenta el `ThemeProvider` de navegación que exporta `expo-router` y la barra de estado (`expo-status-bar`). La integración con el store de ajustes (y el selector `useThemePreference`) es de F5a: aún no existe `src/store/useSettingsStore`.
- **Fuentes:** IBM Plex Sans e IBM Plex Mono, con `@expo-google-fonts/ibm-plex-sans` (400, 500, 600) e `ibm-plex-mono` (400, 500). En React Native, con fuentes propias cada peso es una familia distinta, así que los estilos de texto mapean el peso a la familia (`fontFamilies` en `src/theme/fontFamilies.ts`: `IBMPlexSans_400Regular`, `IBMPlexSans_500Medium`, `IBMPlexSans_600SemiBold`, `IBMPlexMono_400Regular`, `IBMPlexMono_500Medium`) y no usan `fontWeight`. Se usan **ambos mecanismos**: el plugin `expo-font` de `app.json` incrusta los cinco `.ttf` en el build, y además `app/_layout.tsx` los carga con `useFonts(fontAssets)` (`src/theme/fontAssets.ts`) para que los nombres de familia sean deterministas e iguales en iOS y Android (con solo el plugin, iOS puede registrar el nombre PostScript del `.ttf`, p. ej. `IBMPlexSans-Regular`). NO VERIFICADO en dispositivo: que los nombres resultantes sean los esperados en iOS (pendiente de development build).
- **Primitivas** (`src/components/ui/ds/`; se hacen antes que las pantallas): Text (variant), Amount (mono, con signo y color de señal), Button (primary/ghost/danger), Widget (radio md, borde, sin sombra; variante hero con radio lg), InviteCard (borde punteado), Input, MoneyInput, Pill, SegmentedControl, ProgressBar, Sheet (radio lg + shadowSheet), ListRow y AccountPicker. Ninguna importa el `colors` estático: todas usan `useTheme`.
- **Moneda: un único formateador.** `formatCOP` de `src/domain/money.ts` es el único formateador de pesos del proyecto. Opera en **unidades menores**, es manual (sin `Intl`: puede no estar completo en Hermes) y produce `$1.234.567` **sin espacio** tras el `$` (fiel al diseño, que usa `toLocaleString('es-CO')`) y `-$50.000` para negativos; los centavos se redondean al peso. `Amount`, `MoneyInput` y `AccountPicker` reciben unidades menores y lo usan; ningún componente de UI formatea pesos por su cuenta, y `test/unit/theme/ui-utils.test.ts` lo impide (prohíbe en `ds/` `toLocaleString`, `Intl.NumberFormat`, `.toFixed(`, `formatCurrency`, `groupThousands`, plantillas con `$` literal y `'$' +`, y exige que `AccountPicker`, `MoneyInput` y `utils` importen `formatCOP`). `parsePesos` acepta con y sin espacio tras el `$`. **Homonimia (VERIFICADO EN CÓDIGO 2026-10-07):** existe OTRA función `formatCOP(amount: number)` en `src/domain/utils/currency.ts`. Es código **viejo**: recibe **pesos** (no unidades menores), usa `Intl.NumberFormat` y su docblock da `"$-50.000"` para negativos. La usan pantallas y componentes antiguos (por ejemplo `src/components/forms/AmountInput.tsx`, `AccountPicker.tsx` y `PocketPicker.tsx`). La homonimia se resuelve en F6 al retirar `src/domain/utils/`. **El código nuevo debe importar siempre `formatCOP` de `src/domain/money`**, nunca de `utils/currency`. Los demás formateadores viejos (`formatCOPShort`, etc.) y los de las pantallas antiguas se retiran también en F6.
- **`MoneyInput`:** `value` y `onChangeValue` son `Minor | null`; interpreta solo los dígitos escritos como pesos enteros (el MVP no tiene decimales). Emite `null` si el valor desborda el rango entero seguro (14 dígitos). **Hallazgo menor:** en ese caso el campo se vacía en lugar de ignorar el dígito que desborda. Además, el borrado de un separador "." es un no-op lógico (el texto se vuelve a formatear): **pendiente de probar en dispositivo**.
- **Migración incremental:**
  1. **Shim:** `src/theme/colors.ts` mantiene sus nombres viejos pero apunta a la paleta nueva clara y estática (bg → surfacePage, surface1 → surfaceCard, textPrimary → inkPrimary, accentGreen → signalGrowth, accentRed → signalDebt, accentBlue → brandPrimary, accentAmber → signalGoal, **accentYellow → signalGoal**, accentPurple → brandPrimary). Así todas las pantallas viejas cambian de aspecto sin tocarlas y desaparecen los `undefined`.
  2. ESLint `no-restricted-imports` sobre `colors` en modo warn; cuenta pendientes sin bloquear (estado actual: sigue en `warn`).
  3. Cada pantalla rehecha usa solo `useTheme` y primitivas.
  4. Cuando la cuenta de usos llega a 0, se borra el shim y la regla pasa a error.

  Como la mayoría de las pantallas viejas se retiran (sección 6), el shim vive poco. **Tratamiento de accentYellow:** no se crea el token. Su uso semántico (advertencia o "en progreso") no existe en el sistema de diseño. En el shim se aproxima con signalGoal y desaparece con las pantallas que lo usan (budget, card, pay-installment, gauge, pockets).
- **Limitación mientras dure la migración:** el shim es estático (claro) y no sigue el modo oscuro. Es aceptable durante el desarrollo, pero no para publicar.
- **Inicio de la app:** el color de fondo de la pantalla de inicio en `app.json` ya es `#F3F6F4` (surfacePage claro; antes `#208AEF`). `userInterfaceStyle: automatic` ya está.

---

## 6. Mapa de pantallas y navegación

**Navegación:** el diseño **no tiene tab bar**. El Dashboard es el centro, con un botón de Ajustes, "Ver todas", "Ver detalle" y un botón flotante para agregar transacción. Se elimina `app/(tabs)` y se usa un **Stack raíz**. El onboarding se protege con el guard de expo-router (`Stack.Protected guard={onboardingDone}`) en lugar del `useEffect` con `router.replace` actual, que es frágil. VERIFICADO (2026-10-03): `Stack.Protected` con `guard` existe en expo-router 56.2. Las hojas (confirmación, pago, aporte) usan `presentation: 'formSheet'` (con `sheetAllowedDetents`) o `'modal'`. VERIFICADO (2026-10-03): `presentation: 'formSheet'` con `sheetAllowedDetents` existe en expo-router 56.2.

| # | Pantalla del diseño | Ruta nueva | Origen en el repo | Acción |
|---|---|---|---|---|
| 1 | Dashboard | `app/(app)/index.tsx` | `(tabs)/index.tsx` | Rehacer |
| 2 | Detalle de cuenta | `app/(app)/accounts/[id].tsx` | `accounts/[id].tsx` | Rehacer |
| 3 | Agregar cuenta | `app/(app)/accounts/new.tsx` | `(modals)/add-account.tsx` | Rehacer |
| 4 | Cashflow (detalle) | `app/(app)/cashflow.tsx` | `cashflow/index.tsx` | Rehacer |
| 5 | Deudas (lista, edición en línea) | `app/(app)/debts/index.tsx` | `debt/index.tsx` | Rehacer |
| 6 | Registrar pago de deuda | `app/(app)/debts/[id]/pay.tsx` (params: type, occurrence) | `debt/pay-installment.tsx` | Rehacer |
| 7 | Agregar deuda | `app/(app)/debts/new.tsx` | `debt/add-card.tsx`, `add-loan.tsx` | Crear (las dos viejas se retiran); con campo de fecha de pago opcional (D7); texto: "Calculamos la tasa con la fórmula estándar de amortización." |
| 8 | Metas (lista) | `app/(app)/goals/index.tsx` | `pockets/index.tsx` | Crear (pockets se retira) |
| 9 | Crear meta | `app/(app)/goals/new.tsx` | — | Crear |
| 10 | Agregar a meta | `app/(app)/goals/[id]/contribute.tsx` | `pockets/add-funds.tsx` | Crear (la vieja se retira) |
| 11 | Transacciones (lista) | `app/(app)/transactions/index.tsx` | `(tabs)/transactions.tsx` | Rehacer |
| 12 | Detalle de transacción | `app/(app)/transactions/[id].tsx` | `(modals)/transaction-detail.tsx` | Rehacer |
| 13 | Agregar transacción | `app/(app)/transactions/new.tsx` (params: type, passive) | `(modals)/add-transaction.tsx` | Rehacer |
| 14 | Agregar recurrente | `app/(app)/recurring/new.tsx` | — | Crear. **Debe pedir la cuenta predeterminada (`defaultAccountId`)**, campo que no estaba en el diseño original (D8). Si el recurrente es quincenal (días 15 y último día del mes), debe llamar a `normalizeAnchor(fecha, frecuencia)` **en vivo** y mostrar el ajuste de la primera fecha a la más cercana válida (en empate, la posterior) mientras el usuario elige, nunca en silencio tras guardar (3.4; ambigüedad resuelta por el usuario) |
| 15 | Ajustes | `app/(app)/settings.tsx` | `(tabs)/settings.tsx`, `settings/*` | Rehacer en una sola pantalla |
| + | Hoja de confirmación de pago ("Ya pagué") | `app/(app)/recurring/[id]/confirm.tsx` (param: occurrence) | — | Crear. Con **selector de cuenta**, que el diseño no muestra: siempre pide cuenta y preselecciona la predeterminada del recurrente (D8) |
| + | Onboarding: Cuentas, Flujo, Invitación, Todo listo | `app/onboarding/{accounts,flow,widgets,done}.tsx` | `(auth)/onboarding/*` | Rehacer; se pasa de `(auth)` a `onboarding`. Pasos y rutas: `accounts`, `flow`, `widgets`, `done` bajo `app/onboarding/`. Paso 2 (Flujo): el mockup y F5b-1 permiten solo UN ingreso y UN gasto recurrentes, ambos opcionales, con nombre, monto aproximado y frecuencia Semanal/Quincenal/Mensual (A11); sin fecha ni pasivo en F5b-1 (A12). El paso 2 **no** admite fecha opcional en F5b-1 (A12, decisión 46): la fecha se completa en Recurrentes (F5b-3) |

**Se retiran:** `(tabs)/*`, `(modals)/category-detail` (las categorías se crean en línea), `settings/{categories,distribution,appearance,notifications,index}`, `pockets/*`, `debt/card/[id]`, `debt/loan/[id]` y los `_layout` correspondientes.

**Contratos de F5 que salen de las reglas de cuentas archivadas (3.4), todavía sin pantalla:**
- **Desarchivar:** al recibir `AccountArchivedError`, la UI ofrece "Desarchivar" con `AccountService.unarchive(error.accountId)` y reintenta. `accounts.summary()` solo lista cuentas activas; el id de la archivada viene de `AccountArchivedError.accountId` (una lista de cuentas archivadas para desarchivar desde Ajustes no está definida: decisión de producto pendiente).
- **Eliminar una meta:** la pantalla llama primero a `GoalService.refundPreview(id)`; si `requiresDestinationMinor > 0`, muestra el desglose (`refunds` con `accountArchived`) y pide elegir una **cuenta activa** de destino, y luego llama a `GoalService.remove(id, { refundAccountId })`. Si recibe `RefundAccountRequiredError`, vuelve a pedir la cuenta (`invalidAccountId` indica la que no sirvió).

"Cerrar sesión" aparece en Ajustes según el spec, pero no hay autenticación (`default-user`). Se oculta en el MVP (D19).

---

## 7. Notificaciones y recurrentes

- **Plan puro** (`domain/rules/notificationPlan.ts`, implementado en F2a y probado en `test/unit/rules/notificationPlan.test.ts`; la entrada la prepara `RecurringService.pendingOccurrences()`): a partir de los recurrentes pendientes, los ajustes y `now` produce las notificaciones deseadas, con identificadores deterministas:
  - `rec:{id}:{occ}:pre`: 2 días antes a `reminderHour`. Texto: "Tu pago de X vence en 2 días".
  - `rec:{id}:{occ}:due`: el día del vencimiento. Texto: "¿Ya pagaste X?" con categoría de acciones.
  - `rec:{id}:{occ}:snooze` si hay `snoozedUntil` en el futuro.
  - `weekly-summary`: disparador semanal, domingo a las 19:00 con texto genérico, porque el contenido se calcularía al programar y quedaría desactualizado (D15). **Título: «Tu resumen semanal está listo»** (decisión del usuario, 2026-10-07; punto 31 de 10.2; VERIFICADO EN CÓDIGO: `notificationPlan.ts`).
  - Ingresos: se incluyen con el texto "¿Ya recibiste X?" (D15).
  - **Decisiones confirmadas por el usuario el 2026-10-08** (puntos 34 a 37 de 10.2; antes eran 4 SUPUESTOS diferidos a F4). La cabecera de `notificationPlan.ts` ya las cita (junto con la decisión 31):
    1. Los avisos de ingresos recurrentes solo avisan el día del vencimiento (`due`, más snooze); no hay `pre`.
    2. Un solo interruptor en Ajustes apaga juntos los avisos de pago y de ingreso; su etiqueta pasa de «Recordatorio de pagos» a «Recordatorios de pagos y cobros» (la etiqueta **no existe en código**: es de F5b, Ajustes).
    3. Un snooze diario no se duplica con el `pre` ni con el `due` del mismo día.
    4. Con tope de notificaciones, el resumen semanal se reserva primero y el resto se prioriza por cercanía de fecha.
- **Adaptador implementado en F4** (`src/platform/notifications.ts`, probado en `test/unit/platform/notifications.test.ts`, 17 tests en F4, más 4 de F4-fix; commits `a1556fc` y `3642b5f`). Expone `setupNotifications`, `ensureNotificationPermission`, `reconcile` y `subscribeToNotificationResponses` (con arranque en frío). `reconcile` es idempotente por una huella (`ffSignature`) y solo toca los ids `rec:*` y `weekly-summary`. El adaptador no está conectado al arranque de la app (ver F4-integración en [Pendientes](#pendientes-para-la-próxima-sesión)); lo pendiente de dispositivo está en esa misma subsección. La fuente de la API fueron los tipos instalados de expo-notifications 56.0.18. Descripción del diseño:
- **Adaptador** (`platform/notifications.ts`): `reconcile()` compara lo programado (`getAllScheduledNotificationsAsync`) con lo deseado, cancela lo que sobra y programa lo que falta. Es idempotente. Se llama al iniciar, al volver a primer plano (AppState), después de cualquier comando que afecte recurrentes o deudas y al cambiar ajustes. Reemplaza `rescheduleAll`, que cancelaba todo cada vez. Las llamadas descritas son el diseño; su conexión al arranque está pendiente (F4-integración).
- **Límite de iOS:** unas 64 notificaciones locales pendientes (límite de la plataforma). VERIFICADO (2026-10-03). El plan prioriza las más cercanas.
- **Respuesta:** `addNotificationResponseReceivedListener` + `getLastNotificationResponseAsync` para el arranque en frío. "Ya pagué" o tocar la notificación abre `/recurring/[id]/confirm?occurrence=…`, o `/debts/[debtId]/pay?type=INSTALLMENT&occurrence=…` si es una cuota de deuda. No se confirma en segundo plano porque hace falta elegir cuenta (la hoja siempre pide cuenta; D8). "Todavía no" llama a `RecurringService.snooze` y luego a `reconcile`.
  - VERIFICADO (2026-10-03): existen los triggers DATE y WEEKLY, `setNotificationCategoryAsync`, `getLastNotificationResponseAsync` y el plugin `expo-notifications`.
  - NO VERIFICADO: el comportamiento del arranque en frío de las notificaciones; las acciones de categoría en Expo Go; el comportamiento sobre dispositivo; si una acción en segundo plano ejecuta JS en iOS y Android; `opensAppToForeground`.
- **Política de "recuérdamelo luego" (D5):**
  - `snoozedUntil` = día siguiente a `reminderHour`.
  - Se repite cada día mientras siga sin pagar, hasta 7 días después del vencimiento.
  - Después no hay más avisos, y el ítem queda como "Vencido" en Próximos pagos hasta que el usuario lo confirme.
  - Nunca se marca solo.
- **Permisos:** se piden al crear el primer recurrente con fecha o al activar el interruptor en Ajustes, no al arrancar. Android 13+ necesita POST_NOTIFICATIONS y un canal. El plugin `expo-notifications` **ya está en `app.json`** (añadido en F0; VERIFICADO EN CÓDIGO 2026-10-07 sin opciones de canal ni de icono: la configuración del canal de Android y de los permisos sigue pendiente de F4). Se necesita un development build para probar el plugin y las acciones (VERIFICADO 2026-10-03). [EXPO-DOC: canales de Android y POST_NOTIFICATIONS en v56.]
- Desactivar recordatorios cancela `rec:*`; desactivar el resumen cancela `weekly-summary`.
- **Recurrentes quincenales:** las fechas de vencimiento de un recurrente BIWEEKLY son los días 15 y último día del mes (D6; la primera fecha ya viene normalizada por el servicio, ver 3.4); los identificadores `rec:{id}:{occ}:*` usan la fecha de la ocurrencia resultante.

---

## 8. Estrategia de pruebas

- **Pruebas sobre SQLite real en node:** `better-sqlite3` (13.0.3 en `package.json`) en memoria + `drizzle-orm/better-sqlite3` + migrador con la **misma carpeta** de migraciones. `createTestDb()` (`test/helpers/db.ts`) devuelve `{ db, sqlite, close }` sobre una BD nueva por test y ejecuta `PRAGMA foreign_keys = ON` de forma explícita (better-sqlite3 lo trae activo; expo-sqlite no). `setup()` (`test/integration/domain/_helpers.ts`) añade la semilla y `createDomain(db, { now })` con un **reloj controlado** (base: 2026-03-10 12:00 local).
  - No hace falta simular expo-sqlite, porque el dominio nunca importa `client.ts`. El alias de `expo-sqlite` y `test/mocks/expo-sqlite.ts` siguen en `vitest.config.ts`: son un resto que se retira en F6.
  - **Gestor de paquetes: `npm`** (el repo contiene `package-lock.json` y no `pnpm-lock.yaml`; los scripts se ejecutan con `npm run ...`). La compilación nativa de better-sqlite3 no requiere configuración adicional de `pnpm`. Alternativa sin compilación, no usada: `sql.js` (WASM) con el driver sql-js de drizzle.
  - Riesgo: diferencias de versión de SQLite entre expo-sqlite y better-sqlite3 (3.50.3 y 3.53.4 según el informe; ver 3.5 por `RETURNING`). Mitigación: no usar funciones exóticas.
  - `vitest.config.ts` fuerza `TZ=America/Bogota` (`env: { TZ }`), toma `test/**/*.test.ts` y usa `globals: true`, entorno `node`.
- **Helpers de integración** (`test/integration/domain/_helpers.ts`): `setup`, `expectIntegrity` (comprueba I1 a I6 con `IntegrityService`), `mkAccount`, `available`, `count`, `localMs`, `thrown`, `failOn` y `clearFail` (triggers `RAISE(ABORT)` para forzar fallos), `snapshot` (foto completa, todas las columnas, de las **9 tablas**: para probar "sin efectos") y `secondUserDomain` (crea un segundo usuario por SQL y devuelve un dominio que opera como él sobre la misma BD y el mismo reloj).
- **Estructura de `test/`:**
  - `test/unit/rules/**`: reglas puras (`amortization`, `dates`, `goalEta`, `money`, `notificationPlan`, `recurrence`, `statement`).
  - `test/unit/theme/**`: tema (`tokens`, `scheme`, `shadow`, `fonts`, `colors-shim`, `ui-utils`: incluye la prohibición de formatear pesos en `ds/`).
  - `test/helpers/repositoryAst.ts`: analizador AST de la guarda estructural (reglas R1-R6 y S1-S2, límites en 3.5). Es un helper, no un archivo de tests.
  - `test/unit/repositoryOwnership.test.ts`: guarda estructural de repositorios y de los `insert` de servicios (3.5); 104 tests.
  - `test/integration/schema/**`: CHECK, UNIQUE y migración + semilla (`transactions`, `other_tables`, `migrations_seed`).
  - `test/integration/domain/**`: servicios sobre SQLite real: `accounts_transactions`, `debt_payments`, `goals`, `recurring`, `settings_onboarding`, `reports`, `integrity`, `atomicity` (triggers `RAISE(ABORT)`), `validation_order` (orden documentado de validaciones), `local_dates` (años < 100 en el borde), `unarchive`, `corrections` (pasada F2b-bis), `goals_refund_eta` y `goal_refund_edges` (redirección al eliminar metas y ETA), `ownership` (ids de otro usuario en todos los puntos de entrada).
  - `test/integration/repositories/ownership.test.ts`: propiedad por repositorio, llamando a los repositorios directamente; 109 tests.
  - `test/property/**`: prueba aleatoria con modelo de referencia independiente (ver abajo).
- **Cifras de la suite** en el último punto verificado: **34 archivos y 769 tests** (de ellos, 104 son de `test/unit/repositoryOwnership.test.ts` y 109 de `test/integration/repositories/ownership.test.ts`). La suite normal tarda unos 43 s (antes unos 39 s: el coste de la guarda por AST y de los 92 casos de repositorio). Cifras tomadas del informe de verificación de la guarda; los 34 archivos coinciden con los `*.test.ts` en disco, pero los totales de tests y los tiempos no se re-ejecutaron al escribir este documento.
- **Escenarios de la regla central** (de extremo a extremo sobre los servicios reales, verificando saldos derivados y reporte):
  1. Pagar una cuota: baja la cuenta, el gasto de deuda del mes sube y el de vida no, baja la deuda, sube paidCount y avanza el recurrente.
  2. Abono mayor al saldo: la deuda queda en 0, el gasto es el monto completo y el capital aplicado es igual al saldo.
  3. Aporte desde dos cuentas: baja el disponible de cada una, no hay transacción y el reporte no cambia.
  4. Cerrar meta: `gastoMetas` del mes sube por el saved, una sola vez, y `gastoTotal` sube en el mismo monto (el Índice baja en el mes del cierre); las cuentas no cambian; un segundo intento de cierre falla; aportes y ajustes de una meta gastada se rechazan.
  5. Los ajustes no cuentan en el reporte y guardan anterior, nuevo y diferencia.
  6. Eliminar una transacción revierte el disponible, la deuda, paidCount y el recurrente.
  7. Confirmar dos veces la misma ocurrencia falla por el UNIQUE.
  8. Confirmar por el camino genérico un recurrente de deuda lanza `UseDebtPaymentFlow`.
  9. Flags de widgets en tres estados.
  10. Onboarding atómico: forzar un fallo de CHECK a mitad y comprobar que no queda nada.
  11. Renombrar una cuenta se refleja en sus transacciones.
  12. Borrar una meta activa devuelve el dinero a cada cuenta de origen.
  13. Archivar una cuenta crea el ajuste de cierre.
  14. Confirmar una ocurrencia exige cuenta; sin `accountId` se rechaza.
  15. Eliminar una transacción de una cuenta archivada se rechaza con `AccountArchivedError` (`remove`, `unconfirm` y borrado de un pago de deuda); `unarchive` quita `archivedAt` sin ajustes nuevos.
  16. Eliminar una meta activa con aportes de cuentas archivadas exige una cuenta activa de destino: crea los `ARCHIVE_CLOSE` y el `MANUAL` en una transacción y sin destino válido lanza `RefundAccountRequiredError`.
  17. Un id de otro usuario es `NotFoundError` y deja la BD idéntica (`snapshot`).
- **Invariantes:** se comprueba I1–I6 después de cada escenario (`expectIntegrity`).
- **Prueba aleatoria con modelo de referencia independiente (`test/property/**`).** Sustituye a la idea original de `fast-check` (no se añadió esa dependencia). Por cada semilla se crea una BD en memoria con **dos usuarios** (el principal y "otro", con datos de todas las clases) y se ejecutan N operaciones aleatorias sobre los servicios de dominio. Un modelo propio (libro mayor, calendario, series y ETA con `BigInt`: `model.ts` y `calendar.ts`) **no reutiliza ningún código de `src/domain/rules`** y predice el resultado de cada operación:
  - Si la operación es **aceptada**, compara el estado completo (`accounts.summary/get`, `debts.list`, `goals.list/get` con `eta`, `reports.monthStatement/netWorth`, `recurring.list/upcoming` e `IntegrityService.check`) y que el otro usuario no cambie ni se mezcle.
  - Si es **rechazada**, debe lanzar el error tipado que predice el modelo y dejar las 9 tablas idénticas.
  - Incluye ids de otro usuario en todas las clases de operación (el modelo los trata como inexistentes).
  - **Determinista:** semillas fijas, reloj inyectado, `TZ=America/Bogota`; nada depende de `Date.now()` ni de `Math.random()`. Reproducible con `FUZZ_REPRO=<semilla>:<longitud> npx vitest run test/property` (ejecuta solo esa secuencia e imprime su traza); `FUZZ_STATS=1` imprime el desglose por tipo, código y cobertura.
  - **Modo corto** (por defecto, dentro de la suite normal, `npx vitest run test/property`): 24 secuencias × 40 operaciones, unos 10 s. **Modo completo** (`npm run test:property`, que fija `FUZZ_FULL=1`; el script usa sintaxis de shell POSIX): 300 secuencias × 60 operaciones más 5 × 1000, unos 7 minutos (419 s); la última corrida registrada fue de 22.286 operaciones (17.311 + 4.975) y 0 divergencias (cifras del informe de verificación; no repetidas al escribir este documento).
  - Límite: es una prueba por muestreo; no prueba ausencia de errores. El calendario del modelo asume UTC-5 (Bogotá).
- **Reglas puras:**
  - Bisección contra valores conocidos (saldo 1.200.000, cuota 180.000, 10 meses).
  - Recurrencia: día 31, febrero, años bisiestos, semanal y quincenal. Quincenal (D6): la secuencia es 15 → último día del mes → 15 del mes siguiente, con último día 28, 29, 30 o 31 según el mes (febrero normal y bisiesto incluidos); se verifica explícitamente que **no** avanza +14 días. Primera fecha: `nearestBiweeklyDate` y `normalizeAnchor` (ajuste al más cercano, empate a la fecha posterior) e `isOccurrenceOfSeries`.
  - ETA (`goalEta`): precedencia, ventana de ritmo, tope de 1200 meses y casos de fechas inválidas.
  - Moneda: `formatCOP` sin espacio, negativos, redondeo al peso y rango seguro; `parsePesos` con y sin espacio tras el `$`.
  - Límites de mes con `TZ=America/Bogota` fijado en la config de vitest.
  - Plan de notificaciones: pre, due, snooze, tope de 7 días, toggles apagados, deuda liquidada excluida.
- **Fuera de vitest:** los adaptadores Expo (notificaciones, fuentes) y las pantallas se validan a mano en un development build. Opcional: tests de componentes con jest-expo, que queda fuera del MVP.
- **Lecciones de verificación (herramientas):**
  - `expo export` exige `--clear` al verificar el bundle.
  - La base de errores de `tsc` varía (362 a 364 en su momento) si faltan `.expo/types` y `expo-env.d.ts` (archivos generados). La cifra actual del informe es 276 `error TS` en la base (todos de imports a módulos retirados hasta F5/F6; ver Estado de implementación).
  - `npm run lint` (`expo lint`) usa caché y **subestima** los errores: usar `--no-cache` al verificar.
  - `vitest.config.ts` fuerza `TZ=America/Bogota`; ejecutar los tests sin esa configuración daría fechas distintas.

---

## 9. Plan por fases

| Fase | Especialista | Contenido | Depende de | Archivos que toca |
|---|---|---|---|---|
| F0 Higiene | devops | `.gitignore` (+`.opencode/`, `.claude/pipeline-state.json`), versionar `eslint.config.js`, decidir qué hacer con el trabajo sin commit (resuelto: el tag `pre-mvp` existe, sobre el commit `e7fd4a5`), dependencias (better-sqlite3, babel-plugin-inline-import, fuentes Plex, retirar tamagui/victory-native), `babel.config.js`, `metro.config.js`, `drizzle.config.ts` con driver expo, plugins de `app.json` (expo-notifications, fuentes, color de inicio), `vitest.config.ts`, script `db:check` | — | Solo configuración en la raíz |
| F1 Datos | data-engineer | `schema.ts` nuevo, borrar migraciones viejas y regenerar `0000`, `client.ts` (PRAGMA, nombre nuevo), `initialize.ts`, semilla de categorías, helper de BD para tests | F0 | `src/database/**`, `test/helpers/db.ts` |
| F2a Reglas puras | backend-coder | money, dates, amortization, recurrence, statement, notificationPlan + tests | F0 (en paralelo con F1) | `src/domain/rules/**`, `src/domain/{money,dates}.ts`, `test/unit/rules/**` |
| F2b Dominio | backend-coder | Repositorios, servicios, `createDomain`, IntegrityService, tests de integración y prueba aleatoria; retirar servicios y repositorios viejos (los comandos con efectos de `src/app-services/**` no se hicieron en F2b: ver notas de alcance) | F1, F2a | `src/database/repositories/**`, `src/domain/services/**`, `src/app-services/**`, `test/integration/**` |
| F3 Tema | frontend-coder | tokens, ThemeProvider, fuentes, primitivas, shim de `colors`, regla ESLint; dueño de `app/_layout.tsx` (proveedores, splash, init) | F0 (en paralelo con F1 y F2) | `src/theme/**`, `src/components/ui/**`, `app/_layout.tsx`, `eslint.config.js` (solo la regla) |
| F4 Plataforma | mobile-coder | Adaptador de notificaciones (reconcile, categorías, listener de respuesta, permisos, canal Android) | F2a (plan), F2b (upcoming, snooze) | `src/platform/**` |
| F5a Navegación y Dashboard | frontend-coder | Borrar `(tabs)`, crear `(app)/_layout` y onboarding con guard, Dashboard, stores y hooks base | F2b, F3 | `app/(app)/_layout.tsx`, `app/(app)/index.tsx`, `app/onboarding/**`, `src/store/**`, `src/hooks/index.ts` |
| F5b Funcionalidades (en paralelo, por carpetas) | frontend-coder / mobile-coder | (i) cuentas y transacciones; (ii) deudas; (iii) metas; (iv) recurrentes, hoja de confirmación y ajustes (con F4); (v) cashflow (ciclo propio F5b-5, al final de F5b, después de F5b-1 a F5b-4) | F5a | Cada subequipo es dueño de su carpeta `app/(app)/<x>/**` y de su `src/hooks/use<X>.ts` |
| F6 Limpieza | backend-coder + frontend-coder | Borrar shim, pantallas, hooks y tests viejos; ESLint en error | F5b | Lo retirado |

**Paralelización segura:** F1 ∥ F2a ∥ F3; F4 ∥ F5a; los cinco subequipos de F5b entre sí. **Archivos compartidos con un solo dueño:** `src/hooks/index.ts` (F5a; los subequipos importan directamente su hook en vez de editar el barrel), `app/_layout.tsx` (F3), `app.json`, `package.json` y la config (F0; quien necesite una dependencia la pide a devops).

El estado actual de cada fase está en [Estado de implementación](#estado-de-implementación).

**Notas de alcance respecto de la tabla (estado real a 2026-10-07):**
- F2b entregó repositorios, servicios, `createDomain` e `IntegrityService` con sus tests, pero **no** `src/app-services/**` (comandos que ejecutan los efectos tras el COMMIT); esa capa se creó en F5a (`5768984`). Los servicios devuelven `effects`, que esa capa ejecuta.
- F4 y F5a se implementaron en el ciclo del 2026-10-08 (ver [Estado de implementación](#estado-de-implementación)); F5a también tocó `app/_layout.tsx`, dueño original F3.
- Los servicios y repositorios viejos que dependían de tablas retiradas ya no existen en `src/`, pero los hooks y pantallas antiguos todavía los importan hasta F5/F6 (ver el estado del árbol en [Estado de implementación](#estado-de-implementación)).
- F3 dejó el shim de `colors` y la regla de ESLint en `warn`; ambos se retiran en F6.

---

## 10. Riesgos, decisiones aprobadas y verificaciones de Expo

### 10.1 Riesgos arquitectónicos

- **R1. RESUELTO (VERIFICADO 2026-10-03).** Transacciones con el driver drizzle expo-sqlite: `db.transaction` es síncrona (ver 3.4). Se descarta `withExclusiveTransactionAsync`.
- **R2. RESUELTO (VERIFICADO 2026-10-03).** Inline de `.sql` en Metro con SDK 56: drizzle-kit con `driver: 'expo'` genera `migrations.js`, con `babel-plugin-inline-import` y `sourceExts` con `'sql'` (ya configurados). Ver 4.4.
- **R3.** Rendimiento de los saldos derivados con muchos movimientos. Para un usuario individual es despreciable: consultas agregadas con índices. Si creciera, se puede materializar después sin cambiar los contratos.
- **R4.** Modelo de deuda sin interés devengado: el saldo puede diferir del extracto. Se mitiga con ajustes.
- **R5.** Cola de notificaciones en iOS (límite de ~64, VERIFICADO 2026-10-03) y comportamiento de las acciones en segundo plano (NO VERIFICADO).
- **R6.** Shim de tema estático: el modo oscuro queda roto en las pantallas viejas mientras dure la migración. Se mitiga con la regla de ESLint y F6 como requisito para publicar.
- **R7.** Diferencias entre la SQLite de tests y la de los dispositivos.
- **R8.** El trabajo sin commit (onboarding, budget, settings, debt detail) choca con este diseño. **Mitigado:** el commit `e7fd4a5` ("snapshot pre-mvp") y el tag `pre-mvp` conservan el estado previo al rediseño.
- **R9.** El target web (`app.json` con web output static) con expo-sqlite no está cubierto. SUPUESTO: el MVP es solo iOS y Android.
- **R10.** `UPDATE/DELETE ... RETURNING` en expo-sqlite (la propiedad del usuario en los repositorios depende de ello; 3.5). Requiere SQLite ≥ 3.35 (el paquete trae 3.50.3 según el informe). NO probado en dispositivo. Plan B: `run()` y `changes`. Tampoco están probados en dispositivo los triggers de `0001_owner_triggers.sql` (3.5).
- **R11.** (Mitigado, 2026-10-18.) Las FK de la BD no incluyen `userId`, pero los triggers de `0001_owner_triggers.sql` rechazan una referencia a una fila de otro usuario y cualquier cambio de `user_id` (3.5). Primera defensa: la validación de todos los ids embebidos en los servicios y la guarda estructural.
- **R12.** Las guardas estructurales verifican forma, no semántica: la guarda de repositorios (AST) comprueba que el `where` referencia `userId`, no que el filtro sea correcto (límites completos en 3.5, incluida su dependencia de `parseDiagnostics`, API interna de TypeScript); lo cubren los tests de comportamiento y la prueba aleatoria (por muestreo).
- **R13.** Estado del árbol: hooks y componentes antiguos siguen importando módulos retirados y hay errores `tsc` y lint preexistentes (tsc 90 errores, eslint 126 problemas). Las 12 rutas antiguas rotas se aparcaron en `_parked/`, por lo que el bundle compila (`expo export --platform android`); ver [Estado de implementación](#estado-de-implementación).
- **R14.** Versiones de Expo desalineadas (14 paquetes) y `async-storage` 3.1.1 frente a la 2.2.0 esperada por el SDK: pendiente de alinear antes de probar en dispositivo (según el informe de verificación; no se volvió a ejecutar la comprobación).

### 10.2 Decisiones aprobadas

Fecha de aprobación de los puntos 1 a 20: **2026-10-03**. Quedan todos aprobados, con las correcciones de los puntos 6 y 8. Los puntos 21 a 32 son decisiones posteriores del usuario (2026-10-04 a 2026-10-07; la fecha exacta de cada una no está registrada, salvo los puntos 29 a 32, que son del 2026-10-07) y se añaden sin borrar las anteriores.

1. `gastoMetas` (metas cerradas) entra en el gasto total y en el denominador del Índice (`gastoTotal = gastoVida + gastoDeuda + gastoMetas`).
2. Eliminar una cuenta con movimientos la archiva y crea un ajuste a 0; sin movimientos se borra de verdad.
3. Eliminar una deuda con pagos la archiva y conserva los pagos como gasto; sin pagos se borra de verdad.
4. Eliminar una meta activa devuelve cada aporte a su cuenta; las metas gastadas no se pueden eliminar. (Ampliado por el punto 23: los aportes de cuentas archivadas se redirigen a una cuenta activa elegida por el usuario.)
5. Política de "recuérdamelo luego": un aviso diario a `reminderHour`, hasta 7 días después del vencimiento.
6. "Quincenal" (BIWEEKLY) = los días 15 y último día del mes. No es cada 14 días. (Completado por el punto 21: qué pasa con la primera fecha.)
7. "Agregar deuda" y el paso 2 del onboarding necesitan un campo de fecha (opcional); sin fecha no hay recordatorios. Precisión (2026-10-08, decisión 46 / A12): en F5b-1 el paso 2 no incluye el campo; la fecha se completa en Recurrentes (F5b-3).
8. La hoja "Ya pagué" incluye un selector de cuenta, preseleccionando la cuenta predeterminada del recurrente. La pantalla "Agregar recurrente" debe pedir esa cuenta predeterminada (`defaultAccountId`).
9. Sin transferencias entre cuentas ni edición de transacciones en el MVP.
10. Los widgets se activan solo con la primera entidad (estado NULL), no con cada alta como en el prototipo.
11. Cerrar una meta exige saved ≥ objetivo.
12. No se puede aportar más que el disponible de la cuenta; las cuentas sí pueden quedar negativas por gastos.
13. Pagar una deuda con saldo 0 se rechaza.
14. Desmarcar un pago en Próximos pagos borra su transacción.
15. Los ingresos recurrentes también notifican; el resumen semanal es genérico (domingo a las 19:00).
16. La proyección de deuda usa la tasa cuando la hay.
17. Montos en unidades menores (×100) y solo COP en el MVP.
18. Se retiran institution, color e icon de cuentas, y cupo, corte y pago mínimo de tarjetas.
19. Se oculta "Cerrar sesión".
20. El ETA de una meta se calcula con el promedio de aportes de los últimos 3 meses, o con la fecha objetivo si existe. (Definiciones y tope: punto 25 y 3.7.)

**Decisiones posteriores (2026-10-04 a 2026-10-07):**

21. **Quincenal: primera fecha.** Si la primera fecha elegida no es el 15 ni el último día del mes, se ajusta a la fecha válida más cercana (`nearestBiweeklyDate`); en empate gana la fecha posterior (CONFIRMADA por el usuario). Solo hay dos empates (día 23 en meses de 31 días y día 22 de febrero bisiesto). La pantalla muestra el ajuste en vivo con `normalizeAnchor`; los servicios guardan el ancla normalizada. Resuelve la ambigüedad que este documento marcaba como abierta en 3.4 y en la fila 14 de la sección 6.
22. **Formateador de moneda único:** `formatCOP` de `src/domain/money.ts` (unidades menores, manual, sin `Intl`), `$1.234.567` sin espacio y `-$50.000`. Ningún componente formatea pesos por su cuenta (un test lo impide). Los formateadores viejos, incluida la `formatCOP` homónima de `src/domain/utils/currency.ts` (pesos), se retiran en F6 (ver 5).
23. **Cuentas archivadas:** (a) una cuenta archivada no cambia de saldo por ningún motivo: borrar una transacción suya se rechaza con `AccountArchivedError` (como crear, ajustar, aportar, pagar y confirmar); (b) eliminar una meta activa con aportes de cuentas archivadas no se bloquea: el usuario elige una cuenta activa de destino (`remove(id, { refundAccountId? })`; sin destino válido, `RefundAccountRequiredError`); (c) los aportes de cuentas activas vuelven a su origen sin pedir nada.
24. **`AccountService.unarchive(id)`:** quita `archivedAt` sin ajustes nuevos. DESCARTADO por el usuario: desarchivar automáticamente.
25. **Tope del ETA por ritmo (100 años) y definiciones del ETA:** `UNKNOWN` ("por calcular") si `monthsLeft > 1200`, y las definiciones de precedencia, ventana y meses hasta la fecha objetivo (3.7).
26. **Año < 100:** las fechas `'YYYY-MM-DD'` con año < 100 se rechazan con `ValidationError` en el borde del servicio (`assertLocalDate`, `MIN_LOCAL_DATE_YEAR = 100`).
27. **Propiedad del usuario en repositorios:** un id ajeno es `NotFoundError` indistinguible de uno inexistente; además, por decisión expresa (hubo un bug real), todos los métodos por id de todos los repositorios exigen `userId` y lo filtran en la consulta, con guarda estructural (3.5).
28. **La prueba aleatoria con modelo independiente entra al repositorio** (`test/property/**`, commit `58b0502`) y corre en modo corto en la suite normal (sección 8).
29. **Libertad financiera con `NO_EXPENSES` (2026-10-07).** Un mes con ingreso pasivo > 0 y gasto total 0 (`NO_EXPENSES`) cuenta como libertad financiera, igual que un índice ≥ 100% (`isFinancialFreedom` en `src/domain/rules/statement.ts`). Antes era SUPUESTO.
30. **Textos del Índice de Flujo de Caja (2026-10-07).** Índice ≥ 100%: «Tu ingreso pasivo cubre el 100% de tus gastos — esto es libertad financiera en el método Cashflow.» (guion largo U+2014). El «100%» es **literal**, no el porcentaje real: con un índice de 150% el mensaje sigue diciendo «cubre el 100%» (consecuencia asumida por el usuario). `NO_EXPENSES`: «No tienes gastos registrados este mes, así que tu ingreso pasivo ya los cubre por completo.». El texto previo al 100% viene del diseño y no cambió (3.2).
31. **Título del resumen semanal (2026-10-07).** «Tu resumen semanal está listo» (`notificationPlan.ts`; el código ya lo usaba).
32. **Tope del ETA: 1200 meses se incluye (2026-10-07).** El tope es `monthsLeft > 1200`: exactamente 1200 meses da `BY_PACE` y 1201 da `UNKNOWN` (3.7). Antes era SUPUESTO.

**Decisiones del 2026-10-08:**

33. **Meses restantes de una deuda con tasa (2026-10-08; opción 3; CONFIRMADA por el usuario).** Con tasa conocida (tasa > 0), `remainingMonths` (`src/domain/rules/amortization.ts`) devuelve solo la simulación `projectPayoff` (`null` si `NEVER` o `CAPPED`), sin `max` contra `totalCount − paidCount`. Sin tasa o con tasa 0 se mantiene `ceil(saldo / cuota)` y el `max` con el plan si `totalCount > 0`. Motivo del usuario: en 7 de 9 escenarios probados las opciones 1 y 3 daban lo mismo; donde cambiaba (abono extra sin actualizar el plan, saldo pequeño) el `max` ocultaba progreso real; y el riesgo de seguros o cargos no modelados no aplica porque la deuda no los modela. Detalle, ejemplos y alternativas: [Decisión 33: meses restantes de una deuda con tasa](#decisión-33-meses-restantes-de-una-deuda-con-tasa).
34. **Ingresos recurrentes: solo aviso el día del vencimiento (2026-10-08; CONFIRMADA por el usuario).** Un ingreso recurrente avisa únicamente en `due` (más el snooze); no hay aviso previo (`pre`). Antes era el SUPUESTO 1 de 7.
35. **Un solo interruptor para avisos de pago y de ingreso (2026-10-08; CONFIRMADA por el usuario).** El interruptor de Ajustes apaga juntos los avisos de pagos y los de ingresos recurrentes; su etiqueta pasa de «Recordatorio de pagos» a «Recordatorios de pagos y cobros». Antes era el SUPUESTO 2 de 7.
36. **El snooze diario no duplica `pre` ni `due` (2026-10-08; CONFIRMADA por el usuario).** Un snooze diario no genera una notificación adicional el mismo día que ya tiene el `pre` o el `due`. Antes era el SUPUESTO 3 de 7.
37. **Tope de notificaciones (2026-10-08; CONFIRMADA por el usuario).** Con el tope alcanzado, el resumen semanal se reserva primero y el resto se prioriza por cercanía de fecha. Antes era el SUPUESTO 4 de 7.

Nota sobre las decisiones 34 a 37: la cabecera de `src/domain/rules/notificationPlan.ts` ya las cita (junto con la 31). La etiqueta del interruptor en Ajustes (decisión 35) **no existe en código**: es de F5b.

**Decisiones del usuario tras F4 y F5a (2026-10-08, CONFIRMADAS por el usuario):**

38. **Texto para `monthsRemaining = null` con cuota definida (2026-10-08; CONFIRMADA por el usuario).** Cuando la cuota no cubre el interés mensual: «Tu cuota actual no alcanza a cubrir el interés mensual — la deuda no va a bajar con este pago.». Si F5b-3 detecta un problema de longitud o espacio, se consulta al usuario antes de cambiarlo. Cierra el pendiente que decía que faltaba definir este texto.
39. **Edición de un próximo pago (2026-10-08; CONFIRMADA por el usuario).** Va en la pantalla de recurrentes (F5b-3), no en el Dashboard; el widget del Dashboard solo tiene acciones rápidas.
40. **Desmarcar un pago, D14 (2026-10-08; CONFIRMADA por el usuario).** `RecurringService.upcoming()` debe exponer la fecha de la ocurrencia confirmada para poder llamar a `unconfirm`. Es un ítem aparte para `backend-coder`.
41. **Onboarding en F5b con prioridad alta (2026-10-08; CONFIRMADA por el usuario).** Sin él, con BD limpia, la app arranca en una ruta inexistente `onboarding`.

**Decisiones del cierre de F4-fix y F5a-fix (2026-10-08, CONFIRMADAS por el usuario):**

42. **Monto del total de Deudas (2026-10-08; CONFIRMADA por el usuario).** Usa el token `amountMd` (18/24), sin tamaño nuevo.
43. **Separaciones del Dashboard (2026-10-08; CONFIRMADA por el usuario).** El gap de las filas de próximos pagos es `space[3]` (12) y el gap entre widgets es `space[5]` (24). `InactiveWidgets` también pasa a `space[3]`.
44. **Holgura del FAB derivada de tokens (2026-10-08; CONFIRMADA por el usuario).** `FAB_SIZE` (56, en `src/components/ui/ds/constants.ts`) + `space[5]` + `space[6]` + `insets.bottom` = 112 px, 2 px más que el 110 original. El usuario lo aceptó: prefiere derivar de tokens a preservar un número arbitrario.
45. **Texto de aviso de próximos pagos por tipo (2026-10-08; CONFIRMADA por el usuario).** Lo genera `upcomingNoticeText` en `src/lib/upcomingNotice.ts`. Pagos: «Te avisamos 2 días antes y el día del vencimiento.». Ingresos: «Te avisamos el día en que esperamos el ingreso.». Lista mixta: ambos textos, pagos primero. La frase «También puedes marcarlo tú mismo cuando quieras.» solo se añade si hay al menos un pago; con solo ingresos no aparece; con la lista vacía no hay párrafo. Alinea el texto con la decisión 34.

**Decisiones de F5b-1 (onboarding, pantalla de error y error boundary; informe del analyst A1-A18, tabla del Orquestador y aprobación del usuario del 2026-10-08, CONFIRMADAS por el usuario):**

46. **Tabla A1-A18 de F5b-1 (2026-10-08; APROBADA por el usuario, con una excepción: A9).** El usuario aprobó la tabla propuesta tal cual, salvo A9. Cada fila, como se aprobó:

    | # | Tema | Decisión aprobada |
    |---|---|---|
    | A8 | ¿Cuándo se llama a `complete`? | Al pulsar «Ir a mi panel» (paso 4). El botón queda en `loading` y «Volver» deshabilitado mientras se guarda. (Razón: el guard desmonta el onboarding en cuanto `complete` hace COMMIT; llamarlo en el paso 3 haría invisible «Todo listo».) |
    | A9 | «Prefiero explorarlo yo mismo» / widgets sin activar en el paso 3 | **Excepción a la propuesta.** Los widgets sin activar quedan en **NULL** (no 0). Es una regla de producto: un 0 explícito bloquearía la auto-activación futura por nudges (primera deuda, primera meta, ingreso pasivo; I6 y D10) y contradiría el copy «lo encuentras después». Ya implementado en el commit de dominio «A9» (`32b77c4`): `OnboardingService.complete` escribe 1 para el widget activado y no escribe el flag si es `null` o está ausente. No existía una decisión previa sobre A9 en este documento, por lo que se integra aquí y no tiene número propio. |
    | A3 | Paso 1 | «Efectivo» es una cuenta real del borrador con saldo editable (vacío = 0). Se exige al menos una cuenta. |
    | A4 | Chips de tipo | Abren el formulario con nombre y tipo prellenados. Correspondencia con `CASH`, `SAVINGS`, `CHECKING` y `DIGITAL_WALLET` confirmada. |
    | A5 | Saldo inicial | Sin negativos, porque `MoneyInput` no escribe signo. Vacío = 0. |
    | A6 | Cerrar la app a mitad | Aceptado: se pierde el borrador y se reinicia desde el paso 1. |
    | A7 | Reglas del borrador | Recortar espacios y bloquear nombres de cuenta duplicados sin distinguir mayúsculas. Sin límite de cuentas. El borrador se vacía tras un `complete` exitoso. |
    | A10 | Errores de `complete` | `VALIDATION`: mensaje junto al campo. `ONBOARDING_ALREADY_COMPLETED`: se trata como éxito y se recargan los ajustes. Desconocido: mensaje genérico con reintentar, conservando el borrador. |
    | A11 | Paso 2 | Opcional y con un ingreso y un gasto como en el mockup. Si hay nombre sin monto, se bloquea con un mensaje. |
    | A12 | Fecha y pasivo en el paso 2 | No en F5b-1: no hay diseño. La fecha se completa en Recurrentes (F5b-3). |
    | A1/A2 | Rutas y heredados | Los nombres de la sección 6 (`accounts`, `flow`, `widgets`, `done` bajo `app/onboarding/`). Se borra `app/(auth)/` en F5b-1 para evitar el choque de rutas. `useUserStore` queda para F6 si algo lo importa. |
    | A15 | Alcance del boundary | `(app)` y también el onboarding, es decir, todo salvo el layout raíz. |
    | A16 | Qué hace «Reintentar» | En arranque, vuelve a ejecutar `initializeApp`. En el boundary, `invalidateAll` y vuelve a renderizar. Los dos con protección contra doble toque. |
    | A18 | Accesibilidad | Roles y estados de los controles, objetivos táctiles de 44 px y progreso «paso X de 4» anunciado a lectores de pantalla. Escalado de fuente del sistema sin recortes. Se verifica en dispositivo. |

    A13 y A14 (copy y tratamiento de errores de la pantalla de error) quedan cubiertas por el copy aprobado en las decisiones 47 y 48. **A17** (validar el redbox de desarrollo frente a la pantalla de error) se verifica en dispositivo; sigue pendiente de dispositivo.
47. **Copy de la pantalla de error, única para arranque y boundary (2026-10-08; CONFIRMADA por el usuario).** Título: «Algo salió mal». Texto: «No pudimos cargar la aplicación. Inténtalo de nuevo.». Botón: «Reintentar». Tras 3 fallos seguidos (el fallo inicial cuenta como el 1.º) se añade: «Si el problema continúa, cierra la app y vuelve a abrirla.». Nunca muestra el mensaje técnico ni datos financieros.
48. **Copy de errores del onboarding (2026-10-08; CONFIRMADA por el usuario).** Validación: «Revisa los datos marcados e inténtalo de nuevo.». Genérico: «No pudimos guardar tu información. Inténtalo de nuevo.». Textos de validación en cliente (APROBADOS por el usuario, literales):
    - Nombre de cuenta vacío (junto al campo, formulario de cuenta del paso 1): «Escribe un nombre para la cuenta.»
    - Nombre de cuenta duplicado, sin distinguir mayúsculas (junto al campo del nombre): «Ya tienes una cuenta con ese nombre.»
    - Ninguna cuenta (bajo la lista de cuentas al pulsar «Continuar» sin ninguna): «Agrega al menos una cuenta para continuar.»
    - Paso 2, nombre sin monto (junto al campo del monto, en la fila del ingreso o del gasto): «Escribe un monto mayor que cero.»
    - Paso 2, monto con nombre vacío: «Escribe un nombre para continuar.»
49. **Frase del paso 4 «Todo listo» (2026-10-08; CONFIRMADA por el usuario).** El usuario la reescribió: «Puedes activar Deudas, Metas o el Índice de Flujo cuando los necesites — nunca pierdes lo que ya armaste aquí.». Sustituye a la del mockup («Actívate cuando quieras más — nunca pierdes lo que ya armaste.»), ambigua sobre qué se activa.

Con estas decisiones no queda ninguna decisión abierta en esta lista; los textos inferidos por F5a que el usuario podría querer cambiar figuran en [Pendientes](#pendientes-para-la-próxima-sesión).

### 10.3 Verificaciones de Expo

Documentación de referencia: https://docs.expo.dev/versions/v56.0.0/

**VERIFICADO (2026-10-03)**, contra la documentación de Expo v56 y las fuentes instaladas:
- **expo-sqlite:** PRAGMA foreign_keys no viene activo por defecto y se activa por conexión.
- **drizzle sobre expo-sqlite:** `db.transaction` es síncrona (callback síncrono, solo `tx.*`, sin await); `withExclusiveTransactionAsync` no es la vía.
- **Migraciones:** drizzle-kit con `driver: 'expo'` genera `migrations.js`; `babel-plugin-inline-import` para `.sql` y `sourceExts` con `'sql'` en Metro (ya configurados).
- **expo-router 56.2:** `Stack.Protected` con `guard`; `presentation: 'formSheet'` con `sheetAllowedDetents`.
- **Drizzle `useLiveQuery`:** exige `enableChangeListener: true`; no se usa (se usa el store de invalidación).
- **expo-notifications:** triggers DATE y WEEKLY, `setNotificationCategoryAsync`, `getLastNotificationResponseAsync` y plugin `expo-notifications`; límite de ~64 notificaciones locales en iOS; hace falta un development build para probar el plugin y las acciones.

**NO VERIFICADO** (el informe no pudo comprobarlo):
- Arranque en frío de las notificaciones.
- Acciones de categoría en Expo Go.
- Nombre de las familias de fuente en iOS (se cargan además con `useFonts` para hacerlos deterministas, pero falta comprobarlo en un development build).
- `UPDATE/DELETE ... RETURNING` en expo-sqlite sobre dispositivo (3.5).
- `Stack.Protected` y `presentation: 'formSheet'` en ejecución (solo se verificó que existen en la documentación y las fuentes de expo-router 56.2).
- Comportamiento sobre dispositivo en general.

**[EXPO-DOC] pendiente** (no cubierto por el informe):
- **expo-sqlite / drizzle:** vigencia de `useMigrations` en SDK 56 (el código usa `migrate` del migrador `drizzle-orm/expo-sqlite/migrator`).
- **expo-font:** en el código se usan el plugin de config **y** `useFonts`; queda por confirmar en la documentación v56 si esa combinación es la recomendada; expo-splash-screen para retener la pantalla de inicio.
- **expo-router 56.2:** typed routes, ThemeProvider de navegación, y qué pasa con los archivos de `(tabs)` sin `Tabs.Screen`.
- **expo-notifications:** canales de Android y POST_NOTIFICATIONS; si una acción en segundo plano ejecuta JS; `opensAppToForeground`.
- **`useColorScheme`** con `userInterfaceStyle: automatic` y cambio de modo en caliente.
- **React Compiler** (`experiments.reactCompiler: true`): compatibilidad con los hooks de invalidación y los stores de zustand.

---

## 11. Decisiones del usuario

Decisiones ya cerradas por el usuario. Prevalecen sobre cualquier otro texto del documento.

- **Pagar deuda = gasto real.** Un pago de deuda es una Transaction EXPENSE (`kind='DEBT_PAYMENT'`).
- **Aportar a una meta = transferencia interna sin Transaction.** Es un GoalContribution.
- **Cerrar meta = cambio de estado a SPENT** sin mover dinero ni pedir cuenta, guardando de qué cuenta salió cada aporte (cada GoalContribution conserva su `accountId`).
- **Mes calendario** como periodo de los reportes.
- **Una sola entidad Debt:** se unifican `debt_cards` y `debt_loans`.
- **Metas como entidad propia** (`goals`).
- **Presupuesto y distribución fuera del MVP** (v1.1).
- **Ediciones manuales de saldos con registro de ajuste** (BalanceAdjustment).
- **Abono mayor al saldo:** cuenta completo como gasto y la deuda queda en 0.
- **El pago de deuda se muestra como categoría separada en el desglose, pero suma al gasto total.**
- **Metas cerradas suman al gasto total:** `gastoTotal = gastoVida + gastoDeuda + gastoMetas` (D1).
- **"Quincenal" = días 15 y último día del mes** (D6).
- **Cuenta predeterminada de un recurrente:** "Agregar recurrente" debe pedirla; "Ya pagué" siempre pide cuenta, preseleccionando la predeterminada (D8).
- **Base de datos limpia con migración regenerada.**
- **La paleta del Design System reemplaza la actual.**
- **IBM Plex Sans y Mono** como tipografías.
- **`eslint.config.js` versionado; `.opencode/` y `pipeline-state.json` ignorados** en `.gitignore`.
- **Texto de Agregar deuda:** "Calculamos la tasa con la fórmula estándar de amortización."
- **`tamagui` y `victory-native` retirados.**
- **"Quincenal": primera fecha** (decisión posterior a la D6): se ajusta a la fecha válida (15 o último día) más cercana; en empate gana la posterior. La pantalla lo muestra en vivo, nunca en silencio tras guardar.
- **Moneda:** un único formateador, `formatCOP` de `src/domain/money.ts` (la `formatCOP` vieja de `utils/currency.ts` es código a retirar en F6; unidades menores, `$1.234.567` sin espacio, `-$50.000`); ningún componente formatea pesos por su cuenta.
- **Cuentas archivadas:** no cambian de saldo por ningún motivo (borrar una transacción suya se rechaza con `AccountArchivedError`); eliminar una meta con aportes de cuentas archivadas no se bloquea, el usuario elige una cuenta activa de destino; `AccountService.unarchive(id)` quita `archivedAt` sin ajustes nuevos; **desarchivar automáticamente está descartado**.
- **ETA de metas:** tope de 100 años (`UNKNOWN` / "por calcular" si `monthsLeft > 1200`; exactamente 1200 meses **se incluye**, decisión del 2026-10-07) y las definiciones de 3.7.
- **Libertad financiera (2026-10-07):** el Índice de Flujo de Caja ≥ 100% es libertad financiera, y también lo es `NO_EXPENSES` (ingreso pasivo con gasto total 0). Ver [3.2](#32-reporte-del-mes).
- **Textos del Índice (2026-10-07):** con índice ≥ 100% el mensaje dice «Tu ingreso pasivo cubre el 100% de tus gastos — esto es libertad financiera en el método Cashflow.» con el «100%» **literal** (no el porcentaje real); sin gastos: «No tienes gastos registrados este mes, así que tu ingreso pasivo ya los cubre por completo.». Ver [3.2](#32-reporte-del-mes).
- **Título del resumen semanal (2026-10-07):** «Tu resumen semanal está listo». Ver [7](#7-notificaciones-y-recurrentes).
- **Fechas con año < 100** se rechazan con `ValidationError` en el borde del servicio.
- **Propiedad del usuario:** un id de otro usuario es un `NotFoundError` indistinguible del inexistente, y todos los métodos por id de todos los repositorios exigen `userId` y lo filtran en la consulta (porque ya hubo un bug real con `accounts.remove/get`), con guarda estructural.
- **La prueba aleatoria con modelo de referencia independiente** forma parte del repositorio.

---

## 12. Desviaciones aprobadas

Esta sección registra las desviaciones respecto del diseño original de este documento (2026-10-03) que se aprobaron o se dieron durante la implementación. Lo ya incorporado al cuerpo del documento se resume aquí para trazabilidad.

### 12.1 F1 (datos): restricciones adicionales y más estrictas

Leídas de `src/database/schema.ts` (VERIFICADO EN CÓDIGO 2026-10-07). Todas son más estrictas que lo descrito en el diseño original.

| Tabla | Restricción | Detalle |
|---|---|---|
| Todas las columnas enum | CHECK `IN (...)` | `ck_users_theme`, `ck_accounts_type`, `ck_categories_type`, `ck_debts_rate_source`, `ck_goals_status`, `ck_rec_type/kind/frequency/status`, `ck_tx_type/kind/payment_type`, `ck_adj_target_type/reason`: la BD hace cumplir los enums, no solo TypeScript |
| `users` | `ck_users_reminder_hour` | `reminderHour BETWEEN 0 AND 23` |
| `users` | `ck_users_widget_*` | cada `widget*` `IN (0, 1)` (NULL pasa) |
| `categories` | `uq_categories_system_type_name` | UNIQUE parcial `(type, name) WHERE userId IS NULL`; el UNIQUE `(userId, type, name)` no protege a las categorías base porque en SQLite los NULL son distintos |
| `debts` | `ck_debts_installment`, `ck_debts_rate`, `ck_debts_initial_paid`, `ck_debts_total_count` | cuota NULL o > 0; tasa NULL o ≥ 0; `initialPaidCount ≥ 0`; `totalCount` NULL o > 0 |
| `goals` | `ck_goals_spent_fields` | además de `SPENT` ⇒ `spentAt` y `spentAmountMinor` no nulos, una meta `ACTIVE` exige ambos NULL |
| `goals` | `ck_goals_spent_amount` | `spentAmountMinor` NULL o ≥ 0 |
| `recurring_items` | `ck_rec_passive_income` | `isPassive` solo en INCOME |
| `recurring_items` | `ck_rec_kind_debt` | `(kind = 'DEBT_INSTALLMENT') = (debtId IS NOT NULL)` |
| `recurring_items` | `ck_rec_debt_installment`, `ck_rec_standard` | cuota de deuda ⇒ EXPENSE con `amountMinor` y `name` NULL; STANDARD ⇒ `amountMinor > 0` y `name` no nulo |
| `recurring_items` | `ck_rec_anchor_date`, `ck_rec_next_due_date` | patrón `GLOB` de `'YYYY-MM-DD'` |
| `recurring_items` | índices extra | `(userId, status)`, `(categoryId)`, `(defaultAccountId)`; UNIQUE `(debtId)` |
| `transactions` | `ck_tx_standard_no_debt` | `kind='STANDARD'` ⇒ `debtId`, `debtPaymentType` y `debtPrincipalAppliedMinor` NULL (cierra el "si y solo si") |
| `transactions` | `ck_tx_occurrence_required` | `recurringItemId` no NULL ⇒ `occurrenceDate` no NULL |
| `transactions` | `ck_tx_principal_range`, `ck_tx_occurrence_date` | `0 ≤ capital ≤ monto`; patrón `GLOB` |
| `transactions` | índice extra | `(categoryId)` |
| `balance_adjustments` | FK `ON DELETE CASCADE` | hacia cuenta, deuda y meta (el diseño original no lo especificaba); los servicios igualmente borran los ajustes de forma explícita |
| `balance_adjustments` | índices | `(accountId)`, `(debtId)`, `(goalId)` |
| FK a `users` | `ON DELETE RESTRICT` | salvo `categories.userId` (`CASCADE`) |

Sin CHECK en el esquema: `goals.targetDate` (la validación está en el servicio). Las FK no incluyen `userId`; la propiedad entre tablas la imponen triggers (3.5).

### 12.2 Desviaciones y ampliaciones posteriores

- **Timestamps:** todos los instantes del esquema son `timestamp_ms` (epoch en milisegundos; el diseño original los llamaba solo "int"); los montos, enteros en unidades menores.
- **Quincenal:** el diseño original dejaba abierta la primera fecha (ver 3.4 y 6, fila 14, antes "AMBIGUO"); se resolvió con `nearestBiweeklyDate` / `normalizeAnchor` (decisión 21).
- **Gestor de paquetes:** `npm` (el original hablaba de `pnpm` con `onlyBuiltDependencies`); el repo tiene `package-lock.json`.
- **Plugins de `app.json`:** `expo-notifications` y `expo-font` (5 `.ttf`) ya están desde F0; las fuentes se cargan además con `useFonts`.
- **Moneda:** `formatCOP` en `src/domain/money.ts` (unidades menores) en lugar de `src/domain/utils/currency.ts`, que queda como código viejo hasta F6 y exporta otra `formatCOP(amount: number)` en pesos (homonimia, ver 5): el código nuevo importa siempre de `src/domain/money`.
- **Contratos ampliados respecto de 3.4 (original):** `GoalService.remove(id, { refundAccountId? })`, `refundPreview`, `AccountService.unarchive`, `GoalView.eta`, `targetDate` en metas, `RecurringService.pendingOccurrences()`, `DebtService.registerPayment` con `occurrenceDate`/`description`, y el conjunto de errores tipados de 3.6.
- **`fast-check` no se añadió:** la prueba aleatoria se hizo con un modelo de referencia propio (sección 8).
- **`src/app-services/**` no se creó en F2b**; se creó en F5a (`5768984`).
- **Comentarios obsoletos del código: corregidos.** Se detectaron al actualizar este documento y ya están resueltos:
  - `src/domain/rules/recurrence.ts` (`nearestBiweeklyDate`) decía "EMPATES (SUPUESTO, pendiente de validar por el usuario)"; ahora dice "decisión CONFIRMADA por el usuario" (empate a la fecha posterior; decisión 21). Corregido en `0b34f13`.
  - `src/domain/rules/goalEta.ts` (cabecera) decía "Precedencia (SUPUESTO de la pasada F2b-bis, a validar)"; ahora cita la decisión del usuario (punto 25 y 3.7). Corregido en `0b34f13`. El tratamiento de exactamente 1200 meses (se incluye) pasó el 2026-10-07 de SUPUESTO a decisión del usuario (punto 32 de 10.2); el comentario de `MAX_PACE_MONTHS` en `goalEta.ts` ya lo cita así.
  - Las cabeceras de `categoryRepository`, `settingsRepository` y `reportRepository` (contradicción sobre mutadores en la primera; cabecera ausente o sin la convención de propiedad en las otras) y los límites documentados en `test/helpers/repositoryAst.ts` se corrigieron en `119a972`.
  - Decisiones del usuario del 2026-10-07 reflejadas en los comentarios del código (VERIFICADO EN CÓDIGO 2026-10-07 en el árbol de trabajo; los commits de esos archivos se hacen aparte y no se citan aquí): `statement.ts` (NO_EXPENSES cuenta como libertad financiera; textos del Índice con el «100%» literal) queda **sin SUPUESTOS**; `notificationPlan.ts` citaba la decisión del título del resumen semanal y conservaba entonces 4 SUPUESTOS diferidos a F4, que el 2026-10-08 pasaron a decisiones 34 a 37 y su cabecera ya las cita (ver [7](#7-notificaciones-y-recurrentes)); `goalEta.ts` cita el tope de 1200 meses incluido.
  - Quedan menores sin resolver (líneas "Mutador(es)" casi duplicadas; los títulos de test con `SUPUESTO` ya se quitaron en `051bdba` y el `SUPUESTO` de `amortization.ts` quedó resuelto por la decisión 33, ver [Decisión 33: meses restantes de una deuda con tasa](#decisión-33-meses-restantes-de-una-deuda-con-tasa)): ver [Pendientes para la próxima sesión](#pendientes-para-la-próxima-sesión).
