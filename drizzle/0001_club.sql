CREATE TABLE `auth_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `friendships` (
	`lo` text NOT NULL,
	`hi` text NOT NULL,
	`sender` text NOT NULL,
	`accepted` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`lo`, `hi`),
	FOREIGN KEY (`lo`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hi`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ordered_pair" CHECK("friendships"."lo"<"friendships"."hi")
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_expiry` ON `sessions` (`expires`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`lookup` text NOT NULL,
	`salt` text NOT NULL,
	`hash` text NOT NULL,
	`iterations` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_lookup_unique` ON `users` (`lookup`);--> statement-breakpoint
ALTER TABLE `rooms` ADD `recipient` text REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `rooms_black` ON `rooms` (`black`,`touched`);--> statement-breakpoint
CREATE INDEX `rooms_white` ON `rooms` (`white`,`touched`);--> statement-breakpoint
CREATE INDEX `room_invites` ON `rooms` (`recipient`,`white`);--> statement-breakpoint
CREATE UNIQUE INDEX `pending_challenge` ON `rooms` (`black`,`recipient`) WHERE "rooms"."white" IS NULL AND "rooms"."recipient" IS NOT NULL;