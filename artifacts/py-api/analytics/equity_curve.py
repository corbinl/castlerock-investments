from typing import List, Dict, Any, Optional


def compute_equity_curve(trades: List[Dict]) -> List[Dict[str, Any]]:
    closed = [t for t in trades if t.get("pnl") is not None]
    sorted_trades = sorted(closed, key=lambda t: t.get("entry_date") or "")

    running = 0.0
    points = []
    for t in sorted_trades:
        pnl = t.get("pnl") or 0
        running += pnl
        raw_date = t.get("exit_date") or t.get("entry_date") or ""
        points.append({
            "date": raw_date[:10] if raw_date else None,
            "cumulativePnl": running,
            "dailyPnl": pnl,
            "tradeId": t.get("id"),
        })
    return points


def compute_calendar(
    trades: List[Dict],
    year: Optional[int] = None,
    month: Optional[int] = None,
) -> List[Dict[str, Any]]:
    closed = [t for t in trades if t.get("pnl") is not None]

    day_pnls: Dict[str, List[float]] = {}
    day_wins: Dict[str, int] = {}
    day_losses: Dict[str, int] = {}

    for t in closed:
        date_str = (t.get("exit_date") or t.get("entry_date") or "")[:10]
        if not date_str or len(date_str) < 10:
            continue
        try:
            parts = date_str.split("-")
            y, m = int(parts[0]), int(parts[1])
            if year and y != year:
                continue
            if month and m != month:
                continue
        except Exception:
            continue

        pnl = t.get("pnl") or 0
        day_pnls.setdefault(date_str, []).append(pnl)
        if pnl > 0:
            day_wins[date_str] = day_wins.get(date_str, 0) + 1
        else:
            day_losses[date_str] = day_losses.get(date_str, 0) + 1

    result = []
    for date_str in sorted(day_pnls.keys()):
        pnls = day_pnls[date_str]
        result.append({
            "date": date_str,
            "totalPnl": sum(pnls),
            "tradeCount": len(pnls),
            "winCount": day_wins.get(date_str, 0),
            "lossCount": day_losses.get(date_str, 0),
            "economicEvents": [],
        })
    return result
