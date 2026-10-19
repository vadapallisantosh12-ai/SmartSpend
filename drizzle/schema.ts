import { int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const transactions = mysqlTable("transactions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  description: varchar("description", { length: 160 }).notNull(),
  amountPaise: int("amountPaise").notNull(),
  type: mysqlEnum("type", ["income", "expense"]).notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  notes: text("notes"),
  paymentMethod: varchar("paymentMethod", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const budgets = mysqlTable("budgets", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  month: varchar("month", { length: 7 }).notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  limitPaise: int("limitPaise").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ ownerMonthCategory: uniqueIndex("budgets_owner_month_category").on(table.userId, table.month, table.category) }));

export const savingsGoals = mysqlTable("savingsGoals", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  name: varchar("name", { length: 120 }).notNull(),
  targetPaise: int("targetPaise").notNull(),
  currentPaise: int("currentPaise").notNull().default(0),
  targetDate: varchar("targetDate", { length: 10 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const savingsContributions = mysqlTable("savingsContributions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  goalId: varchar("goalId", { length: 36 }).notNull().references(() => savingsGoals.id),
  userId: int("userId").notNull().references(() => users.id),
  amountPaise: int("amountPaise").notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  note: varchar("note", { length: 160 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const userSettings = mysqlTable("userSettings", {
  userId: int("userId").primaryKey().references(() => users.id),
  currency: varchar("currency", { length: 3 }).notNull().default("INR"),
  dateFormat: varchar("dateFormat", { length: 24 }).notNull().default("dd MMM yyyy"),
  theme: mysqlEnum("theme", ["light", "dark"]).notNull().default("light"),
  defaultPeriod: varchar("defaultPeriod", { length: 24 }).notNull().default("this-month"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type InsertBudget = typeof budgets.$inferInsert;
export type SavingsGoal = typeof savingsGoals.$inferSelect;
export type InsertSavingsGoal = typeof savingsGoals.$inferInsert;
export type SavingsContribution = typeof savingsContributions.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
