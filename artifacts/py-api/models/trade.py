from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from sqlalchemy.sql import func
from .database import Base


class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)
    import_batch_id = Column(Integer, nullable=True)
    account_id = Column(Integer, nullable=True, index=True)
    import_source = Column(String, nullable=True)
    asset_class = Column(String, default="equity")
    symbol = Column(String, nullable=False, index=True)
    instrument_description = Column(String, nullable=True)
    direction = Column(String, default="long")
    entry_date = Column(String, nullable=False)
    exit_date = Column(String, nullable=True)
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float, nullable=True)
    quantity = Column(Float, nullable=False)
    pnl = Column(Float, nullable=True)
    fees = Column(Float, nullable=True)
    stop_loss = Column(Float, nullable=True)
    take_profit = Column(Float, nullable=True)
    r_multiple = Column(Float, nullable=True)
    execution_quality_entry = Column(Float, nullable=True)
    execution_quality_exit = Column(Float, nullable=True)
    execution_quality_stop = Column(Float, nullable=True)
    efficiency_entry_pct = Column(Float, nullable=True)
    efficiency_exit_pct = Column(Float, nullable=True)
    tilt_state = Column(String, nullable=True)
    strategy_rules_checked = Column(String, nullable=True)
    tags = Column(String, nullable=True)
    setup = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    session = Column(String, nullable=True)
    economic_event_nearby = Column(Boolean, nullable=True)
    has_journal = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
