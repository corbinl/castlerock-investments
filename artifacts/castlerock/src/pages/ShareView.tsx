import { useRoute } from "wouter";
import { useGetSharedTrade } from "@workspace/api-client-react";
import type { Trade, Journal } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function ShareView() {
  const [, params] = useRoute("/share/:token");
  const token = params?.token ?? "";

  const { data, isLoading, error } = useGetSharedTrade(token);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading shared trade…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Link Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This share link is invalid or has expired.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const trade = data.trade as Trade;
  const journal = data.journal as Journal | null | undefined;
  const pnl = trade.pnl ?? 0;
  const isWin = pnl > 0;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-4">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-2xl font-bold text-primary">CastleRock</span>
          <Badge variant="outline">Shared Trade</Badge>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">{trade.symbol}</CardTitle>
              <div className="flex gap-2">
                <Badge variant={trade.direction === "long" ? "default" : "secondary"}>
                  {trade.direction.toUpperCase()}
                </Badge>
                <Badge
                  variant={isWin ? "default" : "destructive"}
                  className={isWin ? "bg-emerald-600" : ""}
                >
                  {isWin ? "WIN" : "LOSS"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">P&L</div>
                <div className={`text-xl font-bold ${isWin ? "text-emerald-500" : "text-red-500"}`}>
                  {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                </div>
              </div>
              {trade.rMultiple != null && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">R-Multiple</div>
                  <div className="text-xl font-bold">{trade.rMultiple.toFixed(2)}R</div>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Quantity</div>
                <div className="text-xl font-bold">{trade.quantity}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Entry</div>
                <div className="font-semibold">${trade.entryPrice.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">{trade.entryDate.slice(0, 10)}</div>
              </div>
              {trade.exitPrice != null && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Exit</div>
                  <div className="font-semibold">${trade.exitPrice.toFixed(2)}</div>
                  {trade.exitDate && (
                    <div className="text-xs text-muted-foreground">{trade.exitDate.slice(0, 10)}</div>
                  )}
                </div>
              )}
              {trade.setup && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Setup</div>
                  <div className="font-semibold">{trade.setup}</div>
                </div>
              )}
            </div>

            {trade.tags && (
              <div className="mt-4 flex flex-wrap gap-1">
                {trade.tags.split(",").map((tag: string) => (
                  <Badge key={tag.trim()} variant="outline" className="text-xs">
                    {tag.trim()}
                  </Badge>
                ))}
              </div>
            )}

            {journal && (
              <>
                <Separator className="my-4" />
                <div>
                  <div className="text-sm font-semibold mb-2">Trade Journal</div>
                  {journal.whyEntry && (
                    <div className="mb-2">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Why Entry</div>
                      <p className="text-sm">{journal.whyEntry}</p>
                    </div>
                  )}
                  {journal.whyExit && (
                    <div className="mb-2">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Why Exit</div>
                      <p className="text-sm">{journal.whyExit}</p>
                    </div>
                  )}
                  {journal.mistakes && (
                    <div className="mb-2">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Mistakes</div>
                      <p className="text-sm text-red-400">{journal.mistakes}</p>
                    </div>
                  )}
                  {journal.marketObservation && (
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Market Observation</div>
                      <p className="text-sm text-emerald-400">{journal.marketObservation}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Shared via CastleRock Investments · Personal Trading Journal
        </p>
      </div>
    </div>
  );
}
