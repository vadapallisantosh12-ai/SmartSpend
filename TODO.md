# SmartSpend AI TODO

## 1. Responsive product shell and navigation
- [x] Deliver a premium financial SaaS dashboard with deep navy and emerald accents, light neutral surfaces, rounded cards, subtle shadows, accessible contrast, responsive layouts, persistent desktop sidebar, and collapsible mobile navigation.
- [x] Provide working navigation for Dashboard, Transactions, Budgets, Analytics, AI Financial Assistant, Savings Goals, and Settings, plus loading, empty, error, validation, and success states.
- [x] Do not populate a new user's dashboard with fake financial data; show helpful empty states when no transactions exist.

## 2. User-scoped persistent finance data
- [x] Use the managed database as the source of truth for transactions, budgets, savings goals, contributions, and settings.
- [x] Use the starter's real Manus OAuth/session flow and protected server procedures; never use fake authentication or allow one user to access another user's financial data.
- [x] Preserve data ownership through user IDs on every feature table and provide data deletion.

## 3. Transaction management
- [x] Let users add, edit, delete, search, filter, sort, and view transaction details.
- [x] Support ID, description, amount, income/expense type, category, date, optional notes, and optional payment method.
- [x] Validate amount > 0, type/category/date, and required fields; show income and expense distinctly; confirm deletion.
- [x] Update dashboard totals, charts, budgets, analytics, and AI context after mutations.

## 4. Budgets and deterministic calculations
- [x] Support monthly and category budgets with create/edit/delete, month selection, limits, actual expense-only spend, remaining amount, percentage, progress bars, alerts, and status rules: <75% normal, 75% to <100% approaching, 100%+ exceeded.
- [x] Exclude income from budget spending and avoid double-counting.
- [x] Calculate totals, remaining balance, savings rate, categories, comparisons, utilization, and goal progress in application code with safe zero handling.

## 5. Dashboard and analytics
- [x] Provide reporting filters for this month, last month, last 3 months, and custom ranges; update every dashboard component when the period changes.
- [x] Show total income, total expenses, remaining balance, savings rate, monthly cash flow, category distribution, recent transactions, budget overview, savings goal progress, and actual-data insights.
- [x] Provide monthly income vs expenses, category breakdown, weekly trends, month-over-month comparisons, highest categories, average daily spending, savings rate, largest transactions, budget utilization, filters, tooltips, accessible labels, mobile charts, and a table alternative.
- [x] Explain when insufficient historical data exists and never invent history.

## 6. Gemini financial assistant
- [x] Retrieve actual transactions and budgets, calculate verified financial context in application code, then send only relevant context to Gemini through a server-side API.
- [x] Preserve active-session conversation context and follow-ups; provide example questions and loading/error/rate-limit/empty-response handling.
- [x] Keep the model configurable, handle missing/invalid keys and oversized requests, never expose secrets, and never fabricate unavailable financial facts.
- [x] Label actual recorded data, calculated metrics, AI suggestions, and hypothetical scenarios.

## 7. AI budget planner and savings goals
- [x] Collect income, fixed/variable expenses, savings commitments, goals, preferred savings target, and optional debt payments; prefill from actual data when available.
- [x] Generate an internally consistent editable proposal for housing, food, transportation, utilities, education, healthcare, entertainment, personal spending, savings, and other expenses without exceeding income unless deficit is explicitly requested; require confirmation before saving.
- [x] Support savings goal creation/edit/delete, contributions, progress, remaining amount, target date, notes, and estimated monthly contribution; handle invalid targets and passed dates safely; do not double-count contributions as expenses.

## 8. Settings, privacy, and delivery
- [x] Support currency, date format, theme, default reporting period, CSV transaction export, and data deletion; distinguish export from full backup and avoid misleading multi-currency totals.
- [x] Document storage behavior, required environment variables, Gemini configuration, run instructions, deployment instructions, and known limitations.
- [x] Run type checks, tests, production build, and route-manifest validation; fix confirmed issues before delivery.
