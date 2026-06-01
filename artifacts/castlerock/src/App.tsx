import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/AppLayout";

import Dashboard from "@/pages/Dashboard";
import Import from "@/pages/Import";
import Queue from "@/pages/Queue";
import Trades from "@/pages/Trades";
import TradeDetail from "@/pages/TradeDetail";
import Analytics from "@/pages/Analytics";
import Pivot from "@/pages/Pivot";
import WhatIf from "@/pages/WhatIf";
import Sessions from "@/pages/Sessions";
import Strategies from "@/pages/Strategies";
import ShareView from "@/pages/ShareView";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      {/* Public share-link page — no sidebar */}
      <Route path="/share/:token" component={ShareView} />

      {/* App pages — wrapped in sidebar layout */}
      <Route>
        <AppLayout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/import" component={Import} />
            <Route path="/queue" component={Queue} />
            <Route path="/trades" component={Trades} />
            <Route path="/trades/:id" component={TradeDetail} />
            <Route path="/analytics" component={Analytics} />
            <Route path="/analytics/pivot" component={Pivot} />
            <Route path="/analytics/whatif" component={WhatIf} />
            <Route path="/sessions" component={Sessions} />
            <Route path="/strategies" component={Strategies} />
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
