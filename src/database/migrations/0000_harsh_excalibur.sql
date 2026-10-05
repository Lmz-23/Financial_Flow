CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ck_accounts_type" CHECK("accounts"."type" IN ('CASH', 'SAVINGS', 'CHECKING', 'DIGITAL_WALLET'))
);
--> statement-breakpoint
CREATE INDEX `idx_accounts_user` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `balance_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`account_id` text,
	`debt_id` text,
	`goal_id` text,
	`previous_minor` integer NOT NULL,
	`new_minor` integer NOT NULL,
	`delta_minor` integer NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_adj_target_type" CHECK("balance_adjustments"."target_type" IN ('ACCOUNT', 'DEBT', 'GOAL')),
	CONSTRAINT "ck_adj_reason" CHECK("balance_adjustments"."reason" IN ('OPENING', 'MANUAL', 'ARCHIVE_CLOSE')),
	CONSTRAINT "ck_adj_single_target" CHECK(("balance_adjustments"."target_type" = 'ACCOUNT' AND "balance_adjustments"."account_id" IS NOT NULL AND "balance_adjustments"."debt_id" IS NULL AND "balance_adjustments"."goal_id" IS NULL)
        OR ("balance_adjustments"."target_type" = 'DEBT' AND "balance_adjustments"."debt_id" IS NOT NULL AND "balance_adjustments"."account_id" IS NULL AND "balance_adjustments"."goal_id" IS NULL)
        OR ("balance_adjustments"."target_type" = 'GOAL' AND "balance_adjustments"."goal_id" IS NOT NULL AND "balance_adjustments"."account_id" IS NULL AND "balance_adjustments"."debt_id" IS NULL)),
	CONSTRAINT "ck_adj_delta" CHECK("balance_adjustments"."delta_minor" = "balance_adjustments"."new_minor" - "balance_adjustments"."previous_minor"),
	CONSTRAINT "ck_adj_non_negative" CHECK("balance_adjustments"."target_type" = 'ACCOUNT' OR "balance_adjustments"."new_minor" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_adj_account` ON `balance_adjustments` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_adj_debt` ON `balance_adjustments` (`debt_id`);--> statement-breakpoint
CREATE INDEX `idx_adj_goal` ON `balance_adjustments` (`goal_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_categories_type" CHECK("categories"."type" IN ('INCOME', 'EXPENSE'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_categories_user_type_name` ON `categories` (`user_id`,`type`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_categories_system_type_name` ON `categories` (`type`,`name`) WHERE "categories"."user_id" IS NULL;--> statement-breakpoint
CREATE TABLE `debts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`installment_minor` integer,
	`monthly_rate` real,
	`rate_source` text NOT NULL,
	`initial_paid_count` integer DEFAULT 0 NOT NULL,
	`total_count` integer,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ck_debts_installment" CHECK("debts"."installment_minor" IS NULL OR "debts"."installment_minor" > 0),
	CONSTRAINT "ck_debts_rate" CHECK("debts"."monthly_rate" IS NULL OR "debts"."monthly_rate" >= 0),
	CONSTRAINT "ck_debts_rate_source" CHECK("debts"."rate_source" IN ('KNOWN', 'ESTIMATED', 'UNKNOWN')),
	CONSTRAINT "ck_debts_initial_paid" CHECK("debts"."initial_paid_count" >= 0),
	CONSTRAINT "ck_debts_total_count" CHECK("debts"."total_count" IS NULL OR "debts"."total_count" > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_debts_user` ON `debts` (`user_id`);--> statement-breakpoint
CREATE TABLE `goal_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`goal_id` text NOT NULL,
	`account_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`date` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ck_contrib_amount" CHECK("goal_contributions"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_contrib_goal` ON `goal_contributions` (`goal_id`);--> statement-breakpoint
CREATE INDEX `idx_contrib_account` ON `goal_contributions` (`account_id`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`target_minor` integer NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`spent_at` integer,
	`spent_amount_minor` integer,
	`target_date` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ck_goals_target" CHECK("goals"."target_minor" > 0),
	CONSTRAINT "ck_goals_status" CHECK("goals"."status" IN ('ACTIVE', 'SPENT')),
	CONSTRAINT "ck_goals_spent_fields" CHECK(("goals"."status" = 'SPENT' AND "goals"."spent_at" IS NOT NULL AND "goals"."spent_amount_minor" IS NOT NULL)
        OR ("goals"."status" = 'ACTIVE' AND "goals"."spent_at" IS NULL AND "goals"."spent_amount_minor" IS NULL)),
	CONSTRAINT "ck_goals_spent_amount" CHECK("goals"."spent_amount_minor" IS NULL OR "goals"."spent_amount_minor" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_goals_user` ON `goals` (`user_id`);--> statement-breakpoint
CREATE TABLE `recurring_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`kind` text DEFAULT 'STANDARD' NOT NULL,
	`debt_id` text,
	`name` text,
	`amount_minor` integer,
	`is_passive` integer DEFAULT false NOT NULL,
	`category_id` text,
	`default_account_id` text,
	`frequency` text NOT NULL,
	`anchor_date` text,
	`next_due_date` text,
	`snoozed_until` integer,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`default_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ck_rec_type" CHECK("recurring_items"."type" IN ('INCOME', 'EXPENSE')),
	CONSTRAINT "ck_rec_kind" CHECK("recurring_items"."kind" IN ('STANDARD', 'DEBT_INSTALLMENT')),
	CONSTRAINT "ck_rec_frequency" CHECK("recurring_items"."frequency" IN ('WEEKLY', 'BIWEEKLY', 'MONTHLY')),
	CONSTRAINT "ck_rec_status" CHECK("recurring_items"."status" IN ('ACTIVE', 'PAUSED')),
	CONSTRAINT "ck_rec_kind_debt" CHECK(("recurring_items"."kind" = 'DEBT_INSTALLMENT') = ("recurring_items"."debt_id" IS NOT NULL)),
	CONSTRAINT "ck_rec_debt_installment" CHECK("recurring_items"."kind" <> 'DEBT_INSTALLMENT' OR ("recurring_items"."type" = 'EXPENSE' AND "recurring_items"."amount_minor" IS NULL AND "recurring_items"."name" IS NULL)),
	CONSTRAINT "ck_rec_standard" CHECK("recurring_items"."kind" <> 'STANDARD' OR ("recurring_items"."amount_minor" IS NOT NULL AND "recurring_items"."amount_minor" > 0 AND "recurring_items"."name" IS NOT NULL)),
	CONSTRAINT "ck_rec_passive_income" CHECK("recurring_items"."is_passive" = 0 OR "recurring_items"."type" = 'INCOME'),
	CONSTRAINT "ck_rec_anchor_date" CHECK("recurring_items"."anchor_date" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	CONSTRAINT "ck_rec_next_due_date" CHECK("recurring_items"."next_due_date" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_rec_debt` ON `recurring_items` (`debt_id`);--> statement-breakpoint
CREATE INDEX `idx_rec_user_status` ON `recurring_items` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_rec_category` ON `recurring_items` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_rec_default_account` ON `recurring_items` (`default_account_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`type` text NOT NULL,
	`kind` text DEFAULT 'STANDARD' NOT NULL,
	`amount_minor` integer NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`date` integer NOT NULL,
	`category_id` text,
	`is_passive` integer DEFAULT false NOT NULL,
	`debt_id` text,
	`debt_payment_type` text,
	`debt_principal_applied_minor` integer,
	`recurring_item_id` text,
	`occurrence_date` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`recurring_item_id`) REFERENCES `recurring_items`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ck_tx_amount" CHECK("transactions"."amount_minor" > 0),
	CONSTRAINT "ck_tx_type" CHECK("transactions"."type" IN ('INCOME', 'EXPENSE')),
	CONSTRAINT "ck_tx_kind" CHECK("transactions"."kind" IN ('STANDARD', 'DEBT_PAYMENT')),
	CONSTRAINT "ck_tx_payment_type" CHECK("transactions"."debt_payment_type" IN ('INSTALLMENT', 'EXTRA')),
	CONSTRAINT "ck_tx_passive_income" CHECK("transactions"."is_passive" = 0 OR "transactions"."type" = 'INCOME'),
	CONSTRAINT "ck_tx_debt_payment" CHECK("transactions"."kind" <> 'DEBT_PAYMENT' OR ("transactions"."type" = 'EXPENSE' AND "transactions"."debt_id" IS NOT NULL AND "transactions"."debt_payment_type" IS NOT NULL AND "transactions"."debt_principal_applied_minor" IS NOT NULL)),
	CONSTRAINT "ck_tx_standard_no_debt" CHECK("transactions"."kind" <> 'STANDARD' OR ("transactions"."debt_id" IS NULL AND "transactions"."debt_payment_type" IS NULL AND "transactions"."debt_principal_applied_minor" IS NULL)),
	CONSTRAINT "ck_tx_principal_range" CHECK("transactions"."debt_principal_applied_minor" IS NULL OR ("transactions"."debt_principal_applied_minor" >= 0 AND "transactions"."debt_principal_applied_minor" <= "transactions"."amount_minor")),
	CONSTRAINT "ck_tx_occurrence_required" CHECK("transactions"."recurring_item_id" IS NULL OR "transactions"."occurrence_date" IS NOT NULL),
	CONSTRAINT "ck_tx_occurrence_date" CHECK("transactions"."occurrence_date" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')
);
--> statement-breakpoint
CREATE INDEX `idx_tx_user_date` ON `transactions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_tx_account` ON `transactions` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_tx_debt` ON `transactions` (`debt_id`);--> statement-breakpoint
CREATE INDEX `idx_tx_category` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tx_recurring_occurrence` ON `transactions` (`recurring_item_id`,`occurrence_date`) WHERE "transactions"."recurring_item_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`currency` text DEFAULT 'COP' NOT NULL,
	`theme_preference` text DEFAULT 'system' NOT NULL,
	`notify_payment_reminders` integer DEFAULT true NOT NULL,
	`notify_weekly_summary` integer DEFAULT true NOT NULL,
	`reminder_hour` integer DEFAULT 9 NOT NULL,
	`widget_cashflow` integer,
	`widget_debts` integer,
	`widget_goals` integer,
	`onboarding_completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "ck_users_theme" CHECK("users"."theme_preference" IN ('light', 'dark', 'system')),
	CONSTRAINT "ck_users_reminder_hour" CHECK("users"."reminder_hour" BETWEEN 0 AND 23),
	CONSTRAINT "ck_users_widget_cashflow" CHECK("users"."widget_cashflow" IN (0, 1)),
	CONSTRAINT "ck_users_widget_debts" CHECK("users"."widget_debts" IN (0, 1)),
	CONSTRAINT "ck_users_widget_goals" CHECK("users"."widget_goals" IN (0, 1))
);
