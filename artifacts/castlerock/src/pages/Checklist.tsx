import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  CheckSquare, Plus, Trash2, GripVertical, Settings, X, Check,
  TrendingUp, Calendar,
} from "lucide-react";

interface ChecklistItem {
  id: number;
  label: string;
  isActive: boolean;
  sortOrder: number;
  completedToday?: boolean;
}

interface TodayStatus {
  date: string;
  total: number;
  completed: number;
  compliancePct: number;
  items: ChecklistItem[];
}

interface ComplianceDay {
  date: string;
  total: number;
  completed: number;
  pct: number;
}

function ComplianceCalendar({ data }: { data: ComplianceDay[] }) {
  if (data.length === 0) return null;
  return (
    <div className="flex gap-1 flex-wrap">
      {data.map((d) => {
        const bg =
          d.total === 0
            ? "hsl(var(--muted))"
            : d.pct === 100
            ? "hsl(142 65% 42%)"
            : d.pct >= 60
            ? "hsl(45 90% 52%)"
            : d.pct > 0
            ? "hsl(25 90% 52%)"
            : "hsl(0 65% 48%)";
        const label =
          d.total === 0
            ? "No items"
            : `${d.pct}% (${d.completed}/${d.total})`;
        return (
          <div
            key={d.date}
            title={`${d.date}: ${label}`}
            className="w-6 h-6 rounded-sm cursor-default transition-opacity hover:opacity-80"
            style={{ background: bg }}
          />
        );
      })}
    </div>
  );
}

function SparkBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const color =
    value === 100
      ? "hsl(142 65% 42%)"
      : value >= 60
      ? "hsl(45 90% 52%)"
      : "hsl(0 65% 48%)";
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="w-4 bg-muted rounded-sm overflow-hidden" style={{ height: 32 }}>
        <div
          className="w-full rounded-sm"
          style={{
            height: `${pct}%`,
            background: color,
            marginTop: `${100 - pct}%`,
          }}
        />
      </div>
      <span className="text-[9px] text-muted-foreground font-mono">{value}%</span>
    </div>
  );
}

export default function Checklist() {
  const { toast } = useToast();
  const [today, setToday] = useState<TodayStatus | null>(null);
  const [compliance, setCompliance] = useState<ComplianceDay[]>([]);
  const [allItems, setAllItems] = useState<ChecklistItem[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const fetchToday = useCallback(async () => {
    try {
      const res = await fetch("/api/checklist/today");
      if (res.ok) setToday(await res.json());
    } catch {}
  }, []);

  const fetchCompliance = useCallback(async () => {
    try {
      const res = await fetch("/api/checklist/compliance?days=30");
      if (res.ok) setCompliance(await res.json());
    } catch {}
  }, []);

  const fetchAllItems = useCallback(async () => {
    try {
      const res = await fetch("/api/checklist/items");
      if (res.ok) setAllItems(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([fetchToday(), fetchCompliance(), fetchAllItems()]).finally(() =>
      setLoading(false)
    );
  }, [fetchToday, fetchCompliance, fetchAllItems]);

  const handleToggle = async (itemId: number) => {
    try {
      const res = await fetch(`/api/checklist/today/${itemId}/toggle`, { method: "POST" });
      if (res.ok) {
        await fetchToday();
        await fetchCompliance();
      }
    } catch {}
  };

  const handleAddItem = async () => {
    const label = newLabel.trim();
    if (!label) return;
    try {
      const res = await fetch("/api/checklist/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (res.ok) {
        setNewLabel("");
        await Promise.all([fetchAllItems(), fetchToday()]);
        toast({ title: "Item added" });
      }
    } catch {}
  };

  const handleDeleteItem = async (id: number) => {
    try {
      await fetch(`/api/checklist/items/${id}`, { method: "DELETE" });
      await Promise.all([fetchAllItems(), fetchToday()]);
      toast({ title: "Item removed" });
    } catch {}
  };

  const handleToggleActive = async (id: number, current: boolean) => {
    try {
      await fetch(`/api/checklist/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !current }),
      });
      await Promise.all([fetchAllItems(), fetchToday()]);
    } catch {}
  };

  const handleSaveEdit = async (id: number) => {
    const label = editLabel.trim();
    if (!label) return;
    try {
      await fetch(`/api/checklist/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      setEditingId(null);
      await fetchAllItems();
    } catch {}
  };

  const handleDrop = async (targetId: number) => {
    if (dragId === null || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    const reordered = [...allItems];
    const fromIdx = reordered.findIndex((i) => i.id === dragId);
    const toIdx = reordered.findIndex((i) => i.id === targetId);
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setAllItems(reordered);
    setDragId(null);
    setDragOverId(null);
    try {
      await fetch("/api/checklist/items/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: reordered.map((i) => i.id) }),
      });
    } catch {}
  };

  const avgCompliance =
    compliance.length > 0
      ? Math.round(compliance.reduce((s, d) => s + d.pct, 0) / compliance.length)
      : 0;

  const last7 = compliance.slice(-7);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Daily Ritual Checklist</h1>
          {today && today.total > 0 && (
            <Badge
              variant={today.compliancePct === 100 ? "default" : "secondary"}
              className={today.compliancePct === 100 ? "bg-success/20 text-success border-success/30" : ""}
            >
              {today.completed}/{today.total} today
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant={showSettings ? "default" : "outline"}
          onClick={() => setShowSettings((s) => !s)}
          className="h-8 gap-1.5"
          data-testid="button-toggle-settings"
        >
          <Settings className="w-3.5 h-3.5" />
          {showSettings ? "Done" : "Manage Items"}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Today's Progress</p>
            <p className={`text-3xl font-bold font-mono tabular-nums ${today && today.compliancePct === 100 ? "text-success" : ""}`}>
              {today?.compliancePct ?? 0}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {today?.completed ?? 0} of {today?.total ?? 0} items complete
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">30-Day Avg</p>
            <p className={`text-3xl font-bold font-mono tabular-nums ${avgCompliance >= 80 ? "text-success" : avgCompliance >= 50 ? "" : "text-destructive"}`}>
              {avgCompliance}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">compliance rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Last 7 Days</p>
            <div className="flex items-end gap-1">
              {last7.map((d) => (
                <SparkBar key={d.date} value={d.pct} max={100} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <CheckSquare className="w-4 h-4" />
                {today?.date ?? "Today"}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {!today || today.items.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  No active items. Add some in <button onClick={() => setShowSettings(true)} className="underline text-primary">Manage Items</button>.
                </div>
              ) : (
                <div className="space-y-2">
                  {today.items.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        item.completedToday
                          ? "bg-success/5 border-success/20"
                          : "border-border hover:bg-muted/30"
                      }`}
                      onClick={() => handleToggle(item.id)}
                      data-testid={`checklist-item-${item.id}`}
                    >
                      <Checkbox
                        checked={item.completedToday}
                        onCheckedChange={() => handleToggle(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        className={item.completedToday ? "data-[state=checked]:bg-success data-[state=checked]:border-success" : ""}
                      />
                      <span
                        className={`text-sm flex-1 ${
                          item.completedToday ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {item.label}
                      </span>
                      {item.completedToday && <Check className="w-3.5 h-3.5 text-success shrink-0" />}
                    </div>
                  ))}
                </div>
              )}

              {today && today.total > 0 && today.compliancePct === 100 && (
                <div className="mt-4 p-3 rounded-lg bg-success/10 border border-success/20 flex items-center gap-2 text-sm text-success">
                  <Check className="w-4 h-4 shrink-0" />
                  All rituals complete — you're ready to trade!
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                30-Day Calendar
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-5">
              <ComplianceCalendar data={compliance} />
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {[
                  { color: "hsl(142 65% 42%)", label: "100%" },
                  { color: "hsl(45 90% 52%)", label: "60–99%" },
                  { color: "hsl(25 90% 52%)", label: "1–59%" },
                  { color: "hsl(0 65% 48%)", label: "0%" },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
                    {l.label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Compliance Trend
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {compliance.length > 0 ? (
                <div className="space-y-1.5">
                  {[
                    { label: "Last 7 days", days: 7 },
                    { label: "Last 14 days", days: 14 },
                    { label: "Last 30 days", days: 30 },
                  ].map(({ label, days }) => {
                    const slice = compliance.slice(-days);
                    const avg =
                      slice.length > 0
                        ? Math.round(slice.reduce((s, d) => s + d.pct, 0) / slice.length)
                        : 0;
                    return (
                      <div key={label} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground text-xs">{label}</span>
                        <span
                          className={`font-mono font-semibold text-xs ${
                            avg >= 80 ? "text-success" : avg >= 50 ? "" : "text-destructive"
                          }`}
                        >
                          {avg}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No data yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {showSettings && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Manage Checklist Items
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Add new item…"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                className="flex-1 h-8 text-sm"
                data-testid="input-new-checklist-item"
              />
              <Button size="sm" onClick={handleAddItem} className="h-8 gap-1" data-testid="button-add-checklist-item">
                <Plus className="w-3.5 h-3.5" /> Add
              </Button>
            </div>

            <div className="space-y-1.5">
              {allItems.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDragId(item.id)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverId(item.id); }}
                  onDrop={() => handleDrop(item.id)}
                  className={`flex items-center gap-2 p-2 rounded-md border bg-card transition-all cursor-grab ${
                    dragOverId === item.id ? "ring-1 ring-primary opacity-70" : "border-border"
                  } ${!item.isActive ? "opacity-50" : ""}`}
                  data-testid={`settings-item-${item.id}`}
                >
                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

                  {editingId === item.id ? (
                    <Input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit(item.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 h-6 text-xs"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="flex-1 text-sm cursor-pointer"
                      onDoubleClick={() => { setEditingId(item.id); setEditLabel(item.label); }}
                    >
                      {item.label}
                    </span>
                  )}

                  <div className="flex items-center gap-1 shrink-0">
                    {editingId === item.id ? (
                      <>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleSaveEdit(item.id)}>
                          <Check className="w-3 h-3 text-success" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingId(null)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs px-2 text-muted-foreground"
                        onClick={() => handleToggleActive(item.id, item.isActive)}
                      >
                        {item.isActive ? "Hide" : "Show"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteItem(item.id)}
                      data-testid={`button-delete-item-${item.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">Double-click an item label to rename it. Drag to reorder.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
