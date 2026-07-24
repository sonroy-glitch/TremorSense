import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  History,
  Settings2,
  UserRound,
  LogOut,
  Bell,
  ShieldCheck,
  LifeBuoy,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FloatingChatbot } from "./floating-chatbot";

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

const primaryNav: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "History", to: "/history", icon: History },
  { label: "Device Settings", to: "/settings", icon: Settings2 },
  { label: "Profile", to: "/profile", icon: UserRound },
];

const secondaryNav: NavItem[] = [
  { label: "Support", to: "/profile", icon: LifeBuoy },
  { label: "Privacy", to: "/profile", icon: ShieldCheck },
];

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-dvh w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex sticky top-0 h-dvh w-64 shrink-0 flex-col border-r border-border bg-sidebar px-3 py-6">
        <div className="mb-8 px-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">
              T
            </span>
            <div>
              <div className="text-base font-semibold tracking-tight">TremorSense</div>
              <div className="text-xs text-muted-foreground">Clinical health-tech</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-1">
          {primaryNav.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary border-l-4 border-primary pl-2"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-sidebar-border pt-4">
          {secondaryNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                to={item.to}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          {/* TODO(api): call POST /api/auth/logout */}
          <Link
            to="/sign-in"
            className="mt-2 flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            <LogOut className="h-5 w-5" />
            Log out
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-20 w-full items-center justify-between border-b border-border/60 bg-background/85 px-4 backdrop-blur md:px-10">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && (
              <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {actions}
            <Button variant="ghost" size="icon" aria-label="Notifications" className="rounded-full">
              <Bell className="h-5 w-5" />
            </Button>
            <Avatar className="h-10 w-10 border-2 border-primary/40">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">JD</AvatarFallback>
            </Avatar>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-10 md:py-8">{children}</main>
      </div>

      <FloatingChatbot />
    </div>
  );
}
