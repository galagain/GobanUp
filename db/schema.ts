import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
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
  touched: integer("touched").notNull()
}, table => [index("available").on(table.kind, table.size, table.white, table.touched)]);
