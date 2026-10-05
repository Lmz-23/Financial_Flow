# Arquitectura técnica: Financial Flow MVP

Especificación de referencia del diseño objetivo del MVP. Última actualización: 2026-10-03.

## Tabla de contenidos

- [Convenciones del documento](#convenciones-del-documento)
- [Estado de implementación](#estado-de-implementación)
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

---

## Convenciones del documento

- **SUPUESTO**: decisión de diseño tomada sin evidencia y que no está cubierta por las decisiones aprobadas de las secciones 10.2 y 11. Las decisiones ya aprobadas no llevan esta etiqueta y citan su número (por ejemplo, "D6").
- **NO VERIFICADO**: no se ha comprobado en código ni en documentación.
- **[EXPO-DOC]**: hay que confirmarlo en https://docs.expo.dev/versions/v56.0.0/ antes de implementar.
- **VERIFICADO (2026-10-03)**: comprobado contra la documentación de Expo v56 y las fuentes instaladas (informe de investigación del 2026-10-03).

---

## Estado de implementación

Este documento describe el **diseño objetivo**. Las desviaciones aprobadas durante la implementación se anotan en la sección final [Desviaciones aprobadas](#12-desviaciones-aprobadas).

Estado a fecha 2026-10-03:

| Fase | Contenido | Estado |
|---|---|---|
| F0 | Configuración (higiene del repo) | Completada y verificada |
| F1 | Datos | Implementada, en revisión |
| F2a | Reglas puras | Implementada, en revisión |
| F2b | Dominio | Pendiente |
| F3 | Tema | Implementada, en revisión |
| F4 | Plataforma (notificaciones) | Pendiente |
| F5a | Navegación y Dashboard | Pendiente |
| F5b | Funcionalidades | Pendiente |
| F6 | Limpieza | Pendiente |

Los supuestos 1 a 20 están aprobados (sección 10.2) y R1 y R2 están resueltos (sección 10.1), de modo que no quedan bloqueos de diseño previos a F2b.

---

## 0. Problemas del repo que condicionan el diseño

Comprobados leyendo el código del estado previo al rediseño (commit `e7fd4a5`, "snapshot pre-mvp").

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
    - `app.json` no incluía el plugin `expo-notifications`.
    - Migraciones: había un `.ts` que copiaba a mano el `.sql` (`initialize.ts:34-46`).
12. **Huecos en el diseño.**
    - "Agregar deuda" no pide fecha de pago (`dueLabel: 'Sin definir'`, Dashboard.dc.html:1410). Se resuelve con un campo de fecha opcional (D7).
    - La hoja "Ya pagué" no tiene selector de cuenta. Se resuelve: siempre pide cuenta y preselecciona la predeterminada del recurrente (D8).
    - La pantalla "Agregar recurrente" no pide la cuenta predeterminada (`defaultAccountId`). Se resuelve: debe pedir ese campo (D8).
    - El paso 2 del onboarding no pide fecha. Se resuelve con un campo de fecha opcional (D7).
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

---

## 2. Modelo de datos objetivo

Base de datos limpia: un único `0000` regenerado. El archivo de BD cambia de nombre (ver [4.4](#44-mecanismo-de-migraciones)).

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

**accounts**
- Campos: id, userId FK, name, type (`CASH`, `SAVINGS`, `CHECKING`, `DIGITAL_WALLET`: los cuatro tipos que muestra el diseño, Dashboard.dc.html:1260), order, archivedAt nullable, createdAt, updatedAt.
- **Sin columna de saldo.**
- Se retiran `institution`, `color`, `icon` y `cashflowClass` (D18).

**categories**
- Campos: id, userId nullable (NULL = categoría base), name, type INCOME/EXPENSE, order, isActive, createdAt.
- Semilla con las listas del diseño. Gasto: Comida, Transporte, Servicios, Salud, Otro. Ingreso: Sueldo, Freelance, Ventas, Regalo, Otro.
- Se elimina la categoría "Deudas" de la semilla: el pago de deuda no usa categoría.
- `UNIQUE(userId, type, name)`.

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

CHECK: `kind='DEBT_PAYMENT'` ⇔ (type='EXPENSE' AND debtId, debtPaymentType y debtPrincipalAppliedMinor no nulos).

Índices: `(userId, date)`, `(accountId)`, `(debtId)`, y el **UNIQUE parcial `(recurringItemId, occurrenceDate) WHERE recurringItemId IS NOT NULL`**.

Se eliminan: `TRANSFER`, `pocketId`, `status`, `isConfirmed` y los campos `transferTo*`. SUPUESTO: el MVP no tiene transacciones pendientes; lo pendiente vive en los recurrentes. Que no haya transferencias entre cuentas es la decisión D9.

**debts**
- Campos: id, userId, name, installmentMinor (nullable: la cuota puede estar "sin definir"), monthlyRate (real, nullable), rateSource ('KNOWN' / 'ESTIMATED' / 'UNKNOWN'), initialPaidCount (int default 0), totalCount (int nullable), archivedAt (nullable), createdAt, updatedAt.
- **Sin columna de saldo.**
- La fecha de pago (`dueLabel`) se deriva del recurrente vinculado (ver más abajo).

**goals**
- Campos: id, userId, name, targetMinor (CHECK > 0), status ('ACTIVE' / 'SPENT'), spentAt (nullable), spentAmountMinor (nullable), targetDate (nullable, opcional), createdAt, updatedAt.
- CHECK: `status='SPENT'` ⇔ (spentAt y spentAmountMinor no nulos).

**goal_contributions**
- Campos: id, userId, goalId FK RESTRICT, accountId FK RESTRICT, amountMinor (CHECK > 0), date, createdAt.
- Índices: `(goalId)` y `(accountId)`.

**balance_adjustments**
- Campos: id, userId, targetType ('ACCOUNT' / 'DEBT' / 'GOAL'), accountId / debtId / goalId (FKs nullables), previousMinor, newMinor, deltaMinor, reason ('OPENING' / 'MANUAL' / 'ARCHIVE_CLOSE'), createdAt.
- CHECK: exactamente un FK no nulo y que coincida con `targetType`.
- CHECK: `deltaMinor = newMinor - previousMinor`.
- CHECK: `targetType='ACCOUNT' OR newMinor >= 0`. Deudas y metas nunca quedan negativas; las cuentas sí pueden (D12).
- Se usan tres FKs reales en lugar de una referencia polimórfica para que SQLite haga cumplir la integridad referencial.

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
| anchorDate | text 'YYYY-MM-DD', nullable |
| nextDueDate | text nullable (NULL = "sin fecha", por ejemplo lo creado en onboarding) |
| snoozedUntil | int nullable |
| status | 'ACTIVE' / 'PAUSED' |
| createdAt, updatedAt | |

CHECK: `kind='DEBT_INSTALLMENT'` ⇔ (debtId no nulo AND type='EXPENSE' AND amountMinor IS NULL AND name IS NULL).

CHECK: `kind='STANDARD'` ⇒ (amountMinor > 0 AND name no nulo).

**Relaciones:** users 1–N con todo. accounts 1–N con transactions, goal_contributions y adjustments. debts 1–N con transactions y adjustments, y 1–0..1 con recurring_items. goals 1–N con contributions y adjustments. recurring_items 1–N con transactions (una por ocurrencia).

**PRAGMA foreign_keys = ON** al abrir la conexión, tanto en Expo como en tests (si no, RESTRICT no se aplica). VERIFICADO (2026-10-03): expo-sqlite **no** lo trae activo por defecto y se activa por conexión; better-sqlite3 sí lo trae activo, pero los tests lo ejecutan igualmente de forma explícita.

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

Todas son síncronas dentro de `db.transaction(tx => …)`. Devuelven `{ result, effects }`, donde `effects` son las claves de la interfaz que hay que refrescar y los recurrentes a reprogramar; la capa de aplicación los ejecuta después del COMMIT. Cuando una operación indica autoActivate(widget), esa activación va en la misma transacción.

**AccountService**
- `create({name, type, openingMinor})`: inserta la cuenta y, si el saldo inicial no es 0, un ajuste OPENING (anterior 0).
- `update(id, {name?, balanceMinor?})`, en una transacción:
  - Renombrar actualiza solo `accounts.name`. Las transacciones apuntan por id, así que el nombre nuevo aparece en todas sin más.
  - Si cambia el saldo: calcula el saldo actual dentro de la transacción y crea un ajuste MANUAL con anterior, nuevo y diferencia. Si la diferencia es 0, no hace nada.
- `remove(id)` (D2):
  - Si la cuenta no tiene transacciones ni aportes, borrado real junto con sus ajustes; los recurrentes que la tenían como predeterminada quedan sin cuenta.
  - Si tiene movimientos, se **archiva**:
    1. marca `archivedAt`;
    2. si el disponible no es 0, crea un ajuste ARCHIVE_CLOSE que lo deja en 0 (queda registrado);
    3. desvincula los recurrentes;
    4. el historial sigue en los reportes; la cuenta desaparece de listas, selectores y del total.

**TransactionService**
- `create({type, accountId, amountMinor, categoryId|newCategoryName, isPassive, date, description})`:
  - Si viene una categoría nueva, la crea en la misma transacción.
  - Valida que la cuenta no esté archivada.
  - Si `isPassive`, autoActivate(cashflow).
  - Siempre crea `kind='STANDARD'`. Los pagos de deuda solo entran por DebtService.
- `remove(id)`:
  - Borra la transacción. Saldo de cuenta, saldo de deuda, paidCount y reportes se revierten solos porque son derivados.
  - Si estaba ligada a una ocurrencia, `nextDueDate = min(nextDueDate, occurrenceDate)` y se limpia `snoozedUntil`.

**DebtService**
- `create({name, balanceMinor, installmentMinor?, rate: {known: r} | {unknown: {months}}, nextDueDate?})`:
  - Inserta la deuda y un ajuste OPENING.
  - Tasa estimada: `estimateMonthlyRate(saldo, cuota, meses)`, `rateSource=ESTIMATED`, `totalCount=meses`. El texto de la pantalla es "Calculamos la tasa con la fórmula estándar de amortización."
  - Tasa conocida: `rateSource=KNOWN`, `totalCount` NULL.
  - Si hay cuota y fecha, crea el recurrente vinculado (`DEBT_INSTALLMENT`).
  - autoActivate(debts).
- `update(id, {name?, balanceMinor?, installmentMinor?, nextDueDate?})`: un cambio de saldo es un ajuste MANUAL con nuevo ≥ 0; una fecha nueva actualiza o crea el recurrente.
- **`registerPayment({debtId, accountId, amountMinor, type: INSTALLMENT|EXTRA, date})`**, en una transacción:
  1. Calcula el saldo actual de la deuda.
  2. `capital aplicado = min(monto, saldo)`.
  3. Inserta una transacción EXPENSE `kind=DEBT_PAYMENT` por el **monto completo** (un abono mayor al saldo cuenta completo como gasto y la deuda queda en 0; ver sección 11).
  4. Si `type=INSTALLMENT` y hay recurrente vinculado con fecha: la transacción se liga a esa ocurrencia y se avanza `nextDueDate`.
  5. Rechaza el pago si la deuda está archivada. Si el saldo ya es 0, se rechaza con "Deuda liquidada" (D13).
- `remove(id)` (D3):
  - Sin pagos: borrado real junto con ajustes y recurrente.
  - Con pagos: se archiva y se borra el recurrente. Los pagos siguen como gasto de deuda del mes en que ocurrieron (`kind` no depende de que la deuda exista).
- Funciones puras: `estimateMonthlyRate` usa **bisección con cota superior que se va duplicando**, igual que el diseño (líneas 1213-1224). Devuelve null si `cuota × meses ≤ saldo`. Se retira Newton (problema 6). `projectPayoff` se conserva; `calculateAvailableCredit`, `calculateMinPayment` y `calculateBillingInfo` se retiran.
- La proyección usa `projectPayoff(saldo, cuota, tasa)` cuando hay tasa y `ceil(saldo/cuota)` cuando no (D16). El prototipo ignora el interés.
- **Riesgo de modelo:** un pago reduce el saldo por su monto completo y no se modela interés devengado, igual que el diseño (línea 1451). Las diferencias con el extracto del banco se corrigen con un ajuste.

**GoalService**
- `create({name, targetMinor, initialMinor?, accountId?})`: inserta la meta y, si hay ahorro inicial, un aporte. autoActivate(goals).
- `contribute({goalId, accountId, amountMinor, date})`: solo para metas ACTIVE. Inserta un aporte; no crea transacción. Se rechaza si el monto supera el disponible de la cuenta (D12).
- `update(id, {name?, targetMinor?, savedMinor?})`: un cambio de saved es un ajuste MANUAL de la meta y no toca cuentas. Solo para metas ACTIVE.
- **`close(id)`**: requiere ACTIVE y saved ≥ objetivo (D11). Fija `status=SPENT`, `spentAt=now` y `spentAmountMinor=saved`. No pide cuenta, no crea transacción y no mueve dinero. El monto suma a `gastoMetas` del mes del cierre (D1).
- `remove(id)` (D4):
  - Meta activa: borra en una transacción la meta, sus aportes y sus ajustes. El dinero vuelve solo a cada cuenta de origen gracias al registro por aporte. La interfaz confirma antes: "Se devolverán $a a Efectivo, $b a Ahorros".
  - Meta gastada: no se ofrece borrarla (reescribiría gasto histórico) y ya no aparece en la lista.
- ETA de una meta: promedio de aportes de los últimos 3 meses, o la fecha objetivo si existe (D20).

**RecurringService**
- `create / update / remove` para el tipo STANDARD. Un recurrente de ingreso con `isPassive` activa el Índice (SUPUESTO).
- `create` y `update` reciben `defaultAccountId`, que la pantalla "Agregar recurrente" debe pedir (D8). Es solo una sugerencia: no sustituye la elección de cuenta al confirmar.
- `remove` deja las transacciones con `recurringItemId` NULL.
- **`confirmOccurrence({recurringId, occurrenceDate, accountId, amountMinor?, date?})`**:
  - `accountId` es obligatorio: la hoja "Ya pagué" siempre pide cuenta, preseleccionando `defaultAccountId` si existe (D8).
  - Si el recurrente es de deuda, lanza `UseDebtPaymentFlow` y la interfaz redirige a Registrar pago de deuda.
  - Si no: inserta la transacción (type y isPassive del recurrente, `recurringItemId`, `occurrenceDate`), avanza `nextDueDate` y limpia `snoozedUntil`.
- **Avanzar `nextDueDate`:** siguiente fecha calculada sin partir de `now` (nunca desde `now`) y que no tenga ya una transacción ligada.
  - Mensual: se calcula desde `anchorDate`; conserva el día del ancla y, si el mes es más corto, usa el último día (31 de enero → 28 de febrero → 31 de marzo).
  - Semanal: se calcula desde `anchorDate`; +7 días.
  - Quincenal (BIWEEKLY): los días 15 y último día del mes (D6). La secuencia es fija: 15 → último día del mes → 15 del mes siguiente → … El último día es 28 o 29 en febrero, 30 o 31 según el mes. **No es +14 días.** Esta regla no depende del día del ancla; solo la fecha de partida sale de lo que el usuario elija. **AMBIGUO (no definido en las decisiones aprobadas):** qué ocurre si la primera fecha elegida por el usuario para un recurrente quincenal no es ni el 15 ni el último día del mes (¿se rechaza, se ajusta a la siguiente fecha válida o se acepta como primera ocurrencia?). Debe decidirse antes de implementar `recurrence.ts` y la pantalla "Agregar recurrente".
- `unconfirm(recurringId, occurrenceDate)`: delega en `TransactionService.remove`, con un solo camino de reversión. Desmarcar el círculo en Próximos pagos borra la transacción (D14).
- `snooze(recurringId)`: aplica la política de [7](#7-notificaciones-y-recurrentes).
- **Consulta `upcoming(userId)`**: recurrentes activos con fecha, excluyendo los de deudas con saldo 0 o archivadas (se deriva, no hay estado que sincronizar). El nombre y el monto de los de deuda vienen de la deuda. Estado de cada ítem: pendiente, vencido o "pagado" (hay transacción para una ocurrencia del mes actual y la siguiente fecha cae fuera del mes; SUPUESTO de presentación).

**Por qué no se duplica en Próximos pagos:** la cuota de una deuda es un recurrente con `debtId` UNIQUE, nombre y monto nulos (se toman de la deuda) y su fecha es la única fuente del `dueLabel` de la deuda. Ese recurrente lo crea DebtService, no "Agregar recurrente". Mitigación: "Agregar recurrente" pregunta "¿Es la cuota de una deuda?" y, si sí, vincula con una deuda existente en vez de crear un ítem nuevo.

**SettingsService**
- `setTheme`, `setNotifications`, `setWidget(w, on)` (desactivar pone 0).
- `autoActivate(tx, w)` = `UPDATE … SET w=1 WHERE w IS NULL`. Los widgets se activan solo con la primera entidad, siguiendo el spec y no el prototipo, que activa siempre (`debtActive: true`) (D10).

**OnboardingService**
- `complete(draft)`: una sola transacción con las cuentas (con OPENING), los recurrentes de ingreso y gasto del paso 2 (`nextDueDate` NULL, salvo que el usuario indique la fecha opcional; D7), los flags del paso 3 (1 o 0 según la elección) y `onboardingCompletedAt`.
- El borrador vive en un store zustand no persistido. Volver atrás no duplica nada. Si la app se cierra a mitad, se pierde el borrador (son 4 pasos cortos; SUPUESTO aceptable).
- Los recurrentes del onboarding sin fecha quedan "sin fecha" y Próximos pagos invita a completarla. Hasta entonces no hay notificaciones (D7).

**Atomicidad:** la frontera de la transacción es siempre el método del servicio. Los repositorios exponen consultas síncronas (`.get()`, `.all()`, `.run()`) que reciben el `tx` como parámetro. No hay `await` dentro de una transacción. better-sqlite3 lanza error si el callback devuelve una promesa, así que los tests detectan un uso asíncrono por error.

VERIFICADO (2026-10-03): `db.transaction` de drizzle sobre expo-sqlite es **síncrona**: el callback es síncrono, usa solo `tx.*` y no lleva `await`. `withExclusiveTransactionAsync` de expo-sqlite no es la vía.

---

## 4. Capas y módulos

### 4.1 Estructura

```
src/
  database/
    client.ts            ← openDatabaseSync + PRAGMA + drizzle (única importación de expo-sqlite)
    schema.ts
    migrations/          ← generado por drizzle-kit (.sql + meta + migrations.js), no se edita a mano
    repositories/        ← accounts, transactions, debts, goals, contributions, adjustments,
                           recurring, categories, settings, reports (consultas agregadas)
  domain/
    money.ts, dates.ts   ← unidades menores, formato es-CO, límites de mes, fecha local
    rules/               ← puras: amortization.ts, recurrence.ts, statement.ts, notificationPlan.ts
    services/            ← Account, Transaction, Debt, Goal, Recurring, Settings, Onboarding,
                           Report (antes Cashflow), Integrity
    createDomain(db)     ← fábrica: inyecta la BD (Expo en la app, better-sqlite3 en tests)
  platform/              ← notifications.ts (adaptador expo-notifications), fonts
  app-services/          ← comandos: llaman al dominio y después ejecutan efectos
  store/                 ← useSettingsStore (caché de users), useInvalidation, useOnboardingDraft, useUIStore
  hooks/                 ← un hook por dominio (useAccounts, useMonthStatement, useDebts, useGoals,
                           useUpcoming, useTransactions); se suscriben a claves de invalidación
  theme/                 ← tokens.ts (desde design-tokens.json), ThemeProvider, useTheme
  components/ui/         ← primitivas temáticas
app/                     ← solo pantallas: usan hooks y comandos
```

Regla de ESLint `no-restricted-imports`: `app/**` no importa `src/database/**`; `src/domain/**` no importa `expo-*`, `react-native` ni `src/platform`.

**Refresco de la interfaz:** un store de invalidación por clave (`accounts`, `transactions`, `debts`, `goals`, `recurring`, `settings`, `statement`). Cada comando lo actualiza después del COMMIT y los hooks vuelven a consultar. Mantiene el patrón actual (sin caché financiero) y no añade dependencias.
- Alternativa descartada: `useLiveQuery` de drizzle con el listener de cambios de expo-sqlite. VERIFICADO (2026-10-03): `useLiveQuery` exige `enableChangeListener: true`. No se usa: no está verificado con agregados y JOINs y acopla los hooks al driver.
- Otra alternativa: TanStack Query. Es sólida pero añade una dependencia. Queda como opción si crece la complejidad.

### 4.2 Qué se conserva, se retira o se crea

- **Se conserva y adapta:** `projectPayoff` y la bisección de `DebtService` (pasan a `rules/amortization.ts`); `CashflowService` se reescribe como `ReportService`; la idea de `RecurringService` (reescrito); `lib/expo/notifications` (pasa a ser adaptador); `domain/utils/currency` y `date`; los componentes de formulario (se reestilizan); `debtService.test.ts` (se adapta).
- **Se retira (código, tablas y pantallas):**
  - Presupuesto y distribución (fuera del MVP, v1.1): `BudgetService`, `DistributionService`, `useBudget`, `budgets_monthly`, `distribution_rules`, `app/(tabs)/budget.tsx`, `app/settings/distribution.tsx`. Justificación: ambos servicios dependen de `debtCards`, `debtLoans` y `pockets`, que desaparecen. Conservarlos "inertes" obligaría a reescribirlos solo para que compilen. Además, el presupuesto de v1.1 es por categoría, distinto del actual global, así que el costo de reintroducirlos es casi el mismo que hacerlos de nuevo. Se marca el commit `e7fd4a5` (snapshot pre-mvp) como referencia; que exista además un tag `pre-mvp` NO está verificado.
  - Pockets completo: repositorio, hooks, `app/pockets/*`, `app/(tabs)/pockets.tsx`, `PocketPicker`.
  - `debtCardRepository` y `debtLoanRepository` (se unifican en la entidad única Debt).
  - `useIntegrityCheck`, mientras sea solo para depuración.
  - `themed-text`, `themed-view`, `app-tabs*`, `animated-icon*`, `hint-row`, `web-badge`, `external-link`: restos de la plantilla con imports rotos (NO VERIFICADO uno por uno).
  - `test/mocks/expo-sqlite.ts`, `test/unit/integrity.test.ts` y la parte simulada de `cashflowService.test.ts`.
  - Persistencia de `useUserStore` en AsyncStorage.
- **Presupuesto en la interfaz:** como no hay tab bar, no se muestra nada. Opcionalmente, una fila deshabilitada "Presupuesto · Próximamente" en Ajustes que no navega ni guarda. Se recomienda omitirla, porque el diseño no la tiene.
- **Dependencias retiradas:** `tamagui` y `victory-native` no se importaban en `app/` ni en `src/` y se retiran (sección 11). El original dejaba NO VERIFICADO que no hubiera uso indirecto.

### 4.3 Estado de la interfaz

Zustand solo para: caché de ajustes (se carga desde SQLite al iniciar y se escribe a través del servicio), invalidación, borrador del onboarding y estado efímero de la interfaz. Nunca para saldos.

### 4.4 Mecanismo de migraciones

- `drizzle.config.ts` con `driver: 'expo'`: drizzle-kit genera `.sql`, `meta/_journal.json` y **`migrations.js`**, que importa los `.sql`. VERIFICADO (2026-10-03).
- En el bundle: `babel-plugin-inline-import` para `.sql` en `babel.config.js` y `sourceExts` con `'sql'` en `metro.config.js`. VERIFICADO (2026-10-03); ambos archivos ya están configurados (F0).
- En ejecución: `migrate(db, migrations)` en `initialize`, con la pantalla de inicio retenida hasta que termine. [EXPO-DOC: si `useMigrations` sigue vigente en SDK 56; no lo cubrió el informe.]
- En tests: `drizzle-orm/better-sqlite3/migrator` con `migrationsFolder` apuntando a los mismos `.sql`. La fuente única es `schema.ts`; drizzle-kit genera el `.sql` y `migrations.js`. El espejo `.ts` manual **no debe existir**.
- Protección contra divergencias: script `db:check` (`drizzle-kit check` + `generate` sin diferencias en git) en CI y antes de hacer commit.
- **Riesgo con instalaciones de desarrollo:** un dispositivo con la BD vieja tiene `__drizzle_migrations` con el hash anterior del `0000`. Mitigación: cambiar el nombre del archivo (`financial-flow-v1.db`). Con eso se parte de una BD limpia sin pasos manuales (base de datos limpia con migración regenerada).

---

## 5. Sistema de tema

La paleta del Design System reemplaza la actual.

- **Tokens:** `src/theme/tokens.ts` importa `Design/design-tokens.json` (o una copia en `src/theme/`; SUPUESTO: copiar para no depender de la carpeta Design en el bundle). Los transforma a camelCase: surfacePage, surfaceCard, surfaceRaised, borderSubtle, inkPrimary, inkSecondary, inkOnBrand, brandPrimary, signalGrowth, signalDebt, signalGoal y focusRing (resolviendo la referencia `{brand-primary}`). También tipografía (display-lg…amount-sm), espaciado (space-1…7), radios (xs, sm, md, lg, full) y la sombra solo para hojas. Es una única fuente de verdad sin generación de código.
- **ThemeProvider único** en `app/_layout.tsx`: `scheme = preference === 'system' ? useColorScheme() : preference`. Expone `useTheme()` → `{ scheme, colors, type, space, radius, shadowSheet }`. El selector del store se renombra a `useThemePreference`. También alimenta el tema de React Navigation y la barra de estado [EXPO-DOC: de dónde exporta expo-router v56 `ThemeProvider` y los temas de navegación].
- **Fuentes:** IBM Plex Sans e IBM Plex Mono, con `@expo-google-fonts/ibm-plex-sans` (400, 500, 600) e `ibm-plex-mono` (400, 500). En React Native, con fuentes propias cada peso es una familia distinta, así que los estilos de texto mapean el peso a la familia (`IBMPlexSans_600SemiBold`, etc.) y no usan `fontWeight`. [EXPO-DOC: en v56, plugin de config de expo-font para incrustar en build o `useFonts` en ejecución con la pantalla de inicio retenida. Se recomienda el plugin si está disponible.] NO VERIFICADO: el nombre de las familias de fuente en iOS con el plugin.
- **Primitivas** (se hacen antes que las pantallas): Text (variant), Amount (mono, con signo y color de señal), Button (primary/ghost/danger), Widget (radio md, borde, sin sombra; variante hero con radio lg), InviteCard (borde punteado), Input, MoneyInput, Pill/SegmentedControl, ProgressBar, Sheet (radio lg + shadowSheet), ListRow y AccountPicker.
- **Migración incremental:**
  1. **Shim:** `src/theme/colors.ts` mantiene sus nombres viejos pero apunta a la paleta nueva clara y estática (bg → surfacePage, surface1 → surfaceCard, textPrimary → inkPrimary, accentGreen → signalGrowth, accentRed → signalDebt, accentBlue → brandPrimary, accentAmber → signalGoal, **accentYellow → signalGoal**, accentPurple → brandPrimary). Así todas las pantallas viejas cambian de aspecto sin tocarlas y desaparecen los `undefined`.
  2. ESLint `no-restricted-imports` sobre `colors` en modo warn; cuenta pendientes sin bloquear.
  3. Cada pantalla rehecha usa solo `useTheme` y primitivas.
  4. Cuando la cuenta de usos llega a 0, se borra el shim y la regla pasa a error.

  Como la mayoría de las pantallas viejas se retiran (sección 6), el shim vive poco. **Tratamiento de accentYellow:** no se crea el token. Su uso semántico (advertencia o "en progreso") no existe en el sistema de diseño. En el shim se aproxima con signalGoal y desaparece con las pantallas que lo usan (budget, card, pay-installment, gauge, pockets).
- **Limitación mientras dure la migración:** el shim es estático (claro) y no sigue el modo oscuro. Es aceptable durante el desarrollo, pero no para publicar.
- **Inicio de la app:** cambiar el color de fondo de la pantalla de inicio en `app.json` (#208AEF) a surfacePage o brandPrimary. `userInterfaceStyle: automatic` ya está.

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
| 14 | Agregar recurrente | `app/(app)/recurring/new.tsx` | — | Crear. **Debe pedir la cuenta predeterminada (`defaultAccountId`)**, campo que no estaba en el diseño original (D8). Si el recurrente es quincenal, ver la regla de BIWEEKLY (días 15 y último día del mes) y su ambigüedad abierta en 3.4 |
| 15 | Ajustes | `app/(app)/settings.tsx` | `(tabs)/settings.tsx`, `settings/*` | Rehacer en una sola pantalla |
| + | Hoja de confirmación de pago ("Ya pagué") | `app/(app)/recurring/[id]/confirm.tsx` (param: occurrence) | — | Crear. Con **selector de cuenta**, que el diseño no muestra: siempre pide cuenta y preselecciona la predeterminada del recurrente (D8) |
| + | Onboarding: Cuentas, Flujo, Invitación, Todo listo | `app/onboarding/{accounts,flow,widgets,done}.tsx` | `(auth)/onboarding/*` | Rehacer; se pasa de `(auth)` a `onboarding`. El paso 2 admite fecha opcional (D7) |

**Se retiran:** `(tabs)/*`, `(modals)/category-detail` (las categorías se crean en línea), `settings/{categories,distribution,appearance,notifications,index}`, `pockets/*`, `debt/card/[id]`, `debt/loan/[id]` y los `_layout` correspondientes.

"Cerrar sesión" aparece en Ajustes según el spec, pero no hay autenticación (`default-user`). Se oculta en el MVP (D19).

---

## 7. Notificaciones y recurrentes

- **Plan puro** (`domain/rules/notificationPlan.ts`, se puede testear): a partir de los recurrentes de `upcoming()`, los ajustes y `now` produce las notificaciones deseadas, con identificadores deterministas:
  - `rec:{id}:{occ}:pre`: 2 días antes a `reminderHour`. Texto: "Tu pago de X vence en 2 días".
  - `rec:{id}:{occ}:due`: el día del vencimiento. Texto: "¿Ya pagaste X?" con categoría de acciones.
  - `rec:{id}:{occ}:snooze` si hay `snoozedUntil` en el futuro.
  - `weekly-summary`: disparador semanal, domingo a las 19:00 con texto genérico, porque el contenido se calcularía al programar y quedaría desactualizado (D15).
  - Ingresos: se incluyen con el texto "¿Ya recibiste X?" (D15).
- **Adaptador** (`platform/notifications.ts`): `reconcile()` compara lo programado (`getAllScheduledNotificationsAsync`) con lo deseado, cancela lo que sobra y programa lo que falta. Es idempotente. Se llama al iniciar, al volver a primer plano (AppState), después de cualquier comando que afecte recurrentes o deudas y al cambiar ajustes. Reemplaza `rescheduleAll`, que hoy cancela todo cada vez.
- **Límite de iOS:** unas 64 notificaciones locales pendientes (límite de la plataforma). VERIFICADO (2026-10-03). El plan prioriza las más cercanas.
- **Respuesta:** `addNotificationResponseReceivedListener` + `getLastNotificationResponseAsync` para el arranque en frío. "Ya pagué" o tocar la notificación abre `/recurring/[id]/confirm?occurrence=…`, o `/debts/[debtId]/pay?type=INSTALLMENT&occurrence=…` si es una cuota de deuda. No se confirma en segundo plano porque hace falta elegir cuenta (la hoja siempre pide cuenta; D8). "Todavía no" llama a `RecurringService.snooze` y luego a `reconcile`.
  - VERIFICADO (2026-10-03): existen los triggers DATE y WEEKLY, `setNotificationCategoryAsync`, `getLastNotificationResponseAsync` y el plugin `expo-notifications`.
  - NO VERIFICADO: el comportamiento del arranque en frío de las notificaciones; las acciones de categoría en Expo Go; el comportamiento sobre dispositivo; si una acción en segundo plano ejecuta JS en iOS y Android; `opensAppToForeground`.
- **Política de "recuérdamelo luego" (D5):**
  - `snoozedUntil` = día siguiente a `reminderHour`.
  - Se repite cada día mientras siga sin pagar, hasta 7 días después del vencimiento.
  - Después no hay más avisos, y el ítem queda como "Vencido" en Próximos pagos hasta que el usuario lo confirme.
  - Nunca se marca solo.
- **Permisos:** se piden al crear el primer recurrente con fecha o al activar el interruptor en Ajustes, no al arrancar. Android 13+ necesita POST_NOTIFICATIONS y un canal. Falta añadir el plugin `expo-notifications` a `app.json` (el plugin existe, VERIFICADO 2026-10-03; que `app.json` ya lo incluya se debe comprobar en F4). Se necesita un development build para probar el plugin y las acciones (VERIFICADO 2026-10-03). [EXPO-DOC: canales de Android y POST_NOTIFICATIONS en v56.]
- Desactivar recordatorios cancela `rec:*`; desactivar el resumen cancela `weekly-summary`.
- **Recurrentes quincenales:** las fechas de vencimiento de un recurrente BIWEEKLY son los días 15 y último día del mes (D6); los identificadores `rec:{id}:{occ}:*` usan la fecha de la ocurrencia resultante.

---

## 8. Estrategia de pruebas

- **Pruebas sobre SQLite real en node:** `better-sqlite3` en memoria + `drizzle-orm/better-sqlite3` + migrador con la **misma carpeta** de migraciones. Un helper `createTestDomain()` devuelve `createDomain(db)` sobre una BD nueva por test. Cada BD de test ejecuta `PRAGMA foreign_keys = ON` de forma explícita.
  - No hace falta simular expo-sqlite, porque el dominio nunca importa `client.ts`.
  - Se elimina el alias de vitest.
  - Hay que aprobar la compilación nativa de better-sqlite3 en el gestor de paquetes. El original mencionaba pnpm (`onlyBuiltDependencies`), pero el repo contiene `package-lock.json` (npm) y no `pnpm-lock.yaml`; el gestor efectivo debe confirmarse. Alternativa sin compilación: `sql.js` (WASM) con el driver sql-js de drizzle.
  - Riesgo: diferencias de versión de SQLite entre expo-sqlite y better-sqlite3. Mitigación: no usar funciones exóticas.
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
- **Invariantes:** se comprueba I1–I6 después de cada escenario. Opcionalmente, pruebas por propiedades con `fast-check` (dependencia nueva, SUPUESTO) con secuencias aleatorias de operaciones.
- **Reglas puras:**
  - Bisección contra valores conocidos (saldo 1.200.000, cuota 180.000, 10 meses).
  - Recurrencia: día 31, febrero, años bisiestos, semanal y quincenal. Quincenal (D6): la secuencia es 15 → último día del mes → 15 del mes siguiente, con último día 28, 29, 30 o 31 según el mes (febrero normal y bisiesto incluidos); se verifica explícitamente que **no** avanza +14 días.
  - Límites de mes con `TZ=America/Bogota` fijado en la config de vitest.
  - Plan de notificaciones: pre, due, snooze, tope de 7 días, toggles apagados, deuda liquidada excluida.
- **Fuera de vitest:** los adaptadores Expo (notificaciones, fuentes) y las pantallas se validan a mano en un development build. Opcional: tests de componentes con jest-expo, que queda fuera del MVP.

---

## 9. Plan por fases

| Fase | Especialista | Contenido | Depende de | Archivos que toca |
|---|---|---|---|---|
| F0 Higiene | devops | `.gitignore` (+`.opencode/`, `.claude/pipeline-state.json`), versionar `eslint.config.js`, decidir qué hacer con el trabajo sin commit (recomendado: commit o tag `pre-mvp` antes de retirar), dependencias (better-sqlite3, babel-plugin-inline-import, fuentes Plex, retirar tamagui/victory-native), `babel.config.js`, `metro.config.js`, `drizzle.config.ts` con driver expo, plugins de `app.json` (expo-notifications, fuentes, color de inicio), `vitest.config.ts`, script `db:check` | — | Solo configuración en la raíz |
| F1 Datos | data-engineer | `schema.ts` nuevo, borrar migraciones viejas y regenerar `0000`, `client.ts` (PRAGMA, nombre nuevo), `initialize.ts`, semilla de categorías, helper de BD para tests | F0 | `src/database/**`, `test/helpers/db.ts` |
| F2a Reglas puras | backend-coder | money, dates, amortization, recurrence, statement, notificationPlan + tests | F0 (en paralelo con F1) | `src/domain/rules/**`, `src/domain/{money,dates}.ts`, `test/unit/rules/**` |
| F2b Dominio | backend-coder | Repositorios, servicios, `createDomain`, IntegrityService, comandos con efectos, tests de integración; retirar servicios y repositorios viejos | F1, F2a | `src/database/repositories/**`, `src/domain/services/**`, `src/app-services/**`, `test/integration/**` |
| F3 Tema | frontend-coder | tokens, ThemeProvider, fuentes, primitivas, shim de `colors`, regla ESLint; dueño de `app/_layout.tsx` (proveedores, splash, init) | F0 (en paralelo con F1 y F2) | `src/theme/**`, `src/components/ui/**`, `app/_layout.tsx`, `eslint.config.js` (solo la regla) |
| F4 Plataforma | mobile-coder | Adaptador de notificaciones (reconcile, categorías, listener de respuesta, permisos, canal Android) | F2a (plan), F2b (upcoming, snooze) | `src/platform/**` |
| F5a Navegación y Dashboard | frontend-coder | Borrar `(tabs)`, crear `(app)/_layout` y onboarding con guard, Dashboard, stores y hooks base | F2b, F3 | `app/(app)/_layout.tsx`, `app/(app)/index.tsx`, `app/onboarding/**`, `src/store/**`, `src/hooks/index.ts` |
| F5b Funcionalidades (en paralelo, por carpetas) | frontend-coder / mobile-coder | (i) cuentas y transacciones; (ii) deudas; (iii) metas; (iv) recurrentes, hoja de confirmación y ajustes (con F4); (v) cashflow | F5a | Cada subequipo es dueño de su carpeta `app/(app)/<x>/**` y de su `src/hooks/use<X>.ts` |
| F6 Limpieza | backend-coder + frontend-coder | Borrar shim, pantallas, hooks y tests viejos; ESLint en error | F5b | Lo retirado |

**Paralelización segura:** F1 ∥ F2a ∥ F3; F4 ∥ F5a; los cinco subequipos de F5b entre sí. **Archivos compartidos con un solo dueño:** `src/hooks/index.ts` (F5a; los subequipos importan directamente su hook en vez de editar el barrel), `app/_layout.tsx` (F3), `app.json`, `package.json` y la config (F0; quien necesite una dependencia la pide a devops).

El estado actual de cada fase está en [Estado de implementación](#estado-de-implementación).

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
- **R8.** El trabajo sin commit (onboarding, budget, settings, debt detail) choca con este diseño. Hay que congelarlo antes de F5. El commit `e7fd4a5` ("snapshot pre-mvp") conserva el estado previo al rediseño.
- **R9.** El target web (`app.json` con web output static) con expo-sqlite no está cubierto. SUPUESTO: el MVP es solo iOS y Android.

### 10.2 Decisiones aprobadas

Fecha de aprobación: **2026-10-03**. Los supuestos 1 a 20 quedan todos aprobados, con las correcciones de los puntos 6 y 8.

1. `gastoMetas` (metas cerradas) entra en el gasto total y en el denominador del Índice (`gastoTotal = gastoVida + gastoDeuda + gastoMetas`).
2. Eliminar una cuenta con movimientos la archiva y crea un ajuste a 0; sin movimientos se borra de verdad.
3. Eliminar una deuda con pagos la archiva y conserva los pagos como gasto; sin pagos se borra de verdad.
4. Eliminar una meta activa devuelve cada aporte a su cuenta; las metas gastadas no se pueden eliminar.
5. Política de "recuérdamelo luego": un aviso diario a `reminderHour`, hasta 7 días después del vencimiento.
6. "Quincenal" (BIWEEKLY) = los días 15 y último día del mes. No es cada 14 días.
7. "Agregar deuda" y el paso 2 del onboarding necesitan un campo de fecha (opcional); sin fecha no hay recordatorios.
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
20. El ETA de una meta se calcula con el promedio de aportes de los últimos 3 meses, o con la fecha objetivo si existe.

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
- Nombre de las familias de fuente en iOS con el plugin.
- Comportamiento sobre dispositivo.

**[EXPO-DOC] pendiente** (no cubierto por el informe):
- **expo-sqlite / drizzle:** vigencia de `useMigrations` en SDK 56.
- **expo-font:** plugin de config frente a `useFonts`; expo-splash-screen para retener la pantalla de inicio.
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

---

## 12. Desviaciones aprobadas

Esta sección registra las desviaciones respecto de este documento que se aprueben durante la implementación.

- **F1 (datos):** aplicó CHECK adicionales más estrictos que los descritos en este documento. El detalle se documentará tras la revisión de la fase.
