import type { ReactNode } from "react";
import { Activity, ShieldCheck, Waves } from "lucide-react";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh w-full lg:grid-cols-2 bg-background">
      {/* Left: form */}
      <div className="flex items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
              T
            </span>
            <div>
              <div className="text-lg font-semibold tracking-tight">TremorSense</div>
              <div className="text-xs text-muted-foreground">Clinical health-tech</div>
            </div>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>

      {/* Right: hero */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary/15 via-primary/5 to-background lg:block">
        <div className="absolute inset-0" aria-hidden="true">
          <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <CaneSignalGraphic />
          </div>
        </div>
        <div className="relative z-10 flex h-full flex-col justify-end p-12">
          <div className="max-w-md rounded-2xl border border-border/60 bg-card/80 p-6 backdrop-blur">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Activity className="h-3.5 w-3.5" /> Predictive gait companion
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">
              Freeze episodes, forecast before they happen.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              TremorSense senses subtle changes in your stride and cues you seconds before a
              Freezing of Gait event — so you can walk, pause, and turn with confidence.
            </p>
            <div className="mt-5 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" /> HIPAA-ready
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Waves className="h-4 w-4 text-primary" /> Real-time signals
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CaneSignalGraphic() {
  return (
    <svg width="360" height="360" viewBox="0 0 360 360" fill="none" aria-hidden="true">
      {/* Signal waves */}
      {[1, 2, 3].map((r, i) => (
        <circle
          key={r}
          cx="180"
          cy="180"
          r={70 + i * 40}
          stroke="currentColor"
          className="text-primary/30"
          strokeWidth="1.5"
          strokeDasharray="4 6"
        />
      ))}
      {/* Cane */}
      <g className="text-primary">
        <path
          d="M200 90 C 200 90, 240 90, 240 130 L240 260 C 240 275, 220 275, 220 260 L 220 130 C 220 110, 200 110, 200 130 L 200 250"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="200" cy="255" r="10" fill="currentColor" />
      </g>
      {/* Waveform */}
      <path
        d="M60 300 Q 90 260, 120 300 T 180 300 T 240 300 T 300 300"
        stroke="currentColor"
        className="text-primary"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
