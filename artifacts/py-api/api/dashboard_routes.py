from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from models import get_db, DashboardLayout

router = APIRouter(prefix="/dashboard")


class LayoutInput(BaseModel):
    name: str
    layout: Optional[str] = None
    isDefault: Optional[bool] = False


@router.get("/layout")
def get_layout(db: Session = Depends(get_db)):
    layout = db.query(DashboardLayout).filter(DashboardLayout.is_default == True).first()
    if not layout:
        layout = db.query(DashboardLayout).first()
    if not layout:
        return {"id": None, "name": "default", "layout": None, "isDefault": True}
    return {
        "id": layout.id,
        "name": layout.name,
        "layout": layout.layout,
        "isDefault": layout.is_default,
    }


@router.post("/layout")
def save_layout(body: LayoutInput, db: Session = Depends(get_db)):
    if body.isDefault:
        db.query(DashboardLayout).update({"is_default": False})
    layout = DashboardLayout(
        name=body.name,
        layout=body.layout,
        is_default=body.isDefault or False,
    )
    db.add(layout)
    db.commit()
    db.refresh(layout)
    return {
        "id": layout.id,
        "name": layout.name,
        "layout": layout.layout,
        "isDefault": layout.is_default,
    }
