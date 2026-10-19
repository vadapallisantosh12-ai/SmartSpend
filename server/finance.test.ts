import { describe, expect, it } from "vitest";
import { budgetStatus, calculateBudgetUtilization, calculateCategorySpending, calculateSavingsRate, calculateTotalExpenses, calculateTotalIncome, getPeriodRange, proposeBudget } from "./finance";
import type { Budget, Transaction } from "../drizzle/schema";

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: crypto.randomUUID(), userId: 1, description: "Test", amountPaise: 10000, type: "expense", category: "Other", date: "2026-10-10", notes: null, paymentMethod: null, createdAt: new Date(), ...overrides,
});

const budget = (overrides: Partial<Budget>): Budget => ({ id: crypto.randomUUID(), userId: 1, month: "2026-10", category: "Food and Dining", limitPaise: 100000, createdAt: new Date(), updatedAt: new Date(), ...overrides });

describe("deterministic finance calculations", () => {
  it("separates income from expense totals and handles zero income", () => {
    const records = [tx({ type: "income", amountPaise: 250000, category: "Salary" }), tx({ type: "expense", amountPaise: 50000, category: "Food and Dining" })];
    expect(calculateTotalIncome(records)).toBe(2500);
    expect(calculateTotalExpenses(records)).toBe(500);
    expect(calculateSavingsRate(0, 10)).toBe(0);
  });

  it("groups only expense categories", () => {
    const records = [tx({ type: "income", amountPaise: 100000, category: "Salary" }), tx({ type: "expense", amountPaise: 12000, category: "Food and Dining" }), tx({ type: "expense", amountPaise: 8000, category: "Food and Dining" })];
    expect(calculateCategorySpending(records)).toEqual([{ category: "Food and Dining", amount: 200 }]);
  });

  it("applies the requested budget status thresholds and excludes income", () => {
    expect(budgetStatus(74.99)).toBe("normal");
    expect(budgetStatus(75)).toBe("approaching");
    expect(budgetStatus(100)).toBe("exceeded");
    const utilization = calculateBudgetUtilization(budget({ limitPaise: 100000 }), [tx({ type: "income", amountPaise: 100000, category: "Food and Dining" }), tx({ type: "expense", amountPaise: 80000, category: "Food and Dining" })]);
    expect(utilization.spent).toBe(800);
    expect(utilization.percent).toBe(80);
    expect(utilization.status).toBe("approaching");
  });

  it("keeps a proposed budget internally consistent with available income", () => {
    const result = proposeBudget({ income: 5000, fixedExpenses: 2000, variableExpenses: 3000, savingsCommitment: 0, preferredSavingsTarget: 1000, debtPayments: 0 });
    expect(result.totalPlanned).toBeLessThanOrEqual(5000);
    expect(result.deficit).toBe(false);
    expect(result.categories.some(item => item.category === "Savings")).toBe(true);
  });

  it("honors a committed savings amount even when the preferred target is lower", () => {
    const result = proposeBudget({ income: 5000, fixedExpenses: 1000, variableExpenses: 1000, savingsCommitment: 1500, preferredSavingsTarget: 500, debtPayments: 0 });
    expect(result.savingsTarget).toBe(1500);
  });

  it("returns stable calendar ranges for all reporting period modes", () => {
    const now = new Date("2026-10-19T12:00:00");
    expect(getPeriodRange("this-month", undefined, undefined, now)).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(getPeriodRange("last-month", undefined, undefined, now)).toEqual({ start: "2026-09-01", end: "2026-09-30" });
    expect(getPeriodRange("last-3-months", undefined, undefined, now)).toEqual({ start: "2026-08-01", end: "2026-10-31" });
    expect(getPeriodRange("custom", "2026-07-12", "2026-08-03", now)).toEqual({ start: "2026-07-12", end: "2026-08-03" });
  });
});
