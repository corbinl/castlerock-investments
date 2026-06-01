from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from models import get_db, Strategy, Trade
from analytics.slices import compute_slice_stats

router = APIRouter(prefix="/strategies")


class StrategyInput(BaseModel):
    name: str
    description: Optional[str] = None
    rules: Optional[str] = None
    assetClass: Optional[str] = None


class StrategyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    rules: Optional[str] = None
    assetClass: Optional[str] = None


def strategy_to_dict(s: Strategy) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "description": s.description,
        "rules": s.rules,
        "assetClass": s.asset_class,
        "createdAt": s.created_at.isoformat() if s.created_at else None,
    }


@router.get("")
def list_strategies(db: Session = Depends(get_db)):
    strategies = db.query(Strategy).all()
    return [strategy_to_dict(s) for s in strategies]


@router.post("", status_code=201)
def create_strategy(body: StrategyInput, db: Session = Depends(get_db)):
    s = Strategy(
        name=body.name,
        description=body.description,
        rules=body.rules,
        asset_class=body.assetClass,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return strategy_to_dict(s)


@router.get("/{id}")
def get_strategy(id: int, db: Session = Depends(get_db)):
    s = db.query(Strategy).filter(Strategy.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return strategy_to_dict(s)


@router.get("/{id}/stats")
def get_strategy_stats(id: int, db: Session = Depends(get_db)):
    s = db.query(Strategy).filter(Strategy.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Strategy not found")

    trades = db.query(Trade).filter(Trade.setup == s.name).all()
    trade_dicts = [{
        "pnl": t.pnl,
        "r_multiple": t.r_multiple,
        "setup": t.setup,
        "direction": t.direction,
        "asset_class": t.asset_class,
    } for t in trades]

    return {
        "strategy": strategy_to_dict(s),
        "stats": compute_slice_stats(trade_dicts, s.name),
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
        s.rules = body.rules
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
