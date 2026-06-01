from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
from models import get_db, Trade, ImportBatch
from ingestion.parsers import parse_csv
from ingestion.pipeline import store_preview, get_preview, clear_preview, dedupe_rows

router = APIRouter(prefix="/import")


class ImportConfirm(BaseModel):
    sessionId: str
    accountId: Optional[int] = None


@router.post("/preview")
async def preview_import(
    file: UploadFile = File(...),
    accountId: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
    content = await file.read()
    filename = file.filename or "upload.csv"

    broker, rows, errors = parse_csv(content, filename)

    # Build existing keys for dedupe check
    existing = db.query(
        Trade.symbol, Trade.entry_date, Trade.exit_date, Trade.quantity
    ).all()
    existing_keys = set(
        (str(r[0]), str(r[1]), str(r[2]), str(r[3])) for r in existing
    )

    new_rows, dupe_rows = dedupe_rows(rows, existing_keys)
    session_id = store_preview(broker, new_rows, errors, filename, accountId)

    # Build preview list (first 50)
    preview = []
    for r in new_rows[:50]:
        preview.append({
            "symbol": r.get("symbol"),
            "direction": r.get("direction"),
            "entryDate": r.get("entry_date"),
            "exitDate": r.get("exit_date"),
            "entryPrice": r.get("entry_price"),
            "exitPrice": r.get("exit_price"),
            "quantity": r.get("quantity"),
            "pnl": r.get("pnl"),
            "fees": r.get("fees"),
            "stopLoss": r.get("stop_loss"),
            "takeProfit": r.get("take_profit"),
            "rMultiple": r.get("r_multiple"),
            "setup": r.get("setup"),
            "tags": r.get("tags"),
        })

    return {
        "sessionId": session_id,
        "brokerFormat": broker,
        "rowCount": len(new_rows),
        "duplicateCount": len(dupe_rows),
        "errorCount": len(errors),
        "errors": errors[:10],
        "preview": preview,
    }


@router.post("/confirm")
def confirm_import(body: ImportConfirm, db: Session = Depends(get_db)):
    session = get_preview(body.sessionId)
    if not session:
        raise HTTPException(status_code=404, detail="Preview session not found or expired")

    rows = session["rows"]
    account_id = body.accountId or session.get("account_id")
    filename = session["filename"]
    broker = session["broker"]

    batch = ImportBatch(
        filename=filename,
        broker_format=broker,
        account_id=account_id,
        row_count=len(rows),
        error_count=len(session["errors"]),
    )
    db.add(batch)
    db.flush()

    inserted = 0
    errors = []
    for row in rows:
        try:
            trade = Trade(
                import_batch_id=batch.id,
                account_id=account_id,
                import_source=broker,
                symbol=str(row.get("symbol") or "UNKNOWN").upper(),
                direction=row.get("direction") or "long",
                entry_date=str(row.get("entry_date") or ""),
                exit_date=row.get("exit_date"),
                entry_price=float(row.get("entry_price") or 0),
                exit_price=row.get("exit_price"),
                quantity=float(row.get("quantity") or 1),
                pnl=row.get("pnl"),
                fees=row.get("fees"),
                stop_loss=row.get("stop_loss"),
                take_profit=row.get("take_profit"),
                r_multiple=row.get("r_multiple"),
                setup=row.get("setup"),
                tags=row.get("tags"),
                notes=row.get("notes"),
                session=row.get("session"),
                asset_class=row.get("asset_class") or "equity",
                tilt_state=row.get("tilt_state"),
                economic_event_nearby=row.get("economic_event_nearby"),
            )
            db.add(trade)
            inserted += 1
        except Exception as e:
            errors.append(str(e))

    batch.row_count = inserted
    batch.error_count = len(errors)
    db.commit()
    clear_preview(body.sessionId)

    return {
        "batchId": batch.id,
        "inserted": inserted,
        "errors": errors[:10],
    }


@router.get("/batches")
def list_batches(db: Session = Depends(get_db)):
    batches = db.query(ImportBatch).order_by(ImportBatch.imported_at.desc()).all()
    return [
        {
            "id": b.id,
            "filename": b.filename,
            "brokerFormat": b.broker_format,
            "accountId": b.account_id,
            "rowCount": b.row_count,
            "errorCount": b.error_count,
            "importedAt": b.imported_at.isoformat() if b.imported_at else None,
        }
        for b in batches
    ]
