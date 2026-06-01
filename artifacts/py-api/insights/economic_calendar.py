from typing import List, Dict, Any
from datetime import datetime, timedelta

# Major economic events 2024-2026 (approximate dates)
ECONOMIC_EVENTS = [
    # 2024 NFP
    {"date": "2024-01-05", "event": "NFP", "importance": "high"},
    {"date": "2024-02-02", "event": "NFP", "importance": "high"},
    {"date": "2024-03-08", "event": "NFP", "importance": "high"},
    {"date": "2024-04-05", "event": "NFP", "importance": "high"},
    {"date": "2024-05-03", "event": "NFP", "importance": "high"},
    {"date": "2024-06-07", "event": "NFP", "importance": "high"},
    {"date": "2024-07-05", "event": "NFP", "importance": "high"},
    {"date": "2024-08-02", "event": "NFP", "importance": "high"},
    {"date": "2024-09-06", "event": "NFP", "importance": "high"},
    {"date": "2024-10-04", "event": "NFP", "importance": "high"},
    {"date": "2024-11-01", "event": "NFP", "importance": "high"},
    {"date": "2024-12-06", "event": "NFP", "importance": "high"},
    # 2025 NFP
    {"date": "2025-01-10", "event": "NFP", "importance": "high"},
    {"date": "2025-02-07", "event": "NFP", "importance": "high"},
    {"date": "2025-03-07", "event": "NFP", "importance": "high"},
    {"date": "2025-04-04", "event": "NFP", "importance": "high"},
    {"date": "2025-05-02", "event": "NFP", "importance": "high"},
    {"date": "2025-06-06", "event": "NFP", "importance": "high"},
    # 2024 FOMC
    {"date": "2024-01-31", "event": "FOMC", "importance": "high"},
    {"date": "2024-03-20", "event": "FOMC", "importance": "high"},
    {"date": "2024-05-01", "event": "FOMC", "importance": "high"},
    {"date": "2024-06-12", "event": "FOMC", "importance": "high"},
    {"date": "2024-07-31", "event": "FOMC", "importance": "high"},
    {"date": "2024-09-18", "event": "FOMC", "importance": "high"},
    {"date": "2024-11-07", "event": "FOMC", "importance": "high"},
    {"date": "2024-12-18", "event": "FOMC", "importance": "high"},
    # 2025 FOMC
    {"date": "2025-01-29", "event": "FOMC", "importance": "high"},
    {"date": "2025-03-19", "event": "FOMC", "importance": "high"},
    {"date": "2025-05-07", "event": "FOMC", "importance": "high"},
    {"date": "2025-06-18", "event": "FOMC", "importance": "high"},
    # 2024 CPI
    {"date": "2024-01-11", "event": "CPI", "importance": "high"},
    {"date": "2024-02-13", "event": "CPI", "importance": "high"},
    {"date": "2024-03-12", "event": "CPI", "importance": "high"},
    {"date": "2024-04-10", "event": "CPI", "importance": "high"},
    {"date": "2024-05-15", "event": "CPI", "importance": "high"},
    {"date": "2024-06-12", "event": "CPI", "importance": "high"},
    {"date": "2024-07-11", "event": "CPI", "importance": "high"},
    {"date": "2024-08-14", "event": "CPI", "importance": "high"},
    {"date": "2024-09-11", "event": "CPI", "importance": "high"},
    {"date": "2024-10-10", "event": "CPI", "importance": "high"},
    {"date": "2024-11-13", "event": "CPI", "importance": "high"},
    {"date": "2024-12-11", "event": "CPI", "importance": "high"},
    # 2025 CPI
    {"date": "2025-01-15", "event": "CPI", "importance": "high"},
    {"date": "2025-02-12", "event": "CPI", "importance": "high"},
    {"date": "2025-03-12", "event": "CPI", "importance": "high"},
    {"date": "2025-04-10", "event": "CPI", "importance": "high"},
    {"date": "2025-05-13", "event": "CPI", "importance": "high"},
    {"date": "2025-06-11", "event": "CPI", "importance": "high"},
]


def get_events_for_range(date_from: str, date_to: str) -> List[Dict[str, Any]]:
    return [
        e for e in ECONOMIC_EVENTS
        if date_from <= e["date"] <= date_to
    ]


def is_near_event(trade_date_str: str, window_minutes: int = 30) -> bool:
    if not trade_date_str:
        return False
    try:
        from dateutil.parser import parse as parse_date
        trade_dt = parse_date(trade_date_str)
        trade_date = trade_dt.strftime("%Y-%m-%d")
        # Events are day-level; flag if same day (simplified)
        for e in ECONOMIC_EVENTS:
            if e["date"] == trade_date:
                return True
    except Exception:
        pass
    return False
