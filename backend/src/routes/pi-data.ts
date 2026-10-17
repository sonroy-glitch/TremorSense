import { Router, type Request, type Response } from "express";
import { prisma } from "../../prisma/client.js";
import { requirePiKey } from "../auth.js";

export const piDataRouter = Router();

interface EpisodePayload {
  started_at: string;
  ended_at: string;
  duration_ms?: number;
  confidence?: number;
  window_count?: number;
}

interface RollupPayload {
  hour_start: string;
  normal_ms?: number;
  freeze_ms?: number;
  episode_count?: number;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clampInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

/**
 * The cane's only write endpoint. The Pi batches whatever it buffered while
 * offline and POSTs it once connectivity returns, so this accepts arrays and is
 * idempotent: episodes upsert on (cane_id, started_at) and rollups upsert on
 * (cane_id, hour_start), letting the Pi retry a batch safely.
 *
 *   POST /pi_data
 *   x-api-key: <PI_INGEST_KEY>
 *   {
 *     "cane_id": "TS-4F2A-9C71",
 *     "episodes": [{ "started_at": "...", "ended_at": "...", "duration_ms": 8000,
 *                    "confidence": 0.91, "window_count": 4 }],
 *     "rollups":  [{ "hour_start": "...", "normal_ms": 3480000, "freeze_ms": 8000,
 *                    "episode_count": 1 }]
 *   }
 */
piDataRouter.post("/pi_data", requirePiKey, async (req: Request, res: Response) => {
  const cane_id = String(req.body?.cane_id ?? "").trim().toUpperCase();
  const episodes: EpisodePayload[] = Array.isArray(req.body?.episodes) ? req.body.episodes : [];
  const rollups: RollupPayload[] = Array.isArray(req.body?.rollups) ? req.body.rollups : [];

  if (!cane_id) return res.status(400).json({ msg: "cane_id is required" });
  if (episodes.length === 0 && rollups.length === 0)
    return res.status(400).json({ msg: "Nothing to record: send episodes and/or rollups" });
  if (episodes.length > 500 || rollups.length > 500)
    return res.status(413).json({ msg: "Batch too large: send at most 500 of each per request" });

  try {
    // A cane only exists once its owner has signed up with that ID. Reject
    // unknown canes loudly so the Pi keeps buffering instead of dropping data.
    const owner = await prisma.user.findUnique({ where: { cane_id } });
    if (!owner) return res.status(404).json({ msg: `No account is paired with cane ${cane_id}` });

    const episodeRows = [];
    for (const raw of episodes) {
      const started_at = parseDate(raw.started_at);
      const ended_at = parseDate(raw.ended_at);
      if (!started_at || !ended_at) {
        return res.status(400).json({ msg: "Each episode needs ISO started_at and ended_at" });
      }
      const duration_ms = raw.duration_ms
        ? clampInt(raw.duration_ms)
        : Math.max(0, ended_at.getTime() - started_at.getTime());
      const confidence = Number.isFinite(Number(raw.confidence)) ? Number(raw.confidence) : null;
      episodeRows.push({
        cane_id,
        started_at,
        ended_at,
        duration_ms,
        confidence,
        window_count: raw.window_count === undefined ? null : clampInt(raw.window_count),
      });
    }

    const rollupRows = [];
    for (const raw of rollups) {
      const hour_start = parseDate(raw.hour_start);
      if (!hour_start) return res.status(400).json({ msg: "Each rollup needs an ISO hour_start" });
      hour_start.setUTCMinutes(0, 0, 0);
      rollupRows.push({
        cane_id,
        hour_start,
        normal_ms: clampInt(raw.normal_ms),
        freeze_ms: clampInt(raw.freeze_ms),
        episode_count: clampInt(raw.episode_count),
      });
    }

    await prisma.$transaction([
      ...episodeRows.map((row) =>
        prisma.fog_episode.upsert({
          where: { cane_id_started_at: { cane_id: row.cane_id, started_at: row.started_at } },
          create: row,
          update: row,
        }),
      ),
      ...rollupRows.map((row) =>
        prisma.gait_rollup.upsert({
          where: { cane_id_hour_start: { cane_id: row.cane_id, hour_start: row.hour_start } },
          create: row,
          update: row,
        }),
      ),
    ]);

    return res.status(200).json({
      msg: "Data recorded",
      episodes_recorded: episodeRows.length,
      rollups_recorded: rollupRows.length,
    });
  } catch (error) {
    console.error("POST /pi_data failed", error);
    return res.status(500).json({ msg: "Internal server error" });
  }
});
