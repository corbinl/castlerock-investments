from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Any
from pydantic import BaseModel
from models import get_db, Trade, Journal

router = APIRouter(prefix="/trades")


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


class TradeUpdate(BaseModel):
    tags: Optional[str] = None
    setup: Optional[str] = None
    notes: Optional[str] = None
    tiltState: Optional[str] = None
    stopLoss: Optional[float] = None
    takeProfit: Optional[float] = None
    session: Optional[str] = None
    assetClass: Optional[str] = None


@router.get("")
def list_trades(
    accountId: Optional[int] = Query(None),
    assetClass: Optional[str] = Query(None),
    symbol: Optional[str] = Query(None),
    direction: Optional[str] = Query(None),
    strategy: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    dateFrom: Optional[str] = Query(None),
    dateTo: Optional[str] = Query(None),
    untaggedOnly: Optional[bool] = Query(None),
    page: Optional[int] = Query(1),
    pageSize: Optional[int] = Query(50),
    sortBy: Optional[str] = Query(None),
    sortDir: Optional[str] = Query("desc"),
    db: Session = Depends(get_db),
):
    q = db.query(Trade)
    if accountId:
        q = q.filter(Trade.account_id == accountId)
    if assetClass:
        q = q.filter(Trade.asset_class == assetClass)
    if symbol:
        q = q.filter(Trade.symbol == symbol)
    if direction:
        q = q.filter(Trade.direction == direction)
    if strategy:
        q = q.filter(Trade.setup == strategy)
    if tag:
        q = q.filter(Trade.tags.contains(tag))
    if dateFrom:
        q = q.filter(Trade.entry_date >= dateFrom)
    if dateTo:
        q = q.filter(Trade.entry_date <= dateTo)
    if untaggedOnly:
        q = q.filter((Trade.tags == None) | (Trade.tags == ""))

    total = q.count()

    # Sort
    sort_col = getattr(Trade, "entry_date", None)
    if sortBy:
        col_map = {
            "entryDate": Trade.entry_date,
            "exitDate": Trade.exit_date,
            "pnl": Trade.pnl,
            "symbol": Trade.symbol,
            "rMultiple": Trade.r_multiple,
        }
        sort_col = col_map.get(sortBy, Trade.entry_date)

    if sortDir == "asc":
        q = q.order_by(sort_col.asc())
    else:
        q = q.order_by(sort_col.desc())

    page = max(1, page or 1)
    pageSize = min(500, max(1, pageSize or 50))
    trades = q.offset((page - 1) * pageSize).limit(pageSize).all()

    return {
        "total": total,
        "page": page,
        "pageSize": pageSize,
        "trades": [trade_to_dict(t) for t in trades],
    }


@router.get("/meta/symbols")
def list_symbols(db: Session = Depends(get_db)):
    rows = db.query(Trade.symbol).filter(Trade.symbol != None).distinct().all()
    return sorted(set(r[0] for r in rows if r[0]))


@router.get("/meta/tags")
def list_tags(db: Session = Depends(get_db)):
    rows = db.query(Trade.tags).filter(Trade.tags != None, Trade.tags != "").all()
    tag_set = set()
    for (tags_str,) in rows:
        if tags_str:
            for t in tags_str.split(","):
                t = t.strip()
                if t:
                    tag_set.add(t)
    return sorted(tag_set)


@router.get("/{id}")
def get_trade(id: int, db: Session = Depends(get_db)):
    t = db.query(Trade).filter(Trade.id == id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Trade not found")
    j = db.query(Journal).filter(Journal.trade_id == id).first()
    result = trade_to_dict(t)
    result["journal"] = journal_to_dict(j) if j else None
    return result


def journal_to_dict(j: Journal) -> dict:
    return {
        "id": j.id,
        "tradeId": j.trade_id,
        "whyEntry": j.why_entry,
        "whyExit": j.why_exit,
        "whyStopLoss": j.why_stop_loss,
        "whyTakeProfit": j.why_take_profit,
        "mistakes": j.mistakes,
        "marketObservation": j.market_observation,
        "confidenceRating": j.confidence_rating,
        "ruleFollowed": j.rule_followed,
        "tiltState": j.tilt_state,
        "executionQualityEntry": j.execution_quality_entry,
        "executionQualityExit": j.execution_quality_exit,
        "executionQualityStop": j.execution_quality_stop,
        "strategyRulesChecked": j.strategy_rules_checked,
        "updatedAt": j.updated_at.isoformat() if j.updated_at else None,
    }


@router.patch("/{id}")
def update_trade(id: int, body: TradeUpdate, db: Session = Depends(get_db)):
    t = db.query(Trade).filter(Trade.id == id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Trade not found")
    if body.tags is not None:
        t.tags = body.tags
    if body.setup is not None:
        t.setup = body.setup
    if body.notes is not None:
        t.notes = body.notes
    if body.tiltState is not None:
        t.tilt_state = body.tiltState
    if body.stopLoss is not None:
        t.stop_loss = body.stopLoss
    if body.takeProfit is not None:
        t.take_profit = body.takeProfit
    if body.session is not None:
        t.session = body.session
    if body.assetClass is not None:
        t.asset_class = body.assetClass
    db.commit()
    db.refresh(t)
    return trade_to_dict(t)


@router.delete("/{id}", status_code=204)
def delete_trade(id: int, db: Session = Depends(get_db)):
    t = db.query(Trade).filter(Trade.id == id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Trade not found")
    db.query(Journal).filter(Journal.trade_id == id).delete()
    db.delete(t)
    db.commit()


