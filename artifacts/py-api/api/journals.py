from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from models import get_db, Trade, Journal

router = APIRouter()


class JournalInput(BaseModel):
    whyEntry: Optional[str] = None
    whyExit: Optional[str] = None
    whyStopLoss: Optional[str] = None
    whyTakeProfit: Optional[str] = None
    mistakes: Optional[str] = None
    marketObservation: Optional[str] = None
    confidenceRating: Optional[float] = None
    ruleFollowed: Optional[bool] = None
    tiltState: Optional[str] = None
    executionQualityEntry: Optional[float] = None
    executionQualityExit: Optional[float] = None
    executionQualityStop: Optional[float] = None
    strategyRulesChecked: Optional[str] = None


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


@router.get("/trades/{id}/journal")
def get_journal(id: int, db: Session = Depends(get_db)):
    j = db.query(Journal).filter(Journal.trade_id == id).first()
    if not j:
        raise HTTPException(status_code=404, detail="Journal not found")
    return journal_to_dict(j)


@router.put("/trades/{id}/journal")
def upsert_journal(id: int, body: JournalInput, db: Session = Depends(get_db)):
    trade = db.query(Trade).filter(Trade.id == id).first()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")

    j = db.query(Journal).filter(Journal.trade_id == id).first()
    if not j:
        j = Journal(trade_id=id)
        db.add(j)

    j.why_entry = body.whyEntry
    j.why_exit = body.whyExit
    j.why_stop_loss = body.whyStopLoss
    j.why_take_profit = body.whyTakeProfit
    j.mistakes = body.mistakes
    j.market_observation = body.marketObservation
    j.confidence_rating = body.confidenceRating
    j.rule_followed = body.ruleFollowed
    j.tilt_state = body.tiltState
    j.execution_quality_entry = body.executionQualityEntry
    j.execution_quality_exit = body.executionQualityExit
    j.execution_quality_stop = body.executionQualityStop
    j.strategy_rules_checked = body.strategyRulesChecked

    trade.has_journal = True
    db.commit()
    db.refresh(j)
    return journal_to_dict(j)
