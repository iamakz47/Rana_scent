import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(254));

// Matches supabase/config.toml: 10+ characters, upper, lower and a digit.
// Set the same policy in the hosted project (Auth → Providers → Email).
export const passwordSchema = z
  .string()
  .min(10)
  .max(72)
  .regex(/[a-z]/)
  .regex(/[A-Z]/)
  .regex(/[0-9]/);

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
  next: z.string().optional(),
});

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "mismatch" });
