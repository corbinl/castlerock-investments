# CastleRock Investments — Roadmap

A personal trading journal and trade pattern analysis app. Self-hosted, no auth required, CSV import only.

---

## ✅ Shipped

### Core App (10 pages)
- **Dashboard** — CastleRock Score gauge, equity curve, P&L stats, calendar heatmap, weekly briefing, behavioral nudge alerts, recent trades
- **Trade Log** — Paginated trade list with filters (symbol, direction, tag, date range, asset class, strategy), sorting, pagination
- **Trade Detail** — Full trade view with inline journal editor (why entry/exit, mistakes, confidence, tilt state, rule adherence), social share link
- **Import** — CSV upload with column mapping preview, import batch tracking
- **Queue** — Untagged trades prioritised for journaling; clears as trades get tagged
- **Analytics** — Overview stats, breakdown slices (by symbol, strategy, day, hour, asset class), equity curve, streaks analysis, AI-style insights
- **Pivot Explorer** — Cross-dimensional heatmap (any two of: symbol, direction, setup, asset class, tags) across 5 metrics
- **What-If Simulator** — Filter out trade types and see how stats change; save and compare scenarios
- **Sessions** — Pre-market plan builder (instruments, bias, setups watching, pre/post notes, adherence score)
- **Strategy Playbook** — Document strategies with rules, view per-strategy stats and top trades

### Backend (Python FastAPI + SQLite)
- 120 seeded demo trades across 2 accounts and 4 strategies
- Full analytics engine: overview, slices, streaks, equity curve, calendar, pivot, what-if, CastleRock Score
- CastleRock Score formula: 4 equal components (win rate, profit factor capped 3×, expectancy R, rule adherence) → 0–100 score with tiers Expert / Advanced / Intermediate / Beginner
- Rule compliance analytics (`/analytics/by-rule`)
- Trade meta endpoints (`/trades/meta/symbols`, `/trades/meta/tags`)
- Strategy playbook endpoint (`/strategies/{id}/playbook`)
- Dashboard layout persistence (`PUT /dashboard/layout`)
- Behavioral nudges and insights engine
- Session plans CRUD
- CSV import with batch tracking
- Social share links for individual trades

---

## 🔄 Active (in queue)

| # | Feature | Notes |
|---|---------|-------|
| #6 | Trade journal entries inline in Trade Log | Expand-in-place journal editing without navigating away |
| #7 | Analytics Streaks & Insights tabs load real data | Wire streaks and insights tabs to live backend |
| #8 | Mobile app — trade journal & analytics on phone | React Native / Expo companion app |
| #9 | Complete analytics breakdowns & tag filter | Add rule compliance, tilt, confidence, tag, session breakdown tabs; wire tag dropdown from real API; Today's Insight on Dashboard |
| #10 | Dashboard layout customization (drag & save) | Drag-to-rearrange widgets, persisted via API |
| #11 | GitHub repo + project roadmap | This file — push codebase to GitHub |

---

## 🗓 Upcoming

- **Broker API import** — Direct connection to Interactive Brokers / TD Ameritrade / Tradier instead of CSV
- **Multi-account analytics** — Side-by-side comparison across accounts
- **Alerts & triggers** — Notify when drawdown exceeds threshold, streak breaks, or win rate drops
- **Trade replay** — Step through a trade bar-by-bar with annotations
- **Custom CastleRock Score weights** — Let the user tune the 4 component weights

---

## 💡 Long-term ideas

- Authentication & multi-user support
- Shared playbooks between traders
- AI trade coaching (pattern recognition over your own history)
- Broker-level P&L reconciliation
- Tax report export (wash sale detection, short/long term)
- Discord / Slack nudge integration
