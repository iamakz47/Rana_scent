import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { accounts, PASSWORD } from "./accounts";

// Creates the test accounts on the LOCAL Supabase stack only.
export default async function globalSetup() {
  const raw = execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const env = JSON.parse(raw.slice(raw.indexOf("{"))) as Record<string, string>;
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(env.API_URL ?? "")) {
    throw new Error("Admin e2e tests only run against the local Supabase stack");
  }
  const service = createClient(env.API_URL, env.SECRET_KEY, { auth: { persistSession: false } });
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  const roles: Record<string, string | null> = { owner: "owner", editor: "editor", manager: "manager", support: "support", customer: null };

  for (const [key, email] of Object.entries(accounts)) {
    let user = data.users.find((u) => u.email === email);
    if (!user) {
      const created = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
      if (created.error) throw created.error;
      user = created.data.user;
    }
    const role = roles[key];
    if (role) {
      const { error } = await service
        .from("staff_members")
        .upsert({ user_id: user.id, role, display_name: `E2E ${key}`, is_active: true }, { onConflict: "user_id" });
      if (error) throw error;
    }
  }
  await service.from("store_settings").update({ slider_interval_seconds: 4 }).eq("id", 1);

  // Published test catalogue, active delivery and cash on delivery (local only).
  execFileSync("psql", ["-q", "-v", "ON_ERROR_STOP=1", env.DB_URL, "-f", "supabase/samples/local_checkout_fixture.sql"], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  await service.from("inventory").update({ on_hand: 500 }).eq("variant_id",
    (await service.from("product_variants").select("id").eq("sku", "RS-FIXTURE-AURA").single()).data!.id);
}
