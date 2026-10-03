CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`institution` text,
	`color` text NOT NULL,
	`icon` text NOT NULL,
	`cashflow_class` text DEFAULT 'NEUTRAL' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `budgets_monthly` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`month` integer NOT NULL,
	`year` integer NOT NULL,
	`total_income_expected` real NOT NULL,
	`total_fixed_expenses` real NOT NULL,
	`total_debt_payments` real NOT NULL,
	`total_free_amount` real NOT NULL,
	`budget_config` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`icon` text NOT NULL,
	`color` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `debt_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`institution` text NOT NULL,
	`credit_limit` real NOT NULL,
	`used_amount` real NOT NULL,
	`cutoff_day` integer NOT NULL,
	`payment_day` integer NOT NULL,
	`interest_rate_monthly` real,
	`min_payment_percent` real,
	`is_auto_debit` integer DEFAULT false NOT NULL,
	`cashflow_class` text DEFAULT 'LIABILITY' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `debt_loans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`institution` text NOT NULL,
	`original_amount` real NOT NULL,
	`current_balance` real NOT NULL,
	`monthly_payment` real NOT NULL,
	`payment_day_of_month` integer NOT NULL,
	`total_installments` integer NOT NULL,
	`remaining_installments` integer NOT NULL,
	`interest_rate_monthly` real,
	`interest_rate_annual` real,
	`start_date` integer NOT NULL,
	`is_auto_debit` integer DEFAULT false NOT NULL,
	`cashflow_class` text DEFAULT 'LIABILITY' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `distribution_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`percentage` real NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pockets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`goal_amount` real,
	`target_date` integer,
	`color` text NOT NULL,
	`icon` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recurring_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`income_source` text,
	`frequency` text NOT NULL,
	`day_of_week` integer,
	`day_of_month` integer,
	`month` integer,
	`is_auto_confirm` integer DEFAULT false NOT NULL,
	`is_auto_debit` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`next_due_date` integer NOT NULL,
	`last_executed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`pocket_id` text,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`description` text NOT NULL,
	`date` integer NOT NULL,
	`category_id` text,
	`recurring_item_id` text,
	`status` text DEFAULT 'CONFIRMED' NOT NULL,
	`is_confirmed` integer DEFAULT true NOT NULL,
	`transfer_to_account_id` text,
	`transfer_to_pocket_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pocket_id`) REFERENCES `pockets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`recurring_item_id`) REFERENCES `recurring_items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`transfer_to_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`transfer_to_pocket_id`) REFERENCES `pockets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`theme` text DEFAULT 'dark' NOT NULL,
	`currency` text DEFAULT 'COP' NOT NULL,
	`notifications_enabled` integer DEFAULT true NOT NULL,
	`reminder_days_before` integer DEFAULT 1 NOT NULL,
	`onboarding_completed` integer DEFAULT false NOT NULL
);
