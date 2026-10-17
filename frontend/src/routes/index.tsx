import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, AlertTriangle, Clock, RefreshCw, Timer, Wifi, WifiOff } from "lucide-react";
import { api, type Overview } from "@/lib/api";
import { formatActiveTime, formatDuration, formatRelative, formatWeekday } from "@/lib/format";
import { EpisodeTable } from "@/components/episode-table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — TremorSense" },
      {
        name: "description",
        content:
          "Your TremorSense dashboard: freezing-of-gait episodes detected by your cane, when they happened, and how long they lasted.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const overview = useQuery({
    queryKey: ["overview"],
    queryFn: api.overview,
    // The cane uploads in batches when it finds internet, so a slow refetch
    // is enough to stay current.
    refetchInterval: 60_000,
  });

  const episodes = useQuery({
    queryKey: ["episodes", "24h"],
    queryFn: () => api.episodes("24h"),
  });

  return (
    <AppShell
      title="Dashboard"
      subtitle="Freezing-of-gait detection from your cane"
      actions={
        <Button
          variant="outline"
          className="hidden sm:inline-flex"
          onClick={() => {
            overview.refetch();
            episodes.refetch();
          }}
          disabled={overview.isFetching}
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", overview.isFetching && "animate-spin")} />
          Refresh
        </Button>
      }
    >
      <div className="space-y-6">
        {overview.isError ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Couldn't load your data: {(overview.error as Error).message}
            </CardContent>
          </Card>
        ) : null}

        <StatGrid data={overview.data} loading={overview.isLoading} />
        <DeviceStatusCard data={overview.data} loading={overview.isLoading} />
        <HourlyCard data={overview.data} loading={overview.isLoading} />
        <WeeklyCard data={overview.data} loading={overview.isLoading} />

        <EpisodeTable
          title="Episodes in the last 24 hours"
          episodes={episodes.data?.episodes ?? []}
          loading={episodes.isLoading}
        />
      </div>
    </AppShell>
  );
}

function StatGrid({ data, loading }: { data?: Overview; loading: boolean }) {
  const today = data?.today;
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Freeze episodes today"
        value={today ? String(today.episodes) : undefined}
        hint={data ? `${data.week.episodes} in the last 7 days` : undefined}
        icon={<AlertTriangle className="h-5 w-5" />}
        loading={loading}
      />
      <StatCard
        label="Time frozen today"
        value={today ? formatDuration(today.total_freeze_ms) : undefined}
        hint={today ? `${today.freeze_pct}% of time walking` : undefined}
        icon={<Timer className="h-5 w-5" />}
        loading={loading}
      />
      <StatCard
        label="Longest episode"
        value={today ? formatDuration(today.longest_episode_ms) : undefined}
        hint={today ? `${formatDuration(today.avg_episode_ms)} average` : undefined}
        icon={<Clock className="h-5 w-5" />}
        loading={loading}
      />
      <StatCard
        label="Time walking today"
        value={today ? formatActiveTime(today.active_ms) : undefined}
        hint="Signal classified by the cane"
        icon={<Activity className="h-5 w-5" />}
        loading={loading}
      />
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  loading,
}: {
  label: string;
  value?: string;
  hint?: string;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className="mt-3">
          {loading ? (
            <Skeleton className="h-10 w-24" />
          ) : (
            <span className="text-4xl font-bold tracking-tight tabular-nums">{value ?? "—"}</span>
          )}
        </div>
        {hint && !loading && (
          <p className="mt-2 text-xs font-medium text-muted-foreground">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}

function DeviceStatusCard({ data, loading }: { data?: Overview; loading: boolean }) {
  const device = data?.device;
  const online = device?.online ?? false;
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "grid h-12 w-12 place-items-center rounded-full",
              online ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
            )}
          >
            {online ? <Wifi className="h-6 w-6" /> : <WifiOff className="h-6 w-6" />}
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Cane {device?.cane_id ?? "—"}</div>
            {loading ? (
              <Skeleton className="mt-1 h-6 w-48" />
            ) : (
              <div className="text-lg font-semibold">
                {online ? "Syncing" : "Waiting for upload"}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  · last upload {formatRelative(device?.last_seen_at ?? null)}
                </span>
              </div>
            )}
          </div>
        </div>
        <p className="max-w-sm text-xs text-muted-foreground">
          The cane classifies your gait continuously and uploads detected episodes the next time it
          finds an internet connection.
        </p>
      </CardContent>
    </Card>
  );
}

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  fontSize: 12,
} as const;

function HourlyCard({ data, loading }: { data?: Overview; loading: boolean }) {
  const series = (data?.hourly ?? []).map((h) => ({
    label: h.label,
    episodes: h.episodes,
    frozenSeconds: Math.round(h.freeze_ms / 1000),
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Last 24 hours</CardTitle>
        <p className="text-sm text-muted-foreground">Seconds spent frozen, by hour of the day.</p>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="freezeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  interval={2}
                />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "var(--color-muted-foreground)" }}
                  formatter={(value: number, name) => [
                    name === "frozenSeconds" ? `${value}s frozen` : `${value} episodes`,
                    "",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="frozenSeconds"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  fill="url(#freezeFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function WeeklyCard({ data, loading }: { data?: Overview; loading: boolean }) {
  const series = (data?.week.series ?? []).map((d) => ({
    day: formatWeekday(d.date),
    episodes: d.episodes,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-lg">Weekly freeze episodes</CardTitle>
          <p className="text-sm text-muted-foreground">Episodes per day over the past 7 days.</p>
        </div>
        {data && (
          <Badge variant="secondary" className="text-[11px] font-semibold">
            {data.week.episodes} total
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="episodes"
                  fill="var(--color-primary)"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
