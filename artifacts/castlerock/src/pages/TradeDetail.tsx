import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useGetTrade, useUpsertJournal, useCreateTradeShareLink } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Share2, ArrowUpRight, ArrowDownRight, Save, Copy, Check, Brain, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

function Slider({ label, value, onChange, min = 1, max = 10 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs font-mono font-semibold text-primary">{value}/{max}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-primary cursor-pointer" />
    </div>
  );
}

export default function TradeDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const tradeId = parseInt(params.id ?? "0");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useGetTrade(tradeId, { query: { enabled: !!tradeId, queryKey: ["getTrade", tradeId] } });
  const upsertJournal = useUpsertJournal();
  const createShareLink = useCreateTradeShareLink();

  const [form, setForm] = useState({
    whyEntry: "", whyExit: "", whyStopLoss: "", whyTakeProfit: "",
    mistakes: "", marketObservation: "",
    confidenceRating: 5, ruleFollowed: false,
    tiltState: "calm",
    executionQualityEntry: 5, executionQualityExit: 5, executionQualityStop: 5,
    strategyRulesChecked: "",
  });
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [coaching, setCoaching] = useState<string | null>(null);
  const [coachingStreaming, setCoachingStreaming] = useState(false);
  const [coachingCached, setCoachingCached] = useState(false);
  const [coachingGeneratedAt, setCoachingGeneratedAt] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (tradeId && data?.trade?.hasJournal) {
      fetch(`/api/coach/trade/${tradeId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((res) => {
          if (res?.coaching) {
            setCoaching(res.coaching);
            setCoachingCached(true);
            setCoachingGeneratedAt(res.generatedAt ?? null);
          }
        })
        .catch(() => {});
    }
  }, [tradeId, data?.trade?.hasJournal]);

  useEffect(() => {
    if (data?.journal) {
      const j = data.journal;
      setForm({
        whyEntry: j.whyEntry ?? "",
        whyExit: j.whyExit ?? "",
        whyStopLoss: j.whyStopLoss ?? "",
        whyTakeProfit: j.whyTakeProfit ?? "",
        mistakes: j.mistakes ?? "",
        marketObservation: j.marketObservation ?? "",
        confidenceRating: j.confidenceRating ?? 5,
        ruleFollowed: j.ruleFollowed ?? false,
        tiltState: j.tiltState ?? "calm",
        executionQualityEntry: j.executionQualityEntry ?? 5,
        executionQualityExit: j.executionQualityExit ?? 5,
        executionQualityStop: j.executionQualityStop ?? 5,
        strategyRulesChecked: j.strategyRulesChecked ?? "",
      });
    }
  }, [data]);

  const handleSave = () => {
    upsertJournal.mutate(
      { id: tradeId, data: { ...form, confidenceRating: form.confidenceRating, ruleFollowed: form.ruleFollowed } },
      { onSuccess: () => { toast({ title: "Journal saved" }); qc.invalidateQueries({ queryKey: ["getTrade", tradeId] }); } }
    );
  };

  const handleGetCoaching = async (regenerate = false) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setCoachingStreaming(true);
    setCoaching("");
    setCoachingCached(false);
    setCoachingGeneratedAt(null);

    try {
      const res = await fetch(`/api/coach/trade/${tradeId}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast({ title: "Coaching unavailable", description: (errData as any).detail ?? "Please add a journal entry first.", variant: "destructive" });
        setCoaching(null);
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
              if (payload.error) {
                toast({ title: "Coaching error", description: payload.error, variant: "destructive" });
                setCoaching(null);
                return;
              }
              if (payload.cached) {
                setCoaching(payload.text);
                setCoachingCached(true);
                setCoachingGeneratedAt(payload.generatedAt ?? null);
                setCoachingStreaming(false);
                return;
              }
              if (payload.text) {
                accumulated += payload.text;
                setCoaching(accumulated);
              }
              if (payload.done) {
                setCoachingCached(false);
                setCoachingGeneratedAt(payload.generatedAt ?? null);
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        toast({ title: "Failed to get coaching", variant: "destructive" });
        setCoaching(null);
      }
    } finally {
      setCoachingStreaming(false);
    }
  };

  const handleShare = () => {
    createShareLink.mutate(
      { id: tradeId },
      { onSuccess: (res) => { setShareToken(res.token); toast({ title: "Share link created" }); } }
    );
  };

  const copyLink = () => {
    const url = `${window.location.origin}/share/view/${shareToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <div className="h-48 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!data || !data.trade) return <div className="text-center text-muted-foreground py-20">Trade not found</div>;

  const { trade } = data;
  const pnl = trade.pnl;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/trades"><Button variant="ghost" size="sm" data-testid="button-back"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <h1 className="text-2xl font-bold tracking-tight">{trade.symbol}</h1>
          <Badge variant="outline" className={trade.direction === "long" ? "border-success text-success" : "border-destructive text-destructive"}>{trade.direction.toUpperCase()}</Badge>
          {pnl != null && <Badge className={pnl >= 0 ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>{pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}</Badge>}
        </div>
        <div className="flex gap-2">
          {shareToken ? (
            <div className="flex items-center gap-2">
              <Input readOnly value={`${window.location.origin}/share/view/${shareToken}`} className="w-56 text-xs h-8" />
              <Button size="sm" variant="outline" onClick={copyLink} data-testid="button-copy-share">
                {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={handleShare} data-testid="button-share"><Share2 className="w-3.5 h-3.5 mr-1" />Share</Button>
          )}
        </div>
      </div>

      {/* Trade facts */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Trade Details</CardTitle></CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-4 gap-4 text-sm">
            {[
              ["Entry Date", trade.entryDate.slice(0, 10)],
              ["Exit Date", trade.exitDate?.slice(0, 10) ?? "Open"],
              ["Entry Price", `$${trade.entryPrice.toFixed(2)}`],
              ["Exit Price", trade.exitPrice ? `$${trade.exitPrice.toFixed(2)}` : "—"],
              ["Quantity", String(trade.quantity)],
              ["Fees", trade.fees ? `$${trade.fees.toFixed(2)}` : "—"],
              ["Stop Loss", trade.stopLoss ? `$${trade.stopLoss.toFixed(2)}` : "—"],
              ["Take Profit", trade.takeProfit ? `$${trade.takeProfit.toFixed(2)}` : "—"],
              ["R Multiple", trade.rMultiple ? `${trade.rMultiple.toFixed(2)}R` : "—"],
              ["Asset Class", trade.assetClass],
              ["Setup", trade.setup ?? "—"],
              ["Tags", trade.tags ?? "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                <p className="font-medium font-mono text-sm">{value}</p>
              </div>
            ))}
          </div>
          {pnl != null && (
            <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${pnl >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
              {pnl >= 0 ? <ArrowUpRight className="w-5 h-5 text-success" /> : <ArrowDownRight className="w-5 h-5 text-destructive" />}
              <span className={`text-2xl font-bold font-mono ${pnl >= 0 ? "text-success" : "text-destructive"}`}>{pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}</span>
              {trade.rMultiple && <Badge variant="outline" className="ml-2">{trade.rMultiple.toFixed(2)}R</Badge>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Journal */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Trade Journal</CardTitle>
          <Button size="sm" onClick={handleSave} disabled={upsertJournal.isPending} data-testid="button-save-journal">
            <Save className="w-3.5 h-3.5 mr-1" />{upsertJournal.isPending ? "Saving..." : "Save"}
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {([["whyEntry", "Why did you enter?"], ["whyExit", "Why did you exit?"], ["whyStopLoss", "Stop loss rationale"], ["whyTakeProfit", "Take profit rationale"], ["mistakes", "Mistakes made"], ["marketObservation", "Market observation"]] as [keyof typeof form, string][]).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Textarea data-testid={`textarea-${key}`} value={String(form[key])} onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))} rows={2} className="resize-none text-sm" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2">
            <Slider label="Confidence Rating" value={form.confidenceRating} onChange={(v) => setForm(f => ({ ...f, confidenceRating: v }))} />
            <Slider label="Entry Execution Quality" value={form.executionQualityEntry} onChange={(v) => setForm(f => ({ ...f, executionQualityEntry: v }))} />
            <Slider label="Exit Execution Quality" value={form.executionQualityExit} onChange={(v) => setForm(f => ({ ...f, executionQualityExit: v }))} />
          </div>

          <div className="grid grid-cols-3 gap-4 pt-1">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tilt State</Label>
              <Select value={form.tiltState} onValueChange={(v) => setForm(f => ({ ...f, tiltState: v }))}>
                <SelectTrigger data-testid="select-tilt-state"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["calm", "focused", "nervous", "revenge-trading", "overconfident", "fearful", "fomo"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex flex-col justify-end">
              <div className="flex items-center gap-2 pb-2">
                <Checkbox id="ruleFollowed" data-testid="checkbox-rule-followed" checked={form.ruleFollowed} onCheckedChange={(v) => setForm(f => ({ ...f, ruleFollowed: !!v }))} />
                <Label htmlFor="ruleFollowed" className="text-sm cursor-pointer">Rules followed</Label>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Strategy rules checklist</Label>
              <Input data-testid="input-strategy-rules" value={form.strategyRulesChecked} onChange={(e) => setForm(f => ({ ...f, strategyRulesChecked: e.target.value }))} placeholder="comma-separated rules checked" className="text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Coach */}
      <Card className="border-amber-500/30">
        <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-amber-400" />
            <CardTitle className="text-sm font-medium text-amber-400 uppercase tracking-wider">AI Trade Coach</CardTitle>
          </div>
          <div className="flex gap-2">
            {(coaching || coachingStreaming) && (
              <Button size="sm" variant="ghost" onClick={() => handleGetCoaching(true)} disabled={coachingStreaming} data-testid="button-coach-refresh">
                <RefreshCw className={`w-3.5 h-3.5 ${coachingStreaming ? "animate-spin" : ""}`} />
              </Button>
            )}
            {!coaching && !coachingStreaming && (
              <Button
                size="sm"
                onClick={() => handleGetCoaching(false)}
                disabled={coachingStreaming || !data?.trade?.hasJournal}
                data-testid="button-get-coaching"
                className="bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30"
              >
                <Brain className="w-3.5 h-3.5 mr-1" />
                Get Coaching
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {!data?.trade?.hasJournal && !coaching && !coachingStreaming && (
            <p className="text-sm text-muted-foreground italic">Add a journal entry and save it to unlock AI coaching for this trade.</p>
          )}
          {data?.trade?.hasJournal && !coaching && !coachingStreaming && (
            <p className="text-sm text-muted-foreground italic">Click "Get Coaching" to receive AI-powered feedback on this trade.</p>
          )}
          {(coaching || coachingStreaming) && (
            <div className="space-y-2">
              <p className="text-sm leading-relaxed whitespace-pre-line">
                {coaching}
                {coachingStreaming && <span className="inline-block w-1.5 h-4 bg-amber-400 animate-pulse ml-0.5 align-middle" />}
              </p>
              {!coachingStreaming && coachingGeneratedAt && (
                <p className="text-xs text-muted-foreground">
                  {coachingCached ? "Cached" : "Generated"} · {new Date(coachingGeneratedAt).toLocaleString()} ·{" "}
                  <button className="underline cursor-pointer" onClick={() => handleGetCoaching(true)}>Regenerate</button>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
