import os
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
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


def get_openai_client() -> OpenAI:
    base_url = os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")
    api_key = os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY", "dummy")
    if not base_url:
        raise HTTPException(status_code=500, detail="OpenAI integration not configured")
    return OpenAI(base_url=base_url, api_key=api_key)


def build_analytics_context(db: Session, account_id: Optional[int] = None) -> Dict[str, Any]:
    q = db.query(Trade)
    if account_id:
        q = q.filter(Trade.account_id == account_id)
    trades = q.all()

    closed = [t for t in trades if t.pnl is not None]
    if not trades:
        return {"totalTrades": 0}

    wins = [t for t in closed if (t.pnl or 0) > 0]
    losses = [t for t in closed if (t.pnl or 0) <= 0]
    total_pnl = sum(t.pnl or 0 for t in closed)
    win_rate = len(wins) / len(closed) if closed else 0
    avg_win = sum(t.pnl or 0 for t in wins) / len(wins) if wins else 0
    avg_loss = abs(sum(t.pnl or 0 for t in losses) / len(losses)) if losses else 0

    def _agg(items):
        if not items:
            return {"trades": 0, "wins": 0, "pnl": 0, "winRate": 0}
        w = [t for t in items if (t.pnl or 0) > 0]
        p = sum(t.pnl or 0 for t in items)
        return {
            "trades": len(items),
            "wins": len(w),
            "pnl": round(p, 2),
            "winRate": round(len(w) / len(items) * 100, 1),
            "avgPnl": round(p / len(items), 2),
        }

    by_day: Dict[str, list] = {}
    by_symbol: Dict[str, list] = {}
    by_session: Dict[str, list] = {}
    by_setup: Dict[str, list] = {}
    by_hour: Dict[str, list] = {}

    for t in closed:
        try:
            d = datetime.fromisoformat(str(t.entry_date))
            day_name = d.strftime("%A")
            hour_key = f"{d.hour:02d}:00"
        except Exception:
            day_name = "Unknown"
            hour_key = "Unknown"

        by_day.setdefault(day_name, []).append(t)
        by_symbol.setdefault(t.symbol, []).append(t)
        by_session.setdefault(t.session or "Unknown", []).append(t)
        by_setup.setdefault(t.setup or "Untagged", []).append(t)
        by_hour.setdefault(hour_key, []).append(t)

    journal_ids = [t.id for t in trades if t.has_journal]
    journals = db.query(Journal).filter(Journal.trade_id.in_(journal_ids)).all() if journal_ids else []
    j_map = {j.trade_id: j for j in journals}

    followed = [t for t in closed if j_map.get(t.id) and j_map[t.id].rule_followed is True]
    broken = [t for t in closed if j_map.get(t.id) and j_map[t.id].rule_followed is False]
    unfollowed_pnl = sum(t.pnl or 0 for t in broken)
    followed_pnl = sum(t.pnl or 0 for t in followed)

    recent = sorted(closed, key=lambda t: str(t.entry_date), reverse=True)[:30]
    sample = [
        {
            "date": str(t.entry_date)[:10],
            "symbol": t.symbol,
            "direction": t.direction,
            "pnl": round(t.pnl or 0, 2),
            "setup": t.setup,
            "session": t.session,
            "rMultiple": t.r_multiple,
            "ruleFollowed": j_map[t.id].rule_followed if t.id in j_map else None,
        }
        for t in recent
    ]

    return {
        "totalTrades": len(trades),
        "closedTrades": len(closed),
        "totalPnl": round(total_pnl, 2),
        "winRate": round(win_rate * 100, 1),
        "avgWin": round(avg_win, 2),
        "avgLoss": round(avg_loss, 2),
        "byDay": {k: _agg(v) for k, v in by_day.items()},
        "bySymbol": {k: _agg(v) for k, v in by_symbol.items()},
        "bySession": {k: _agg(v) for k, v in by_session.items()},
        "bySetup": {k: _agg(v) for k, v in by_setup.items()},
        "byHour": {k: _agg(v) for k, v in by_hour.items()},
        "ruleDiscipline": {
            "followedCount": len(followed),
            "brokenCount": len(broken),
            "followedWinRate": round(len([t for t in followed if (t.pnl or 0) > 0]) / len(followed) * 100, 1) if followed else None,
            "brokenWinRate": round(len([t for t in broken if (t.pnl or 0) > 0]) / len(broken) * 100, 1) if broken else None,
            "followedPnl": round(followed_pnl, 2),
            "brokenPnl": round(unfollowed_pnl, 2),
        },
        "recentTrades": sample,
    }


NLQ_SYSTEM_PROMPT = """You are a precise trading performance analyst. You receive aggregated statistics from a trader's journal and answer their natural language questions with specific, data-driven insights.

Rules:
- Cite specific numbers from the data (dollar amounts as $X.XX, percentages as X.X%)
- 2-4 sentences max for the answer
- If data is insufficient, say so honestly with what IS available
- tableRows should reflect the most relevant slice (by day, symbol, session, etc.)
- Limit tableRows to the 8 most relevant entries, sorted by relevance

Respond ONLY with valid JSON (no markdown fences):
{
  "answer": "2-4 sentence plain-English answer with specific numbers",
  "tableTitle": "Short title for supporting data table",
  "tableRows": [
    {"label": "...", "trades": N, "winRate": "X.X%", "totalPnl": "$X.XX", "avgPnl": "$X.XX"}
  ],
  "queryType": "by_day | by_symbol | by_session | by_setup | by_rule | overview | other"
}"""


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

    context = build_analytics_context(db, body.accountId)

    if context.get("totalTrades", 0) == 0:
        return {
            "answer": "You don't have any trades yet. Import some trades to start asking questions about your journal.",
            "tableTitle": None,
            "tableRows": [],
            "queryType": "overview",
        }

    prompt = f"Trader's question: {body.question}\n\nAnalytics data:\n{json.dumps(context, indent=2)}"

    try:
        client = get_openai_client()
        response = client.chat.completions.create(
            model="gpt-5.1",
            max_completion_tokens=800,
            messages=[
                {"role": "system", "content": NLQ_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        )
        raw = (response.choices[0].message.content or "{}").strip()
        if raw.startswith("```"):
            lines = raw.splitlines()
            raw = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])

        result = json.loads(raw)
        return {
            "answer": result.get("answer", "Unable to generate answer."),
            "tableTitle": result.get("tableTitle"),
            "tableRows": result.get("tableRows", []),
            "queryType": result.get("queryType", "other"),
        }
    except json.JSONDecodeError:
        return {
            "answer": "Could not parse the AI response. Please try rephrasing your question.",
            "tableTitle": None,
            "tableRows": [],
            "queryType": "other",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")
