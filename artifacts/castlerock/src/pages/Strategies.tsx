import { useState } from "react";
import { useListStrategies, useCreateStrategy, useUpdateStrategy, useDeleteStrategy, useGetStrategyPlaybook, getListStrategiesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, BookOpen, Edit2, Trash2, ChevronDown, ChevronRight, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Strategy = { id: number; name: string; description?: string | null; rules?: string[]; assetClass?: string | null; createdAt: string };

export default function Strategies() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: strategies, isLoading } = useListStrategies({ query: { queryKey: getListStrategiesQueryKey() } });
  const createStrategy = useCreateStrategy();
  const updateStrategy = useUpdateStrategy();
  const deleteStrategy = useDeleteStrategy();

  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Strategy | null>(null);
  const [form, setForm] = useState({ name: "", description: "", assetClass: "", rules: "" });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [playbookId, setPlaybookId] = useState<number | null>(null);

  const { data: playbook } = useGetStrategyPlaybook(playbookId ?? 0, { query: { enabled: playbookId != null, queryKey: ["strategyPlaybook", playbookId] } });

  const openCreate = () => { setEditing(null); setForm({ name: "", description: "", assetClass: "", rules: "" }); setOpen(true); };
  const openEdit = (s: Strategy) => {
    setEditing(s);
    setForm({ name: s.name, description: s.description ?? "", assetClass: s.assetClass ?? "", rules: (s.rules ?? []).join("\n") });
    setOpen(true);
  };

  const save = () => {
    const rules = form.rules.split("\n").map((r) => r.trim()).filter(Boolean);
    const payload = { name: form.name, description: form.description || null, assetClass: form.assetClass || null, rules };
    if (editing) {
      updateStrategy.mutate({ id: editing.id, data: payload }, {
        onSuccess: () => { toast({ title: "Strategy updated" }); qc.invalidateQueries({ queryKey: getListStrategiesQueryKey() }); setOpen(false); },
      });
    } else {
      createStrategy.mutate({ data: payload }, {
        onSuccess: () => { toast({ title: "Strategy created" }); qc.invalidateQueries({ queryKey: getListStrategiesQueryKey() }); setOpen(false); },
      });
    }
  };

  const confirmDelete = () => {
    if (deleteId == null) return;
    deleteStrategy.mutate({ id: deleteId }, {
      onSuccess: () => { toast({ title: "Strategy deleted" }); qc.invalidateQueries({ queryKey: getListStrategiesQueryKey() }); setDeleteId(null); },
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Strategy Playbook</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Document your trading strategies and rules</p>
        </div>
        <Button onClick={openCreate} data-testid="button-new-strategy" className="gap-1"><Plus className="w-4 h-4" />New Strategy</Button>
      </div>

      {isLoading && <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />)}</div>}

      {!isLoading && (strategies ?? []).length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No strategies yet. Document your trading playbook.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {(strategies ?? []).map((s: Strategy) => (
          <Card key={s.id} data-testid={`strategy-card-${s.id}`} className="hover:border-primary/50 transition-colors">
            <CardContent className="pt-4 pb-4 px-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                  {expandedId === s.id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <div>
                    <span className="font-semibold">{s.name}</span>
                    {s.assetClass && <Badge variant="secondary" className="ml-2 text-xs">{s.assetClass}</Badge>}
                    {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setPlaybookId(playbookId === s.id ? null : s.id)} data-testid={`button-playbook-${s.id}`} title="View playbook stats"><BookOpen className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(s)} data-testid={`button-edit-strategy-${s.id}`}><Edit2 className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(s.id)} data-testid={`button-delete-strategy-${s.id}`} className="text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>

              {expandedId === s.id && s.rules && s.rules.length > 0 && (
                <div className="mt-3 pl-7 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Rules</p>
                  {s.rules.map((rule, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{rule}</span>
                    </div>
                  ))}
                </div>
              )}

              {playbookId === s.id && playbook && (
                <div className="mt-3 pl-7 border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Performance Stats</p>
                  <div className="grid grid-cols-4 gap-3 text-sm">
                    {[
                      ["Trades", String(playbook.stats.totalTrades)],
                      ["Win Rate", `${(playbook.stats.winRate * 100).toFixed(1)}%`],
                      ["Total P&L", `$${playbook.stats.totalPnl.toFixed(2)}`],
                      ["Expectancy", `$${playbook.stats.expectancy.toFixed(2)}`],
                    ].map(([l, v]) => (
                      <div key={l}><p className="text-xs text-muted-foreground mb-0.5">{l}</p><p className="font-mono font-semibold text-sm">{v}</p></div>
                    ))}
                  </div>
                  {playbook.topTrades.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground mb-1">Top trades</p>
                      {playbook.topTrades.slice(0, 3).map((t) => (
                        <div key={t.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{t.symbol}</span>
                          <span>{t.entryDate.slice(0, 10)}</span>
                          <span className={t.pnl != null && t.pnl >= 0 ? "text-success font-mono" : "text-destructive font-mono"}>{t.pnl != null ? `$${t.pnl.toFixed(2)}` : "—"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Edit Strategy" : "New Strategy"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Strategy Name *</Label>
                <Input data-testid="input-strategy-name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Breakout Long" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Asset Class</Label>
                <Input data-testid="input-asset-class" value={form.assetClass} onChange={(e) => setForm(f => ({ ...f, assetClass: e.target.value }))} placeholder="e.g. equity, crypto" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Textarea data-testid="input-description" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="resize-none text-sm" placeholder="Brief description of the strategy" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Rules (one per line)</Label>
              <Textarea data-testid="input-rules" value={form.rules} onChange={(e) => setForm(f => ({ ...f, rules: e.target.value }))} rows={5} className="resize-none text-sm font-mono" placeholder={"Wait for pullback to 20 EMA\nEntry on bullish engulfing candle\nStop below candle low\n1:2 minimum R:R"} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form.name || createStrategy.isPending || updateStrategy.isPending} data-testid="button-save-strategy">{editing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete strategy?</AlertDialogTitle><AlertDialogDescription>This will permanently remove the strategy and its rules. Your trades are not affected.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
