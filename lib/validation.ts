import { z } from "zod";

/**
 * Shared auth validation — one source of truth for the API route AND the
 * client form, so the rules can never drift apart.
 */

// Normalise email once: trim + lowercase so "Foo@X.com " and "foo@x.com"
// are the same account.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address");

// bcrypt only hashes the first 72 BYTES — anything longer is silently
// truncated, which is a real security footgun. We cap length explicitly and
// require a mix of character classes.
export const PASSWORD_MAX = 72;

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters`)
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[0-9]/, "Add a number");

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name"),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Client-side strength meter (0–4). Not a security control — the server
 * schema is authoritative — just UX feedback while typing.
 */
export function passwordStrength(pw: string): {
  score: number;
  label: string;
  checks: { length: boolean; lower: boolean; upper: boolean; number: boolean; special: boolean };
} {
  const checks = {
    length: pw.length >= 8,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  // Map 0–5 passed checks onto a 0–4 score.
  const score = pw.length === 0 ? 0 : Math.min(4, Math.max(1, passed - 1));
  const label = ["", "Weak", "Fair", "Good", "Strong"][score];
  return { score, label, checks };
}
