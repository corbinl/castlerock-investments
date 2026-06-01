from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from sqlalchemy.sql import func
from .database import Base


class Journal(Base):
    __tablename__ = "journals"

    id = Column(Integer, primary_key=True, index=True)
    trade_id = Column(Integer, nullable=False, unique=True, index=True)
    why_entry = Column(String, nullable=True)
    why_exit = Column(String, nullable=True)
    why_stop_loss = Column(String, nullable=True)
    why_take_profit = Column(String, nullable=True)
    mistakes = Column(String, nullable=True)
    market_observation = Column(String, nullable=True)
    confidence_rating = Column(Float, nullable=True)
    rule_followed = Column(Boolean, nullable=True)
    tilt_state = Column(String, nullable=True)
    execution_quality_entry = Column(Float, nullable=True)
    execution_quality_exit = Column(Float, nullable=True)
    execution_quality_stop = Column(Float, nullable=True)
    strategy_rules_checked = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
