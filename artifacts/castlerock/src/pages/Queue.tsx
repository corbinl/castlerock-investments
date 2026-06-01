import { useListTrades } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownRight, BookOpen, Tag, CheckCircle } from "lucide-react";

export default function Queue() {
  const { data, isLoading } = useListTrades({ untaggedOnly: true, pageSize: 100, sortBy: "pnl", sortDir: "asc" });
  const trades = data?.trades ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Untagged Queue</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Trades missing setup or tags — prioritised for journaling</p>
        </div>
        {!isLoading && <Badge variant={trades.length > 0 ? "destructive" : "secondary"} className="text-base px-3 py-1">{trades.length} remaining</Badge>}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
        </div>
      )}

      {!isLoading && trades.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle className="w-12 h-12 text-success mx-auto mb-3" />
            <h2 className="text-lg font-semibold">All caught up</h2>
            <p className="text-muted-foreground mt-1">Every trade has been tagged. Your analytics are fully populated.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && trades.length > 0 && (
        <div className="space-y-3">
          {trades.map((t) => {
            const pnl = t.pnl;
            return (
              <Card key={t.id} data-testid={`queue-card-${t.id}`} className="hover:border-primary/50 transition-colors">
                <CardContent className="py-4 px-5 flex items-center gap-4">
                  <div className={`w-1 h-12 rounded-full shrink-0 ${pnl == null ? "bg-muted" : pnl >= 0 ? "bg-success" : "bg-destructive"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{t.symbol}</span>
                      <Badge variant="outline" className={`text-xs ${t.direction === "long" ? "border-success text-success" : "border-destructive text-destructive"}`}>{t.direction.toUpperCase()}</Badge>
                      <span className="text-xs text-muted-foreground">{t.entryDate.slice(0, 10)}</span>
                      <Badge variant="secondary" className="text-xs">{t.assetClass}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Entry ${t.entryPrice.toFixed(2)}</span>
                      {t.exitPrice && <span>Exit ${t.exitPrice.toFixed(2)}</span>}
                      <span>Qty {t.quantity}</span>
                      {!t.setup && <span className="flex items-center gap-1 text-yellow-500"><Tag className="w-3 h-3" />No setup</span>}
                      {!t.hasJournal && <span className="flex items-center gap-1 text-yellow-500"><BookOpen className="w-3 h-3" />No journal</span>}
                    </div>
                  </div>
                  {pnl != null && (
                    <div className={`flex items-center gap-0.5 font-mono font-bold text-lg ${pnl >= 0 ? "text-success" : "text-destructive"}`}>
                      {pnl >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}${Math.abs(pnl).toFixed(2)}
                    </div>
                  )}
                  <Link href={`/trades/${t.id}`}>
                    <Button variant="outline" size="sm" data-testid={`link-journal-${t.id}`} className="gap-1">
                      <BookOpen className="w-3.5 h-3.5" />Journal
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
