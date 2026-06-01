from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from models import get_db, SessionPlan

router = APIRouter(prefix="/sessions")


class SessionInput(BaseModel):
    sessionDate: str
    instruments: Optional[str] = None
    directionBias: Optional[str] = None
    setupsWatching: Optional[str] = None
    premarketNotes: Optional[str] = None
    postSessionNotes: Optional[str] = None
    planAdherenceScore: Optional[int] = None
    actualTradeCount: Optional[int] = None
    actualPnl: Optional[float] = None


class SessionUpdate(BaseModel):
    sessionDate: Optional[str] = None
    instruments: Optional[str] = None
    directionBias: Optional[str] = None
    setupsWatching: Optional[str] = None
    premarketNotes: Optional[str] = None
    postSessionNotes: Optional[str] = None
    planAdherenceScore: Optional[int] = None
    actualTradeCount: Optional[int] = None
    actualPnl: Optional[float] = None


def session_to_dict(s: SessionPlan) -> dict:
    return {
        "id": s.id,
        "sessionDate": s.session_date or "",
        "instruments": s.instruments,
        "directionBias": s.direction_bias,
        "setupsWatching": s.setups_watching,
        "premarketNotes": s.premarket_notes,
        "postSessionNotes": s.post_session_notes,
        "planAdherenceScore": s.plan_adherence_score,
        "actualTradeCount": s.actual_trade_count,
        "actualPnl": s.actual_pnl,
        "createdAt": s.created_at.isoformat() if s.created_at else None,
    }


@router.get("")
def list_sessions(db: Session = Depends(get_db)):
    sessions = db.query(SessionPlan).order_by(SessionPlan.created_at.desc()).all()
    return [session_to_dict(s) for s in sessions]


@router.post("", status_code=201)
def create_session(body: SessionInput, db: Session = Depends(get_db)):
    s = SessionPlan(
        session_date=body.sessionDate,
        instruments=body.instruments,
        direction_bias=body.directionBias,
        setups_watching=body.setupsWatching,
        premarket_notes=body.premarketNotes,
        post_session_notes=body.postSessionNotes,
        plan_adherence_score=body.planAdherenceScore,
        actual_trade_count=body.actualTradeCount,
        actual_pnl=body.actualPnl,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return session_to_dict(s)


@router.get("/{id}")
def get_session(id: int, db: Session = Depends(get_db)):
    s = db.query(SessionPlan).filter(SessionPlan.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return session_to_dict(s)


@router.patch("/{id}")
def update_session(id: int, body: SessionUpdate, db: Session = Depends(get_db)):
    s = db.query(SessionPlan).filter(SessionPlan.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    if body.sessionDate is not None:
        s.session_date = body.sessionDate
    if body.instruments is not None:
        s.instruments = body.instruments
    if body.directionBias is not None:
        s.direction_bias = body.directionBias
    if body.setupsWatching is not None:
        s.setups_watching = body.setupsWatching
    if body.premarketNotes is not None:
        s.premarket_notes = body.premarketNotes
    if body.postSessionNotes is not None:
        s.post_session_notes = body.postSessionNotes
    if body.planAdherenceScore is not None:
        s.plan_adherence_score = body.planAdherenceScore
    if body.actualTradeCount is not None:
        s.actual_trade_count = body.actualTradeCount
    if body.actualPnl is not None:
        s.actual_pnl = body.actualPnl
    db.commit()
    db.refresh(s)
    return session_to_dict(s)


@router.delete("/{id}", status_code=204)
def delete_session(id: int, db: Session = Depends(get_db)):
    s = db.query(SessionPlan).filter(SessionPlan.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(s)
    db.commit()
