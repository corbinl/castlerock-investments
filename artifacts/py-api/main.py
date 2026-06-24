import os
import sys

# Add py-api root to path so imports resolve cleanly
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models.database import Base, engine

# Import ALL models so they register with Base.metadata before create_all
from models import (
    Trade, Account, Journal, ImportBatch, SessionPlan, Strategy,
    ShareLink, DashboardLayout, CoachingNote, CoachingTheme,
    ChecklistItem, ChecklistCompletion,
)

# Create all tables (idempotent — safe to run on every startup)
Base.metadata.create_all(bind=engine)

# Migrate existing checklist_items table to add deleted_at if missing
def _migrate_checklist_schema():
    from sqlalchemy import text
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE checklist_items ADD COLUMN deleted_at DATETIME"))
            conn.commit()
        except Exception:
            pass  # Column already exists — safe to ignore

_migrate_checklist_schema()

# Seed default checklist items at startup — idempotent (checks by label)
def _seed_checklist_defaults():
    from models.database import SessionLocal
    DEFAULT_CHECKLIST_ITEMS = [
        ("Reviewed overnight news", 0),
        ("Marked key levels", 1),
        ("Set max daily loss", 2),
        ("Written trade plan", 3),
        ("Checked economic calendar", 4),
    ]
    db = SessionLocal()
    try:
        # Remove any duplicate rows (keep lowest id per label), left over from
        # earlier restarts before the unique constraint was in place.
        seen_labels: set = set()
        all_items = db.query(ChecklistItem).order_by(ChecklistItem.id).all()
        for item in all_items:
            if item.label in seen_labels:
                db.delete(item)
            else:
                seen_labels.add(item.label)
        db.commit()

        # Insert defaults that are still missing
        for label, order in DEFAULT_CHECKLIST_ITEMS:
            exists = db.query(ChecklistItem).filter(ChecklistItem.label == label).first()
            if not exists:
                db.add(ChecklistItem(label=label, is_active=True, sort_order=order))
                db.commit()
    finally:
        db.close()

_seed_checklist_defaults()

# Auto-seed demo data if empty
from seed import seed_if_empty
seed_if_empty()

app = FastAPI(title="CastleRock Investments API", root_path="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
from api.health import router as health_router
from api.accounts import router as accounts_router
from api.trades import router as trades_router
from api.journals import router as journals_router
from api.import_routes import router as import_router
from api.analytics_routes import router as analytics_router
from api.insights_routes import router as insights_router
from api.sessions_routes import router as sessions_router
from api.strategies_routes import router as strategies_router
from api.share_routes import router as share_router
from api.dashboard_routes import router as dashboard_router
from api.tags_routes import router as tags_router
from api.coach_routes import router as coach_router
from api.checklist_routes import router as checklist_router
from api.query_routes import router as query_router

app.include_router(health_router)
app.include_router(accounts_router)
app.include_router(trades_router)
app.include_router(journals_router)
app.include_router(import_router)
app.include_router(analytics_router)
app.include_router(insights_router)
app.include_router(sessions_router)
app.include_router(strategies_router)
app.include_router(share_router)
app.include_router(dashboard_router)
app.include_router(tags_router)
app.include_router(coach_router)
app.include_router(checklist_router)
app.include_router(query_router)
