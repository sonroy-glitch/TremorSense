import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — TremorSense" },
      { name: "description", content: "Manage your TremorSense account and paired cane." },
    ],
  }),
  component: ProfilePage,
});

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, setUser, signOut } = useAuth();
  const [form, setForm] = useState({ name: "", email: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) setForm({ name: user.name, email: user.email });
  }, [user]);

  const dirty = !!user && (form.name !== user.name || form.email !== user.email);

  const save = async () => {
    setSaving(true);
    try {
      const { user: updated } = await api.updateMe({ name: form.name, email: form.email });
      setUser(updated);
      toast.success("Profile updated");
    } catch (error) {
      toast.error("Couldn't save your profile", { description: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Profile" subtitle="Your account and paired cane.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-primary/40">
                <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                  {user ? initials(user.name) : "—"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-lg font-semibold">{user?.name ?? "—"}</div>
                <div className="text-sm text-muted-foreground">{user?.email ?? ""}</div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name" className="text-sm font-medium">
                  Full name
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1.5 h-11"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1.5 h-11"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={save} disabled={!dirty || saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Paired cane</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cane ID</span>
                <span className="font-mono font-medium">{user?.cane_id ?? "—"}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                This ID is configured on the cane's Raspberry Pi and is how its uploads are matched
                to your account.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  signOut();
                  // Drop cached telemetry so the next account doesn't briefly
                  // see the previous one's numbers.
                  queryClient.clear();
                  toast("Signed out");
                  navigate({ to: "/sign-in" });
                }}
              >
                <LogOut className="mr-2 h-4 w-4" /> Log out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
