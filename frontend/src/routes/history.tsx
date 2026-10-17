import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EpisodeTable } from "@/components/episode-table";
import { api } from "@/lib/api";
import { formatDuration } from "@/lib/format";

type Range = "24h" | "7d" | "30d";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — TremorSense" },
      {
        name: "description",
        content: "Full history of freezing-of-gait episodes detected by your cane.",
      },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const [range, setRange] = useState<Range>("7d");
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["episodes", range],
    queryFn: () => api.episodes(range),
  });

  const stats = data?.stats;

  return (
    <AppShell
      title="History"
      subtitle="Every freeze episode the cane detected."
      actions={
        <Select value={range} onValueChange={(value) => setRange(value as Range)}>
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
        {isError && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Couldn't load your history: {(error as Error).message}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MiniStat
            label="Episodes"
            value={stats ? String(stats.count) : undefined}
            loading={isLoading}
          />
          <MiniStat
            label="Total time frozen"
            value={stats ? formatDuration(stats.total_freeze_ms) : undefined}
            loading={isLoading}
          />
          <MiniStat
            label="Average episode"
            value={stats ? formatDuration(stats.avg_episode_ms) : undefined}
            loading={isLoading}
          />
          <MiniStat
            label="Longest episode"
            value={stats ? formatDuration(stats.longest_episode_ms) : undefined}
            loading={isLoading}
          />
        </div>

        <EpisodeTable title="Event log" episodes={data?.episodes ?? []} loading={isLoading} />
      </div>
    </AppShell>
  );
}

function MiniStat({ label, value, loading }: { label: string; value?: string; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-3xl font-bold tabular-nums">{value ?? "—"}</div>
        )}
      </CardContent>
    </Card>
  );
}
