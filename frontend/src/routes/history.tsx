import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { historyEvents } from "@/lib/mock-data";
import { EventLogCard } from "./index";
import { useState } from "react";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — TremorSense" },
      { name: "description", content: "Full history of predicted Freezing of Gait events." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const [range, setRange] = useState("7d");
  // TODO(api): GET /api/events?range={range}
  const filtered =
    range === "24h"
      ? historyEvents.slice(0, 6)
      : range === "7d"
        ? historyEvents.slice(0, 18)
        : historyEvents;

  return (
    <AppShell
      title="History"
      subtitle="Every predicted freeze, every cue, every outcome."
      actions={
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MiniStat label="Events" value={filtered.length.toString()} />
          <MiniStat label="Freezes avoided" value={filtered.filter((e) => e.outcome === "avoided").length.toString()} />
          <MiniStat label="Freezes occurred" value={filtered.filter((e) => e.outcome === "occurred").length.toString()} />
          <MiniStat
            label="Avg lead time"
            value={`${(filtered.reduce((s, e) => s + e.leadTimeMs, 0) / filtered.length / 1000).toFixed(1)}s`}
          />
        </div>
        <EventLogCard events={filtered} title="Event log" />
      </div>
    </AppShell>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
