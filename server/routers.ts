import { TRPCError } from "@trpc/server";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { budgets, savingsContributions, savingsGoals, transactions, userSettings } from "../drizzle/schema";
import { amountToPaise, buildAiContext, calculateBudgetUtilization, calculateGoalProgress, getPeriodRange, monthString, proposeBudget, summarizeTransactions } from "./finance";
import { getDb } from "./db";
import { askGemini } from "./gemini";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const expenseCategories = ["Food and Dining", "Groceries", "Transportation", "Shopping", "Education", "Housing", "Utilities", "Healthcare", "Entertainment", "Travel", "Personal Care", "Subscriptions", "Other"] as const;
const incomeCategories = ["Salary", "Freelancing", "Business", "Scholarship", "Allowance", "Investment Income", "Other"] as const;
const allBudgetCategories = ["All expenses", ...expenseCategories] as const;
const today = () => new Date().toISOString().slice(0, 10);
const id = () => crypto.randomUUID();
const money = z.number().finite().positive("Amount must be greater than zero").max(20_000_000, "Amount is above the supported safe limit");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").refine(value => { const parsed = new Date(`${value}T00:00:00Z`); return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value; }, "Use a real calendar date");
const category = z.string().min(1).max(64);
const period = z.enum(["this-month", "last-month", "last-3-months", "custom"]);

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The application database is unavailable." });
  return db;
}

const financeRouter = router({
  bootstrap: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const [transactionRows, budgetRows, goalRows, settingsRows] = await Promise.all([
      db.select().from(transactions).where(eq(transactions.userId, ctx.user.id)).orderBy(desc(transactions.date), desc(transactions.createdAt)),
      db.select().from(budgets).where(eq(budgets.userId, ctx.user.id)).orderBy(desc(budgets.month), desc(budgets.createdAt)),
      db.select().from(savingsGoals).where(eq(savingsGoals.userId, ctx.user.id)).orderBy(desc(savingsGoals.createdAt)),
      db.select().from(userSettings).where(eq(userSettings.userId, ctx.user.id)).limit(1),
    ]);
    return {
      transactions: transactionRows,
      budgets: budgetRows,
      goals: goalRows,
      settings: settingsRows[0] ?? { userId: ctx.user.id, currency: "INR", dateFormat: "dd MMM yyyy", theme: "light" as const, defaultPeriod: "this-month" },
    };
  }),

  transactions: router({
    list: protectedProcedure.input(z.object({ search: z.string().optional(), type: z.enum(["all", "income", "expense"]).default("all"), category: z.string().optional() }).optional()).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const conditions = [eq(transactions.userId, ctx.user.id)];
      if (input?.type && input.type !== "all") conditions.push(eq(transactions.type, input.type));
      if (input?.category && input.category !== "all") conditions.push(eq(transactions.category, input.category));
      if (input?.search?.trim()) conditions.push(or(like(transactions.description, `%${input.search.trim()}%`), like(transactions.category, `%${input.search.trim()}%`))!);
      return db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.date), desc(transactions.createdAt));
    }),
    create: protectedProcedure.input(z.object({ description: z.string().trim().min(1).max(160), amount: money, type: z.enum(["income", "expense"]), category, date, notes: z.string().max(2000).optional(), paymentMethod: z.string().max(64).optional() })).mutation(async ({ ctx, input }) => {
      const validCategories = input.type === "income" ? incomeCategories : expenseCategories;
      if (!validCategories.includes(input.category as never)) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a valid category for this transaction type." });
      const db = await requireDb();
      const transactionId = id();
      await db.insert(transactions).values({ id: transactionId, userId: ctx.user.id, description: input.description, amountPaise: amountToPaise(input.amount), type: input.type, category: input.category, date: input.date, notes: input.notes || null, paymentMethod: input.paymentMethod || null });
      return { id: transactionId };
    }),
    update: protectedProcedure.input(z.object({ id: z.string().uuid(), description: z.string().trim().min(1).max(160), amount: money, type: z.enum(["income", "expense"]), category, date, notes: z.string().max(2000).optional(), paymentMethod: z.string().max(64).optional() })).mutation(async ({ ctx, input }) => {
      const validCategories = input.type === "income" ? incomeCategories : expenseCategories;
      if (!validCategories.includes(input.category as never)) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a valid category for this transaction type." });
      const db = await requireDb();
      await db.update(transactions).set({ description: input.description, amountPaise: amountToPaise(input.amount), type: input.type, category: input.category, date: input.date, notes: input.notes || null, paymentMethod: input.paymentMethod || null }).where(and(eq(transactions.id, input.id), eq(transactions.userId, ctx.user.id)));
      return { success: true };
    }),
    remove: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.delete(transactions).where(and(eq(transactions.id, input.id), eq(transactions.userId, ctx.user.id)));
      return { success: true };
    }),
    exportCsv: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const rows = await db.select().from(transactions).where(eq(transactions.userId, ctx.user.id)).orderBy(desc(transactions.date));
      const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
      const csv = ["id,description,amount,type,category,date,notes,paymentMethod", ...rows.map(row => [row.id, row.description, (row.amountPaise / 100).toFixed(2), row.type, row.category, row.date, row.notes, row.paymentMethod].map(escape).join(","))].join("\n");
      return { csv, filename: `smartspend-transactions-${today()}.csv` };
    }),
  }),

  budgets: router({
    list: protectedProcedure.input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }).optional()).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const conditions = [eq(budgets.userId, ctx.user.id)];
      if (input?.month) conditions.push(eq(budgets.month, input.month));
      return db.select().from(budgets).where(and(...conditions)).orderBy(desc(budgets.month), desc(budgets.createdAt));
    }),
    create: protectedProcedure.input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), category: z.enum(allBudgetCategories), limit: money })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const budgetId = id();
      await db.insert(budgets).values({ id: budgetId, userId: ctx.user.id, month: input.month, category: input.category, limitPaise: amountToPaise(input.limit) }).onDuplicateKeyUpdate({ set: { limitPaise: amountToPaise(input.limit) } });
      return { id: budgetId };
    }),
    update: protectedProcedure.input(z.object({ id: z.string().uuid(), month: z.string().regex(/^\d{4}-\d{2}$/), category: z.enum(allBudgetCategories), limit: money })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.update(budgets).set({ month: input.month, category: input.category, limitPaise: amountToPaise(input.limit) }).where(and(eq(budgets.id, input.id), eq(budgets.userId, ctx.user.id)));
      return { success: true };
    }),
    remove: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.delete(budgets).where(and(eq(budgets.id, input.id), eq(budgets.userId, ctx.user.id)));
      return { success: true };
    }),
  }),

  goals: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(savingsGoals).where(eq(savingsGoals.userId, ctx.user.id)).orderBy(desc(savingsGoals.createdAt));
    }),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(120), target: money, targetDate: date, notes: z.string().max(2000).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const goalId = id();
      await db.insert(savingsGoals).values({ id: goalId, userId: ctx.user.id, name: input.name, targetPaise: amountToPaise(input.target), currentPaise: 0, targetDate: input.targetDate, notes: input.notes || null });
      return { id: goalId };
    }),
    update: protectedProcedure.input(z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(120), target: money, targetDate: date, notes: z.string().max(2000).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.update(savingsGoals).set({ name: input.name, targetPaise: amountToPaise(input.target), targetDate: input.targetDate, notes: input.notes || null }).where(and(eq(savingsGoals.id, input.id), eq(savingsGoals.userId, ctx.user.id)));
      return { success: true };
    }),
    remove: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.delete(savingsContributions).where(and(eq(savingsContributions.goalId, input.id), eq(savingsContributions.userId, ctx.user.id)));
      await db.delete(savingsGoals).where(and(eq(savingsGoals.id, input.id), eq(savingsGoals.userId, ctx.user.id)));
      return { success: true };
    }),
    contribute: protectedProcedure.input(z.object({ goalId: z.string().uuid(), amount: money, date, note: z.string().max(160).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const goal = (await db.select().from(savingsGoals).where(and(eq(savingsGoals.id, input.goalId), eq(savingsGoals.userId, ctx.user.id))).limit(1))[0];
      if (!goal) throw new TRPCError({ code: "NOT_FOUND", message: "Savings goal not found." });
      const amountPaise = amountToPaise(input.amount);
      await db.transaction(async transaction => {
        await transaction.insert(savingsContributions).values({ id: id(), goalId: input.goalId, userId: ctx.user.id, amountPaise, date: input.date, note: input.note || null });
        await transaction.update(savingsGoals).set({ currentPaise: sql`${savingsGoals.currentPaise} + ${amountPaise}` }).where(and(eq(savingsGoals.id, input.goalId), eq(savingsGoals.userId, ctx.user.id)));
      });
      return { success: true };
    }),
  }),

  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const row = (await db.select().from(userSettings).where(eq(userSettings.userId, ctx.user.id)).limit(1))[0];
      return row ?? { userId: ctx.user.id, currency: "INR", dateFormat: "dd MMM yyyy", theme: "light" as const, defaultPeriod: "this-month" };
    }),
    update: protectedProcedure.input(z.object({ currency: z.literal("INR"), dateFormat: z.enum(["dd MMM yyyy", "MMM dd, yyyy", "yyyy-MM-dd"]), theme: z.enum(["light", "dark"]), defaultPeriod: period })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.insert(userSettings).values({ userId: ctx.user.id, ...input }).onDuplicateKeyUpdate({ set: input });
      return { success: true };
    }),
    deleteAll: protectedProcedure.input(z.object({ confirmation: z.literal("DELETE MY DATA") })).mutation(async ({ ctx }) => {
      const db = await requireDb();
      const goals = await db.select({ id: savingsGoals.id }).from(savingsGoals).where(eq(savingsGoals.userId, ctx.user.id));
      for (const goal of goals) await db.delete(savingsContributions).where(and(eq(savingsContributions.goalId, goal.id), eq(savingsContributions.userId, ctx.user.id)));
      await db.delete(transactions).where(eq(transactions.userId, ctx.user.id));
      await db.delete(budgets).where(eq(budgets.userId, ctx.user.id));
      await db.delete(savingsGoals).where(eq(savingsGoals.userId, ctx.user.id));
      await db.delete(userSettings).where(eq(userSettings.userId, ctx.user.id));
      return { success: true };
    }),
  }),

  ai: router({
    chat: protectedProcedure.input(z.object({ question: z.string().trim().min(2).max(1600), period: period.default("this-month"), customStart: date.optional(), customEnd: date.optional(), history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) })).max(8).default([]) })).mutation(async ({ ctx, input }) => {
      if (input.period === "custom" && (!input.customStart || !input.customEnd || input.customStart > input.customEnd)) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a valid custom date range." });
      const db = await requireDb();
      const [tx, bs, gs] = await Promise.all([
        db.select().from(transactions).where(eq(transactions.userId, ctx.user.id)),
        db.select().from(budgets).where(eq(budgets.userId, ctx.user.id)),
        db.select().from(savingsGoals).where(eq(savingsGoals.userId, ctx.user.id)),
      ]);
      const range = getPeriodRange(input.period, input.customStart, input.customEnd);
      if (tx.length === 0) return { ok: true as const, text: "I don’t have any recorded transactions yet, so I can’t analyze spending. Add an income or expense transaction and ask me again. This is based on actual recorded data only." };
      return askGemini(input.question, buildAiContext(tx, bs, gs, range), input.history);
    }),
    planBudget: protectedProcedure.input(z.object({ income: z.number().nonnegative(), fixedExpenses: z.number().nonnegative(), variableExpenses: z.number().nonnegative(), savingsCommitment: z.number().nonnegative(), preferredSavingsTarget: z.number().nonnegative(), debtPayments: z.number().nonnegative(), financialGoals: z.string().max(500).default("") })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const tx = await db.select().from(transactions).where(eq(transactions.userId, ctx.user.id));
      const currentMonth = monthString();
      const summary = summarizeTransactions(tx, { start: `${currentMonth}-01`, end: `${currentMonth}-31` });
      return proposeBudget({ ...input, actualCategories: summary.categories });
    }),
  }),

  summary: protectedProcedure.input(z.object({ period: period.default("this-month"), customStart: date.optional(), customEnd: date.optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await requireDb();
    const [tx, bs, gs] = await Promise.all([
      db.select().from(transactions).where(eq(transactions.userId, ctx.user.id)),
      db.select().from(budgets).where(eq(budgets.userId, ctx.user.id)),
      db.select().from(savingsGoals).where(eq(savingsGoals.userId, ctx.user.id)),
    ]);
    const range = getPeriodRange(input?.period ?? "this-month", input?.customStart, input?.customEnd);
    return { range, summary: summarizeTransactions(tx, range), cashFlow: tx.filter(t => t.date >= range.start && t.date <= range.end), budgets: bs.map(b => calculateBudgetUtilization(b, tx)), goals: gs.map(g => ({ ...g, progress: calculateGoalProgress(g) })) };
  }),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  finance: financeRouter,
});

export type AppRouter = typeof appRouter;
