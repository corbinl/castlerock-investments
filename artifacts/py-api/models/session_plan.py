from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from .database import Base


class SessionPlan(Base):
    __tablename__ = "session_plans"

    id = Column(Integer, primary_key=True, index=True)
    session_date = Column(String, nullable=False, default="")
    instruments = Column(String, nullable=True)
    direction_bias = Column(String, nullable=True)
    setups_watching = Column(String, nullable=True)
    premarket_notes = Column(String, nullable=True)
    post_session_notes = Column(String, nullable=True)
    plan_adherence_score = Column(Integer, nullable=True)
    actual_trade_count = Column(Integer, nullable=True)
    actual_pnl = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
