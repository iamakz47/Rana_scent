"use server";

import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";
import { allow, clientIp, hashKey } from "@/lib/rate-limit";

export type ContactState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; error: "name" | "replyTo" | "email" | "phone" | "message" | "spam" | "rateLimited" | "unavailable" | "generic" };

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.union([z.literal(""), z.email().max(200)]),
  phone: z.union([z.literal(""), z.string().trim().regex(/^\+?[0-9 ]{7,20}$/)]),
  message: z.string().trim().min(10).max(2000),
  locale: z.enum(["ar", "en"]),
});

const field = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
};

// Sends a contact message. Spam protection, in order: a hidden "website"
// field people never fill in; a minimum time on the page; a per-visitor rate
// limit; and the database's own validation and limits (per sender and overall).
export async function sendContactMessage(_prev: ContactState, data: FormData): Promise<ContactState> {
  // Bots fill every field, including the hidden one: pretend it worked.
  if (field(data, "website")) return { status: "sent" };
  const started = Number(field(data, "started"));
  if (!Number.isFinite(started) || started <= 0 || Date.now() - started < 3000) return { status: "sent" };

  const parsed = schema.safeParse({
    name: field(data, "name"),
    email: field(data, "email").trim().toLowerCase(),
    phone: field(data, "phone").replace(/[^\d+ ]/g, "").trim(),
    message: field(data, "message"),
    locale: field(data, "locale") === "en" ? "en" : "ar",
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.path[0];
    return { status: "error", error: first === "name" || first === "email" || first === "phone" || first === "message" ? first : "generic" };
  }
  if (!parsed.data.email && !parsed.data.phone) return { status: "error", error: "replyTo" };
  if (!isSupabaseConfigured()) return { status: "error", error: "unavailable" };

  const ip = await clientIp();
  if (!(await allow("contact", ip, 5, 3600))) return { status: "error", error: "rateLimited" };

  const { error } = await createPublicClient().rpc("submit_contact_message", {
    p_name: parsed.data.name,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone,
    p_message: parsed.data.message,
    p_locale: parsed.data.locale,
    p_client_hash: hashKey("contact", ip),
  });
  if (error) {
    const known: Record<string, ContactState & { status: "error" }> = {
      contact_name: { status: "error", error: "name" },
      contact_reply_to: { status: "error", error: "replyTo" },
      contact_email: { status: "error", error: "email" },
      contact_phone: { status: "error", error: "phone" },
      contact_message: { status: "error", error: "message" },
      contact_spam: { status: "error", error: "spam" },
      contact_rate_limited: { status: "error", error: "rateLimited" },
    };
    // A missing function (database not updated yet) reads as "unavailable".
    return known[error.message] ?? { status: "error", error: error.code === "PGRST202" ? "unavailable" : "generic" };
  }
  return { status: "sent" };
}
