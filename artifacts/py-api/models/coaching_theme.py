from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from .database import Base


class CoachingTheme(Base):
    __tablename__ = "coaching_themes"

    id = Column(Integer, primary_key=True, index=True)
    themes = Column(String, nullable=False)
    trade_count = Column(Integer, default=0)
    generated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
