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
  cadence: text("cadence").notNull().default("none"),
  clock: text("clock"),
  resigned: integer("resigned"),
  recipient: text("recipient").references(() => users.id),
}, t => [
  index("available").on(t.kind,t.size,t.white,t.touched),
  index("rooms_black").on(t.black,t.touched),
  index("rooms_white").on(t.white,t.touched),
  index("room_invites").on(t.recipient,t.white),
  uniqueIndex("pending_challenge").on(t.black,t.recipient).where(sql`${t.white} IS NULL AND ${t.recipient} IS NOT NULL`),
]);

export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  scope: text("scope").notNull(),
  fingerprint: text("fingerprint").notNull(),
  record: text("record").notNull(),
  total: integer("total").notNull(),
  done: integer("done").notNull().default(0),
  status: text("status").notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  owner: text("owner"),
  leaseUntil: integer("lease_until").notNull().default(0),
  requester: text("requester").notNull(),
  created: integer("created").notNull(),
}, t => [uniqueIndex("review_record").on(t.scope,t.fingerprint),index("review_queue").on(t.status,t.created),
  index("review_requester").on(t.requester,t.created)]);
export const reviewMoves = sqliteTable("review_moves", {
  review: text("review").notNull().references(()=>reviews.id,{onDelete:"cascade"}),
  ply: integer("ply").notNull(),
  result: text("result").notNull(),
}, t => [primaryKey({columns:[t.review,t.ply]})]);
