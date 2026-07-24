import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Music2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { device } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Device Settings — TremorSense" },
      { name: "description", content: "Tune sensitivity and cue preferences for your smart cane." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [sensitivity, setSensitivity] = useState([65]);
  const [cues, setCues] = useState({ laser: true, metronome: true });

  return (
    <AppShell title="Device settings" subtitle="Personalize how your TremorSense cane responds.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Prediction sensitivity</CardTitle>
            <p className="text-sm text-muted-foreground">
              Higher values predict FoG earlier but may trigger more false alerts.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-xl border border-border bg-secondary/40 p-5">
              <div className="mb-4 flex items-baseline justify-between">
                <span className="text-sm font-medium text-muted-foreground">Threshold</span>
                <span className="text-3xl font-bold tabular-nums">{sensitivity[0]}</span>
              </div>
              {/* TODO(api): PATCH /api/device/settings { sensitivity } */}
              <Slider
                value={sensitivity}
                onValueChange={setSensitivity}
                min={0}
                max={100}
                step={5}
                aria-label="Prediction sensitivity"
              />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>Conservative</span>
                <span>Balanced</span>
                <span>Aggressive</span>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Cue preferences
              </h3>
              <div className="space-y-2">
                <CueToggle
                  icon={<Lightbulb className="h-5 w-5" />}
                  label="Laser line"
                  description="Projects a visual line to step over."
                  checked={cues.laser}
                  onChange={(v) => setCues((c) => ({ ...c, laser: v }))}
                />
                <CueToggle
                  icon={<Music2 className="h-5 w-5" />}
                  label="Metronome"
                  description="Steady auditory beat to pace steps."
                  checked={cues.metronome}
                  onChange={(v) => setCues((c) => ({ ...c, metronome: v }))}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() =>
                  toast.success("Settings saved", { description: "Your cane will sync momentarily." })
                }
              >
                Save changes
              </Button>
              <Button
                variant="outline"
                onClick={() => toast("Recalibration started", { description: "Walk 20 steps on a flat surface." })}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Recalibrate cane
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paired device</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Cane ID" value={<span className="font-mono">{device.canedId}</span>} />
            <Row
              label="Status"
              value={
                <Badge className="bg-success/15 text-success hover:bg-success/15">
                  {device.connected ? "Connected" : "Offline"}
                </Badge>
              }
            />
            <Row label="Battery" value={`${device.batteryPct}%`} />
            <Row label="Firmware" value={device.firmware} />
            <Row label="Last sync" value="4 minutes ago" />
            <Button variant="outline" className="mt-3 w-full">
              Unpair device
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function CueToggle({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = `toggle-${label}`;
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 hover:bg-accent/40"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <div>
          <div className="font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
