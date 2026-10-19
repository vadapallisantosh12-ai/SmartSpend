# SmartSpend AI — implementation plan

## Product approach

SmartSpend AI is a user-scoped personal finance workspace, not a landing page. The React client uses a persistent shell with dashboard-style sections; protected tRPC procedures expose CRUD for transactions, budgets, savings goals, and settings. Drizzle/MySQL is the source of truth. Financial arithmetic is implemented in reusable server-side functions and the browser mirrors those calculations for responsive charts and instant UI updates. The Gemini integration is server-only and receives only a compact, verified financial context; it explains calculated facts rather than calculating them.

The first delivery is optimized for a complete working core: authenticated access, empty states, real CRUD, period-aware dashboard, budgets, analytics, savings goals, CSV export, theme/currency settings, and an AI assistant with graceful missing-key/error handling. No fake transaction seed data is included.

## Design direction

Three possible directions were considered: **Ledger Atelier** (0.08), a quiet editorial finance workspace with paper-like surfaces; **Emerald Signal** (0.06), a premium fintech dashboard with deep navy framing and emerald data accents; **Civic Balance** (0.07), an approachable public-service budgeting tool with warm neutrals. The selected direction is **Emerald Signal**.

- **Design Movement:** premium fintech dashboard with editorial restraint and a slightly instrument-panel-like information hierarchy.
- **Core Principles:** evidence first, calm over alarm, progressive disclosure, and clear distinction between actuals, calculations, and suggestions.
- **Color Philosophy:** deep navy creates trust and focus; emerald marks healthy movement and confirmed savings; warm off-white keeps the dense financial surface human; amber/red are reserved for budget status and never used decoratively.
- **Layout Paradigm:** a persistent rail anchors navigation while the main canvas uses asymmetric split panels: one dominant insight surface paired with compact supporting metrics, rather than a uniform card grid.
- **Signature Elements:** a slim emerald “signal” rule on key cards, dark navy command surfaces for AI and period controls, and monospaced numeric treatments for totals and ratios.
- **Interaction Philosophy:** every mutation gives immediate feedback and a visible consequence; forms stay lightweight; delete is explicit; empty states tell the user what to do next.
- **Animation:** use short 160–220ms fades and lifts for panels, a gentle progress-bar fill on data updates, and a subtle shimmer only for loading; no looping decorative motion.
- **Typography System:** Inter for interface copy with IBM Plex Mono for currency, percentages, and dates; strong 30–40px page titles, 12px uppercase metadata, and restrained 14–16px body text.
- **Brand Essence:** “A clear, honest cockpit for everyday money decisions.” Personality: composed, candid, practical.
- **Brand Voice:** headlines are direct and encouraging; CTAs are specific. Example lines: “See what your money is doing.” and “Add the next real transaction.”
- **Wordmark & Logo:** a compact “SS” signal mark formed from two offset ledger ticks, paired with the wordmark; the mark doubles as a small emerald status indicator in the sidebar.
- **Signature Brand Color:** signal emerald `#16A66A`.

## Architecture and project structure

- `client/src/App.tsx`: authenticated app shell, navigation state, route manifest-compatible sections, and theme handling.
- `client/src/pages/Home.tsx`: dashboard, transactions, budgets, analytics, AI assistant, savings goals, and settings views with reusable local form primitives.
- `client/src/index.css`: Emerald Signal tokens, responsive layout, typography, data-table and chart styling.
- `server/routers.ts`: protected finance CRUD, bootstrap, deterministic summaries, CSV-ready export, AI chat, and budget planner procedures.
- `server/finance.ts`: pure calculations for periods, totals, categories, budget status, comparisons, goal progress, and AI context.
- `server/db.ts`: Drizzle connection and user upsert/read helpers.
- `drizzle/schema.ts` and `drizzle/*`: user-owned transactions, budgets, savings goals, contributions, and settings tables.
- `public/manus-routes.json`: declared SPA route set for the managed preview.
- `README.md`: Gemini configuration, local run, deployment, storage and limitations.

## Backend/frontend serving

The managed Express server serves `/api/health`, OAuth, tRPC, and the Vite/production frontend. The database is managed MySQL through `DATABASE_URL`. The Gemini key is read only from server environment (`GEMINI_API_KEY`); the model is selected with `GEMINI_MODEL` and defaults to a current configurable value. If no key exists, the assistant clearly reports that configuration is needed and the rest of the app remains usable.

## Build workflow

1. Extend the Drizzle schema and generate/apply an additive migration.
2. Implement pure finance calculations and protected tRPC procedures.
3. Build the responsive app shell and data-driven sections.
4. Add server-side Gemini service and deterministic budget planner.
5. Add settings, CSV export, validation, and graceful error states.
6. Run type checks, tests, production build, route-manifest check, and inspect the running Preview.
7. Commit the working project to the canonical `main` checkpoint.
