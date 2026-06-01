"""Shared helper for fetching trade dicts with journal data merged in."""
from typing import List, Optional
from sqlalchemy.orm import Session
from models import Trade, Journal


def fetch_trades_dicts(
    db: Session,
    account_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> List[dict]:
    q = db.query(Trade)
    if account_id:
        q = q.filter(Trade.account_id == account_id)
    if date_from:
        q = q.filter(Trade.entry_date >= date_from)
    if date_to:
        q = q.filter(Trade.entry_date <= date_to)
    trades = q.all()

    trade_ids = [t.id for t in trades]
    journals = {}
    if trade_ids:
        for j in db.query(Journal).filter(Journal.trade_id.in_(trade_ids)).all():
            journals[j.trade_id] = j

    result = []
    for t in trades:
        d = {
            "id": t.id,
            "account_id": t.account_id,
            "symbol": t.symbol,
            "direction": t.direction,
            "entry_date": t.entry_date,
            "exit_date": t.exit_date,
            "entry_price": t.entry_price,
            "exit_price": t.exit_price,
            "quantity": t.quantity,
            "pnl": t.pnl,
            "fees": t.fees,
            "stop_loss": t.stop_loss,
            "take_profit": t.take_profit,
            "r_multiple": t.r_multiple,
            "setup": t.setup,
            "tags": t.tags,
            "session": t.session,
            "asset_class": t.asset_class,
            "tilt_state": t.tilt_state,
            "has_journal": t.has_journal,
        }
        j = journals.get(t.id)
        if j:
            d["rule_followed"] = j.rule_followed
            d["confidence_rating"] = j.confidence_rating
        else:
            d["rule_followed"] = None
            d["confidence_rating"] = None
        result.append(d)
    return result
