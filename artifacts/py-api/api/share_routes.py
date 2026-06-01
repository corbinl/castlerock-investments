import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import get_db, Trade, Journal, ShareLink

router = APIRouter(prefix="/share")


def journal_to_dict(j: Journal) -> dict:
    return {
        "id": j.id,
        "tradeId": j.trade_id,
        "whyEntry": j.why_entry,
        "whyExit": j.why_exit,
        "mistakes": j.mistakes,
        "marketObservation": j.market_observation,
        "confidenceRating": j.confidence_rating,
        "ruleFollowed": j.rule_followed,
        "tiltState": j.tilt_state,
    }


@router.post("/trades/{id}")
def create_share_link(id: int, db: Session = Depends(get_db)):
    trade = db.query(Trade).filter(Trade.id == id).first()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")

    token = str(uuid.uuid4()).replace("-", "")
    link = ShareLink(token=token, trade_id=id)
    db.add(link)
    db.commit()
    return {"token": token}


@router.get("/view/{token}")
def get_share_view(token: str, db: Session = Depends(get_db)):
    link = db.query(ShareLink).filter(ShareLink.token == token).first()
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")

    trade = db.query(Trade).filter(Trade.id == link.trade_id).first()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")

    journal = db.query(Journal).filter(Journal.trade_id == trade.id).first()

    return {
        "trade": {
            "id": trade.id,
            "symbol": trade.symbol,
            "direction": trade.direction,
            "entryDate": trade.entry_date,
            "exitDate": trade.exit_date,
            "entryPrice": trade.entry_price,
            "exitPrice": trade.exit_price,
            "quantity": trade.quantity,
            "pnl": trade.pnl,
            "rMultiple": trade.r_multiple,
            "setup": trade.setup,
            "tags": trade.tags,
        },
        "journal": journal_to_dict(journal) if journal else None,
    }
