import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { device } from "@/lib/mock-data";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — TremorSense" },
      { name: "description", content: "Manage your TremorSense account and preferences." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
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
                  JD
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-lg font-semibold">John Doe</div>
                <div className="text-sm text-muted-foreground">Patient · joined Mar 2025</div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name" className="text-sm font-medium">Full name</Label>
                <Input id="name" defaultValue="John Doe" className="mt-1.5 h-11" />
              </div>
              <div>
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input id="email" type="email" defaultValue="john.doe@example.com" className="mt-1.5 h-11" />
              </div>
              <div>
                <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
                <Input id="phone" defaultValue="+1 (555) 010-2244" className="mt-1.5 h-11" />
              </div>
              <div>
                <Label htmlFor="clinician" className="text-sm font-medium">Clinician</Label>
                <Input id="clinician" defaultValue="Dr. A. Patel · Movement Disorders Clinic" className="mt-1.5 h-11" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              {/* TODO(api): PATCH /api/user/profile */}
              <Button onClick={() => toast.success("Profile updated")}>Save changes</Button>
              <Button variant="outline">Change password</Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Paired cane</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cane ID</span>
                <span className="font-mono font-medium">{device.canedId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Firmware</span>
                <span className="font-medium">{device.firmware}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Battery</span>
                <span className="font-medium">{device.batteryPct}%</span>
              </div>
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
                  // TODO(api): POST /api/auth/logout
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
