import io
import pandas as pd
from typing import Tuple, List, Dict, Any


def detect_broker_format(df: pd.DataFrame) -> str:
    cols = set(c.lower() for c in df.columns)
    if "ticket" in cols and "profit" in cols and "swaps" in cols:
        return "mt4"
    if "deal" in cols and "order" in cols and "profit" in cols:
        return "mt5"
    if "iborderid" in cols or "clientorderid" in cols or "realized p&l" in cols:
        return "ibkr"
    return "generic"


COLUMN_MAPS = {
    "generic": {
        "symbol": ["symbol", "ticker", "instrument"],
        "direction": ["direction", "side", "type", "action"],
        "entry_date": ["entry_date", "entrydate", "open_date", "opendate", "date", "open time"],
        "exit_date": ["exit_date", "exitdate", "close_date", "closedate", "close time"],
        "entry_price": ["entry_price", "entryprice", "open_price", "openprice", "open price", "price"],
        "exit_price": ["exit_price", "exitprice", "close_price", "closeprice", "close price"],
        "quantity": ["quantity", "qty", "size", "volume", "units", "shares"],
        "pnl": ["pnl", "profit", "profit/loss", "gain/loss", "net p&l", "net pnl"],
        "fees": ["fees", "commission", "commissions", "fee"],
        "stop_loss": ["stop_loss", "stoploss", "sl", "stop"],
        "take_profit": ["take_profit", "takeprofit", "tp", "target"],
        "setup": ["setup", "strategy", "pattern"],
        "tags": ["tags", "tag", "notes", "comments"],
        "session": ["session", "time_of_day"],
        "asset_class": ["asset_class", "assetclass", "market", "asset type"],
        "tilt_state": ["tilt_state", "tiltstate", "emotion", "mood"],
        "confidence_rating": ["confidence_rating", "confidence", "confidence score"],
        "rule_followed": ["rule_followed", "rulefollowed", "rules_followed"],
    },
    "mt4": {
        "symbol": ["symbol"],
        "direction": ["type"],
        "entry_date": ["open time"],
        "exit_date": ["close time"],
        "entry_price": ["open price"],
        "exit_price": ["close price"],
        "quantity": ["volume"],
        "pnl": ["profit"],
        "fees": ["commission"],
        "stop_loss": ["s / l"],
        "take_profit": ["t / p"],
    },
    "mt5": {
        "symbol": ["symbol"],
        "direction": ["type"],
        "entry_date": ["time"],
        "exit_date": ["time"],
        "entry_price": ["price"],
        "exit_price": ["price"],
        "quantity": ["volume"],
        "pnl": ["profit"],
        "fees": ["commission"],
    },
}


def normalize_direction(val: Any) -> str:
    if val is None:
        return "long"
    v = str(val).lower().strip()
    if v in ("buy", "long", "b"):
        return "long"
    if v in ("sell", "short", "s"):
        return "short"
    return "long"


def find_column(df: pd.DataFrame, candidates: List[str]) -> Any:
    lower_cols = {c.lower(): c for c in df.columns}
    for cand in candidates:
        if cand.lower() in lower_cols:
            return lower_cols[cand.lower()]
    return None


def map_columns(df: pd.DataFrame, broker: str) -> pd.DataFrame:
    col_map = COLUMN_MAPS.get(broker, COLUMN_MAPS["generic"])
    result = {}
    for target_field, candidates in col_map.items():
        src = find_column(df, candidates)
        if src:
            result[target_field] = df[src]
    # Always try generic fallback for missing fields
    if broker != "generic":
        generic_map = COLUMN_MAPS["generic"]
        for target_field, candidates in generic_map.items():
            if target_field not in result:
                src = find_column(df, candidates)
                if src:
                    result[target_field] = df[src]
    return pd.DataFrame(result)


def compute_r_multiple(row: Dict) -> Any:
    try:
        entry = float(row.get("entry_price") or 0)
        exit_ = float(row.get("exit_price") or 0)
        sl = float(row.get("stop_loss") or 0)
        direction = row.get("direction", "long")
        if sl == 0 or entry == 0:
            return None
        risk = abs(entry - sl)
        if risk == 0:
            return None
        if direction == "long":
            return (exit_ - entry) / risk
        else:
            return (entry - exit_) / risk
    except Exception:
        return None


def parse_csv(content: bytes, filename: str) -> Tuple[str, List[Dict[str, Any]], List[str]]:
    errors = []
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        return "generic", [], [f"Failed to parse CSV: {e}"]

    # Clean column names
    df.columns = [str(c).strip() for c in df.columns]

    broker = detect_broker_format(df)
    mapped = map_columns(df, broker)

    rows = []
    for i, row in mapped.iterrows():
        try:
            d = row.to_dict()
            # Clean NaN
            d = {k: (None if pd.isna(v) else v) for k, v in d.items()}

            # Normalize types
            if "direction" in d:
                d["direction"] = normalize_direction(d.get("direction"))

            for float_field in ["entry_price", "exit_price", "quantity", "pnl", "fees", "stop_loss", "take_profit", "confidence_rating"]:
                if float_field in d and d[float_field] is not None:
                    try:
                        d[float_field] = float(str(d[float_field]).replace(",", ""))
                    except Exception:
                        d[float_field] = None

            # Compute r_multiple if possible
            if not d.get("r_multiple") and d.get("stop_loss"):
                d["r_multiple"] = compute_r_multiple(d)

            # rule_followed: convert to bool
            if "rule_followed" in d and d["rule_followed"] is not None:
                v = str(d["rule_followed"]).lower()
                d["rule_followed"] = v in ("true", "1", "yes", "y")

            rows.append(d)
        except Exception as e:
            errors.append(f"Row {i}: {e}")

    return broker, rows, errors
