import os
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from openai import OpenAI
from models import get_db, Trade, Journal, CoachingNote, CoachingTheme, SessionLocal

router = APIRouter()

def get_openai_client() -> OpenAI:
    base_url = os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")
    api_key = os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY", "dummy")
    if not base_url:
        raise HTTPException(status_code=500, detail="OpenAI integration not configured")
    return OpenAI(base_url=base_url, api_key=api_key)


def build_coaching_prompt(trade: Trade, journal: Optional[Journal]) -> str:
    direction = (trade.direction or "unknown").upper()
    symbol = trade.symbol or "?"
    pnl = f"${trade.pnl:.2f}" if trade.pnl is not None else "unknown"
    r_multiple = f"{trade.r_multiple:.2f}R" if trade.r_multiple is not None else "unknown"
    entry = f"${trade.entry_price}"
    exit_p = f"${trade.exit_price}" if trade.exit_price is not None else "open"
    stop = f"${trade.stop_loss}" if trade.stop_loss is not None else "none"
    target = f"${trade.take_profit}" if trade.take_profit is not None else "none"
    setup = trade.setup or "not tagged"

    if journal:
        journal_section = f"""
Journal:
- Why entry: {journal.why_entry or 'not filled'}
- Why exit: {journal.why_exit or 'not filled'}
- Mistakes: {journal.mistakes or 'none noted'}
- Market observation: {journal.market_observation or 'none'}
- Confidence rating: {journal.confidence_rating or '?'}/10
- Rules followed: {'YES' if journal.rule_followed is True else 'NO' if journal.rule_followed is False else 'not recorded'}
- Mental/tilt state: {journal.tilt_state or 'not recorded'}"""
    else:
        journal_section = "No journal entry."

    return f"""You are a direct, data-driven trading coach reviewing a completed trade. Be specific and actionable — no generic advice.

Trade: {direction} {symbol}
P&L: {pnl} | R-multiple: {r_multiple}
Entry: {entry} | Exit: {exit_p}
Stop: {stop} | Target: {target}
Setup/Strategy: {setup}
{journal_section}

Give exactly 3-5 sentences of coaching feedback. Structure: 1) Name the specific behavioral pattern you see. 2) What they did well OR what went wrong, grounded in the numbers. 3) One concrete action for their next trade of this type. Be direct, not preachy."""


def build_themes_prompt(notes: list) -> str:
    sample = "\n\n---\n\n".join(notes[:20])
    return f"""You are a trading performance analyst. Below are recent coaching notes for a trader. Identify exactly 3 recurring behavioral patterns or themes across these notes. Be specific and data-driven.

{sample}

Format your response as a JSON array of exactly 3 objects: [{{"theme": "short title", "description": "2 sentences", "frequency": "how often it appears", "action": "one specific improvement"}}]

Respond ONLY with the JSON array, no other text."""


class RegenerateBody(BaseModel):
    regenerate: Optional[bool] = False


@router.get("/coach/trade/{trade_id}")
def get_trade_coaching(trade_id: int, db: Session = Depends(get_db)):
    note = db.query(CoachingNote).filter(CoachingNote.trade_id == trade_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="No coaching note found")
    generated_at = note.created_at.isoformat() if note.created_at else None
    return {"coaching": note.content, "cached": True, "generatedAt": generated_at}


@router.post("/coach/trade/{trade_id}")
def generate_trade_coaching(trade_id: int, body: RegenerateBody = RegenerateBody(), db: Session = Depends(get_db)):
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")

    if not trade.has_journal:
        raise HTTPException(status_code=422, detail="Add a journal entry before requesting coaching")

    existing = db.query(CoachingNote).filter(CoachingNote.trade_id == trade_id).first()
    if existing and not body.regenerate:
        generated_at = existing.created_at.isoformat() if existing.created_at else None
        return {"coaching": existing.content, "cached": True, "generatedAt": generated_at}

    journal = db.query(Journal).filter(Journal.trade_id == trade_id).first()

    try:
        client = get_openai_client()
        prompt = build_coaching_prompt(trade, journal)
        response = client.chat.completions.create(
            model="gpt-5.1",
            max_completion_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        content = response.choices[0].message.content or "Unable to generate coaching at this time."

        if existing:
            existing.content = content
        else:
            note = CoachingNote(trade_id=trade_id, content=content)
            db.add(note)
        db.commit()
        db.refresh(existing if existing else note)

        saved = existing if existing else note
        generated_at = saved.created_at.isoformat() if saved.created_at else None
        return {"coaching": content, "cached": False, "generatedAt": generated_at}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate coaching: {str(e)}")


@router.post("/coach/trade/{trade_id}/stream")
def stream_trade_coaching(trade_id: int, body: RegenerateBody = RegenerateBody(), db: Session = Depends(get_db)):
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    if not trade.has_journal:
        raise HTTPException(status_code=422, detail="Add a journal entry before requesting coaching")

    existing = db.query(CoachingNote).filter(CoachingNote.trade_id == trade_id).first()
    if existing and not body.regenerate:
        generated_at = existing.created_at.isoformat() if existing.created_at else None
        def cached_gen():
            yield f"data: {json.dumps({'text': existing.content, 'cached': True, 'done': True, 'generatedAt': generated_at})}\n\n"
        return StreamingResponse(cached_gen(), media_type="text/event-stream",
                                  headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    journal = db.query(Journal).filter(Journal.trade_id == trade_id).first()
    prompt = build_coaching_prompt(trade, journal)
    existing_id = existing.id if existing else None

    def generate():
        full_content = ""
        db_inner = SessionLocal()
        try:
            client = get_openai_client()
            stream = client.chat.completions.create(
                model="gpt-5.1",
                max_completion_tokens=400,
                messages=[{"role": "user", "content": prompt}],
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content if chunk.choices[0].delta else None
                if delta:
                    full_content += delta
                    yield f"data: {json.dumps({'text': delta, 'cached': False, 'done': False})}\n\n"

            note_row = db_inner.query(CoachingNote).filter(CoachingNote.id == existing_id).first() if existing_id else None
            if note_row:
                note_row.content = full_content
            else:
                note_row = CoachingNote(trade_id=trade_id, content=full_content)
                db_inner.add(note_row)
            db_inner.commit()
            db_inner.refresh(note_row)
            generated_at = note_row.created_at.isoformat() if note_row.created_at else None
            yield f"data: {json.dumps({'text': '', 'cached': False, 'done': True, 'generatedAt': generated_at})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"
        finally:
            db_inner.close()

    return StreamingResponse(generate(), media_type="text/event-stream",
                              headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/coach/themes")
def get_themes(db: Session = Depends(get_db)):
    notes = db.query(CoachingNote).order_by(CoachingNote.created_at.desc()).limit(20).all()
    if len(notes) < 3:
        return {"themes": [], "message": "Get coaching on at least 3 trades to see behavioral themes."}

    cached = db.query(CoachingTheme).order_by(CoachingTheme.generated_at.desc()).first()
    if not cached:
        return {"themes": [], "message": "No themes generated yet. Click 'Analyze Themes'."}

    try:
        return {"themes": json.loads(cached.themes), "cached": True}
    except Exception:
        return {"themes": [], "message": "Error loading themes."}


@router.post("/coach/themes")
def generate_themes(body: RegenerateBody = RegenerateBody(), db: Session = Depends(get_db)):
    notes = db.query(CoachingNote).order_by(CoachingNote.created_at.desc()).limit(20).all()
    if len(notes) < 3:
        return {"themes": [], "message": "Get coaching on at least 3 trades to see behavioral themes."}

    cached = db.query(CoachingTheme).order_by(CoachingTheme.generated_at.desc()).first()
    if cached and cached.trade_count == len(notes) and not body.regenerate:
        try:
            return {"themes": json.loads(cached.themes), "cached": True}
        except Exception:
            pass

    try:
        client = get_openai_client()
        note_texts = [n.content for n in notes]
        prompt = build_themes_prompt(note_texts)
        response = client.chat.completions.create(
            model="gpt-5.1",
            max_completion_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.choices[0].message.content or "[]"
        try:
            themes = json.loads(raw)
        except Exception:
            themes = []

        serialized = json.dumps(themes)
        if cached:
            cached.themes = serialized
            cached.trade_count = len(notes)
        else:
            new_theme = CoachingTheme(themes=serialized, trade_count=len(notes))
            db.add(new_theme)
        db.commit()

        return {"themes": themes, "cached": False}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate themes: {str(e)}")
