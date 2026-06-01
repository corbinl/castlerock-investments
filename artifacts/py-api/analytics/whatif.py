from typing import List, Dict, Any, Optional
from .overview import compute_overview


def compute_whatif(
    trades: List[Dict],
    min_confidence: Optional[float] = None,
    rule_followed_only: bool = False,
    exclude_tilt_states: Optional[List[str]] = None,
) -> Dict[str, Any]:
    filtered = list(trades)

    if min_confidence is not None:
        filtered = [t for t in filtered if (t.get("confidence_rating") or 0) >= min_confidence]

    if rule_followed_only:
        filtered = [t for t in filtered if t.get("rule_followed") is True]

    if exclude_tilt_states:
        filtered = [t for t in filtered if t.get("tilt_state") not in exclude_tilt_states]

    metrics = compute_overview(filtered)
    return {
        "filteredTradeCount": len(filtered),
        "originalTradeCount": len(trades),
        "metrics": metrics,
    }
