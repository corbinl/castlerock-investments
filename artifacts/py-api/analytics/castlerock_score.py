from typing import Optional, Dict, Any


def compute_castlerock_score(
    win_rate: float,
    profit_factor: float,
    expectancy_r: float,
    rule_adherence_rate: Optional[float],
    max_drawdown: float,
    total_trades: int,
) -> Dict[str, Any]:
    if total_trades == 0:
        return {"score": 0, "label": "No Data"}

    w_score = min(win_rate * 100, 100) * 0.25
    pf_raw = min(profit_factor / 3, 1) * 100
    pf_score = pf_raw * 0.25
    er_score = min(max((expectancy_r + 1) / 2, 0), 1) * 100 * 0.20
    rule_score = (rule_adherence_rate if rule_adherence_rate is not None else 0.5) * 100 * 0.15
    dd_penalty = min(abs(max_drawdown) / 5000, 1) * 100 * 0.15

    score = round(min(w_score + pf_score + er_score + rule_score + (15 - dd_penalty), 100))

    if score >= 80:
        label = "Elite"
    elif score >= 65:
        label = "Advanced"
    elif score >= 50:
        label = "Intermediate"
    elif score >= 35:
        label = "Developing"
    else:
        label = "Struggling"

    return {"score": score, "label": label}
