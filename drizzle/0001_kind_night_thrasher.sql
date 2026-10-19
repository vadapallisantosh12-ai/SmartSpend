CREATE TABLE `budgets` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`month` varchar(7) NOT NULL,
	`category` varchar(64) NOT NULL,
	`limitPaise` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budgets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `savingsContributions` (
	`id` varchar(36) NOT NULL,
	`goalId` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`amountPaise` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`note` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `savingsContributions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `savingsGoals` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`targetPaise` int NOT NULL,
	`currentPaise` int NOT NULL DEFAULT 0,
	`targetDate` varchar(10) NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `savingsGoals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`description` varchar(160) NOT NULL,
	`amountPaise` int NOT NULL,
	`type` enum('income','expense') NOT NULL,
	`category` varchar(64) NOT NULL,
	`date` varchar(10) NOT NULL,
	`notes` text,
	`paymentMethod` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userSettings` (
	`userId` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'INR',
	`dateFormat` varchar(24) NOT NULL DEFAULT 'dd MMM yyyy',
	`theme` enum('light','dark') NOT NULL DEFAULT 'light',
	`defaultPeriod` varchar(24) NOT NULL DEFAULT 'this-month',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userSettings_userId` PRIMARY KEY(`userId`)
);
