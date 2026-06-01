import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from collections import Counter
from pydantic import BaseModel
from models import get_db, Strategy, Trade
from analytics.slices import compute_slice_stats
from analytics.overview import compute_overview

router = APIRouter(prefix="/strategies")


def parse_rules(rules_raw) -> List[str]:
    """Parse rules stored as JSON string → list of strings."""
    if rules_raw is None:
        return []
    if isinstance(rules_raw, list):
        return rules_raw
    try:
        parsed = json.loads(rules_raw)
        return parsed if isinstance(parsed, list) else [str(parsed)]
    except (json.JSONDecodeError, TypeError):
        return [r.strip() for r in str(rules_raw).split(",") if r.strip()]


def strategy_to_dict(s: Strategy) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "description": s.description,
        "rules": parse_rules(s.rules),
        "assetClass": s.asset_class,
        "createdAt": s.created_at.isoformat() if s.created_at else None,
    }


class StrategyInput(BaseModel):
    name: str
    description: Optional[str] = None
    rules: List[str] = []
    assetClass: Optional[str] = None


class StrategyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    rules: Optional[List[str]] = None
    assetClass: Optional[str] = None


@router.get("")
def list_strategies(db: Session = Depends(get_db)):
    strategies = db.query(Strategy).all()
    return [strategy_to_dict(s) for s in strategies]


@router.post("", status_code=201)
def create_strategy(body: StrategyInput, db: Session = Depends(get_db)):
    s = Strategy(
        name=body.name,
        description=body.description,
        rules=json.dumps(body.rules),
        asset_class=body.assetClass,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return strategy_to_dict(s)


@router.get("/{id}/playbook")
def get_strategy_playbook(id: int, db: Session = Depends(get_db)):
    s = db.query(Strategy).filter(Strategy.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Strategy not found")

    trades = db.query(Trade).filter(Trade.setup == s.name).all()
    trade_dicts = [{
        "pnl": t.pnl, "r_multiple": t.r_multiple, "setup": t.setup,
        "direction": t.direction, "asset_class": t.asset_class,
        "entry_date": t.entry_date, "exit_date": t.exit_date, "symbol": t.symbol,
        "rule_followed": t.strategy_rules_checked,
    } for t in trades]

    top_trades_orm = sorted(
        [t for t in trades if t.pnl is not None],
        key=lambda t: t.pnl or 0, reverse=True
    )[:5]

    def trade_minimal(t: Trade) -> dict:
        return {
            "id": t.id, "symbol": t.symbol, "direction": t.direction,
            "entryDate": t.entry_date, "exitDate": t.exit_date,
            "entryPrice": t.entry_price, "exitPrice": t.exit_price,
            "quantity": t.quantity, "pnl": t.pnl, "fees": t.fees,
            "rMultiple": t.r_multiple, "setup": t.setup, "tags": t.tags,
            "assetClass": t.asset_class, "importBatchId": t.import_batch_id,
            "accountId": t.account_id, "importSource": t.import_source,
            "instrumentDescription": t.instrument_description,
            "stopLoss": t.stop_loss, "takeProfit": t.take_profit,
            "executionQualityEntry": t.execution_quality_entry,
            "executionQualityExit": t.execution_quality_exit,
            "executionQualityStop": t.execution_quality_stop,
            "efficiencyEntryPct": t.efficiency_entry_pct,
            "efficiencyExitPct": t.efficiency_exit_pct,
            "tiltState": t.tilt_state, "strategyRulesChecked": t.strategy_rules_checked,
            "notes": t.notes, "session": t.session,
            "economicEventNearby": t.economic_event_nearby, "hasJournal": t.has_journal,
            "createdAt": t.created_at.isoformat() if t.created_at else None,
            "updatedAt": t.updated_at.isoformat() if t.updated_at else None,
        }

    stats = compute_overview(trade_dicts)
    return {
        "strategy": strategy_to_dict(s),
        "stats": stats,
        "topTrades": [trade_minimal(t) for t in top_trades_orm],
        "generatedAt": datetime.utcnow().isoformat(),
    }


@router.get("/{id}")
def get_strategy(id: int, db: Session = Depends(get_db)):
    s = db.query(Strategy).filter(Strategy.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Strategy not found")

    trades = db.query(Trade).filter(Trade.setup == s.name).all()
    trade_dicts = [{
        "pnl": t.pnl, "r_multiple": t.r_multiple, "setup": t.setup,
        "direction": t.direction, "asset_class": t.asset_class, "symbol": t.symbol,
    } for t in trades]

    symbols = [t.get("symbol") for t in trade_dicts if t.get("symbol")]
    top_symbols = [sym for sym, _ in Counter(symbols).most_common(5)]
    stats = compute_slice_stats(trade_dicts, s.name) if trade_dicts else None

    return {
        "strategy": strategy_to_dict(s),
        "stats": stats,
        "tradeCount": len(trades),
        "topSymbols": top_symbols,
    }


@router.patch("/{id}")
def update_strategy(id: int, body: StrategyUpdate, db: Session = Depends(get_db)):
    s = db.query(Strategy).filter(Strategy.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Strategy not found")
    if body.name is not None:
        s.name = body.name
    if body.description is not None:
        s.description = body.description
    if body.rules is not None:
        s.rules = json.dumps(body.rules)
    if body.assetClass is not None:
        s.asset_class = body.assetClass
    db.commit()
    db.refresh(s)
    return strategy_to_dict(s)


@router.delete("/{id}", status_code=204)
def delete_strategy(id: int, db: Session = Depends(get_db)):
    s = db.query(Strategy).filter(Strategy.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Strategy not found")
    db.delete(s)
    db.commit()
