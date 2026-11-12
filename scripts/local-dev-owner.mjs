// Creates (or reuses) a local-only owner account for development and e2e tests.
// Refuses to run unless the target is the local Supabase stack.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secret = process.env.SUPABASE_SECRET_KEY ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)) {
  console.error("Refusing: NEXT_PUBLIC_SUPABASE_URL is not the local stack. Run via scripts/with-local-supabase.sh");
  process.exit(1);
}

const email = process.env.LOCAL_OWNER_EMAIL ?? "owner@rana.test";
const password = process.env.LOCAL_OWNER_PASSWORD ?? "Owner-Local-Pass1";
const service = createClient(url, secret, { auth: { persistSession: false } });

const { data: list } = await service.auth.admin.listUsers();
let user = list.users.find((u) => u.email === email);
if (!user) {
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  user = created.data.user;
}
const { error } = await service
  .from("staff_members")
  .upsert({ user_id: user.id, role: "owner", display_name: "Local Owner", is_active: true }, { onConflict: "user_id" });
if (error) throw error;
console.log(`Local owner ready: ${email}`);
