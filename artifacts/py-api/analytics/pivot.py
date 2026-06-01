from typing import List, Dict, Any
from collections import defaultdict

# Map frontend camelCase dims to trade dict keys
DIM_MAP = {
    "symbol": "symbol",
    "direction": "direction",
    "setup": "setup",
    "assetClass": "asset_class",
    "tags": "tags",
    "session": "session",
    "tiltState": "tilt_state",
}

VALID_METRICS = {"totalPnl", "winRate", "tradeCount", "avgPnl", "profitFactor", "rMultiple"}


def get_dim_value(trade: Dict, dim_key: str) -> str:
    v = trade.get(dim_key)
    if v is None:
        return "—"
    return str(v).strip() or "—"


def compute_cell_metric(trades: List[Dict], metric: str) -> Any:
    closed = [t for t in trades if t.get("pnl") is not None]
    if not closed:
        return None

    pnls = [t.get("pnl") or 0 for t in closed]
    wins = [p for p in pnls if p > 0]
    losses = [abs(p) for p in pnls if p <= 0]

    if metric == "totalPnl":
        return sum(pnls)
    elif metric == "tradeCount":
        return len(closed)
    elif metric == "avgPnl":
        return sum(pnls) / len(pnls)
    elif metric == "winRate":
        return len(wins) / len(pnls) if pnls else 0.0
    elif metric == "profitFactor":
        tw = sum(wins)
        tl = sum(losses)
        return tw / tl if tl > 0 else (999.0 if tw > 0 else 0.0)
    elif metric == "rMultiple":
        rs = [t.get("r_multiple") for t in closed if t.get("r_multiple") is not None]
        return sum(rs) / len(rs) if rs else None
    return None


def compute_pivot(
    trades: List[Dict],
    row_dim: str,
    col_dim: str,
    metric: str,
) -> Dict[str, Any]:
    row_key = DIM_MAP.get(row_dim, "symbol")
    col_key = DIM_MAP.get(col_dim, "direction")
    if metric not in VALID_METRICS:
        metric = "totalPnl"

    groups: Dict[str, Dict[str, List[Dict]]] = defaultdict(lambda: defaultdict(list))
    row_keys: set = set()
    col_keys: set = set()

    for t in trades:
        r = get_dim_value(t, row_key)
        c = get_dim_value(t, col_key)
        groups[r][c].append(t)
        row_keys.add(r)
        col_keys.add(c)

    row_labels = sorted(row_keys)
    col_labels = sorted(col_keys)

    cells = []
    for row in row_labels:
        row_cells = []
        for col in col_labels:
            cell_trades = groups[row][col]
            row_cells.append(compute_cell_metric(cell_trades, metric) if cell_trades else None)
        cells.append(row_cells)

    return {
        "rowLabels": row_labels,
        "colLabels": col_labels,
        "cells": cells,
        "metric": metric,
        "rowDimension": row_dim,
        "colDimension": col_dim,
    }
