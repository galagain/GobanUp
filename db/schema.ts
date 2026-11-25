import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  lookup: text("lookup").notNull().unique(),
  salt: text("salt").notNull(),
  hash: text("hash").notNull(),
  iterations: integer("iterations").notNull(),
});
export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  expires: integer("expires").notNull(),
}, t => [index("sessions_expiry").on(t.expires)]);
export const friendships = sqliteTable("friendships", {
  lo: text("lo").notNull().references(() => users.id),
  hi: text("hi").notNull().references(() => users.id),
  sender: text("sender").notNull().references(() => users.id),
  accepted: integer("accepted").notNull().default(0),
}, t => [primaryKey({columns:[t.lo,t.hi]}),check("ordered_pair",sql`${t.lo}<${t.hi}`)]);
export const authLimits = sqliteTable("auth_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expires: integer("expires").notNull(),
});
export const games = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  size: integer("size").notNull(),
  black: text("black").notNull(),
  white: text("white"),
  whiteTicket: text("white_ticket").unique(),
  blackName: text("black_name").notNull(),
  whiteName: text("white_name"),
  moves: text("moves").notNull().default("[]"),
  revision: integer("revision").notNull().default(0),
  touched: integer("touched").notNull(),
  resigned: integer("resigned"),
  recipient: text("recipient").references(() => users.id),
}, t => [
  index("available").on(t.kind,t.size,t.white,t.touched),
  index("rooms_black").on(t.black,t.touched),
  index("rooms_white").on(t.white,t.touched),
  index("room_invites").on(t.recipient,t.white),
  uniqueIndex("pending_challenge").on(t.black,t.recipient).where(sql`${t.white} IS NULL AND ${t.recipient} IS NOT NULL`),
]);
