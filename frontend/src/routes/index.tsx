import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BatteryMedium,
  CheckCircle2,
  Footprints,
  Lightbulb,
  Music2,
  Radio,
  RefreshCw,
  Timer,
  Wifi,
  WifiOff,
  AlertTriangle,
} from "lucide-react";
import {
  cueEffectiveness,
  device,
  recentEvents,
  stabilityTimeline24h,
  stabilityTimeline7d,
  summary,
  weeklyEpisodes,
  type CueType,
  type FoGEvent,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — TremorSense" },
      {
        name: "description",
        content:
          "Your live TremorSense dashboard: FoG predictions, gait stability, cue effectiveness, and recent events from your smart cane.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <AppShell
      title="Dashboard"
      subtitle="Patient monitoring · John Doe"
      actions={
        <Button variant="outline" className="hidden sm:inline-flex" aria-label="Sync now">
          <RefreshCw className="mr-2 h-4 w-4" /> Sync now
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Top summary + device */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="FoG episodes today"
            value={summary.episodesToday.toString()}
            trend={{ text: "-12% vs yesterday", tone: "success" }}
            icon={<AlertTriangle className="h-5 w-5" />}
          />
          <StatCard
            label="Avg. lead time"
            value={`${summary.avgLeadTimeSec}s`}
            trend={{ text: "+1.2s improvement", tone: "success" }}
            icon={<Timer className="h-5 w-5" />}
          />
          <StatCard
            label="Steps today"
            value={summary.stepsToday.toLocaleString()}
            trend={{ text: "82% of daily goal", tone: "neutral" }}
            icon={<Footprints className="h-5 w-5" />}
          />
          <StatCard
            label="Gait stability"
            value={`${summary.gaitStabilityScore}`}
            suffix="/100"
            trend={{ text: `+${summary.stabilityTrend}% today`, tone: "success" }}
            icon={<Activity className="h-5 w-5" />}
          />
        </section>

        {/* Device status */}
        <DeviceStatusCard />

        {/* Timeline */}
        <StabilityTimelineCard />

        {/* Weekly + cue effectiveness */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <WeeklyTrendCard />
          <CueEffectivenessCard />
        </section>

        {/* Event log */}
        <EventLogCard events={recentEvents} />
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  suffix,
  trend,
  icon,
}: {
  label: string;
  value: string;
  suffix?: string;
  trend: { text: string; tone: "success" | "warn" | "neutral" };
  icon: React.ReactNode;
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
        <div className="mt-3 flex items-end justify-between gap-2">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight tabular-nums">{value}</span>
            {suffix && (
              <span className="text-lg font-medium text-muted-foreground">{suffix}</span>
            )}
          </div>
          <Badge
            variant="secondary"
            className={cn(
              "text-[11px] font-semibold",
              trend.tone === "success" && "bg-success/15 text-success",
              trend.tone === "warn" && "bg-warn/20 text-warn",
              trend.tone === "neutral" && "bg-muted text-muted-foreground",
            )}
          >
            {trend.text}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function DeviceStatusCard() {
  const minsAgo = Math.max(1, Math.round((Date.now() - new Date(device.lastSync).getTime()) / 60_000));
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "grid h-12 w-12 place-items-center rounded-full",
              device.connected ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
            )}
          >
            {device.connected ? <Wifi className="h-6 w-6" /> : <WifiOff className="h-6 w-6" />}
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Cane {device.canedId}</div>
            <div className="text-lg font-semibold">
              {device.connected ? "Connected" : "Offline"}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                · synced {minsAgo}m ago · fw {device.firmware}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <BatteryMedium className="h-5 w-5 text-muted-foreground" />
            <div className="w-32">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Battery</span>
                <span className="font-semibold tabular-nums text-foreground">{device.batteryPct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    device.batteryPct > 30 ? "bg-primary" : "bg-warn",
                  )}
                  style={{ width: `${device.batteryPct}%` }}
                />
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            <Radio className="h-3.5 w-3.5" /> Live signal
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StabilityTimelineCard() {
  const [range, setRange] = useState<"24h" | "7d">("24h");
  const data = range === "24h" ? stabilityTimeline24h : stabilityTimeline7d;
  const fogPoints = data.filter((d) => d.fog);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-lg">Gait stability timeline</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Red markers show predicted FoG events where a cue was triggered.
          </p>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as "24h" | "7d")}>
          <TabsList>
            <TabsTrigger value="24h">24h</TabsTrigger>
            <TabsTrigger value="7d">7 days</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="stabilityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="time" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={32} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--color-muted-foreground)" }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                fill="url(#stabilityFill)"
              />
              {fogPoints.map((p) => (
                <ReferenceDot
                  key={p.time}
                  x={p.time}
                  y={p.score}
                  r={6}
                  fill="var(--color-destructive)"
                  stroke="var(--color-background)"
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function WeeklyTrendCard() {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Weekly FoG episodes</CardTitle>
        <p className="text-sm text-muted-foreground">Episodes per day over the past 7 days.</p>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyEpisodes} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={28} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="episodes" fill="var(--color-primary)" radius={[8, 8, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function CueEffectivenessCard() {
  const total = cueEffectiveness.reduce((s, d) => s + d.success, 0);
  const colors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)"];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Cue effectiveness</CardTitle>
        <p className="text-sm text-muted-foreground">Success rate by cue type.</p>
      </CardHeader>
      <CardContent>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={cueEffectiveness}
                dataKey="success"
                nameKey="cue"
                innerRadius={44}
                outerRadius={72}
                paddingAngle={3}
                stroke="var(--color-card)"
                strokeWidth={2}
              >
                {cueEffectiveness.map((_, i) => (
                  <Cell key={i} fill={colors[i]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 space-y-2">
          {cueEffectiveness.map((c, i) => (
            <div key={c.cue} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: colors[i] }} />
                {c.cue}
              </span>
              <span className="font-semibold tabular-nums">{Math.round((c.success / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function EventLogCard({ events, title = "Recent events" }: { events: FoGEvent[]; title?: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">Predicted FoG events and how the cane responded.</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Lead time</TableHead>
                <TableHead>Cues triggered</TableHead>
                <TableHead>Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <EventRow key={e.id} e={e} />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function EventRow({ e }: { e: FoGEvent }) {
  const when = useMemo(() => formatWhen(e.timestamp), [e.timestamp]);
  return (
    <TableRow>
      <TableCell className="text-sm">{when}</TableCell>
      <TableCell className="font-semibold tabular-nums">
        {(e.leadTimeMs / 1000).toFixed(1)}s
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1.5">
          {e.cues.map((c) => (
            <CueBadge key={c} cue={c} />
          ))}
        </div>
      </TableCell>
      <TableCell>
        <OutcomeBadge outcome={e.outcome} />
      </TableCell>
    </TableRow>
  );
}

function CueBadge({ cue }: { cue: CueType }) {
  const map: Record<CueType, { icon: React.ReactNode; label: string }> = {
    laser: { icon: <Lightbulb className="h-3 w-3" />, label: "Laser" },
    metronome: { icon: <Music2 className="h-3 w-3" />, label: "Metronome" },
  };
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
      {map[cue].icon}
      {map[cue].label}
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome: FoGEvent["outcome"] }) {
  if (outcome === "avoided")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
        <CheckCircle2 className="h-3.5 w-3.5" /> Freeze avoided
      </span>
    );
  if (outcome === "occurred")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-semibold text-destructive">
        <AlertTriangle className="h-3.5 w-3.5" /> Freeze occurred
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      Unreported
    </span>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
