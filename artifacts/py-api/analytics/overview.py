from typing import List, Dict, Any, Optional


def compute_overview(trades: List[Dict]) -> Dict[str, Any]:
    if not trades:
        return {
            "totalTrades": 0,
            "winRate": 0.0,
            "lossRate": 0.0,
            "avgWin": 0.0,
            "avgLoss": 0.0,
            "expectancy": 0.0,
            "expectancyR": 0.0,
            "profitFactor": 0.0,
            "totalPnl": 0.0,
            "totalFees": 0.0,
            "maxDrawdown": 0.0,
            "avgRMultiple": 0.0,
            "castlerockScore": 0,
            "castlerockScoreLabel": "No Data",
            "ruleAdherenceRate": None,
            "avgConfidence": None,
            "avgHoldTimeHours": None,
            "biggestWinner": 0.0,
            "biggestLoser": 0.0,
            "longWinRate": None,
            "shortWinRate": None,
        }

    closed = [t for t in trades if t.get("pnl") is not None]
    wins = [t for t in closed if (t.get("pnl") or 0) > 0]
    losses = [t for t in closed if (t.get("pnl") or 0) <= 0]

    total_pnl = sum(t.get("pnl") or 0 for t in closed)
    total_fees = sum(t.get("fees") or 0 for t in trades)
    win_rate = len(wins) / len(closed) if closed else 0.0
    loss_rate = 1.0 - win_rate

    total_wins = sum(t.get("pnl") or 0 for t in wins)
    total_losses = abs(sum(t.get("pnl") or 0 for t in losses))
    avg_win = total_wins / len(wins) if wins else 0.0
    avg_loss = total_losses / len(losses) if losses else 0.0
    profit_factor = (total_wins / total_losses) if total_losses > 0 else (999.0 if total_wins > 0 else 0.0)
    expectancy = win_rate * avg_win - loss_rate * avg_loss

    r_trades = [t for t in closed if t.get("r_multiple") is not None]
    avg_r_multiple = (sum(t.get("r_multiple") or 0 for t in r_trades) / len(r_trades)) if r_trades else 0.0
    expectancy_r = avg_r_multiple

    # Max drawdown from equity curve
    sorted_trades = sorted(closed, key=lambda t: t.get("entry_date") or "")
    peak = running = max_drawdown = 0.0
    for t in sorted_trades:
        running += t.get("pnl") or 0
        if running > peak:
            peak = running
        dd = running - peak
        if dd < max_drawdown:
            max_drawdown = dd

    biggest_winner = max((t.get("pnl") or 0 for t in closed), default=0.0)
    biggest_loser = min((t.get("pnl") or 0 for t in closed), default=0.0)

    # Long/short split
    longs = [t for t in closed if t.get("direction") == "long"]
    shorts = [t for t in closed if t.get("direction") == "short"]
    long_wins = [t for t in longs if (t.get("pnl") or 0) > 0]
    short_wins = [t for t in shorts if (t.get("pnl") or 0) > 0]
    long_win_rate = len(long_wins) / len(longs) if longs else None
    short_win_rate = len(short_wins) / len(shorts) if shorts else None

    # Rule adherence (from journal data embedded in trade)
    rule_trades = [t for t in trades if t.get("rule_followed") is not None]
    rule_adherence_rate = (
        sum(1 for t in rule_trades if t.get("rule_followed")) / len(rule_trades)
        if rule_trades else None
    )

    # Confidence
    conf_trades = [t for t in trades if t.get("confidence_rating") is not None]
    avg_confidence = (
        sum(t.get("confidence_rating") or 0 for t in conf_trades) / len(conf_trades)
        if conf_trades else None
    )

    # Hold time
    hold_times = []
    for t in closed:
        if t.get("exit_date") and t.get("entry_date"):
            try:
                from dateutil.parser import parse as parse_date
                entry = parse_date(t["entry_date"])
                exit_ = parse_date(t["exit_date"])
                hours = (exit_ - entry).total_seconds() / 3600
                if hours > 0:
                    hold_times.append(hours)
            except Exception:
                pass
    avg_hold_time = sum(hold_times) / len(hold_times) if hold_times else None

    from .castlerock_score import compute_castlerock_score
    score_result = compute_castlerock_score(
        win_rate=win_rate,
        profit_factor=profit_factor,
        expectancy_r=expectancy_r,
        rule_adherence_rate=rule_adherence_rate,
        max_drawdown=max_drawdown,
        total_trades=len(trades),
    )

    return {
        "totalTrades": len(closed),
        "winRate": win_rate,
        "lossRate": loss_rate,
        "avgWin": avg_win,
        "avgLoss": avg_loss,
        "expectancy": expectancy,
        "expectancyR": expectancy_r,
        "profitFactor": profit_factor,
        "totalPnl": total_pnl,
        "totalFees": total_fees,
        "maxDrawdown": max_drawdown,
        "avgRMultiple": avg_r_multiple,
        "castlerockScore": score_result["score"],
        "castlerockScoreLabel": score_result["label"],
        "ruleAdherenceRate": rule_adherence_rate,
        "avgConfidence": avg_confidence,
        "avgHoldTimeHours": avg_hold_time,
        "biggestWinner": biggest_winner,
        "biggestLoser": biggest_loser,
        "longWinRate": long_win_rate,
        "shortWinRate": short_win_rate,
    }
