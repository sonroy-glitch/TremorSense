import { Router, type Request, type Response } from "express";
import { prisma } from "../../prisma/client.js";
import { authedUser, requireAuth } from "../auth.js";

export const telemetryRouter = Router();

const RANGES = { "24h": 1, "7d": 7, "30d": 30 } as const;
type Range = keyof typeof RANGES;

function parseRange(value: unknown): Range {
  return typeof value === "string" && value in RANGES ? (value as Range) : "7d";
}

/**
 * Minutes to add to UTC to reach the viewer's local time. The browser sends
 * `-new Date().getTimezoneOffset()`, so "today" means the user's calendar day
 * rather than the server's.
 */
function parseTzOffset(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= 14 * 60 ? n : 0;
}

/** Start of the viewer's local day, expressed as a real UTC instant. */
function startOfLocalDay(tzOffsetMinutes: number, daysAgo = 0): Date {
  const shifted = new Date(Date.now() + tzOffsetMinutes * 60_000);
  shifted.setUTCHours(0, 0, 0, 0);
  shifted.setUTCDate(shifted.getUTCDate() - daysAgo);
  return new Date(shifted.getTime() - tzOffsetMinutes * 60_000);
}

function localDayKey(date: Date, tzOffsetMinutes: number): string {
  return new Date(date.getTime() + tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

function localHour(date: Date, tzOffsetMinutes: number): number {
  return new Date(date.getTime() + tzOffsetMinutes * 60_000).getUTCHours();
}

/**
 * Everything the dashboard renders, in one request. Every number here is
 * derived from what the cane actually uploads — freeze episodes and hourly
 * activity totals — so there is nothing to invent on the client.
 */
telemetryRouter.get("/overview", requireAuth, async (req: Request, res: Response) => {
  const { cane_id } = authedUser(req);
  const tz = parseTzOffset(req.query["tz"]);

  try {
    const todayStart = startOfLocalDay(tz);
    const weekStart = startOfLocalDay(tz, 6); // today plus the previous 6 days
    const dayAgo = new Date(Date.now() - 24 * 3600_000);

    const [weekEpisodes, dayRollups, lastEpisode, lastRollup] = await Promise.all([
      prisma.fog_episode.findMany({
        where: { cane_id, started_at: { gte: weekStart } },
        orderBy: { started_at: "asc" },
      }),
      prisma.gait_rollup.findMany({
        where: { cane_id, hour_start: { gte: dayAgo } },
        orderBy: { hour_start: "asc" },
      }),
      prisma.fog_episode.findFirst({ where: { cane_id }, orderBy: { started_at: "desc" } }),
      prisma.gait_rollup.findFirst({ where: { cane_id }, orderBy: { hour_start: "desc" } }),
    ]);

    const todayEpisodes = weekEpisodes.filter((e) => e.started_at >= todayStart);
    const todayFreezeMs = todayEpisodes.reduce((sum, e) => sum + e.duration_ms, 0);
    const todayRollups = dayRollups.filter((r) => r.hour_start >= todayStart);
    const todayNormalMs = todayRollups.reduce((sum, r) => sum + r.normal_ms, 0);
    const todayActiveMs = todayNormalMs + todayFreezeMs;

    // The cane only reports when it has something to report, so "last seen" is
    // the newest of either stream.
    const lastSeenAt =
      [lastEpisode?.created_at, lastRollup?.updated_at]
        .filter((d): d is Date => !!d)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    const dayBuckets = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      dayBuckets.set(localDayKey(startOfLocalDay(tz, i), tz), 0);
    }
    for (const episode of weekEpisodes) {
      const key = localDayKey(episode.started_at, tz);
      if (dayBuckets.has(key)) dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + 1);
    }

    const hourly = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      episodes: 0,
      freeze_ms: 0,
      normal_ms: 0,
    }));
    for (const rollup of dayRollups) {
      const bucket = hourly[localHour(rollup.hour_start, tz)];
      if (!bucket) continue;
      bucket.freeze_ms += rollup.freeze_ms;
      bucket.normal_ms += rollup.normal_ms;
    }
    for (const episode of weekEpisodes) {
      if (episode.started_at < dayAgo) continue;
      const bucket = hourly[localHour(episode.started_at, tz)];
      if (bucket) bucket.episodes += 1;
    }

    return res.status(200).json({
      device: {
        cane_id,
        last_seen_at: lastSeenAt,
        // The Pi uploads on a schedule, so treat a quiet half hour as offline.
        online: !!lastSeenAt && Date.now() - lastSeenAt.getTime() < 30 * 60_000,
      },
      today: {
        episodes: todayEpisodes.length,
        total_freeze_ms: todayFreezeMs,
        longest_episode_ms: todayEpisodes.reduce((max, e) => Math.max(max, e.duration_ms), 0),
        avg_episode_ms: todayEpisodes.length
          ? Math.round(todayFreezeMs / todayEpisodes.length)
          : 0,
        active_ms: todayActiveMs,
        freeze_pct: todayActiveMs ? Number(((todayFreezeMs / todayActiveMs) * 100).toFixed(1)) : 0,
      },
      week: {
        episodes: weekEpisodes.length,
        series: Array.from(dayBuckets, ([date, episodes]) => ({ date, episodes })),
      },
      hourly,
    });
  } catch (error) {
    console.error("GET /api/overview failed", error);
    return res.status(500).json({ msg: "Internal server error" });
  }
});

/** Paged event log for /history. */
telemetryRouter.get("/episodes", requireAuth, async (req: Request, res: Response) => {
  const { cane_id } = authedUser(req);
  const range = parseRange(req.query["range"]);
  const limitParam = Number(req.query["limit"]);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 200;
  const since = new Date(Date.now() - RANGES[range] * 24 * 3600_000);

  try {
    const episodes = await prisma.fog_episode.findMany({
      where: { cane_id, started_at: { gte: since } },
      orderBy: { started_at: "desc" },
      take: limit,
    });

    const totalMs = episodes.reduce((sum, e) => sum + e.duration_ms, 0);
    return res.status(200).json({
      range,
      episodes,
      stats: {
        count: episodes.length,
        total_freeze_ms: totalMs,
        avg_episode_ms: episodes.length ? Math.round(totalMs / episodes.length) : 0,
        longest_episode_ms: episodes.reduce((max, e) => Math.max(max, e.duration_ms), 0),
      },
    });
  } catch (error) {
    console.error("GET /api/episodes failed", error);
    return res.status(500).json({ msg: "Internal server error" });
  }
});
