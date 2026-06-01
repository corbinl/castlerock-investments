import { useState } from "react";
import { useListTrades, useListTags, getListTagsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";

const PAGE_SIZE = 50;

export default function Trades() {
  const [page, setPage] = useState(1);
  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState("all");
  const [sortBy, setSortBy] = useState("entryDate");
  const [sortDir, setSortDir] = useState("desc");
  const [tag, setTag] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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

  return (
    <div className="space-y-4">
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
                  <tr key={t.id} data-testid={`trade-row-${t.id}`} className="hover:bg-muted/20 transition-colors">
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
                      <Link href={`/trades/${t.id}`}>
                        <Button variant="ghost" size="sm" data-testid={`link-trade-detail-${t.id}`} className="h-7 px-2"><BookOpen className="w-3.5 h-3.5" /></Button>
                      </Link>
                    </td>
                  </tr>
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
