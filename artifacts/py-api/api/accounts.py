from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from models import get_db, Account

router = APIRouter(prefix="/accounts")


class AccountInput(BaseModel):
    name: str
    currency: str = "USD"
    description: Optional[str] = None


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    currency: Optional[str] = None
    description: Optional[str] = None


def account_to_dict(a: Account) -> dict:
    return {
        "id": a.id,
        "name": a.name,
        "currency": a.currency,
        "description": a.description,
        "createdAt": a.created_at.isoformat() if a.created_at else None,
    }


@router.get("")
def list_accounts(db: Session = Depends(get_db)):
    accounts = db.query(Account).all()
    return [account_to_dict(a) for a in accounts]


@router.post("", status_code=201)
def create_account(body: AccountInput, db: Session = Depends(get_db)):
    a = Account(name=body.name, currency=body.currency, description=body.description)
    db.add(a)
    db.commit()
    db.refresh(a)
    return account_to_dict(a)


@router.get("/{id}")
def get_account(id: int, db: Session = Depends(get_db)):
    a = db.query(Account).filter(Account.id == id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Account not found")
    return account_to_dict(a)


@router.patch("/{id}")
def update_account(id: int, body: AccountUpdate, db: Session = Depends(get_db)):
    a = db.query(Account).filter(Account.id == id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Account not found")
    if body.name is not None:
        a.name = body.name
    if body.currency is not None:
        a.currency = body.currency
    if body.description is not None:
        a.description = body.description
    db.commit()
    db.refresh(a)
    return account_to_dict(a)


@router.delete("/{id}", status_code=204)
def delete_account(id: int, db: Session = Depends(get_db)):
    a = db.query(Account).filter(Account.id == id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete(a)
    db.commit()
