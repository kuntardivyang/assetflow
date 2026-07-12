"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { signupSchema, passwordStrength } from "@/lib/validation";

const STRENGTH_COLORS = ["", "bg-danger", "bg-warning", "bg-blue-500", "bg-success"];

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => passwordStrength(form.password), [form.password]);
  const mismatch = form.confirm.length > 0 && form.confirm !== form.password;

  function update(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validate against the same schema the server uses.
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create account");
      setLoading(false);
      return;
    }
    await signIn("credentials", {
      email: parsed.data.email,
      password: form.password,
      redirect: false,
    });
    router.push("/dashboard");
    router.refresh();
  }

  const reqs = [
    { ok: strength.checks.length, label: "8+ characters" },
    { ok: strength.checks.upper, label: "Uppercase letter" },
    { ok: strength.checks.lower, label: "Lowercase letter" },
    { ok: strength.checks.number, label: "Number" },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
            AF
          </div>
          <h1 className="text-xl font-semibold">Create your account</h1>
          <p className="text-center text-xs text-muted-foreground">
            Sign up creates an employee account — admin roles are assigned later.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={form.name} onChange={update("name")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@company.com"
              value={form.email}
              onChange={update("email")}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={show ? "text" : "password"}
                placeholder="At least 8 characters"
                value={form.password}
                onChange={update("password")}
                className="pr-9"
                required
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {form.password.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-1.5 flex-1 gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-full flex-1 rounded-full",
                          i <= strength.score ? STRENGTH_COLORS[strength.score] : "bg-muted",
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{strength.label}</span>
                </div>
                <ul className="grid grid-cols-2 gap-1">
                  {reqs.map((r) => (
                    <li key={r.label} className={cn("flex items-center gap-1 text-xs", r.ok ? "text-success" : "text-muted-foreground")}>
                      {r.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {r.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type={show ? "text" : "password"}
              value={form.confirm}
              onChange={update("confirm")}
              className={cn(mismatch && "border-danger focus-visible:ring-danger")}
              required
            />
            {mismatch && <p className="text-xs text-danger">Passwords do not match</p>}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating…" : "Create Account"}
          </Button>
        </form>

        <div className="mt-6 border-t border-border pt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
