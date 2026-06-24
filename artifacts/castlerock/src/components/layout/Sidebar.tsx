import { Link, useLocation } from "wouter";
import { LayoutDashboard, Import, ListTodo, History, LineChart, Table, FlaskConical, CalendarDays, BookOpen, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/checklist", label: "Daily Checklist", icon: CheckSquare },
  { href: "/import", label: "Import", icon: Import },
  { href: "/queue", label: "Queue", icon: ListTodo },
  { href: "/trades", label: "Trade Log", icon: History },
  { href: "/analytics", label: "Analytics", icon: LineChart },
  { href: "/analytics/pivot", label: "Pivot Explorer", icon: Table },
  { href: "/analytics/whatif", label: "What-If Simulator", icon: FlaskConical },
  { href: "/sessions", label: "Sessions", icon: CalendarDays },
  { href: "/strategies", label: "Strategies", icon: BookOpen },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border h-screen flex flex-col fixed left-0 top-0">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-sidebar-primary tracking-tight">CastleRock</h1>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6">
        <nav className="space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
      
      <div className="p-4 border-t border-sidebar-border">
        <div className="text-xs text-sidebar-foreground/50 text-center">
          CastleRock Investments v1.0
        </div>
      </div>
    </div>
  );
}
