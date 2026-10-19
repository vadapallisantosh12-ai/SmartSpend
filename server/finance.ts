import type { Budget, SavingsGoal, Transaction } from "../drizzle/schema";

export type PeriodKey = "this-month" | "last-month" | "last-3-months" | "custom";
export type DateRange = { start: string; end: string };

const pad = (value: number) => String(value).padStart(2, "0");
export const toDateString = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const monthString = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
export const amountToPaise = (amount: number) => Math.round(amount * 100);
export const paiseToAmount = (paise: number | string | null | undefined) => Number(paise ?? 0) / 100;

export function getPeriodRange(period: PeriodKey, customStart?: string, customEnd?: string, now = new Date()): DateRange {
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  if (period === "custom" && customStart && customEnd) return { start: customStart, end: customEnd };
  if (period === "last-month") {
    return { start: toDateString(new Date(now.getFullYear(), now.getMonth() - 1, 1)), end: toDateString(new Date(now.getFullYear(), now.getMonth(), 0)) };
  }
  if (period === "last-3-months") {
    return { start: toDateString(new Date(now.getFullYear(), now.getMonth() - 2, 1)), end: toDateString(currentMonthEnd) };
  }
  return { start: toDateString(currentMonthStart), end: toDateString(currentMonthEnd) };
}

export function inRange(date: string, range: DateRange) {
  return date >= range.start && date <= range.end;
}

export function calculateTotalIncome(transactions: Transaction[]) {
  return transactions.filter(t => t.type === "income").reduce((total, t) => total + paiseToAmount(t.amountPaise), 0);
}

export function calculateTotalExpenses(transactions: Transaction[]) {
  return transactions.filter(t => t.type === "expense").reduce((total, t) => total + paiseToAmount(t.amountPaise), 0);
}

export function calculateRemainingBalance(income: number, expenses: number) {
  return income - expenses;
}

export function calculateSavingsRate(income: number, expenses: number) {
  return income > 0 ? ((income - expenses) / income) * 100 : 0;
}

export function calculateCategorySpending(transactions: Transaction[]) {
  const totals = new Map<string, number>();
  transactions.filter(t => t.type === "expense").forEach(t => totals.set(t.category, (totals.get(t.category) ?? 0) + paiseToAmount(t.amountPaise)));
  return [...totals.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

export function calculateDailyCashFlow(transactions: Transaction[], range: DateRange) {
  const map = new Map<string, { date: string; income: number; expenses: number }>();
  transactions.filter(t => inRange(t.date, range)).forEach(t => {
    const row = map.get(t.date) ?? { date: t.date, income: 0, expenses: 0 };
    if (t.type === "income") row.income += paiseToAmount(t.amountPaise); else row.expenses += paiseToAmount(t.amountPaise);
    map.set(t.date, row);
  });
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function budgetStatus(percent: number): "normal" | "approaching" | "exceeded" {
  if (percent >= 100) return "exceeded";
  if (percent >= 75) return "approaching";
  return "normal";
}

export function calculateBudgetUtilization(budget: Budget, transactions: Transaction[]) {
  const spent = transactions.filter(t => t.type === "expense" && (budget.category === "All expenses" || t.category === budget.category) && t.date.startsWith(budget.month)).reduce((sum, t) => sum + paiseToAmount(t.amountPaise), 0);
  const limit = paiseToAmount(budget.limitPaise);
  const percent = limit > 0 ? (spent / limit) * 100 : 0;
  return { budgetId: budget.id, category: budget.category, month: budget.month, limit, spent, remaining: limit - spent, percent, status: budgetStatus(percent) };
}

export function calculateMonthlyComparison(transactions: Transaction[], range: DateRange) {
  const current = transactions.filter(t => inRange(t.date, range));
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const previousEnd = new Date(start.getTime() - 86400000);
  const previousStart = new Date(previousEnd.getTime() - (days - 1) * 86400000);
  const previous = transactions.filter(t => inRange(t.date, { start: toDateString(previousStart), end: toDateString(previousEnd) }));
  const currentExpenses = calculateTotalExpenses(current);
  const previousExpenses = calculateTotalExpenses(previous);
  return { currentExpenses, previousExpenses, change: previousExpenses > 0 ? ((currentExpenses - previousExpenses) / previousExpenses) * 100 : null, hasComparison: previous.length > 0 };
}

export function calculateGoalProgress(goal: SavingsGoal) {
  const target = paiseToAmount(goal.targetPaise);
  const saved = paiseToAmount(goal.currentPaise);
  const progress = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
  const today = toDateString(new Date());
  const daysRemaining = Math.max(0, Math.round((new Date(`${goal.targetDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000));
  const monthlyNeeded = daysRemaining > 0 ? Math.max(0, target - saved) / Math.max(1, daysRemaining / 30.4375) : null;
  return { target, saved, remaining: Math.max(0, target - saved), progress, monthlyNeeded, targetDatePassed: goal.targetDate < today && saved < target };
}

export function summarizeTransactions(transactions: Transaction[], range: DateRange) {
  const relevant = transactions.filter(t => inRange(t.date, range));
  const income = calculateTotalIncome(relevant);
  const expenses = calculateTotalExpenses(relevant);
  return {
    range,
    transactionCount: relevant.length,
    income,
    expenses,
    balance: calculateRemainingBalance(income, expenses),
    savingsRate: calculateSavingsRate(income, expenses),
    categories: calculateCategorySpending(relevant),
    largestExpenses: relevant.filter(t => t.type === "expense").sort((a, b) => b.amountPaise - a.amountPaise).slice(0, 5).map(t => ({ description: t.description, category: t.category, amount: paiseToAmount(t.amountPaise), date: t.date })),
  };
}

export function buildAiContext(transactions: Transaction[], budgets: Budget[], goals: SavingsGoal[], range: DateRange) {
  const relevant = transactions.filter(t => inRange(t.date, range));
  return {
    verifiedSummary: summarizeTransactions(transactions, range),
    budgets: budgets.filter(b => b.month >= range.start.slice(0, 7) && b.month <= range.end.slice(0, 7)).map(b => calculateBudgetUtilization(b, transactions)),
    goals: goals.map(g => ({ name: g.name, ...calculateGoalProgress(g) })),
    recentTransactions: relevant.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map(t => ({ description: t.description, amount: paiseToAmount(t.amountPaise), type: t.type, category: t.category, date: t.date })),
  };
}

export function proposeBudget(input: { income: number; fixedExpenses: number; variableExpenses: number; savingsCommitment: number; preferredSavingsTarget: number; debtPayments: number; financialGoals?: string; actualCategories?: Array<{ category: string; amount: number }> }) {
  const income = Math.max(0, input.income);
  const fixed = Math.max(0, input.fixedExpenses);
  const variable = Math.max(0, input.variableExpenses);
  const committed = Math.max(0, input.savingsCommitment);
  const debt = Math.max(0, input.debtPayments);
  const savings = Math.min(Math.max(0, Math.max(input.preferredSavingsTarget, committed)), Math.max(0, income - fixed - debt));
  const actual = new Map((input.actualCategories ?? []).map(item => [item.category, Math.max(0, item.amount)]));
  const remaining = Math.max(0, income - fixed - debt - savings);
  const baseline = Math.max(0, variable || remaining);
  const suggested = (category: string, share: number) => actual.get(category) ?? baseline * share;
  const categories = [
    { category: "Housing", amount: fixed * 0.5 },
    { category: "Food", amount: suggested("Food and Dining", 0.22) },
    { category: "Transportation", amount: suggested("Transportation", 0.12) },
    { category: "Utilities", amount: fixed * 0.2 },
    { category: "Education", amount: suggested("Education", 0.06) },
    { category: "Healthcare", amount: suggested("Healthcare", 0.05) },
    { category: "Entertainment", amount: suggested("Entertainment", 0.06) },
    { category: "Personal spending", amount: suggested("Personal Care", 0.06) },
    { category: "Savings", amount: savings },
    { category: "Other expenses", amount: suggested("Other", 0.05) },
  ];
  const nonSavings = categories.filter(c => c.category !== "Savings").reduce((sum, c) => sum + c.amount, 0);
  const available = Math.max(0, income - savings);
  const scale = nonSavings > available && nonSavings > 0 ? available / nonSavings : 1;
  const adjusted = categories.map(c => ({ ...c, amount: Number((c.category === "Savings" ? c.amount : c.amount * scale).toFixed(2)) }));
  return { income, fixedExpenses: fixed, debtPayments: debt, savingsTarget: savings, financialGoals: input.financialGoals ?? "", categories: adjusted, totalPlanned: Number(adjusted.reduce((sum, c) => sum + c.amount, 0).toFixed(2)), deficit: adjusted.reduce((sum, c) => sum + c.amount, 0) > income + 0.01 };
}
