# CastleRock Investments

A full-stack personal trading journal and trade pattern analysis app. Import your trades via CSV, journal every decision, and uncover the patterns that make or break your edge.

![CastleRock Dashboard](https://i.imgur.com/placeholder.png)

---

## Features

- **CastleRock Score** — A 0–100 composite score across win rate, profit factor, expectancy R, and rule adherence
- **10-page app** — Dashboard, Trade Log, Import, Queue, Analytics, Pivot Explorer, What-If Simulator, Sessions, Strategies, Trade Detail
- **Analytics engine** — Slices by symbol, strategy, direction, tag, session, tilt, confidence; streak analysis; equity curve; calendar heatmap
- **Pivot Explorer** — Cross-dimensional heatmap across any two trade dimensions
- **What-If Simulator** — Remove trade types and see how your stats change
- **Strategy Playbook** — Document rules per strategy with live performance stats
- **Pre-market Sessions** — Plan your day and score your adherence
- **CSV Import** — Upload trades from any broker with column mapping

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite + TypeScript |
| UI | shadcn/ui + Tailwind CSS + Recharts |
| Backend | Python 3.11 + FastAPI |
| Database | SQLite + SQLAlchemy |
| API contract | OpenAPI 3.0 → generated React hooks via Orval |
| Monorepo | pnpm workspaces |

---

## Running Locally

### Prerequisites
- Node.js 20+
- Python 3.11+
- pnpm 9+

### Install

```bash
# Install all JS dependencies
pnpm install

# Install Python dependencies
cd artifacts/py-api
pip install -r requirements.txt
```

### Start

```bash
# Start the API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Start the frontend (port from $PORT env var)
pnpm --filter @workspace/castlerock run dev
```

The app seeds 120 demo trades automatically on first run.

### Regenerate API client

If you change `lib/api-spec/openapi.yaml`:

```bash
pnpm --filter @workspace/api-client-react run generate
```

---

## Project Structure

```
/
├── artifacts/
│   ├── castlerock/        # React + Vite frontend
│   └── py-api/            # Python FastAPI backend
│       ├── api/           # Route handlers
│       ├── analytics/     # CastleRock Score, equity curve, streaks, etc.
│       ├── models/        # SQLAlchemy models
│       └── seed.py        # Demo data seeder
├── lib/
│   ├── api-spec/          # OpenAPI contract (source of truth)
│   └── api-client-react/  # Generated React hooks (from OpenAPI)
└── ROADMAP.md
```

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for what's shipped, what's in the queue, and what's coming next.
