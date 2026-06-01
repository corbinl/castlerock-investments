from typing import List, Dict, Any
from collections import defaultdict
from datetime import datetime, timedelta


def detect_nudges(trades: List[Dict]) -> List[Dict[str, Any]]:
    nudges = []

    if not trades:
        return nudges

    # Sort by entry_date
    sorted_trades = sorted(trades, key=lambda t: t.get("entry_date") or "")
    closed = [t for t in sorted_trades if t.get("pnl") is not None]

    # --- Overtrading: >5 trades on same day ---
    day_counts: Dict[str, int] = defaultdict(int)
    for t in sorted_trades:
        day = (t.get("entry_date") or "")[:10]
        if day:
            day_counts[day] += 1
    overtrade_days = {day: cnt for day, cnt in day_counts.items() if cnt > 5}
    if overtrade_days:
        worst_day = max(overtrade_days, key=lambda d: overtrade_days[d])
        nudges.append({
            "type": "overtrading",
            "severity": "warning",
            "title": "Overtrading Detected",
            "message": f"You placed {overtrade_days[worst_day]} trades on {worst_day}. Overtrading often leads to emotional decisions.",
            "date": worst_day,
        })

    # --- Revenge trading: 3 consecutive losses then another trade same day ---
    day_trades: Dict[str, List[Dict]] = defaultdict(list)
    for t in closed:
        day = (t.get("entry_date") or "")[:10]
        day_trades[day].append(t)

    for day, day_t in day_trades.items():
        day_sorted = sorted(day_t, key=lambda t: t.get("entry_date") or "")
        pnls = [t.get("pnl") or 0 for t in day_sorted]
        for i in range(len(pnls) - 3):
            if pnls[i] <= 0 and pnls[i+1] <= 0 and pnls[i+2] <= 0 and i+3 < len(pnls):
                nudges.append({
                    "type": "revenge_trading",
                    "severity": "danger",
                    "title": "Revenge Trading Pattern",
                    "message": f"On {day}, you had 3 consecutive losses and continued trading. This is a common revenge trading pattern.",
                    "date": day,
                })
                break

    # --- Unreviewed losses: losing trades without journal, older than 48h ---
    cutoff = (datetime.utcnow() - timedelta(hours=48)).isoformat()
    unreviewed = [
        t for t in closed
        if (t.get("pnl") or 0) < 0
        and not t.get("has_journal")
        and (t.get("entry_date") or "") < cutoff
    ]
    if unreviewed:
        nudges.append({
            "type": "unreviewed_losses",
            "severity": "info",
            "title": "Unreviewed Losses",
            "message": f"You have {len(unreviewed)} losing trade(s) without a journal entry. Reviewing losses helps prevent repeating mistakes.",
            "count": len(unreviewed),
        })

    # --- FOMO pattern: tilt=fomo with loss rate >60% ---
    fomo_trades = [t for t in closed if t.get("tilt_state") == "fomo"]
    if len(fomo_trades) >= 3:
        fomo_losses = [t for t in fomo_trades if (t.get("pnl") or 0) <= 0]
        fomo_loss_rate = len(fomo_losses) / len(fomo_trades)
        if fomo_loss_rate > 0.6:
            nudges.append({
                "type": "fomo",
                "severity": "warning",
                "title": "FOMO Trading Risk",
                "message": f"When trading in FOMO state, your loss rate is {fomo_loss_rate:.0%}. Consider pausing when you feel FOMO.",
                "lossRate": fomo_loss_rate,
            })

    return nudges


def compute_weekly_briefing(trades: List[Dict]) -> Dict[str, Any]:
    if not trades:
        return {
            "tradeCount": 0,
            "winRate": 0.0,
            "totalPnl": 0.0,
            "bestDay": None,
            "worstDay": None,
            "standoutPattern": None,
            "recommendation": "Start logging trades to get your weekly briefing.",
        }

    # Last 7 days
    cutoff = (datetime.utcnow() - timedelta(days=7)).isoformat()
    recent = [t for t in trades if (t.get("entry_date") or "") >= cutoff and t.get("pnl") is not None]

    if not recent:
        return {
            "tradeCount": 0,
            "winRate": 0.0,
            "totalPnl": 0.0,
            "bestDay": None,
            "worstDay": None,
            "standoutPattern": None,
            "recommendation": "No trades in the last 7 days. Keep up your journaling habit!",
        }

    wins = [t for t in recent if (t.get("pnl") or 0) > 0]
    total_pnl = sum(t.get("pnl") or 0 for t in recent)
    win_rate = len(wins) / len(recent)

    # Best/worst day
    day_pnl: Dict[str, float] = defaultdict(float)
    for t in recent:
        day = (t.get("entry_date") or "")[:10]
        day_pnl[day] += t.get("pnl") or 0

    best_day = max(day_pnl, key=lambda d: day_pnl[d]) if day_pnl else None
    worst_day = min(day_pnl, key=lambda d: day_pnl[d]) if day_pnl else None

    # Standout pattern
    from collections import Counter
    setups = [t.get("setup") for t in recent if t.get("setup")]
    standout = Counter(setups).most_common(1)[0][0] if setups else None

    # Recommendation
    if win_rate < 0.4:
        rec = "Your win rate is below 40%. Focus on high-conviction setups only and reduce position sizing."
    elif total_pnl < 0:
        rec = "Net negative week. Review your losing trades and look for common patterns to avoid."
    elif win_rate > 0.6 and total_pnl > 0:
        rec = "Strong week! Consider documenting your best setups for consistency."
    else:
        rec = "Steady week. Keep following your process and journaling every trade."

    return {
        "tradeCount": len(recent),
        "winRate": win_rate,
        "totalPnl": total_pnl,
        "bestDay": best_day,
        "worstDay": worst_day,
        "standoutPattern": standout,
        "recommendation": rec,
    }


def compute_today_panel(trades: List[Dict]) -> Dict[str, Any]:
    if not trades:
        return {"priority": "info", "title": "Welcome!", "message": "Start adding trades to see your today insights."}

    closed = [t for t in trades if t.get("pnl") is not None]
    sorted_trades = sorted(closed, key=lambda t: t.get("entry_date") or "")

    # Last 3 consecutive losses → show post-loss behavior
    if len(sorted_trades) >= 3:
        last_3 = sorted_trades[-3:]
        all_losses = all((t.get("pnl") or 0) <= 0 for t in last_3)
        if all_losses:
            # Find historical post-3-loss behavior
            post_loss_pnls = []
            for i in range(len(sorted_trades) - 3):
                if all((sorted_trades[i+j].get("pnl") or 0) <= 0 for j in range(3)):
                    if i + 3 < len(sorted_trades):
                        post_loss_pnls.append(sorted_trades[i+3].get("pnl") or 0)
            if post_loss_pnls:
                avg = sum(post_loss_pnls) / len(post_loss_pnls)
                direction = "profitable" if avg > 0 else "losing"
                return {
                    "priority": "warning",
                    "title": "3 Consecutive Losses",
                    "message": f"Historically, your next trade after 3 losses has been {direction} (avg ${avg:.2f}). Take a break before continuing.",
                }
            return {
                "priority": "warning",
                "title": "3 Consecutive Losses",
                "message": "You've had 3 losses in a row. Consider taking a break and reviewing your setup criteria.",
            }

    # New week: show last week top pattern
    now = datetime.utcnow()
    week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0)
    last_week_start = week_start - timedelta(days=7)
    last_week = [
        t for t in closed
        if last_week_start.isoformat() <= (t.get("entry_date") or "") < week_start.isoformat()
    ]
    if last_week and now.weekday() == 0:
        wins = [t for t in last_week if (t.get("pnl") or 0) > 0]
        win_rate = len(wins) / len(last_week)
        total = sum(t.get("pnl") or 0 for t in last_week)
        return {
            "priority": "info",
            "title": "New Week Recap",
            "message": f"Last week: {len(last_week)} trades, {win_rate:.0%} win rate, ${total:.2f} P&L. Keep the momentum going!",
        }

    return {
        "priority": "info",
        "title": "Keep Going",
        "message": f"You have {len(sorted_trades)} trades in your journal. Stay consistent!",
    }
