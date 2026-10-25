-- PROPIEDAD DEL USUARIO EN LA BD (migracion custom: `drizzle-kit generate --custom`; drizzle no modela
-- triggers, asi que el esquema tipado de schema.ts no los ve). Sustituye a las FK compuestas (id, user_id):
-- es ADITIVA (no reconstruye ni copia tablas, no cambia ningun ON DELETE) y no toca filas existentes.
--  1. `*_user_id_immutable`: un UPDATE no puede cambiar `user_id` en ninguna de las 8 tablas con dueno.
--  2. `*_owner_replace`: un INSERT con un `id` que ya existe con OTRO `user_id` se rechaza. Cierra el
--     `INSERT OR REPLACE` / `REPLACE INTO`, que borra e inserta sin disparar el trigger de UPDATE.
--  3. `*_owner_ins` / `*_owner_upd`: una referencia (account_id, debt_id, ...) a una fila de OTRO usuario se
--     rechaza. Si el padre NO existe, el trigger no dice nada y responde la FK de siempre. Las categorias del
--     sistema (`categories.user_id IS NULL`) se aceptan desde cualquier usuario. En UPDATE solo se valida la
--     columna que CAMBIA (una fila previa incoherente no bloquea la edicion de otra columna ni un SET NULL).
-- Error: RAISE(ABORT) -> SQLITE_CONSTRAINT_TRIGGER con mensaje 'OWNER_MISMATCH: <tabla>.<columna>' u
-- 'OWNER_IMMUTABLE: <tabla>.user_id'. Los servicios validan antes (NotFoundError); esto es la ultima linea.
-- Rollback: DROP TRIGGER de los 24 nombres trg_* de este archivo. NO probado en dispositivo (tests: better-sqlite3).
CREATE TRIGGER `trg_accounts_user_id_immutable`
BEFORE UPDATE OF `user_id` ON `accounts`
WHEN NEW.`user_id` IS NOT OLD.`user_id`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_IMMUTABLE: accounts.user_id');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_categories_user_id_immutable`
BEFORE UPDATE OF `user_id` ON `categories`
WHEN NEW.`user_id` IS NOT OLD.`user_id`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_IMMUTABLE: categories.user_id');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_debts_user_id_immutable`
BEFORE UPDATE OF `user_id` ON `debts`
WHEN NEW.`user_id` IS NOT OLD.`user_id`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_IMMUTABLE: debts.user_id');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_goals_user_id_immutable`
BEFORE UPDATE OF `user_id` ON `goals`
WHEN NEW.`user_id` IS NOT OLD.`user_id`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_IMMUTABLE: goals.user_id');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_recurring_items_user_id_immutable`
BEFORE UPDATE OF `user_id` ON `recurring_items`
WHEN NEW.`user_id` IS NOT OLD.`user_id`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_IMMUTABLE: recurring_items.user_id');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_transactions_user_id_immutable`
BEFORE UPDATE OF `user_id` ON `transactions`
WHEN NEW.`user_id` IS NOT OLD.`user_id`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_IMMUTABLE: transactions.user_id');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_goal_contributions_user_id_immutable`
BEFORE UPDATE OF `user_id` ON `goal_contributions`
WHEN NEW.`user_id` IS NOT OLD.`user_id`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_IMMUTABLE: goal_contributions.user_id');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_balance_adjustments_user_id_immutable`
BEFORE UPDATE OF `user_id` ON `balance_adjustments`
WHEN NEW.`user_id` IS NOT OLD.`user_id`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_IMMUTABLE: balance_adjustments.user_id');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_accounts_owner_replace`
BEFORE INSERT ON `accounts`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_IMMUTABLE: accounts.user_id')
  WHERE EXISTS (SELECT 1 FROM `accounts` o WHERE o.`id` = NEW.`id` AND o.`user_id` IS NOT NEW.`user_id`);
END;
--> statement-breakpoint
CREATE TRIGGER `trg_categories_owner_replace`
BEFORE INSERT ON `categories`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_IMMUTABLE: categories.user_id')
  WHERE EXISTS (SELECT 1 FROM `categories` o WHERE o.`id` = NEW.`id` AND o.`user_id` IS NOT NEW.`user_id`);
END;
--> statement-breakpoint
CREATE TRIGGER `trg_debts_owner_replace`
BEFORE INSERT ON `debts`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_IMMUTABLE: debts.user_id')
  WHERE EXISTS (SELECT 1 FROM `debts` o WHERE o.`id` = NEW.`id` AND o.`user_id` IS NOT NEW.`user_id`);
END;
--> statement-breakpoint
CREATE TRIGGER `trg_goals_owner_replace`
BEFORE INSERT ON `goals`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_IMMUTABLE: goals.user_id')
  WHERE EXISTS (SELECT 1 FROM `goals` o WHERE o.`id` = NEW.`id` AND o.`user_id` IS NOT NEW.`user_id`);
END;
--> statement-breakpoint
CREATE TRIGGER `trg_recurring_items_owner_replace`
BEFORE INSERT ON `recurring_items`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_IMMUTABLE: recurring_items.user_id')
  WHERE EXISTS (SELECT 1 FROM `recurring_items` o WHERE o.`id` = NEW.`id` AND o.`user_id` IS NOT NEW.`user_id`);
END;
--> statement-breakpoint
CREATE TRIGGER `trg_transactions_owner_replace`
BEFORE INSERT ON `transactions`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_IMMUTABLE: transactions.user_id')
  WHERE EXISTS (SELECT 1 FROM `transactions` o WHERE o.`id` = NEW.`id` AND o.`user_id` IS NOT NEW.`user_id`);
END;
--> statement-breakpoint
CREATE TRIGGER `trg_goal_contributions_owner_replace`
BEFORE INSERT ON `goal_contributions`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_IMMUTABLE: goal_contributions.user_id')
  WHERE EXISTS (SELECT 1 FROM `goal_contributions` o WHERE o.`id` = NEW.`id` AND o.`user_id` IS NOT NEW.`user_id`);
END;
--> statement-breakpoint
CREATE TRIGGER `trg_balance_adjustments_owner_replace`
BEFORE INSERT ON `balance_adjustments`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_IMMUTABLE: balance_adjustments.user_id')
  WHERE EXISTS (SELECT 1 FROM `balance_adjustments` o WHERE o.`id` = NEW.`id` AND o.`user_id` IS NOT NEW.`user_id`);
END;
--> statement-breakpoint
CREATE TRIGGER `trg_recurring_items_owner_ins`
BEFORE INSERT ON `recurring_items`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: recurring_items.debt_id')
  WHERE NEW.`debt_id` IS NOT NULL AND EXISTS (
    SELECT 1 FROM `debts` p WHERE p.`id` = NEW.`debt_id` AND p.`user_id` <> NEW.`user_id`
  );
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: recurring_items.category_id')
  WHERE NEW.`category_id` IS NOT NULL AND EXISTS (
    SELECT 1 FROM `categories` p WHERE p.`id` = NEW.`category_id` AND p.`user_id` IS NOT NULL AND p.`user_id` <> NEW.`user_id`
  );
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: recurring_items.default_account_id')
  WHERE NEW.`default_account_id` IS NOT NULL AND EXISTS (
    SELECT 1 FROM `accounts` p WHERE p.`id` = NEW.`default_account_id` AND p.`user_id` <> NEW.`user_id`
  );
END;
--> statement-breakpoint
CREATE TRIGGER `trg_recurring_items_owner_upd`
BEFORE UPDATE OF `debt_id`, `category_id`, `default_account_id` ON `recurring_items`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: recurring_items.debt_id')
  WHERE NEW.`debt_id` IS NOT NULL AND NEW.`debt_id` IS NOT OLD.`debt_id` AND EXISTS (
    SELECT 1 FROM `debts` p WHERE p.`id` = NEW.`debt_id` AND p.`user_id` <> NEW.`user_id`
  );
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: recurring_items.category_id')
  WHERE NEW.`category_id` IS NOT NULL AND NEW.`category_id` IS NOT OLD.`category_id` AND EXISTS (
    SELECT 1 FROM `categories` p WHERE p.`id` = NEW.`category_id` AND p.`user_id` IS NOT NULL AND p.`user_id` <> NEW.`user_id`
  );
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: recurring_items.default_account_id')
  WHERE NEW.`default_account_id` IS NOT NULL AND NEW.`default_account_id` IS NOT OLD.`default_account_id` AND EXISTS (
    SELECT 1 FROM `accounts` p WHERE p.`id` = NEW.`default_account_id` AND p.`user_id` <> NEW.`user_id`
  );
END;
--> statement-breakpoint
CREATE TRIGGER `trg_transactions_owner_ins`
BEFORE INSERT ON `transactions`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: transactions.account_id')
  WHERE NEW.`account_id` IS NOT NULL AND EXISTS (
    SELECT 1 FROM `accounts` p WHERE p.`id` = NEW.`account_id` AND p.`user_id` <> NEW.`user_id`
  );
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: transactions.category_id')
  WHERE NEW.`category_id` IS NOT NULL AND EXISTS (
    SELECT 1 FROM `categories` p WHERE p.`id` = NEW.`category_id` AND p.`user_id` IS NOT NULL AND p.`user_id` <> NEW.`user_id`
  );
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: transactions.debt_id')
  WHERE NEW.`debt_id` IS NOT NULL AND EXISTS (
    SELECT 1 FROM `debts` p WHERE p.`id` = NEW.`debt_id` AND p.`user_id` <> NEW.`user_id`
  );
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: transactions.recurring_item_id')
  WHERE NEW.`recurring_item_id` IS NOT NULL AND EXISTS (
    SELECT 1 FROM `recurring_items` p WHERE p.`id` = NEW.`recurring_item_id` AND p.`user_id` <> NEW.`user_id`
  );
END;
--> statement-breakpoint
CREATE TRIGGER `trg_transactions_owner_upd`
BEFORE UPDATE OF `account_id`, `category_id`, `debt_id`, `recurring_item_id` ON `transactions`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: transactions.account_id')
  WHERE NEW.`account_id` IS NOT NULL AND NEW.`account_id` IS NOT OLD.`account_id` AND EXISTS (
    SELECT 1 FROM `accounts` p WHERE p.`id` = NEW.`account_id` AND p.`user_id` <> NEW.`user_id`
  );
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: transactions.category_id')
  WHERE NEW.`category_id` IS NOT NULL AND NEW.`category_id` IS NOT OLD.`category_id` AND EXISTS (
    SELECT 1 FROM `categories` p WHERE p.`id` = NEW.`category_id` AND p.`user_id` IS NOT NULL AND p.`user_id` <> NEW.`user_id`
  );
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: transactions.debt_id')
  WHERE NEW.`debt_id` IS NOT NULL AND NEW.`debt_id` IS NOT OLD.`debt_id` AND EXISTS (
    SELECT 1 FROM `debts` p WHERE p.`id` = NEW.`debt_id` AND p.`user_id` <> NEW.`user_id`
  );
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: transactions.recurring_item_id')
  WHERE NEW.`recurring_item_id` IS NOT NULL AND NEW.`recurring_item_id` IS NOT OLD.`recurring_item_id` AND EXISTS (
    SELECT 1 FROM `recurring_items` p WHERE p.`id` = NEW.`recurring_item_id` AND p.`user_id` <> NEW.`user_id`
  );
END;
--> statement-breakpoint
CREATE TRIGGER `trg_goal_contributions_owner_ins`
BEFORE INSERT ON `goal_contributions`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: goal_contributions.goal_id')
  WHERE NEW.`goal_id` IS NOT NULL AND EXISTS (
    SELECT 1 FROM `goals` p WHERE p.`id` = NEW.`goal_id` AND p.`user_id` <> NEW.`user_id`
  );
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: goal_contributions.account_id')
  WHERE NEW.`account_id` IS NOT NULL AND EXISTS (
    SELECT 1 FROM `accounts` p WHERE p.`id` = NEW.`account_id` AND p.`user_id` <> NEW.`user_id`
  );
END;
--> statement-breakpoint
CREATE TRIGGER `trg_goal_contributions_owner_upd`
BEFORE UPDATE OF `goal_id`, `account_id` ON `goal_contributions`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: goal_contributions.goal_id')
  WHERE NEW.`goal_id` IS NOT NULL AND NEW.`goal_id` IS NOT OLD.`goal_id` AND EXISTS (
    SELECT 1 FROM `goals` p WHERE p.`id` = NEW.`goal_id` AND p.`user_id` <> NEW.`user_id`
  );
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: goal_contributions.account_id')
  WHERE NEW.`account_id` IS NOT NULL AND NEW.`account_id` IS NOT OLD.`account_id` AND EXISTS (
    SELECT 1 FROM `accounts` p WHERE p.`id` = NEW.`account_id` AND p.`user_id` <> NEW.`user_id`
  );
END;
--> statement-breakpoint
CREATE TRIGGER `trg_balance_adjustments_owner_ins`
BEFORE INSERT ON `balance_adjustments`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: balance_adjustments.account_id')
  WHERE NEW.`account_id` IS NOT NULL AND EXISTS (
    SELECT 1 FROM `accounts` p WHERE p.`id` = NEW.`account_id` AND p.`user_id` <> NEW.`user_id`
  );
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: balance_adjustments.debt_id')
  WHERE NEW.`debt_id` IS NOT NULL AND EXISTS (
    SELECT 1 FROM `debts` p WHERE p.`id` = NEW.`debt_id` AND p.`user_id` <> NEW.`user_id`
  );
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: balance_adjustments.goal_id')
  WHERE NEW.`goal_id` IS NOT NULL AND EXISTS (
    SELECT 1 FROM `goals` p WHERE p.`id` = NEW.`goal_id` AND p.`user_id` <> NEW.`user_id`
  );
END;
--> statement-breakpoint
CREATE TRIGGER `trg_balance_adjustments_owner_upd`
BEFORE UPDATE OF `account_id`, `debt_id`, `goal_id` ON `balance_adjustments`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: balance_adjustments.account_id')
  WHERE NEW.`account_id` IS NOT NULL AND NEW.`account_id` IS NOT OLD.`account_id` AND EXISTS (
    SELECT 1 FROM `accounts` p WHERE p.`id` = NEW.`account_id` AND p.`user_id` <> NEW.`user_id`
  );
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: balance_adjustments.debt_id')
  WHERE NEW.`debt_id` IS NOT NULL AND NEW.`debt_id` IS NOT OLD.`debt_id` AND EXISTS (
    SELECT 1 FROM `debts` p WHERE p.`id` = NEW.`debt_id` AND p.`user_id` <> NEW.`user_id`
  );
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: balance_adjustments.goal_id')
  WHERE NEW.`goal_id` IS NOT NULL AND NEW.`goal_id` IS NOT OLD.`goal_id` AND EXISTS (
    SELECT 1 FROM `goals` p WHERE p.`id` = NEW.`goal_id` AND p.`user_id` <> NEW.`user_id`
  );
END;
