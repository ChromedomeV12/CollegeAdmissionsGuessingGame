import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

export const profiles = sqliteTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    sortOrder: integer("sort_order").notNull(),
    publicJson: text("public_json").notNull(),
    fullJson: text("full_json").notNull(),
    importedAt: text("imported_at").notNull(),
  },
  (table) => [uniqueIndex("idx_profiles_sort_order").on(table.sortOrder)],
);

export const scores = sqliteTable(
  "scores",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    breakdown: text("breakdown"),
  },
  (table) => [primaryKey({ columns: [table.userId, table.profileId] })],
);

export const profileLocks = sqliteTable(
  "profile_locks",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    lockedAt: text("locked_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.profileId] })],
);

export const rivals = sqliteTable(
  "rivals",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rivalUserId: text("rival_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.rivalUserId] })],
);

export const gameAttempts = sqliteTable(
  "game_attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    state: text("state").notNull(),
    startedAt: text("started_at").notNull(),
    retryDeadline: text("retry_deadline"),
    recoveryDeadline: text("recovery_deadline"),
    retryStartedAt: text("retry_started_at"),
    firstResult: text("first_result"),
    firstPrediction: text("first_prediction"),
    finalizedResult: text("finalized_result"),
    finalizedAt: text("finalized_at"),
  },
  (table) => [
    check(
      "game_attempts_state_check",
      sql`${table.state} IN ('guessing','retry_pending','retrying','finalized')`,
    ),
    uniqueIndex("idx_game_attempts_active_profile")
      .on(table.userId, table.profileId)
      .where(sql`${table.state} <> 'finalized'`),
    index("idx_game_attempts_user_profile").on(table.userId, table.profileId),
  ],
);

export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
