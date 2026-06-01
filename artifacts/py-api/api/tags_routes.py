from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models import get_db, Trade

router = APIRouter(prefix="/tags")


@router.get("")
def list_tags(db: Session = Depends(get_db)):
    """Return all unique tags used across trades."""
    rows = db.query(Trade.tags).filter(Trade.tags != None, Trade.tags != "").all()
    tag_set = set()
    for (tags_str,) in rows:
        if tags_str:
            for t in tags_str.split(","):
                t = t.strip()
                if t:
                    tag_set.add(t)
    return sorted(tag_set)
