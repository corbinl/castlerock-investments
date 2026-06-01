import json
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Any
from pydantic import BaseModel
from models import get_db, DashboardLayout

router = APIRouter(prefix="/dashboard")


class WidgetConfig(BaseModel):
    id: str
    type: str
    x: int = 0
    y: int = 0
    w: int = 4
    h: int = 4
    config: Any = None


class LayoutInput(BaseModel):
    name: str
    widgets: List[WidgetConfig] = []


def layout_to_dict(layout: DashboardLayout) -> dict:
    widgets_raw = layout.layout or "[]"
    try:
        widgets = json.loads(widgets_raw)
    except (json.JSONDecodeError, TypeError):
        widgets = []
    return {
        "id": layout.id,
        "name": layout.name,
        "widgets": widgets,
        "updatedAt": layout.updated_at.isoformat() if layout.updated_at else datetime.utcnow().isoformat(),
    }


@router.get("/layout")
def get_layout(db: Session = Depends(get_db)):
    layout = db.query(DashboardLayout).filter(DashboardLayout.is_default == True).first()
    if not layout:
        layout = db.query(DashboardLayout).first()
    if not layout:
        return {
            "id": 0,
            "name": "default",
            "widgets": [],
            "updatedAt": datetime.utcnow().isoformat(),
        }
    return layout_to_dict(layout)


@router.put("/layout")
def save_layout(body: LayoutInput, db: Session = Depends(get_db)):
    existing = db.query(DashboardLayout).filter(DashboardLayout.is_default == True).first()
    if existing:
        existing.name = body.name
        existing.layout = json.dumps([w.model_dump() for w in body.widgets])
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return layout_to_dict(existing)
    else:
        layout = DashboardLayout(
            name=body.name,
            layout=json.dumps([w.model_dump() for w in body.widgets]),
            is_default=True,
        )
        db.add(layout)
        db.commit()
        db.refresh(layout)
        return layout_to_dict(layout)
