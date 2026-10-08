CREATE TABLE "access_links" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"board_id" text,
	"member_id" text,
	"kind" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_links_kind_check" CHECK ("access_links"."kind" in ('owner', 'member_invite', 'board_share')),
	CONSTRAINT "access_links_shape_check" CHECK ((
        ("access_links"."kind" = 'owner' and "access_links"."member_id" is not null and "access_links"."board_id" is null)
        or ("access_links"."kind" = 'member_invite' and "access_links"."member_id" is null and "access_links"."board_id" is null)
        or ("access_links"."kind" = 'board_share' and "access_links"."board_id" is not null and "access_links"."member_id" is null)
      ))
);
--> statement-breakpoint
CREATE TABLE "boards" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"visibility" text DEFAULT 'public' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "boards_team_id_slug_unique" UNIQUE("team_id","slug"),
	CONSTRAINT "boards_visibility_check" CHECK ("boards"."visibility" in ('public', 'private'))
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"idea_id" text NOT NULL,
	"body" text NOT NULL,
	"actor_id" text NOT NULL,
	"author_name" text,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comments_actor_id_check" CHECK (("comments"."actor_id" like 'anon:%' or "comments"."actor_id" like 'member:%'))
);
--> statement-breakpoint
CREATE TABLE "idea_status_events" (
	"id" text PRIMARY KEY NOT NULL,
	"idea_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idea_status_events_actor_id_check" CHECK (("idea_status_events"."actor_id" like 'anon:%' or "idea_status_events"."actor_id" like 'member:%')),
	CONSTRAINT "idea_status_events_from_check" CHECK ("idea_status_events"."from_status" in ('open', 'planned', 'in_progress', 'shipped', 'declined')),
	CONSTRAINT "idea_status_events_to_check" CHECK ("idea_status_events"."to_status" in ('open', 'planned', 'in_progress', 'shipped', 'declined'))
);
--> statement-breakpoint
CREATE TABLE "idea_tags" (
	"idea_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"board_id" text NOT NULL,
	CONSTRAINT "idea_tags_idea_id_tag_id_pk" PRIMARY KEY("idea_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "ideas" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"actor_id" text NOT NULL,
	"author_name" text,
	"hidden" boolean DEFAULT false NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))) STORED,
	CONSTRAINT "ideas_id_board_id_unique" UNIQUE("id","board_id"),
	CONSTRAINT "ideas_status_check" CHECK ("ideas"."status" in ('open', 'planned', 'in_progress', 'shipped', 'declined')),
	CONSTRAINT "ideas_actor_id_check" CHECK (("ideas"."actor_id" like 'anon:%' or "ideas"."actor_id" like 'member:%'))
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_role_check" CHECK ("members"."role" in ('owner', 'member'))
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	CONSTRAINT "tags_board_id_name_unique" UNIQUE("board_id","name"),
	CONSTRAINT "tags_id_board_id_unique" UNIQUE("id","board_id")
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"idea_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_idea_id_actor_id_pk" PRIMARY KEY("idea_id","actor_id"),
	CONSTRAINT "votes_actor_id_check" CHECK (("votes"."actor_id" like 'anon:%' or "votes"."actor_id" like 'member:%'))
);
--> statement-breakpoint
ALTER TABLE "access_links" ADD CONSTRAINT "access_links_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_links" ADD CONSTRAINT "access_links_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_links" ADD CONSTRAINT "access_links_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_status_events" ADD CONSTRAINT "idea_status_events_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_tags" ADD CONSTRAINT "idea_tags_idea_board_fk" FOREIGN KEY ("idea_id","board_id") REFERENCES "public"."ideas"("id","board_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_tags" ADD CONSTRAINT "idea_tags_tag_board_fk" FOREIGN KEY ("tag_id","board_id") REFERENCES "public"."tags"("id","board_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_links_token_hash_unique" ON "access_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "boards_team_id_idx" ON "boards" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "comments_idea_created_idx" ON "comments" USING btree ("idea_id","created_at");--> statement-breakpoint
CREATE INDEX "idea_status_events_idea_idx" ON "idea_status_events" USING btree ("idea_id","created_at");--> statement-breakpoint
CREATE INDEX "ideas_board_status_created_idx" ON "ideas" USING btree ("board_id","status","created_at");--> statement-breakpoint
CREATE INDEX "ideas_unreviewed_idx" ON "ideas" USING btree ("board_id","created_at") WHERE "ideas"."reviewed_at" is null;--> statement-breakpoint
CREATE INDEX "ideas_search_idx" ON "ideas" USING gin ("search");--> statement-breakpoint
CREATE INDEX "members_team_id_idx" ON "members" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "tags_board_id_idx" ON "tags" USING btree ("board_id");