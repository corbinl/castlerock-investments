import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { v4 as uuidv4 } from "uuid";
import { db } from "@workspace/db";
import { tradesTable, importBatchesTable } from "@workspace/db";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// In-memory session store for preview sessions (simple, single-user)
const previewSessions = new Map<string, { rows: ParsedRow[]; format: string; filename: string }>();

interface ParsedRow {
  rowIndex: number;
  symbol: string;
  direction: string;
  entryDate: string;
  exitDate: string | null;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  pnl: number | null;
  isDuplicate: boolean;
  raw: Record<string, string>;
  assetClass?: string;
  fees?: number;
  rMultiple?: number;
  stopLoss?: number;
  takeProfit?: number;
}

function detectFormat(headers: string[]): string {
  const hs = headers.map((h) => h.toLowerCase());
  if (hs.includes("ticket") || hs.includes("magic")) return "mt4";
  if (hs.includes("deal") || hs.includes("commission")) return "mt5";
  if (hs.includes("ibkr") || hs.includes("ib_commission")) return "ibkr";
  return "generic";
}

function mapRow(raw: Record<string, string>, format: string, rowIndex: number): ParsedRow | null {
  const get = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const val = raw[k] ?? raw[k.toLowerCase()] ?? raw[k.toUpperCase()];
      if (val && val.trim()) return val.trim();
    }
    return undefined;
  };

  const symbol = get("Symbol", "symbol", "Instrument", "instrument") ?? get("Ticker", "ticker", "pair") ?? "UNKNOWN";
  const dirRaw = get("Type", "type", "Direction", "direction", "Side", "side") ?? "long";
  const direction = dirRaw.toLowerCase().includes("sell") || dirRaw.toLowerCase().includes("short") ? "short" : "long";
  const entryDate = get("Open Time", "OpenTime", "Entry Date", "EntryDate", "Date", "date", "Open") ?? new Date().toISOString().slice(0, 10);
  const exitDate = get("Close Time", "CloseTime", "Exit Date", "ExitDate", "Close") ?? null;
  const entryPrice = parseFloat(get("Open Price", "OpenPrice", "Entry Price", "EntryPrice", "Entry", "Buy Price") ?? "0");
  const exitPrice = parseFloat(get("Close Price", "ClosePrice", "Exit Price", "ExitPrice", "Close Price") ?? "");
  const quantity = parseFloat(get("Volume", "volume", "Quantity", "quantity", "Lots", "Size", "Shares") ?? "1");
  const pnlRaw = get("Profit", "profit", "P&L", "pnl", "PnL", "Net PnL", "Realized P&L");
  const pnl = pnlRaw ? parseFloat(pnlRaw) : null;
  const feesRaw = get("Commission", "commission", "Fees", "fees", "Swap");
  const fees = feesRaw ? parseFloat(feesRaw) : undefined;
  const assetClass = get("Asset Class", "AssetClass") ?? "equity";

  if (isNaN(entryPrice) || isNaN(quantity)) return null;

  return {
    rowIndex,
    symbol,
    direction,
    entryDate: entryDate.slice(0, 10),
    exitDate: exitDate ? exitDate.slice(0, 10) : null,
    entryPrice,
    exitPrice: !isNaN(exitPrice) ? exitPrice : null,
    quantity,
    pnl: pnl,
    isDuplicate: false,
    raw,
    assetClass,
    fees,
  };
}

router.post("/import/preview", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  let records: Record<string, string>[];
  try {
    records = parse(req.file.buffer.toString("utf-8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
    }) as Record<string, string>[];
  } catch (e: unknown) {
    return res.status(400).json({ error: "CSV parse error", detail: String(e) });
  }

  if (records.length === 0) return res.status(400).json({ error: "Empty CSV" });

  const headers = Object.keys(records[0]!);
  const format = (req.body.brokerFormat as string) || detectFormat(headers);

  const parsedRows: ParsedRow[] = [];
  const errors: { rowIndex: number; field: string; message: string }[] = [];

  for (let i = 0; i < records.length; i++) {
    const row = mapRow(records[i]!, format, i);
    if (row) {
      parsedRows.push(row);
    } else {
      errors.push({ rowIndex: i, field: "general", message: "Could not parse row" });
    }
  }

  // Check duplicates against DB
  const existingSymbols = await db
    .select({ symbol: tradesTable.symbol, entryDate: tradesTable.entryDate, entryPrice: tradesTable.entryPrice })
    .from(tradesTable);
  const existingSet = new Set(existingSymbols.map((r) => `${r.symbol}|${r.entryDate}|${r.entryPrice}`));

  let duplicateRows = 0;
  for (const row of parsedRows) {
    const key = `${row.symbol}|${row.entryDate}|${row.entryPrice}`;
    if (existingSet.has(key)) {
      row.isDuplicate = true;
      duplicateRows++;
    }
  }

  const sessionId = uuidv4();
  previewSessions.set(sessionId, { rows: parsedRows, format, filename: req.file.originalname });

  const colMap: Record<string, string> = {};
  for (const h of headers.slice(0, 15)) {
    colMap[h] = h;
  }

  res.json({
    sessionId,
    detectedFormat: format,
    columnMapping: colMap,
    rows: parsedRows.slice(0, 100),
    errors,
    totalRows: records.length,
    validRows: parsedRows.length,
    duplicateRows,
  });
});

router.post("/import/confirm", async (req, res) => {
  const { sessionId, accountId, skipDuplicates = true, brokerFormat, rows: clientRows } = req.body;

  const session = previewSessions.get(sessionId);
  const rowsToSave: ParsedRow[] = (session?.rows ?? clientRows ?? []).filter(
    (r: ParsedRow) => !(skipDuplicates && r.isDuplicate)
  );

  if (rowsToSave.length === 0) {
    return res.json({ batchId: 0, savedCount: 0, skippedCount: 0, errorCount: 0, errors: [] });
  }

  const [batch] = await db
    .insert(importBatchesTable)
    .values({
      filename: session ? (previewSessions.get(sessionId)?.filename ?? "import.csv") : "import.csv",
      brokerFormat: session?.format ?? brokerFormat ?? "generic",
      accountId: accountId ? parseInt(accountId) : null,
      rowCount: rowsToSave.length,
      errorCount: 0,
    })
    .returning();

  const errors: { rowIndex: number; field: string; message: string }[] = [];
  let savedCount = 0;
  let skippedCount = 0;

  for (const row of rowsToSave) {
    try {
      await db.insert(tradesTable).values({
        importBatchId: batch?.id,
        accountId: accountId ? parseInt(accountId) : null,
        importSource: session?.format ?? brokerFormat ?? "generic",
        assetClass: row.assetClass ?? "equity",
        symbol: row.symbol,
        direction: row.direction,
        entryDate: row.entryDate,
        exitDate: row.exitDate,
        entryPrice: row.entryPrice,
        exitPrice: row.exitPrice,
        quantity: row.quantity,
        pnl: row.pnl,
        fees: row.fees,
        rMultiple: row.rMultiple,
        stopLoss: row.stopLoss,
        takeProfit: row.takeProfit,
        hasJournal: false,
      });
      savedCount++;
    } catch {
      errors.push({ rowIndex: row.rowIndex, field: "db", message: "Insert failed" });
      skippedCount++;
    }
  }

  if (batch) {
    await db.update(importBatchesTable).set({ rowCount: savedCount, errorCount: errors.length });
  }

  previewSessions.delete(sessionId);
  res.json({ batchId: batch?.id ?? 0, savedCount, skippedCount, errorCount: errors.length, errors });
});

router.get("/import/batches", async (_req, res) => {
  const rows = await db.select().from(importBatchesTable).orderBy(importBatchesTable.importedAt);
  res.json(
    rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      brokerFormat: r.brokerFormat,
      importedAt: r.importedAt,
      rowCount: r.rowCount,
      errorCount: r.errorCount,
      accountId: r.accountId,
    }))
  );
});

export default router;
