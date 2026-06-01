from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from .database import Base


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    broker_format = Column(String, default="generic")
    account_id = Column(Integer, nullable=True)
    row_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    imported_at = Column(DateTime(timezone=True), server_default=func.now())
