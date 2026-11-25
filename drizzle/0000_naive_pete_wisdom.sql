CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`size` integer NOT NULL,
	`black` text NOT NULL,
	`white` text,
	`white_ticket` text,
	`black_name` text NOT NULL,
	`white_name` text,
	`moves` text DEFAULT '[]' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`touched` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_white_ticket_unique` ON `rooms` (`white_ticket`);--> statement-breakpoint
CREATE INDEX `available` ON `rooms` (`kind`,`size`,`white`,`touched`);