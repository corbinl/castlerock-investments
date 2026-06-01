import uuid
from typing import Dict, Any, List, Optional, Tuple

# In-memory session store: session_id -> parsed rows + metadata
_sessions: Dict[str, Dict] = {}


def store_preview(broker: str, rows: List[Dict], errors: List[str], filename: str, account_id: Optional[int]) -> str:
    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "broker": broker,
        "rows": rows,
        "errors": errors,
        "filename": filename,
        "account_id": account_id,
    }
    return session_id


def get_preview(session_id: str) -> Optional[Dict]:
    return _sessions.get(session_id)


def clear_preview(session_id: str) -> None:
    _sessions.pop(session_id, None)


def dedupe_rows(rows: List[Dict], existing_keys: set) -> Tuple[List[Dict], List[Dict]]:
    """Return (new_rows, duplicate_rows) based on canonical key."""
    new_rows = []
    dupes = []
    seen = set()
    for row in rows:
        key = (
            str(row.get("symbol") or ""),
            str(row.get("entry_date") or ""),
            str(row.get("exit_date") or ""),
            str(row.get("quantity") or ""),
        )
        if key in existing_keys or key in seen:
            dupes.append(row)
        else:
            seen.add(key)
            new_rows.append(row)
    return new_rows, dupes
