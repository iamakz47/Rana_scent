import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Resolves the LOCAL stack's URL and keys from `supabase status`. Refuses to
// run against anything that is not on localhost, so these tests can never
// touch a hosted project.
type LocalEnv = { url: string; publishableKey: string; secretKey: string };

let cached: LocalEnv | undefined;

export function localEnv(): LocalEnv {
  if (cached) return cached;
  const raw = execFileSync("npx", ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const json = JSON.parse(raw.slice(raw.indexOf("{"))) as Record<string, string>;
  const url = json.API_URL;
  if (!url || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)) {
    throw new Error(`Refusing to run database tests against non-local URL: ${url}`);
  }
  cached = { url, publishableKey: json.PUBLISHABLE_KEY, secretKey: json.SECRET_KEY };
  return cached;
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export function anonClient(): SupabaseClient {
  const env = localEnv();
  return createClient(env.url, env.publishableKey, noSession);
}

export function serviceClient(): SupabaseClient {
  const env = localEnv();
  return createClient(env.url, env.secretKey, noSession);
}

export const TEST_PASSWORD = "Local-Test-Passw0rd";

// Creates a confirmed user (local only) and returns a signed-in client.
export async function createUser(label: string) {
  const email = `${label}-${crypto.randomUUID().slice(0, 8)}@example.test`;
  const service = serviceClient();
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, email, client };
}

export async function createStaff(label: string, role: string) {
  const user = await createUser(label);
  const { error } = await serviceClient().from("staff_members").insert({ user_id: user.id, role });
  if (error) throw error;
  return user;
}
