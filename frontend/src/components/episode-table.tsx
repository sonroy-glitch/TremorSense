import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";
import type { FogEpisode } from "@/lib/api";
import { formatDuration, formatRelative, formatTimestamp } from "@/lib/format";

/**
 * Event log of detected freeze episodes. The cane's model emits two classes
 * (1 = normal, 2 = freeze) and only class 2 is ever stored, so every row here
 * is a freeze — there is no outcome or cue column to show.
 */
export function EpisodeTable({
  episodes,
  title = "Episodes",
  loading = false,
}: {
  episodes: FogEpisode[];
  title?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Each row is one detected freezing-of-gait episode.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : episodes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm font-medium">No freeze episodes recorded</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Either none were detected in this period, or the cane hasn't uploaded yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {episodes.map((episode) => (
                  <TableRow key={episode.id}>
                    <TableCell className="text-sm">{formatRelative(episode.started_at)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTimestamp(episode.started_at)}
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {formatDuration(episode.duration_ms)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {episode.confidence === null
                        ? "—"
                        : `${Math.round(episode.confidence * 100)}%`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
