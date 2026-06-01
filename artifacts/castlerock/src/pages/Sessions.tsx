import { useState } from "react";
import { useListSessionPlans, useCreateSessionPlan, useUpdateSessionPlan, getListSessionPlansQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CalendarDays, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Session = {
  id: number; sessionDate: string; instruments?: string | null; directionBias?: string | null;
  setupsWatching?: string | null; premarketNotes?: string | null; postSessionNotes?: string | null;
  planAdherenceScore?: number | null; createdAt: string;
};

type FormData = {
  sessionDate: string; instruments: string; directionBias: string;
  setupsWatching: string; premarketNotes: string; postSessionNotes: string; planAdherenceScore: string;
};

const blankForm: FormData = { sessionDate: new Date().toISOString().slice(0, 10), instruments: "", directionBias: "neutral", setupsWatching: "", premarketNotes: "", postSessionNotes: "", planAdherenceScore: "" };

export default function Sessions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: sessions, isLoading } = useListSessionPlans(undefined, { query: { queryKey: getListSessionPlansQueryKey() } });
  const createPlan = useCreateSessionPlan();
  const updatePlan = useUpdateSessionPlan();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Session | null>(null);
  const [form, setForm] = useState<FormData>(blankForm);

  const openCreate = () => { setEditing(null); setForm(blankForm); setOpen(true); };
  const openEdit = (s: Session) => {
    setEditing(s);
    setForm({ sessionDate: s.sessionDate, instruments: s.instruments ?? "", directionBias: s.directionBias ?? "neutral", setupsWatching: s.setupsWatching ?? "", premarketNotes: s.premarketNotes ?? "", postSessionNotes: s.postSessionNotes ?? "", planAdherenceScore: s.planAdherenceScore ? String(s.planAdherenceScore) : "" });
    setOpen(true);
  };

  const save = () => {
    const payload = { ...form, planAdherenceScore: form.planAdherenceScore ? parseInt(form.planAdherenceScore) : undefined };
    if (editing) {
      updatePlan.mutate({ id: editing.id, data: payload }, {
        onSuccess: () => { toast({ title: "Session plan updated" }); qc.invalidateQueries({ queryKey: getListSessionPlansQueryKey() }); setOpen(false); },
      });
    } else {
      createPlan.mutate({ data: payload }, {
        onSuccess: () => { toast({ title: "Session plan created" }); qc.invalidateQueries({ queryKey: getListSessionPlansQueryKey() }); setOpen(false); },
      });
    }
  };

  const Field = ({ fKey, label, type = "text" }: { fKey: keyof FormData; label: string; type?: string }) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {type === "textarea" ? (
        <Textarea data-testid={`input-${fKey}`} value={form[fKey]} onChange={(e) => setForm(f => ({ ...f, [fKey]: e.target.value }))} rows={3} className="resize-none text-sm" />
      ) : (
        <Input data-testid={`input-${fKey}`} type={type} value={form[fKey]} onChange={(e) => setForm(f => ({ ...f, [fKey]: e.target.value }))} className="text-sm" />
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Session Plans</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Pre-market game plans and post-session reviews</p>
        </div>
        <Button onClick={openCreate} data-testid="button-new-session" className="gap-1"><Plus className="w-4 h-4" />New Plan</Button>
      </div>

      {isLoading && <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}</div>}

      {!isLoading && (sessions ?? []).length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <CalendarDays className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No session plans yet. Create your first pre-market plan.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {(sessions ?? []).map((s: Session) => (
          <Card key={s.id} data-testid={`session-card-${s.id}`} className="hover:border-primary/50 transition-colors">
            <CardContent className="pt-4 pb-4 px-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <CalendarDays className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-sm">{s.sessionDate}</span>
                    {s.directionBias && <Badge variant="secondary" className="ml-2 text-xs">{s.directionBias}</Badge>}
                    {s.instruments && <span className="ml-2 text-xs text-muted-foreground">{s.instruments}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {s.planAdherenceScore != null && (
                    <Badge variant="outline" className={`text-xs ${s.planAdherenceScore >= 7 ? "border-success text-success" : s.planAdherenceScore >= 4 ? "border-yellow-500 text-yellow-600" : "border-destructive text-destructive"}`}>
                      Adherence: {s.planAdherenceScore}/10
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => openEdit(s)} data-testid={`button-edit-session-${s.id}`}><Edit2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {s.setupsWatching && (
                  <div><p className="text-xs text-muted-foreground mb-0.5">Setups watching</p><p className="text-sm">{s.setupsWatching}</p></div>
                )}
                {s.premarketNotes && (
                  <div><p className="text-xs text-muted-foreground mb-0.5">Pre-market notes</p><p className="text-sm text-muted-foreground leading-relaxed">{s.premarketNotes}</p></div>
                )}
                {s.postSessionNotes && (
                  <div className="col-span-2"><p className="text-xs text-muted-foreground mb-0.5">Post-session review</p><p className="text-sm text-muted-foreground leading-relaxed">{s.postSessionNotes}</p></div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Session Plan" : "New Session Plan"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <Field fKey="sessionDate" label="Session Date" type="date" />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Direction Bias</Label>
              <Select value={form.directionBias} onValueChange={(v) => setForm(f => ({ ...f, directionBias: v }))}>
                <SelectTrigger data-testid="input-directionBias"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["neutral", "bullish", "bearish", "cautious"].map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Field fKey="instruments" label="Instruments watching" />
            <Field fKey="planAdherenceScore" label="Plan adherence (0-10)" type="number" />
            <div className="col-span-2"><Field fKey="setupsWatching" label="Setups watching" type="textarea" /></div>
            <div className="col-span-2"><Field fKey="premarketNotes" label="Pre-market notes" type="textarea" /></div>
            <div className="col-span-2"><Field fKey="postSessionNotes" label="Post-session review" type="textarea" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={createPlan.isPending || updatePlan.isPending} data-testid="button-save-session">{editing ? "Update" : "Create"} Plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
