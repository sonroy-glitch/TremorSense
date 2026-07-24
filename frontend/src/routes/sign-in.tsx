import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/sign-in")({
  head: () => ({
    meta: [
      { title: "Sign in — TremorSense" },
      { name: "description", content: "Sign in to your TremorSense dashboard." },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!email) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email.";
    if (!password) next.password = "Password is required.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    // TODO(api): POST /api/auth/sign-in { email, password }
    setTimeout(() => {
      setLoading(false);
      if (password === "wrong") {
        toast.error("Invalid credentials", { description: "Check your email and password." });
        return;
      }
      toast.success("Welcome back");
      navigate({ to: "/" });
    }, 900);
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to check on your gait and today's insights.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" error={errors.email} htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-12 text-base"
            aria-invalid={!!errors.email}
          />
        </Field>
        <Field label="Password" error={errors.password} htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            className="h-12 text-base"
            aria-invalid={!!errors.password}
          />
        </Field>
        <div className="flex justify-end">
          <Link to="/sign-in" className="text-sm font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="h-12 w-full text-base" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign in
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          New to TremorSense?{" "}
          <Link to="/sign-up" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export function Field({
  label,
  error,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </Label>
        {hint}
      </div>
      {children}
      {error && <p className="mt-1.5 text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
