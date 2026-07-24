// Mock data for TremorSense UI.
// TODO(api): Replace with real fetches to backend telemetry endpoints, e.g.
//   GET /api/telemetry/summary
//   GET /api/telemetry/gait-stability?range=24h
//   GET /api/events?limit=50
//   GET /api/cues/effectiveness

export type CueType = "laser" | "metronome";

export interface FoGEvent {
  id: string;
  timestamp: string; // ISO
  leadTimeMs: number;
  cues: CueType[];
  outcome: "avoided" | "occurred" | "unreported";
}

export interface SummaryStats {
  episodesToday: number;
  avgLeadTimeSec: number;
  stepsToday: number;
  gaitStabilityScore: number;
  stabilityTrend: number; // +/- pct vs yesterday
}

export interface DeviceStatus {
  canedId: string;
  connected: boolean;
  batteryPct: number;
  lastSync: string; // ISO
  firmware: string;
}

export const summary: SummaryStats = {
  episodesToday: 4,
  avgLeadTimeSec: 12.5,
  stepsToday: 4820,
  gaitStabilityScore: 78,
  stabilityTrend: 4,
};

export const device: DeviceStatus = {
  canedId: "TS-4F2A-9C71",
  connected: true,
  batteryPct: 72,
  lastSync: new Date(Date.now() - 4 * 60_000).toISOString(),
  firmware: "v2.4.1",
};

// 24h gait stability timeline (hourly)
export const stabilityTimeline24h = Array.from({ length: 24 }).map((_, i) => {
  const base = 78 + Math.sin(i / 3) * 8 + (Math.random() - 0.5) * 6;
  const fog = [7, 11, 14, 18].includes(i);
  return {
    time: `${i.toString().padStart(2, "0")}:00`,
    score: Math.max(35, Math.min(98, Math.round(base - (fog ? 25 : 0)))),
    fog,
  };
});

// 7-day stability (daily avg)
export const stabilityTimeline7d = [
  { time: "Mon", score: 68, fog: false },
  { time: "Tue", score: 72, fog: true },
  { time: "Wed", score: 65, fog: true },
  { time: "Thu", score: 74, fog: false },
  { time: "Fri", score: 79, fog: true },
  { time: "Sat", score: 81, fog: false },
  { time: "Sun", score: 78, fog: true },
];

export const weeklyEpisodes = [
  { day: "Mon", episodes: 6 },
  { day: "Tue", episodes: 8 },
  { day: "Wed", episodes: 9 },
  { day: "Thu", episodes: 5 },
  { day: "Fri", episodes: 7 },
  { day: "Sat", episodes: 3 },
  { day: "Sun", episodes: 4 },
];

export const cueEffectiveness = [
  { cue: "Laser", success: 82, name: "laser" },
  { cue: "Metronome", success: 71, name: "metronome" },
];

export const recentEvents: FoGEvent[] = [
  {
    id: "evt_1",
    timestamp: new Date(Date.now() - 42 * 60_000).toISOString(),
    leadTimeMs: 14200,
    cues: ["laser"],
    outcome: "avoided",
  },
  {
    id: "evt_2",
    timestamp: new Date(Date.now() - 3 * 3600_000).toISOString(),
    leadTimeMs: 9800,
    cues: ["metronome"],
    outcome: "avoided",
  },
  {
    id: "evt_3",
    timestamp: new Date(Date.now() - 5 * 3600_000).toISOString(),
    leadTimeMs: 6100,
    cues: ["laser", "metronome"],
    outcome: "occurred",
  },
  {
    id: "evt_4",
    timestamp: new Date(Date.now() - 8 * 3600_000).toISOString(),
    leadTimeMs: 18400,
    cues: ["laser"],
    outcome: "avoided",
  },
  {
    id: "evt_5",
    timestamp: new Date(Date.now() - 22 * 3600_000).toISOString(),
    leadTimeMs: 11500,
    cues: ["metronome"],
    outcome: "unreported",
  },
];

// Extended history — used on /history
export const historyEvents: FoGEvent[] = [
  ...recentEvents,
  ...Array.from({ length: 25 }).map((_, i) => {
    const cues: CueType[][] = [["laser"], ["metronome"], ["laser", "metronome"], ["laser", "metronome"], ["laser", "metronome"]];
    const outcomes: FoGEvent["outcome"][] = ["avoided", "avoided", "avoided", "occurred", "unreported"];
    return {
      id: `evt_h_${i}`,
      timestamp: new Date(Date.now() - (i + 2) * 8 * 3600_000).toISOString(),
      leadTimeMs: 4000 + Math.round(Math.random() * 16000),
      cues: cues[i % cues.length],
      outcome: outcomes[i % outcomes.length],
    };
  }),
];
