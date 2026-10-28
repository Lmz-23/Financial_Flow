-- TRANSFERENCIAS ENTRE CUENTAS (decision 2026-10-27, revierte D9). Tabla nueva `account_transfers` + sus triggers de
-- propiedad a mano (drizzle no los modela), con el mismo patron de 0001_owner_triggers.sql:
--  1. `trg_account_transfers_user_id_immutable`: un UPDATE no puede cambiar `user_id`.
--  2. `trg_account_transfers_owner_replace`: un INSERT con un `id` existente de OTRO usuario se rechaza (INSERT OR REPLACE).
--  3. `trg_account_transfers_owner_ins` / `_owner_upd`: `from_account_id` y `to_account_id` deben ser cuentas del mismo
--     usuario (OWNER_MISMATCH). Si el padre NO existe responde la FK de siempre; en UPDATE solo se valida la columna que cambia.
-- Aditiva: no reconstruye ninguna tabla existente, por lo que NO hace falta recrear los trg_* de 0001.
-- Rollback: DROP TRIGGER de los 4 trg_account_transfers_* y DROP TABLE `account_transfers`.
CREATE TABLE `account_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`from_account_id` text NOT NULL,
	`to_account_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`date` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`from_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`to_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ck_xfer_amount" CHECK("account_transfers"."amount_minor" > 0),
	CONSTRAINT "ck_xfer_distinct" CHECK("account_transfers"."from_account_id" <> "account_transfers"."to_account_id")
);
--> statement-breakpoint
CREATE INDEX `idx_xfer_user_date` ON `account_transfers` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_xfer_from` ON `account_transfers` (`from_account_id`);--> statement-breakpoint
CREATE INDEX `idx_xfer_to` ON `account_transfers` (`to_account_id`);--> statement-breakpoint
CREATE TRIGGER `trg_account_transfers_user_id_immutable`
BEFORE UPDATE OF `user_id` ON `account_transfers`
WHEN NEW.`user_id` IS NOT OLD.`user_id`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_IMMUTABLE: account_transfers.user_id');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_account_transfers_owner_replace`
BEFORE INSERT ON `account_transfers`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_IMMUTABLE: account_transfers.user_id')
  WHERE EXISTS (SELECT 1 FROM `account_transfers` o WHERE o.`id` = NEW.`id` AND o.`user_id` IS NOT NEW.`user_id`);
END;
--> statement-breakpoint
CREATE TRIGGER `trg_account_transfers_owner_ins`
BEFORE INSERT ON `account_transfers`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: account_transfers.from_account_id')
  WHERE NEW.`from_account_id` IS NOT NULL AND EXISTS (
    SELECT 1 FROM `accounts` p WHERE p.`id` = NEW.`from_account_id` AND p.`user_id` <> NEW.`user_id`
  );
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: account_transfers.to_account_id')
  WHERE NEW.`to_account_id` IS NOT NULL AND EXISTS (
    SELECT 1 FROM `accounts` p WHERE p.`id` = NEW.`to_account_id` AND p.`user_id` <> NEW.`user_id`
  );
END;
--> statement-breakpoint
CREATE TRIGGER `trg_account_transfers_owner_upd`
BEFORE UPDATE OF `from_account_id`, `to_account_id` ON `account_transfers`
BEGIN
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: account_transfers.from_account_id')
  WHERE NEW.`from_account_id` IS NOT NULL AND NEW.`from_account_id` IS NOT OLD.`from_account_id` AND EXISTS (
    SELECT 1 FROM `accounts` p WHERE p.`id` = NEW.`from_account_id` AND p.`user_id` <> NEW.`user_id`
  );
  SELECT RAISE(ABORT, 'OWNER_MISMATCH: account_transfers.to_account_id')
  WHERE NEW.`to_account_id` IS NOT NULL AND NEW.`to_account_id` IS NOT OLD.`to_account_id` AND EXISTS (
    SELECT 1 FROM `accounts` p WHERE p.`id` = NEW.`to_account_id` AND p.`user_id` <> NEW.`user_id`
  );
END;
