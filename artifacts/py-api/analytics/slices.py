from typing import List, Dict, Any, Optional
from collections import defaultdict


def compute_slice_stats(trades: List[Dict], label: str) -> Dict[str, Any]:
    closed = [t for t in trades if t.get("pnl") is not None]
    if not closed:
        return {
            "label": label,
            "tradeCount": 0,
            "winRate": 0.0,
            "avgPnl": 0.0,
            "totalPnl": 0.0,
            "profitFactor": 0.0,
            "expectancy": 0.0,
            "avgRMultiple": None,
        }

    wins = [t for t in closed if (t.get("pnl") or 0) > 0]
    losses = [t for t in closed if (t.get("pnl") or 0) <= 0]
    total_pnl = sum(t.get("pnl") or 0 for t in closed)
    total_wins = sum(t.get("pnl") or 0 for t in wins)
    total_losses = abs(sum(t.get("pnl") or 0 for t in losses))
    win_rate = len(wins) / len(closed)
    loss_rate = 1 - win_rate
    avg_win = total_wins / len(wins) if wins else 0.0
    avg_loss = total_losses / len(losses) if losses else 0.0
    profit_factor = (total_wins / total_losses) if total_losses > 0 else (999.0 if total_wins > 0 else 0.0)
    expectancy = win_rate * avg_win - loss_rate * avg_loss
    r_trades = [t for t in closed if t.get("r_multiple") is not None]
    avg_r = sum(t.get("r_multiple") or 0 for t in r_trades) / len(r_trades) if r_trades else None

    return {
        "label": label,
        "tradeCount": len(closed),
        "winRate": win_rate,
        "avgPnl": total_pnl / len(closed),
        "totalPnl": total_pnl,
        "profitFactor": profit_factor,
        "expectancy": expectancy,
        "avgRMultiple": avg_r,
    }


def group_by(trades: List[Dict], key_fn) -> List[Dict[str, Any]]:
    groups: Dict[str, List[Dict]] = defaultdict(list)
    for t in trades:
        k = key_fn(t)
        if k is not None:
            groups[str(k)].append(t)
    return [compute_slice_stats(v, label) for label, v in groups.items()]


def by_symbol(trades: List[Dict]) -> List[Dict]:
    return group_by(trades, lambda t: t.get("symbol"))


def by_strategy(trades: List[Dict]) -> List[Dict]:
    return group_by(trades, lambda t: t.get("setup") or "No Strategy")


def by_setup(trades: List[Dict]) -> List[Dict]:
    return group_by(trades, lambda t: t.get("setup") or "No Setup")


def by_tag(trades: List[Dict]) -> List[Dict]:
    groups: Dict[str, List[Dict]] = defaultdict(list)
    for t in trades:
        raw = t.get("tags") or ""
        tags = [tag.strip() for tag in raw.split(",") if tag.strip()] if raw else []
        if not tags:
            groups["Untagged"].append(t)
        else:
            for tag in tags:
                groups[tag].append(t)
    return [compute_slice_stats(v, label) for label, v in groups.items()]


def by_direction(trades: List[Dict]) -> List[Dict]:
    return group_by(trades, lambda t: t.get("direction") or "unknown")


def by_asset_class(trades: List[Dict]) -> List[Dict]:
    return group_by(trades, lambda t: t.get("asset_class") or "unknown")


def by_session(trades: List[Dict]) -> List[Dict]:
    return group_by(trades, lambda t: t.get("session") or "unknown")


def by_tilt(trades: List[Dict]) -> List[Dict]:
    return group_by(trades, lambda t: t.get("tilt_state") or "calm")


def by_confidence(trades: List[Dict]) -> List[Dict]:
    groups: Dict[str, List[Dict]] = defaultdict(list)
    for t in trades:
        conf = t.get("confidence_rating")
        if conf is not None:
            bucket = f"{int(conf)}-{int(conf)+1}" if conf < 10 else "10"
            groups[bucket].append(t)
    return [compute_slice_stats(v, label) for label, v in sorted(groups.items())]


def by_day_of_week(trades: List[Dict]) -> List[Dict]:
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    groups: Dict[str, List[Dict]] = defaultdict(list)
    for t in trades:
        try:
            from dateutil.parser import parse as parse_date
            d = parse_date(t["entry_date"])
            groups[days[d.weekday()]].append(t)
        except Exception:
            pass
    return [compute_slice_stats(v, label) for label, v in groups.items()]


def by_hour_of_day(trades: List[Dict]) -> List[Dict]:
    results = []
    groups: Dict[int, List[Dict]] = defaultdict(list)
    for t in trades:
        try:
            from dateutil.parser import parse as parse_date
            d = parse_date(t["entry_date"])
            groups[d.hour].append(t)
        except Exception:
            pass
    for hour in sorted(groups.keys()):
        closed = [t for t in groups[hour] if t.get("pnl") is not None]
        total_pnl = sum(t.get("pnl") or 0 for t in closed)
        trade_count = len(closed)
        wins = sum(1 for t in closed if (t.get("pnl") or 0) > 0)
        results.append({
            "hour": hour,
            "totalPnl": total_pnl,
            "tradeCount": trade_count,
            "winRate": wins / trade_count if trade_count > 0 else 0.0,
        })
    return results
