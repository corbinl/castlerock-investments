from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from .database import Base


class CoachingNote(Base):
    __tablename__ = "coaching_notes"

    id = Column(Integer, primary_key=True, index=True)
    trade_id = Column(Integer, nullable=False, unique=True, index=True)
    content = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
