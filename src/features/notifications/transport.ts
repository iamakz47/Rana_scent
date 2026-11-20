import "server-only";

// Email delivery. Server-only; the API key never reaches the browser.
//
//   RESEND_API_KEY        Resend API key. Without it (or without EMAIL_FROM),
//                         the safe TEST adapter is used: nothing leaves the
//                         server and the outbox records provider "test".
//   EMAIL_FROM            e.g. "Rana Scent <orders@ranascent.com>" (a domain
//                         verified in Resend). ORDER_EMAIL_FROM is accepted too.
//   EMAIL_REPLY_TO        optional reply-to address.
//   EMAIL_TEST_ALLOWLIST  outside the production deployment, real sending is
//                         limited to these addresses or "@domain" entries.
//                         Anyone else is suppressed, so preview/test runs can
//                         never email real customers.
//   EMAIL_PROVIDER=test   forces the test adapter anywhere.

export type SendInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};
export type SendResult =
  | { ok: true; provider: string; messageId: string }
  | { ok: false; provider: string; error: string; retryable: boolean };

export type Transport = { name: string; send(input: SendInput): Promise<SendResult> };

export const sentInTest: SendInput[] = [];

export const testTransport: Transport = {
  name: "test",
  async send(input) {
    sentInTest.push(input);
    if (sentInTest.length > 200) sentInTest.shift();
    return { ok: true, provider: "test", messageId: `test_${input.idempotencyKey}` };
  },
};

function fromAddress(): string {
  return process.env.EMAIL_FROM || process.env.ORDER_EMAIL_FROM || "";
}

export function isProductionDeployment(): boolean {
  return process.env.VERCEL_ENV === "production";
}

export function recipientAllowed(to: string, env: { production: boolean; allowlist: string }): boolean {
  if (env.production) return true;
  const address = to.trim().toLowerCase();
  return env.allowlist
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .some((entry) => (entry.startsWith("@") ? address.endsWith(entry) : address === entry));
}

export function resendTransport(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): Transport {
  return {
    name: "resend",
    async send(input) {
      try {
        const res = await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            // Resend de-duplicates retries of the same message for 24 hours.
            "Idempotency-Key": input.idempotencyKey,
          },
          body: JSON.stringify({
            from,
            to: [input.to],
            subject: input.subject,
            html: input.html,
            text: input.text,
            ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
          }),
          signal: AbortSignal.timeout(10_000),
          cache: "no-store",
        });
        if (res.ok) {
          const body = (await res.json().catch(() => ({}))) as { id?: string };
          return { ok: true, provider: "resend", messageId: body.id ?? "" };
        }
        // 4xx (other than rate limits) won't succeed on retry.
        const retryable = res.status === 429 || res.status >= 500;
        return { ok: false, provider: "resend", error: `Resend responded ${res.status}`, retryable };
      } catch (error) {
        return { ok: false, provider: "resend", error: error instanceof Error ? error.name : "Network error", retryable: true };
      }
    },
  };
}

export function emailMode(): "resend" | "test" {
  if (process.env.EMAIL_PROVIDER === "test") return "test";
  return process.env.RESEND_API_KEY && fromAddress() ? "resend" : "test";
}

// The transport for a given recipient, applying the non-production guard.
export function transportFor(to: string): Transport | null {
  if (emailMode() === "test") return testTransport;
  const allowed = recipientAllowed(to, {
    production: isProductionDeployment(),
    allowlist: process.env.EMAIL_TEST_ALLOWLIST ?? "",
  });
  if (!allowed) return null;
  return resendTransport(process.env.RESEND_API_KEY!, fromAddress());
}
