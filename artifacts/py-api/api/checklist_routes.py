from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional, List
from pydantic import BaseModel
from datetime import date, timedelta
from models import get_db
from models.checklist import ChecklistItem, ChecklistCompletion

router = APIRouter(prefix="/checklist")


def item_to_dict(item: ChecklistItem) -> dict:
    return {
        "id": item.id,
        "label": item.label,
        "isActive": item.is_active,
        "sortOrder": item.sort_order,
        "createdAt": item.created_at.isoformat() if item.created_at else None,
    }


class ItemCreate(BaseModel):
    label: str
    sortOrder: Optional[int] = None


class ItemUpdate(BaseModel):
    label: Optional[str] = None
    isActive: Optional[bool] = None
    sortOrder: Optional[int] = None


class ReorderBody(BaseModel):
    ids: List[int]


@router.get("/items")
def list_items(db: Session = Depends(get_db)):
    items = db.query(ChecklistItem).order_by(ChecklistItem.sort_order, ChecklistItem.id).all()
    return [item_to_dict(i) for i in items]


@router.post("/items", status_code=201)
def create_item(body: ItemCreate, db: Session = Depends(get_db)):
    if body.sortOrder is None:
        max_order = db.query(ChecklistItem).count()
        sort_order = max_order
    else:
        sort_order = body.sortOrder
    item = ChecklistItem(label=body.label, is_active=True, sort_order=sort_order)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item_to_dict(item)


@router.patch("/items/{item_id}")
def update_item(item_id: int, body: ItemUpdate, db: Session = Depends(get_db)):
    item = db.query(ChecklistItem).filter(ChecklistItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if body.label is not None:
        item.label = body.label
    if body.isActive is not None:
        item.is_active = body.isActive
    if body.sortOrder is not None:
        item.sort_order = body.sortOrder
    db.commit()
    db.refresh(item)
    return item_to_dict(item)


@router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(ChecklistItem).filter(ChecklistItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()


@router.post("/items/reorder")
def reorder_items(body: ReorderBody, db: Session = Depends(get_db)):
    for i, item_id in enumerate(body.ids):
        item = db.query(ChecklistItem).filter(ChecklistItem.id == item_id).first()
        if item:
            item.sort_order = i
    db.commit()
    return {"ok": True}


@router.get("/today")
def get_today(db: Session = Depends(get_db)):
    today_str = date.today().isoformat()
    items = db.query(ChecklistItem).filter(ChecklistItem.is_active == True).order_by(
        ChecklistItem.sort_order, ChecklistItem.id
    ).all()
    completions = db.query(ChecklistCompletion).filter(
        ChecklistCompletion.date == today_str
    ).all()
    completed_ids = {c.item_id for c in completions}
    total = len(items)
    done = len([i for i in items if i.id in completed_ids])
    return {
        "date": today_str,
        "total": total,
        "completed": done,
        "compliancePct": round(done / total * 100) if total > 0 else 100,
        "items": [
            {**item_to_dict(i), "completedToday": i.id in completed_ids}
            for i in items
        ],
    }


@router.post("/today/{item_id}/toggle")
def toggle_today(item_id: int, db: Session = Depends(get_db)):
    today_str = date.today().isoformat()
    item = db.query(ChecklistItem).filter(ChecklistItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    existing = db.query(ChecklistCompletion).filter(
        ChecklistCompletion.item_id == item_id,
        ChecklistCompletion.date == today_str,
    ).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"completed": False}
    else:
        c = ChecklistCompletion(item_id=item_id, date=today_str)
        db.add(c)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
        return {"completed": True}


@router.get("/compliance")
def get_compliance(days: int = 30, db: Session = Depends(get_db)):
    today = date.today()
    result = []
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        d_str = d.isoformat()
        active_items = db.query(ChecklistItem).filter(ChecklistItem.is_active == True).all()
        total = len(active_items)
        if total == 0:
            result.append({"date": d_str, "total": 0, "completed": 0, "pct": 100})
            continue
        completions = db.query(ChecklistCompletion).filter(
            ChecklistCompletion.date == d_str,
            ChecklistCompletion.item_id.in_([a.id for a in active_items])
        ).count()
        result.append({
            "date": d_str,
            "total": total,
            "completed": completions,
            "pct": round(completions / total * 100) if total > 0 else 100,
        })
    return result
