from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from models import get_db, Trade, Journal
from analytics.overview import compute_overview
from analytics.slices import (
    by_symbol, by_strategy, by_setup, by_tag, by_direction,
    by_asset_class, by_session, by_tilt, by_confidence,
    by_day_of_week, by_hour_of_day,
)
from analytics.streaks import compute_streaks
from analytics.equity_curve import compute_equity_curve, compute_calendar
from analytics.whatif import compute_whatif
from analytics.pivot import compute_pivot
from analytics.castlerock_score import compute_castlerock_score
from analytics_routes_helper import fetch_trades_dicts

router = APIRouter(prefix="/analytics")


@router.get("/overview")
def get_overview(
    accountId: Optional[int] = Query(None),
    dateFrom: Optional[str] = Query(None),
    dateTo: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId, dateFrom, dateTo)
    return compute_overview(trades)


@router.get("/by-symbol")
def get_by_symbol(
    accountId: Optional[int] = Query(None),
    dateFrom: Optional[str] = Query(None),
    dateTo: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId, dateFrom, dateTo)
    return by_symbol(trades)


@router.get("/by-strategy")
def get_by_strategy(
    accountId: Optional[int] = Query(None),
    dateFrom: Optional[str] = Query(None),
    dateTo: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId, dateFrom, dateTo)
    return by_strategy(trades)


@router.get("/by-setup")
def get_by_setup(
    accountId: Optional[int] = Query(None),
    dateFrom: Optional[str] = Query(None),
    dateTo: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId, dateFrom, dateTo)
    return by_setup(trades)


@router.get("/by-tag")
def get_by_tag(
    accountId: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId)
    return by_tag(trades)


@router.get("/by-direction")
def get_by_direction(
    accountId: Optional[int] = Query(None),
    dateFrom: Optional[str] = Query(None),
    dateTo: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId, dateFrom, dateTo)
    return by_direction(trades)


@router.get("/by-asset-class")
def get_by_asset_class(
    accountId: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId)
    return by_asset_class(trades)


@router.get("/by-session")
def get_by_session(
    accountId: Optional[int] = Query(None),
    dateFrom: Optional[str] = Query(None),
    dateTo: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId, dateFrom, dateTo)
    return by_session(trades)


@router.get("/by-day")
def get_by_day(
    accountId: Optional[int] = Query(None),
    dateFrom: Optional[str] = Query(None),
    dateTo: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId, dateFrom, dateTo)
    return by_day_of_week(trades)


@router.get("/by-hour")
def get_by_hour(
    accountId: Optional[int] = Query(None),
    dateFrom: Optional[str] = Query(None),
    dateTo: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId, dateFrom, dateTo)
    return by_hour_of_day(trades)


@router.get("/by-time")
def get_by_time(
    accountId: Optional[int] = Query(None),
    dateFrom: Optional[str] = Query(None),
    dateTo: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    from datetime import datetime
    from collections import defaultdict

    trades = fetch_trades_dicts(db, accountId, dateFrom, dateTo)

    buckets = defaultdict(list)
    for t in trades:
        if t.get("pnl") is None:
            continue
        entry_date = t.get("entryDate") or t.get("entry_date")
        if not entry_date:
            continue
        try:
            dt = datetime.fromisoformat(str(entry_date).replace("Z", "+00:00"))
            dow = dt.weekday()
            hour = dt.hour
            buckets[(dow, hour)].append(t["pnl"])
        except Exception:
            continue

    result = []
    for (dow, hour), pnls in buckets.items():
        wins = sum(1 for p in pnls if p > 0)
        result.append({
            "dayOfWeek": dow,
            "hour": hour,
            "avgPnl": sum(pnls) / len(pnls),
            "totalPnl": sum(pnls),
            "count": len(pnls),
            "winRate": wins / len(pnls),
        })

    return sorted(result, key=lambda x: (x["dayOfWeek"], x["hour"]))


@router.get("/by-tilt")
def get_by_tilt(
    accountId: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId)
    return by_tilt(trades)


@router.get("/by-confidence")
def get_by_confidence(
    accountId: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId)
    return by_confidence(trades)


@router.get("/equity-curve")
def get_equity_curve(
    accountId: Optional[int] = Query(None),
    dateFrom: Optional[str] = Query(None),
    dateTo: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId, dateFrom, dateTo)
    return compute_equity_curve(trades)


@router.get("/calendar")
def get_calendar(
    accountId: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId)
    return compute_calendar(trades, year, month)


@router.get("/streaks")
def get_streaks(
    accountId: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId)
    return compute_streaks(trades)


@router.get("/by-rule")
def get_by_rule(
    accountId: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId)
    followed = [t for t in trades if t.get("rule_followed") is True]
    broken = [t for t in trades if t.get("rule_followed") is False]

    def safe_win_rate(ts):
        closed = [t for t in ts if t.get("pnl") is not None]
        if not closed:
            return 0.0
        return sum(1 for t in closed if (t.get("pnl") or 0) > 0) / len(closed)

    def safe_expectancy(ts):
        closed = [t for t in ts if t.get("pnl") is not None]
        if not closed:
            return 0.0
        wins = [t for t in closed if (t.get("pnl") or 0) > 0]
        losses = [t for t in closed if (t.get("pnl") or 0) <= 0]
        wr = len(wins) / len(closed)
        avg_w = sum(t.get("pnl") or 0 for t in wins) / len(wins) if wins else 0.0
        avg_l = abs(sum(t.get("pnl") or 0 for t in losses) / len(losses)) if losses else 0.0
        return wr * avg_w - (1 - wr) * avg_l

    all_rule_trades = followed + broken
    adherence_rate = len(followed) / len(all_rule_trades) if all_rule_trades else 0.0

    return {
        "ruleFollowedCount": len(followed),
        "ruleBrokenCount": len(broken),
        "ruleFollowedWinRate": safe_win_rate(followed),
        "ruleBrokenWinRate": safe_win_rate(broken),
        "ruleFollowedExpectancy": safe_expectancy(followed),
        "ruleBrokenExpectancy": safe_expectancy(broken),
        "ruleFollowedTotalPnl": sum(t.get("pnl") or 0 for t in followed if t.get("pnl") is not None),
        "ruleBrokenTotalPnl": sum(t.get("pnl") or 0 for t in broken if t.get("pnl") is not None),
        "adherenceRate": adherence_rate,
    }


@router.get("/pivot")
def get_pivot(
    rowDim: str = Query("symbol"),
    colDim: str = Query("direction"),
    metric: str = Query("totalPnl"),
    accountId: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId)
    return compute_pivot(trades, rowDim, colDim, metric)


@router.get("/whatif")
def get_whatif(
    minConfidence: Optional[float] = Query(None),
    ruleFollowedOnly: Optional[bool] = Query(None),
    excludeTiltStates: Optional[str] = Query(None),
    accountId: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId)
    exclude = [s.strip() for s in excludeTiltStates.split(",")] if excludeTiltStates else None
    return compute_whatif(
        trades,
        min_confidence=minConfidence,
        rule_followed_only=bool(ruleFollowedOnly),
        exclude_tilt_states=exclude,
    )


@router.get("/castlerock-score")
def get_castlerock_score(
    accountId: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    trades = fetch_trades_dicts(db, accountId)
    overview = compute_overview(trades)
    return {
        "score": overview["castlerockScore"],
        "label": overview["castlerockScoreLabel"],
        "breakdown": {
            "winRate": overview["winRate"],
            "profitFactor": overview["profitFactor"],
            "expectancyR": overview["expectancyR"],
            "ruleAdherenceRate": overview["ruleAdherenceRate"],
        },
    }
