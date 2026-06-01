from typing import Optional, Dict, Any


def compute_castlerock_score(
    win_rate: float,
    profit_factor: float,
    expectancy_r: float,
    rule_adherence_rate: Optional[float],
    max_drawdown: float,
    total_trades: int,
) -> Dict[str, Any]:
    """
    CastleRock Score: four equally-weighted components (25% each = 100 max).
      1. Win rate:        win_rate (0–1) scaled to 100
      2. Profit factor:   capped at 3x, normalized 0–100
      3. Expectancy R:    expectancy in R multiples, clamped to –2..+2, mapped 0–100
      4. Rule adherence:  0–1 rate (defaults to 0.5 when unknown), scaled to 100

    Tiers: Expert ≥80 | Advanced ≥65 | Intermediate ≥50 | Beginner <50
    """
    if total_trades == 0:
        return {"score": 0, "label": "No Data"}

    w1 = min(win_rate * 100.0, 100.0) * 0.25
    w2 = min(profit_factor / 3.0, 1.0) * 100.0 * 0.25
    w3 = max(0.0, min((expectancy_r + 2.0) / 4.0, 1.0)) * 100.0 * 0.25
    w4 = (rule_adherence_rate if rule_adherence_rate is not None else 0.5) * 100.0 * 0.25

    score = round(min(w1 + w2 + w3 + w4, 100.0))

    if score >= 80:
        label = "Expert"
    elif score >= 65:
        label = "Advanced"
    elif score >= 50:
        label = "Intermediate"
    else:
        label = "Beginner"

    return {"score": score, "label": label}
