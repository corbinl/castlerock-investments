import os
import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from openai import OpenAI
from models import get_db, Trade, Journal

router = APIRouter()

SUGGESTED_QUESTIONS = [
    "When do I lose the most money?",
    "Show me all trades where I broke my rules",
    "What's my edge on Mondays?",
    "Which symbols are most profitable for me?",
    "How do I perform in the morning vs afternoon?",
    "What's my average win vs loss ratio by setup?",
]

# ── OpenAI client ────────────────────────────────────────────────────────────

def get_openai_client() -> OpenAI:
    base_url = os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")
    api_key = os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY", "dummy")
    if not base_url:
        raise HTTPException(status_code=500, detail="OpenAI integration not configured")
    return OpenAI(base_url=base_url, api_key=api_key)


# ── Function-calling tool schema ─────────────────────────────────────────────

QUERY_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "filter_by_day",
            "description": "Analyze trade performance grouped or filtered by day of week. Use for questions about specific days (Monday, Tuesday, etc.) or day-of-week patterns.",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {
                        "type": "array",
                        "items": {"type": "string", "enum": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]},
                        "description": "Specific days to filter on. Empty means all days."
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "filter_by_symbol",
            "description": "Analyze trade performance grouped or filtered by ticker/symbol. Use for questions about specific symbols (AAPL, GBPUSD, etc.) or which symbols perform best/worst.",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbols": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Specific symbols to filter on. Empty means all symbols."
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "filter_by_session",
            "description": "Analyze trade performance grouped or filtered by trading session (morning, afternoon, pre-market, etc.).",
            "parameters": {
                "type": "object",
                "properties": {
                    "sessions": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Specific session names to filter on. Empty means all sessions."
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "filter_by_setup",
            "description": "Analyze trade performance grouped or filtered by setup or strategy type.",
            "parameters": {
                "type": "object",
                "properties": {
                    "setups": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Specific setup names to filter on. Empty means all setups."
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "filter_by_rule",
            "description": "Analyze the impact of rule discipline — compare trades where the trader followed their rules vs broke them. Also use for questions about discipline, mistakes, or rule adherence.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "filter_by_tilt",
            "description": "Analyze trade performance grouped by mental/emotional state (tilt_state). Use for questions about psychology, emotional trading, or how mindset affects performance.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "compare_periods",
            "description": "Compare performance between two date ranges (e.g. this month vs last month, recent vs older trades).",
            "parameters": {
                "type": "object",
                "properties": {
                    "period_a_days": {
                        "type": "integer",
                        "description": "Number of days in the more recent period (e.g. 30 for last 30 days)"
                    },
                    "period_b_days": {
                        "type": "integer",
                        "description": "Number of days in the comparison period (e.g. 60 for the 30 days before that)"
                    }
                },
                "required": ["period_a_days", "period_b_days"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_overview",
            "description": "Get a general overview of trading performance including key metrics, overall stats, win rate, P&L. Use as default for general questions.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
]

INTENT_SYSTEM_PROMPT = (
    "You are a query intent classifier for a personal trading journal. "
    "Given a trader's natural language question, call the single most relevant function with the correct parameters. "
    "Always call exactly one function."
)


# ── Query handler helpers ────────────────────────────────────────────────────

def _agg_rows(trades: List[Any]) -> Dict[str, Any]:
    """Return aggregated stats dict for a list of trades."""
    if not trades:
        return {"count": 0, "wins": 0, "losses": 0, "totalPnl": 0.0, "avgPnl": 0.0, "winRate": 0.0, "avgWin": 0.0, "avgLoss": 0.0}
    wins = [t for t in trades if (t.pnl or 0) > 0]
    losses = [t for t in trades if (t.pnl or 0) <= 0]
    total = sum(t.pnl or 0 for t in trades)
    avg_win = sum(t.pnl or 0 for t in wins) / len(wins) if wins else 0.0
    avg_loss = abs(sum(t.pnl or 0 for t in losses) / len(losses)) if losses else 0.0
    return {
        "count": len(trades),
        "wins": len(wins),
        "losses": len(losses),
        "totalPnl": round(total, 2),
        "avgPnl": round(total / len(trades), 2),
        "winRate": round(len(wins) / len(trades) * 100, 1),
        "avgWin": round(avg_win, 2),
        "avgLoss": round(avg_loss, 2),
    }


def _format_row(label: str, stats: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "label": label,
        "trades": stats["count"],
        "winRate": f"{stats['winRate']:.1f}%",
        "totalPnl": f"${stats['totalPnl']:,.2f}",
        "avgPnl": f"${stats['avgPnl']:,.2f}",
    }


def _group_trades(trades: List[Any], key_fn) -> Dict[str, List[Any]]:
    groups: Dict[str, List[Any]] = {}
    for t in trades:
        k = key_fn(t) or "Unknown"
        groups.setdefault(k, []).append(t)
    return groups


def _closed(db: Session, account_id: Optional[int]) -> List[Any]:
    q = db.query(Trade).filter(Trade.pnl.isnot(None))
    if account_id:
        q = q.filter(Trade.account_id == account_id)
    return q.all()


# ── Query handlers ────────────────────────────────────────────────────────────

def handler_filter_by_day(db: Session, params: Dict, account_id: Optional[int]) -> Dict:
    trades = _closed(db, account_id)
    filter_days = {d.lower() for d in params.get("days", [])}

    def day_key(t):
        try:
            return datetime.fromisoformat(str(t.entry_date)).strftime("%A")
        except Exception:
            return "Unknown"

    groups = _group_trades(trades, day_key)
    if filter_days:
        groups = {k: v for k, v in groups.items() if k.lower() in filter_days}

    day_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    rows = [_format_row(d, _agg_rows(groups[d])) for d in day_order if d in groups]
    worst = min(groups.items(), key=lambda kv: _agg_rows(kv[1])["totalPnl"], default=(None, []))
    best = max(groups.items(), key=lambda kv: _agg_rows(kv[1])["totalPnl"], default=(None, []))
    return {
        "queryType": "by_day",
        "tableTitle": "Performance by Day of Week",
        "rows": rows,
        "summary": {
            "bestDay": best[0],
            "bestDayPnl": _agg_rows(best[1])["totalPnl"] if best[1] else 0,
            "worstDay": worst[0],
            "worstDayPnl": _agg_rows(worst[1])["totalPnl"] if worst[1] else 0,
            "totalTrades": len(trades),
        },
    }


def handler_filter_by_symbol(db: Session, params: Dict, account_id: Optional[int]) -> Dict:
    trades = _closed(db, account_id)
    filter_syms = {s.upper() for s in params.get("symbols", [])}
    groups = _group_trades(trades, lambda t: (t.symbol or "").upper())
    if filter_syms:
        groups = {k: v for k, v in groups.items() if k in filter_syms}

    sorted_groups = sorted(groups.items(), key=lambda kv: _agg_rows(kv[1])["totalPnl"], reverse=True)
    rows = [_format_row(k, _agg_rows(v)) for k, v in sorted_groups[:8]]
    return {
        "queryType": "by_symbol",
        "tableTitle": "Performance by Symbol",
        "rows": rows,
        "summary": {
            "topSymbol": sorted_groups[0][0] if sorted_groups else None,
            "topSymbolPnl": _agg_rows(sorted_groups[0][1])["totalPnl"] if sorted_groups else 0,
            "bottomSymbol": sorted_groups[-1][0] if sorted_groups else None,
            "bottomSymbolPnl": _agg_rows(sorted_groups[-1][1])["totalPnl"] if sorted_groups else 0,
            "totalSymbols": len(groups),
        },
    }


def handler_filter_by_session(db: Session, params: Dict, account_id: Optional[int]) -> Dict:
    trades = _closed(db, account_id)
    filter_sess = {s.lower() for s in params.get("sessions", [])}
    groups = _group_trades(trades, lambda t: t.session)
    if filter_sess:
        groups = {k: v for k, v in groups.items() if k.lower() in filter_sess}

    sorted_groups = sorted(groups.items(), key=lambda kv: _agg_rows(kv[1])["totalPnl"], reverse=True)
    rows = [_format_row(k, _agg_rows(v)) for k, v in sorted_groups]
    return {
        "queryType": "by_session",
        "tableTitle": "Performance by Session",
        "rows": rows,
        "summary": {
            "bestSession": sorted_groups[0][0] if sorted_groups else None,
            "bestSessionPnl": _agg_rows(sorted_groups[0][1])["totalPnl"] if sorted_groups else 0,
            "worstSession": sorted_groups[-1][0] if sorted_groups else None,
            "worstSessionPnl": _agg_rows(sorted_groups[-1][1])["totalPnl"] if sorted_groups else 0,
        },
    }


def handler_filter_by_setup(db: Session, params: Dict, account_id: Optional[int]) -> Dict:
    trades = _closed(db, account_id)
    filter_setups = {s.lower() for s in params.get("setups", [])}
    groups = _group_trades(trades, lambda t: t.setup or "Untagged")
    if filter_setups:
        groups = {k: v for k, v in groups.items() if k.lower() in filter_setups}

    sorted_groups = sorted(groups.items(), key=lambda kv: _agg_rows(kv[1])["totalPnl"], reverse=True)
    rows = [_format_row(k, _agg_rows(v)) for k, v in sorted_groups[:8]]
    return {
        "queryType": "by_setup",
        "tableTitle": "Performance by Setup",
        "rows": rows,
        "summary": {
            "bestSetup": sorted_groups[0][0] if sorted_groups else None,
            "bestSetupPnl": _agg_rows(sorted_groups[0][1])["totalPnl"] if sorted_groups else 0,
        },
    }


def handler_filter_by_rule(db: Session, params: Dict, account_id: Optional[int]) -> Dict:
    all_trades_q = db.query(Trade)
    if account_id:
        all_trades_q = all_trades_q.filter(Trade.account_id == account_id)
    all_trades = all_trades_q.all()
    closed = [t for t in all_trades if t.pnl is not None]

    journal_ids = [t.id for t in all_trades if t.has_journal]
    journals = db.query(Journal).filter(Journal.trade_id.in_(journal_ids)).all() if journal_ids else []
    j_map = {j.trade_id: j for j in journals}

    followed = [t for t in closed if j_map.get(t.id) and j_map[t.id].rule_followed is True]
    broken = [t for t in closed if j_map.get(t.id) and j_map[t.id].rule_followed is False]
    no_journal = [t for t in closed if t.id not in j_map]

    rows = [
        _format_row("Rules Followed", _agg_rows(followed)),
        _format_row("Rules Broken", _agg_rows(broken)),
    ]
    if no_journal:
        rows.append(_format_row("No Journal Entry", _agg_rows(no_journal)))

    f_stats = _agg_rows(followed)
    b_stats = _agg_rows(broken)
    return {
        "queryType": "by_rule",
        "tableTitle": "Rule Discipline Impact",
        "rows": rows,
        "summary": {
            "followedCount": len(followed),
            "brokenCount": len(broken),
            "followedWinRate": f_stats["winRate"],
            "brokenWinRate": b_stats["winRate"],
            "followedPnl": f_stats["totalPnl"],
            "brokenPnl": b_stats["totalPnl"],
            "pnlCostOfBreaking": round(b_stats["totalPnl"] - f_stats["avgPnl"] * len(broken), 2) if followed else 0,
        },
    }


def handler_filter_by_tilt(db: Session, params: Dict, account_id: Optional[int]) -> Dict:
    all_trades_q = db.query(Trade)
    if account_id:
        all_trades_q = all_trades_q.filter(Trade.account_id == account_id)
    all_trades = all_trades_q.all()
    closed = [t for t in all_trades if t.pnl is not None]

    journal_ids = [t.id for t in all_trades if t.has_journal]
    journals = db.query(Journal).filter(Journal.trade_id.in_(journal_ids)).all() if journal_ids else []
    j_map = {j.trade_id: j for j in journals}

    tilt_groups: Dict[str, list] = {}
    for t in closed:
        j = j_map.get(t.id)
        state = (j.tilt_state if j else None) or "Unknown"
        tilt_groups.setdefault(state, []).append(t)

    sorted_groups = sorted(tilt_groups.items(), key=lambda kv: _agg_rows(kv[1])["totalPnl"], reverse=True)
    rows = [_format_row(k, _agg_rows(v)) for k, v in sorted_groups]
    return {
        "queryType": "by_tilt",
        "tableTitle": "Performance by Mental State",
        "rows": rows,
        "summary": {
            "bestState": sorted_groups[0][0] if sorted_groups else None,
            "worstState": sorted_groups[-1][0] if sorted_groups else None,
        },
    }


def handler_compare_periods(db: Session, params: Dict, account_id: Optional[int]) -> Dict:
    period_a_days = int(params.get("period_a_days", 30))
    period_b_days = int(params.get("period_b_days", 60))

    now = datetime.utcnow()
    cutoff_a = now - timedelta(days=period_a_days)
    cutoff_b = now - timedelta(days=period_b_days)

    q = db.query(Trade).filter(Trade.pnl.isnot(None))
    if account_id:
        q = q.filter(Trade.account_id == account_id)
    all_closed = q.all()

    def _parse_date(t):
        try:
            return datetime.fromisoformat(str(t.entry_date))
        except Exception:
            return None

    period_a = [t for t in all_closed if (d := _parse_date(t)) and d >= cutoff_a]
    period_b = [t for t in all_closed if (d := _parse_date(t)) and cutoff_b <= d < cutoff_a]

    a_stats = _agg_rows(period_a)
    b_stats = _agg_rows(period_b)
    rows = [
        _format_row(f"Last {period_a_days} days", a_stats),
        _format_row(f"Prior {period_b_days - period_a_days} days", b_stats),
    ]
    return {
        "queryType": "compare_periods",
        "tableTitle": f"Last {period_a_days} Days vs Prior Period",
        "rows": rows,
        "summary": {
            "periodA": {"label": f"Last {period_a_days} days", **a_stats},
            "periodB": {"label": f"Prior {period_b_days - period_a_days} days", **b_stats},
            "pnlChange": round(a_stats["totalPnl"] - b_stats["totalPnl"], 2),
            "winRateChange": round(a_stats["winRate"] - b_stats["winRate"], 1),
        },
    }


def handler_get_overview(db: Session, params: Dict, account_id: Optional[int]) -> Dict:
    trades = _closed(db, account_id)
    stats = _agg_rows(trades)

    r_multiples = [t.r_multiple for t in trades if t.r_multiple is not None]
    avg_r = round(sum(r_multiples) / len(r_multiples), 2) if r_multiples else None

    # Recent 7 days
    now = datetime.utcnow()
    recent = [t for t in trades if (d := _try_parse(t.entry_date)) and d >= now - timedelta(days=7)]
    recent_stats = _agg_rows(recent)

    rows = [_format_row("All Time", stats)]
    if recent:
        rows.append(_format_row("Last 7 Days", recent_stats))

    return {
        "queryType": "overview",
        "tableTitle": "Portfolio Overview",
        "rows": rows,
        "summary": {**stats, "avgRMultiple": avg_r, "last7DaysPnl": recent_stats["totalPnl"], "last7DaysTrades": recent_stats["count"]},
    }


def _try_parse(val) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(str(val))
    except Exception:
        return None


HANDLER_MAP = {
    "filter_by_day": handler_filter_by_day,
    "filter_by_symbol": handler_filter_by_symbol,
    "filter_by_session": handler_filter_by_session,
    "filter_by_setup": handler_filter_by_setup,
    "filter_by_rule": handler_filter_by_rule,
    "filter_by_tilt": handler_filter_by_tilt,
    "compare_periods": handler_compare_periods,
    "get_overview": handler_get_overview,
}

ANSWER_SYSTEM_PROMPT = (
    "You are a precise trading performance analyst. "
    "You receive authoritative, DB-computed statistics and must craft a concise 2-4 sentence plain-English answer "
    "to the trader's question using ONLY the numbers provided — do not invent or extrapolate figures. "
    "Format dollar amounts as $X.XX and percentages as X.X%. "
    "If data is limited, acknowledge it honestly. "
    "Respond with ONLY valid JSON (no markdown fences): "
    '{"answer": "..."}'
)


# ── API endpoints ─────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str
    accountId: Optional[int] = None


@router.get("/query/suggested")
def get_suggested_questions():
    return {"questions": SUGGESTED_QUESTIONS}


@router.post("/query/natural")
def natural_language_query(body: QueryRequest, db: Session = Depends(get_db)):
    if not body.question or len(body.question.strip()) < 3:
        raise HTTPException(status_code=400, detail="Question too short")

    # Check there is data to query
    q = db.query(Trade).filter(Trade.pnl.isnot(None))
    if body.accountId:
        q = q.filter(Trade.account_id == body.accountId)
    if q.count() == 0:
        return {
            "answer": "You don't have any closed trades yet. Import some trades to start asking questions about your journal.",
            "tableTitle": None,
            "tableRows": [],
            "queryType": "overview",
        }

    client = get_openai_client()

    # ── Step 1: Classify intent via function calling ──────────────────────────
    try:
        intent_response = client.chat.completions.create(
            model="gpt-5.1",
            max_completion_tokens=200,
            tools=QUERY_TOOLS,
            tool_choice="required",
            messages=[
                {"role": "system", "content": INTENT_SYSTEM_PROMPT},
                {"role": "user", "content": body.question},
            ],
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Intent classification failed: {str(e)}")

    tool_calls = intent_response.choices[0].message.tool_calls
    if not tool_calls:
        intent_name = "get_overview"
        intent_params: Dict = {}
    else:
        tc = tool_calls[0]
        intent_name = tc.function.name
        try:
            intent_params = json.loads(tc.function.arguments or "{}")
        except json.JSONDecodeError:
            intent_params = {}

    # ── Step 2: Execute the matching handler (authoritative DB computation) ───
    handler = HANDLER_MAP.get(intent_name, handler_get_overview)
    try:
        handler_result = handler(db, intent_params, body.accountId)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query handler failed: {str(e)}")

    # ── Step 3: Generate narrative from authoritative data ────────────────────
    try:
        answer_response = client.chat.completions.create(
            model="gpt-5.1",
            max_completion_tokens=300,
            messages=[
                {"role": "system", "content": ANSWER_SYSTEM_PROMPT},
                {"role": "user", "content": f"Question: {body.question}\n\nAuthoritative data:\n{json.dumps(handler_result, indent=2)}"},
            ],
        )
        raw = (answer_response.choices[0].message.content or "{}").strip()
        if raw.startswith("```"):
            lines = raw.splitlines()
            raw = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
        answer_text = json.loads(raw).get("answer", "No answer generated.")
    except Exception:
        # Fall back: build a mechanical answer from handler data so we never return empty
        summary = handler_result.get("summary", {})
        answer_text = f"Based on your trade data: {json.dumps(summary)}"

    return {
        "answer": answer_text,
        "tableTitle": handler_result.get("tableTitle"),
        "tableRows": handler_result.get("rows", []),
        "queryType": handler_result.get("queryType", "other"),
    }
