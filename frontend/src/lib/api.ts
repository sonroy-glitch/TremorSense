// Single entry point for every call to the TremorSense backend.
// Base URL comes from VITE_API_URL (see .env.example); it must be set in
// Vercel so the deployed app points at the Northflank service.

const BASE_URL = (import.meta.env["VITE_API_URL"] ?? "http://localhost:3004").replace(/\/$/, "");

const TOKEN_KEY = "ts:auth:token";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  cane_id: string;
}

export interface FogEpisode {
  id: string;
  cane_id: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  confidence: number | null;
  window_count: number | null;
  created_at: string;
}

export interface Overview {
  device: { cane_id: string; last_seen_at: string | null; online: boolean };
  today: {
    episodes: number;
    total_freeze_ms: number;
    longest_episode_ms: number;
    avg_episode_ms: number;
    active_ms: number;
    freeze_pct: number;
  };
  week: { episodes: number; series: { date: string; episodes: number }[] };
  hourly: { hour: number; label: string; episodes: number; freeze_ms: number; normal_ms: number }[];
}

export interface EpisodesResponse {
  range: string;
  episodes: FogEpisode[];
  stats: {
    count: number;
    total_freeze_ms: number;
    avg_episode_ms: number;
    longest_episode_ms: number;
  };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// sessionStorage/localStorage don't exist during SSR, so every access is guarded.
export const tokenStore = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Private browsing or a full quota — the session just won't persist.
    }
  },
  clear() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Nothing to do: if we can't write storage there's no token to remove.
    }
  },
};

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (auth) {
    const token = tokenStore.get();
    if (token) headers["authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(0, "Can't reach the TremorSense server. Check your connection.");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    // An expired or tampered token should drop the stale session rather than
    // leaving the app in a half-authenticated state.
    if (response.status === 401 && auth) tokenStore.clear();
    throw new ApiError(response.status, payload?.msg ?? `Request failed (${response.status})`);
  }
  return payload as T;
}

export const api = {
  signUp(input: { name: string; email: string; password: string; cane_id: string }) {
    return request<{ token: string; user: PublicUser }>("/auth/signup", {
      method: "POST",
      body: input,
      auth: false,
    });
  },
  signIn(input: { email: string; password: string }) {
    return request<{ token: string; user: PublicUser }>("/auth/signin", {
      method: "POST",
      body: input,
      auth: false,
    });
  },
  me() {
    return request<{ user: PublicUser }>("/auth/me");
  },
  updateMe(input: { name?: string; email?: string }) {
    return request<{ user: PublicUser }>("/auth/me", { method: "PATCH", body: input });
  },
  overview() {
    // The server needs the viewer's offset to decide what "today" means.
    const tz = -new Date().getTimezoneOffset();
    return request<Overview>(`/api/overview?tz=${tz}`);
  },
  episodes(range: "24h" | "7d" | "30d") {
    return request<EpisodesResponse>(`/api/episodes?range=${range}`);
  },
  askAssistant(user_question: string) {
    return request<{ assistant_message: string }>("/llm_bot", {
      method: "POST",
      body: { user_question },
    });
  },
  clearAssistant() {
    return request<{ msg: string }>("/llm_bot", { method: "DELETE" });
  },
};
