import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, History, UserRound, LogOut, Loader2 } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FloatingChatbot } from "./floating-chatbot";
import { useAuth } from "@/lib/auth";

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

const primaryNav: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "History", to: "/history", icon: History },
  { label: "Profile", to: "/profile", icon: UserRound },
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { status, user, signOut } = useAuth();

  // Every page using AppShell is behind the login wall. The token lives in
  // localStorage, so the check has to happen on the client after mount.
  useEffect(() => {
    if (status === "anonymous") navigate({ to: "/sign-in" });
  }, [status, navigate]);

  if (status !== "authenticated") {
    return (
      <div className="grid min-h-dvh place-items-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const logOut = () => {
    signOut();
    queryClient.clear();
    navigate({ to: "/sign-in" });
  };

  const avatarInitials = user
    ? user.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
    : "";

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
          <button
            type="button"
            onClick={logOut}
            className="mt-2 flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            <LogOut className="h-5 w-5" />
            Log out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-20 w-full items-center justify-between border-b border-border/60 bg-background/85 px-4 backdrop-blur md:px-10">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            {actions}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Log out"
              className="rounded-full md:hidden"
              onClick={logOut}
            >
              <LogOut className="h-5 w-5" />
            </Button>
            <Link to="/profile" aria-label="Profile">
              <Avatar className="h-10 w-10 border-2 border-primary/40">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {avatarInitials}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </header>

        {/* Mobile nav — the sidebar is hidden below md. */}
        <nav className="flex gap-1 border-b border-border px-2 py-2 md:hidden">
          {primaryNav.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 px-4 py-6 md:px-10 md:py-8">{children}</main>
      </div>

      <FloatingChatbot />
    </div>
  );
}
