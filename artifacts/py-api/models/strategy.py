from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from .database import Base


class Strategy(Base):
    __tablename__ = "strategies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    rules = Column(String, nullable=True)
    asset_class = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
