from typing import List, Dict, Any


def compute_streaks(trades: List[Dict]) -> Dict[str, Any]:
    closed = [t for t in trades if t.get("pnl") is not None]
    sorted_trades = sorted(closed, key=lambda t: t.get("entry_date") or "")

    if not sorted_trades:
        return {
            "currentStreak": 0,
            "currentStreakType": None,
            "maxWinStreak": 0,
            "maxLossStreak": 0,
            "avgWinAfterLossStreak": None,
            "avgLossAfterWinStreak": None,
            "streaks": [],
        }

    outcomes = ["win" if (t.get("pnl") or 0) > 0 else "loss" for t in sorted_trades]

    # Identify all streaks
    streaks = []
    streak_type = outcomes[0]
    streak_len = 1
    streak_start = 0

    for i in range(1, len(outcomes)):
        if outcomes[i] == streak_type:
            streak_len += 1
        else:
            streaks.append({"type": streak_type, "length": streak_len, "startIdx": streak_start})
            streak_type = outcomes[i]
            streak_len = 1
            streak_start = i
    streaks.append({"type": streak_type, "length": streak_len, "startIdx": streak_start})

    max_win_streak = max((s["length"] for s in streaks if s["type"] == "win"), default=0)
    max_loss_streak = max((s["length"] for s in streaks if s["type"] == "loss"), default=0)

    current = streaks[-1] if streaks else None
    current_streak = current["length"] if current else 0
    current_streak_type = current["type"] if current else None

    # Post-streak behavior: avg P&L of first trade after a 3+ loss streak
    post_loss_pnls = []
    post_win_pnls = []
    for i, s in enumerate(streaks[:-1]):
        end_idx = s["startIdx"] + s["length"]
        if end_idx < len(sorted_trades):
            next_pnl = sorted_trades[end_idx].get("pnl") or 0
            if s["type"] == "loss" and s["length"] >= 3:
                post_loss_pnls.append(next_pnl)
            elif s["type"] == "win" and s["length"] >= 3:
                post_win_pnls.append(next_pnl)

    avg_win_after_loss = sum(post_loss_pnls) / len(post_loss_pnls) if post_loss_pnls else None
    avg_loss_after_win = sum(post_win_pnls) / len(post_win_pnls) if post_win_pnls else None

    return {
        "currentStreak": current_streak,
        "currentStreakType": current_streak_type,
        "maxWinStreak": max_win_streak,
        "maxLossStreak": max_loss_streak,
        "avgWinAfterLossStreak": avg_win_after_loss,
        "avgLossAfterWinStreak": avg_loss_after_win,
        "streaks": [{"type": s["type"], "length": s["length"]} for s in streaks[-10:]],
    }
