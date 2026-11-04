import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/features/admin/auth/dal";
import { getAdminDictionary } from "@/features/admin/i18n";
import { PendingSection } from "@/features/admin/ui/pending-section";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.pending.promotions.title };
}

export default async function Page() {
  await requireStaff("marketing.write");
  const supabase = await createClient();
  const { count } = await supabase.from("discount_codes").select("*", { count: "exact", head: true });
  return <PendingSection section="promotions" count={count} />;
}
