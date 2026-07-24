import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { Field } from "./sign-in";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const Route = createFileRoute("/sign-up")({
  head: () => ({
    meta: [
      { title: "Create account — TremorSense" },
      {
        name: "description",
        content: "Create your TremorSense account and pair your smart cane.",
      },
    ],
  }),
  component: SignUpPage,
});

const CANE_ID_RE = /^TS-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function scorePassword(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s; // 0-4
}

function SignUpPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", confirm: "", caneId: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const strength = scorePassword(form.password);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.email) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email.";
    if (!form.password) next.password = "Choose a password.";
    else if (strength < 3) next.password = "Use 8+ chars with a letter, number, and symbol.";
    if (form.confirm !== form.password) next.confirm = "Passwords don't match.";
    if (!form.caneId) next.caneId = "Cane ID is required.";
    else if (!CANE_ID_RE.test(form.caneId.trim().toUpperCase()))
      next.caneId = "Format: TS-XXXX-XXXX (letters & numbers).";
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    // TODO(api): POST /api/auth/sign-up { email, password, caneId }
    setTimeout(() => {
      setLoading(false);
      if (form.caneId.trim().toUpperCase() === "TS-0000-0000") {
        toast.error("Cane ID not recognized", {
          description: "Check the ID printed on the base of your cane.",
        });
        return;
      }
      toast.success("Account created", { description: "Your cane is paired and syncing." });
      navigate({ to: "/" });
    }, 1100);
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Pair your TremorSense cane and start seeing predictive gait insights."
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" error={errors.email} htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
            placeholder="you@example.com"
            className="h-12 text-base"
          />
        </Field>
        <Field label="Password" error={errors.password} htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            placeholder="At least 8 characters"
            className="h-12 text-base"
          />
          {form.password && (
            <div className="mt-2 flex gap-1" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    i < strength
                      ? strength <= 2
                        ? "bg-warn"
                        : "bg-success"
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>
          )}
        </Field>
        <Field label="Confirm password" error={errors.confirm} htmlFor="confirm">
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={set("confirm")}
            placeholder="Re-enter your password"
            className="h-12 text-base"
          />
        </Field>
        <Field
          label="Cane ID"
          error={errors.caneId}
          htmlFor="caneId"
          hint={
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Where do I find my Cane ID?"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  This is printed on the base of your TremorSense cane. Format:
                  <br />
                  <span className="font-mono">TS-XXXX-XXXX</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          }
        >
          <Input
            id="caneId"
            value={form.caneId}
            onChange={set("caneId")}
            placeholder="TS-4F2A-9C71"
            className="h-12 text-base font-mono uppercase"
            autoCapitalize="characters"
          />
        </Field>

        <Button type="submit" className="h-12 w-full text-base" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create account
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/sign-in" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
