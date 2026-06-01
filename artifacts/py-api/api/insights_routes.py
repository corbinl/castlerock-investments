import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta
from models import get_db, Trade, Journal, Account
from insights.nudges import detect_nudges, compute_weekly_briefing, compute_today_panel
from analytics.overview import compute_overview
from analytics.equity_curve import compute_equity_curve, compute_calendar
from analytics_routes_helper import fetch_trades_dicts

router = APIRouter()


def nudge_to_schema(n: dict) -> dict:
    """Convert internal nudge dict to Nudge schema."""
    return {
        "id": str(uuid.uuid4()),
        "type": n.get("type", "info"),
        "message": n.get("message", ""),
        "severity": n.get("severity", "info"),
        "actionLabel": n.get("actionLabel"),
        "actionRoute": n.get("actionRoute"),
    }


def insight_from_nudge(n: dict, priority: int = 5) -> dict:
    """Convert nudge to Insight schema for topInsights."""
    return {
        "id": str(uuid.uuid4()),
        "category": n.get("type", "behavioral"),
        "priority": priority,
        "title": n.get("title", ""),
        "body": n.get("message", ""),
        "supportingData": {},
        "isActionable": True,
        "sampleSize": n.get("count", 0),
    }


def build_weekly_briefing(trades: list) -> dict:
    """Build WeeklyBriefing response matching the schema."""
    now = datetime.utcnow()
    week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=6)

    b = compute_weekly_briefing(trades)

    # Find top symbol this week
    week_trades = [t for t in trades if (t.get("entry_date") or "") >= week_start.isoformat()]
    from collections import Counter
    symbols = [t.get("symbol") for t in week_trades if t.get("symbol")]
    top_symbol = Counter(symbols).most_common(1)[0][0] if symbols else None

    # Rule adherence this week
    rule_trades = [t for t in week_trades if t.get("rule_followed") is not None]
    rule_rate = (
        sum(1 for t in rule_trades if t.get("rule_followed")) / len(rule_trades)
        if rule_trades else None
    )

    return {
        "weekStart": week_start.strftime("%Y-%m-%d"),
        "weekEnd": week_end.strftime("%Y-%m-%d"),
        "tradeCount": b["tradeCount"],
        "winRate": b["winRate"],
        "totalPnl": b["totalPnl"],
        "bestDay": b.get("bestDay"),
        "worstDay": b.get("worstDay"),
        "standoutPattern": b.get("standoutPattern"),
        "recommendation": b["recommendation"],
        "ruleAdherenceRate": rule_rate,
        "topSymbol": top_symbol,
    }


def trade_to_dict(t: Trade) -> dict:
    return {
        "id": t.id,
        "importBatchId": t.import_batch_id,
        "accountId": t.account_id,
        "importSource": t.import_source,
        "assetClass": t.asset_class,
        "symbol": t.symbol,
        "instrumentDescription": t.instrument_description,
        "direction": t.direction,
        "entryDate": t.entry_date,
        "exitDate": t.exit_date,
        "entryPrice": t.entry_price,
        "exitPrice": t.exit_price,
        "quantity": t.quantity,
        "pnl": t.pnl,
        "fees": t.fees,
        "stopLoss": t.stop_loss,
        "takeProfit": t.take_profit,
        "rMultiple": t.r_multiple,
        "executionQualityEntry": t.execution_quality_entry,
        "executionQualityExit": t.execution_quality_exit,
        "executionQualityStop": t.execution_quality_stop,
        "efficiencyEntryPct": t.efficiency_entry_pct,
        "efficiencyExitPct": t.efficiency_exit_pct,
        "tiltState": t.tilt_state,
        "strategyRulesChecked": t.strategy_rules_checked,
        "tags": t.tags,
        "setup": t.setup,
        "notes": t.notes,
        "session": t.session,
        "economicEventNearby": t.economic_event_nearby,
        "hasJournal": t.has_journal,
        "createdAt": t.created_at.isoformat() if t.created_at else None,
        "updatedAt": t.updated_at.isoformat() if t.updated_at else None,
    }


def account_to_dict(a: Account) -> dict:
    return {
        "id": a.id,
        "name": a.name,
        "currency": a.currency,
        "description": a.description,
        "createdAt": a.created_at.isoformat() if a.created_at else None,
    }


@router.get("/insights")
def get_insights(
    accountId: Optional[int] = Query(None),
    limit: Optional[int] = Query(10),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId)
    nudges = detect_nudges(trades)
    insights = [insight_from_nudge(n, priority=i+1) for i, n in enumerate(nudges)]
    return insights[:limit]


@router.get("/insights/nudges")
def get_nudges(
    accountId: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId)
    nudges = detect_nudges(trades)
    return [nudge_to_schema(n) for n in nudges]


@router.get("/insights/weekly-briefing")
def get_weekly_briefing(
    accountId: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId)
    return build_weekly_briefing(trades)


@router.get("/insights/today")
def get_today_insight(
    accountId: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId)
    today = compute_today_panel(trades)
    return {
        "id": str(uuid.uuid4()),
        "category": "today",
        "priority": 1,
        "title": today["title"],
        "body": today["message"],
        "supportingData": {},
        "isActionable": True,
        "sampleSize": len(trades),
    }


@router.get("/dashboard/summary")
def get_dashboard_summary(
    accountId: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId)
    overview = compute_overview(trades)
    nudges = detect_nudges(trades)
    briefing = build_weekly_briefing(trades)
    equity_curve = compute_equity_curve(trades)

    # Current month calendar
    now = datetime.utcnow()
    calendar = compute_calendar(trades, year=now.year, month=now.month)

    # Recent trades (last 20, sorted by entry_date desc)
    recent_trades_orm = (
        db.query(Trade)
        .order_by(Trade.entry_date.desc())
        .limit(20)
        .all()
    )

    # Untagged count
    untagged_count = db.query(Trade).filter(
        (Trade.tags == None) | (Trade.tags == "")
    ).count()

    # All accounts
    accounts = db.query(Account).all()

    # Top insights from nudges
    top_insights = [insight_from_nudge(n, priority=i+1) for i, n in enumerate(nudges)]

    return {
        "overview": overview,
        "recentTrades": [trade_to_dict(t) for t in recent_trades_orm],
        "equityCurve": equity_curve,
        "calendarThisMonth": calendar,
        "topInsights": top_insights,
        "nudges": [nudge_to_schema(n) for n in nudges],
        "weeklyBriefing": briefing,
        "untaggedCount": untagged_count,
        "accounts": [account_to_dict(a) for a in accounts],
    }
