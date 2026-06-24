import { useState, useEffect, useRef, Fragment } from "react";
import { useListTrades, useListTags, getListTagsQueryKey, useGetJournal, useUpsertJournal } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, BookOpen, ChevronDown, ChevronUp, Save, ExternalLink, Brain, CheckSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 50;

function InlineJournal({ tradeId, onClose }: { tradeId: number; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: journal, isLoading } = useGetJournal(tradeId, {
    query: { queryKey: ["getJournal", tradeId], retry: false },
  });
  const upsert = useUpsertJournal();

  const [form, setForm] = useState({
    whyEntry: "",
    whyExit: "",
    mistakes: "",
    marketObservation: "",
    confidenceRating: 5,
    ruleFollowed: false,
    tiltState: "calm",
  });

  const [coachingNudge, setCoachingNudge] = useState(false);
  const [coachingText, setCoachingText] = useState<string | null>(null);
  const [coachingStreaming, setCoachingStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (journal) {
      setForm({
        whyEntry: journal.whyEntry ?? "",
        whyExit: journal.whyExit ?? "",
        mistakes: journal.mistakes ?? "",
        marketObservation: journal.marketObservation ?? "",
        confidenceRating: journal.confidenceRating ?? 5,
        ruleFollowed: journal.ruleFollowed ?? false,
        tiltState: journal.tiltState ?? "calm",
      });
    }
  }, [journal]);

  const handleSave = () => {
    upsert.mutate(
      { id: tradeId, data: form },
      {
        onSuccess: () => {
          toast({ title: "Journal saved" });
          qc.invalidateQueries({ queryKey: ["getJournal", tradeId] });
          qc.invalidateQueries({ queryKey: ["listTrades"] });
          setCoachingNudge(true);
        },
      }
    );
  };

  const handleGetCoaching = async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setCoachingStreaming(true);
    setCoachingText("");
    setCoachingNudge(false);

    try {
      const res = await fetch(`/api/coach/trade/${tradeId}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate: false }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast({ title: "Coaching unavailable", description: (errData as any).detail ?? "Add a journal entry first.", variant: "destructive" });
        setCoachingText(null);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.error) { setCoachingText(null); return; }
              if (payload.cached) { setCoachingText(payload.text); setCoachingStreaming(false); return; }
              if (payload.text) { accumulated += payload.text; setCoachingText(accumulated); }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") setCoachingText(null);
    } finally {
      setCoachingStreaming(false);
    }
  };

  if (isLoading) {
    return (
      <tr>
        <td colSpan={11} className="bg-muted/10 px-6 py-4">
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={11} className="bg-muted/10 border-b border-border">
        <div className="px-6 py-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Journal</span>
            <div className="flex items-center gap-2">
              <Link href={`/trades/${tradeId}`}>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground">
                  <ExternalLink className="w-3 h-3" /> Full detail
                </Button>
              </Link>
              <Button size="sm" onClick={handleSave} disabled={upsert.isPending} className="h-7 text-xs" data-testid={`button-save-inline-journal-${tradeId}`}>
                <Save className="w-3 h-3 mr-1" />{upsert.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Why entry?</Label>
              <Textarea
                data-testid={`inline-why-entry-${tradeId}`}
                value={form.whyEntry}
                onChange={(e) => setForm((f) => ({ ...f, whyEntry: e.target.value }))}
                rows={2}
                className="resize-none text-xs"
                placeholder="Setup reason…"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Why exit?</Label>
              <Textarea
                value={form.whyExit}
                onChange={(e) => setForm((f) => ({ ...f, whyExit: e.target.value }))}
                rows={2}
                className="resize-none text-xs"
                placeholder="Exit reasoning…"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Mistakes</Label>
              <Textarea
                value={form.mistakes}
                onChange={(e) => setForm((f) => ({ ...f, mistakes: e.target.value }))}
                rows={2}
                className="resize-none text-xs"
                placeholder="What went wrong…"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Market observation</Label>
              <Textarea
                value={form.marketObservation}
                onChange={(e) => setForm((f) => ({ ...f, marketObservation: e.target.value }))}
                rows={2}
                className="resize-none text-xs"
                placeholder="Context / conditions…"
              />
            </div>
          </div>
          <div className="flex items-center gap-6 pt-1">
            <div className="flex items-center gap-2 min-w-[160px]">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Confidence</Label>
              <input
                type="range" min={1} max={10} value={form.confidenceRating}
                onChange={(e) => setForm((f) => ({ ...f, confidenceRating: parseInt(e.target.value) }))}
                className="accent-primary w-24"
              />
              <span className="text-xs font-mono font-semibold text-primary w-8">{form.confidenceRating}/10</span>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id={`rf-${tradeId}`}
                checked={form.ruleFollowed}
                onCheckedChange={(v) => setForm((f) => ({ ...f, ruleFollowed: !!v }))}
              />
              <Label htmlFor={`rf-${tradeId}`} className="text-xs cursor-pointer">Rules followed</Label>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Tilt state</Label>
              <Select value={form.tiltState} onValueChange={(v) => setForm((f) => ({ ...f, tiltState: v }))}>
                <SelectTrigger className="w-32 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["calm", "focused", "nervous", "revenge-trading", "overconfident", "fearful", "fomo"].map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Coaching nudge shown after save */}
          {coachingNudge && !coachingText && !coachingStreaming && (
            <div className="flex items-center gap-3 pt-1 border-t border-amber-500/20 mt-2">
              <Brain className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-xs text-amber-300">Journal saved! Want AI coaching on this trade?</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 px-2"
                onClick={handleGetCoaching}
                data-testid={`button-inline-get-coaching-${tradeId}`}
              >
                Get Coaching
              </Button>
            </div>
          )}

          {/* Inline coaching result */}
          {(coachingText !== null || coachingStreaming) && (
            <div className="pt-2 border-t border-amber-500/20 mt-2 space-y-1">
              <div className="flex items-center gap-1.5 mb-1">
                <Brain className="w-3 h-3 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">AI Coach</span>
              </div>
              <p className="text-xs leading-relaxed text-foreground whitespace-pre-line">
                {coachingText}
                {coachingStreaming && <span className="inline-block w-1 h-3 bg-amber-400 animate-pulse ml-0.5 align-middle" />}
              </p>
              {!coachingStreaming && (
                <p className="text-xs text-muted-foreground">
                  <Link href={`/trades/${tradeId}`} className="underline">View full detail</Link> for complete coaching history
                </p>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function Trades() {
  const [page, setPage] = useState(1);
  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState("all");
  const [sortBy, setSortBy] = useState("entryDate");
  const [sortDir, setSortDir] = useState("desc");
  const [tag, setTag] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [checklistStatus, setChecklistStatus] = useState<{ total: number; completed: number; compliancePct: number } | null>(null);

  useEffect(() => {
    fetch("/api/checklist/today")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setChecklistStatus(d); })
      .catch(() => {});
  }, []);

  const { data, isLoading } = useListTrades({
    symbol: symbol || undefined,
    direction: direction !== "all" ? direction : undefined,
    tag: tag !== "all" ? tag : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page, pageSize: PAGE_SIZE, sortBy, sortDir,
  });

  const { data: tags } = useListTags({ query: { queryKey: getListTagsQueryKey() } });

  const trades = data?.trades ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const toggleExpand = (id: number) => setExpandedId((cur) => (cur === id ? null : id));

  return (
    <div className="space-y-4">
      {checklistStatus && checklistStatus.total > 0 && checklistStatus.compliancePct < 100 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm" data-testid="checklist-nudge-banner">
          <CheckSquare className="w-4 h-4 shrink-0" />
          <span className="flex-1">
            Pre-trade ritual incomplete — {checklistStatus.completed}/{checklistStatus.total} items done today.
          </span>
          <Link href="/checklist">
            <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-amber-600 dark:text-amber-400 hover:text-amber-500 hover:bg-amber-500/10">
              Complete checklist →
            </Button>
          </Link>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Trade Log</h1>
        <Badge variant="secondary">{total} trades</Badge>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3">
            <Input data-testid="input-symbol" placeholder="Symbol" value={symbol} onChange={(e) => { setSymbol(e.target.value); setPage(1); }} className="w-32" />
            <Select value={direction} onValueChange={(v) => { setDirection(v); setPage(1); }}>
              <SelectTrigger className="w-28" data-testid="select-direction"><SelectValue placeholder="Direction" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="long">Long</SelectItem>
                <SelectItem value="short">Short</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tag} onValueChange={(v) => { setTag(v); setPage(1); }}>
              <SelectTrigger className="w-36" data-testid="select-tag"><SelectValue placeholder="Tag" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {(tags ?? []).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-36" data-testid="input-date-from" />
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-36" data-testid="input-date-to" />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entryDate">Entry Date</SelectItem>
                <SelectItem value="pnl">P&L</SelectItem>
                <SelectItem value="symbol">Symbol</SelectItem>
                <SelectItem value="rMultiple">R Multiple</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortDir} onValueChange={setSortDir}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Desc</SelectItem>
                <SelectItem value="asc">Asc</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => { setSymbol(""); setDirection("all"); setTag("all"); setDateFrom(""); setDateTo(""); setPage(1); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Date", "Symbol", "Dir", "Qty", "Entry", "Exit", "P&L", "R", "Setup", "Tags", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i}><td colSpan={11} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded w-full" /></td></tr>
                  ))
                ) : trades.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">No trades match filters. <Link href="/import" className="text-primary underline">Import trades</Link></td></tr>
                ) : trades.map((t) => (
                  <Fragment key={t.id}>
                    <tr
                      data-testid={`trade-row-${t.id}`}
                      className={`hover:bg-muted/20 transition-colors cursor-pointer ${expandedId === t.id ? "bg-muted/10" : ""}`}
                      onClick={() => toggleExpand(t.id)}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{t.entryDate.slice(0, 10)}</td>
                      <td className="px-4 py-2.5 font-semibold">{t.symbol}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={`text-xs ${t.direction === "long" ? "border-success text-success" : "border-destructive text-destructive"}`}>{t.direction === "long" ? "LONG" : "SHORT"}</Badge>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{t.quantity}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">${t.entryPrice.toFixed(2)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{t.exitPrice ? `$${t.exitPrice.toFixed(2)}` : <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-2.5">
                        {t.pnl != null ? (
                          <div className={`flex items-center gap-0.5 font-mono font-semibold ${t.pnl >= 0 ? "text-success" : "text-destructive"}`}>
                            {t.pnl >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}${Math.abs(t.pnl).toFixed(2)}
                          </div>
                        ) : <span className="text-muted-foreground text-xs">Open</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{t.rMultiple ? `${t.rMultiple.toFixed(2)}R` : <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[100px] truncate">{t.setup ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {t.tags ? t.tags.split(",").map((tg) => tg.trim()).filter(Boolean).slice(0, 2).map((tg) => (
                          <Badge key={tg} variant="secondary" className="text-xs mr-1">{tg}</Badge>
                        )) : null}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          {t.hasJournal && <BookOpen className="w-3 h-3 text-primary opacity-70" />}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-1.5"
                            data-testid={`button-expand-journal-${t.id}`}
                            onClick={(e) => { e.stopPropagation(); toggleExpand(t.id); }}
                          >
                            {expandedId === t.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === t.id && (
                      <InlineJournal tradeId={t.id} onClose={() => setExpandedId(null)} />
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">{total} trades, page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page"><ChevronLeft className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid="button-next-page"><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
