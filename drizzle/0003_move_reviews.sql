CREATE TABLE `review_moves` (
	`review` text NOT NULL,
	`ply` integer NOT NULL,
	`result` text NOT NULL,
	PRIMARY KEY(`review`, `ply`),
	FOREIGN KEY (`review`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`fingerprint` text NOT NULL,
	`record` text NOT NULL,
	`total` integer NOT NULL,
	`done` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`owner` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`requester` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_record` ON `reviews` (`scope`,`fingerprint`);--> statement-breakpoint
CREATE INDEX `review_queue` ON `reviews` (`status`,`created`);--> statement-breakpoint
CREATE INDEX `review_requester` ON `reviews` (`requester`,`created`);