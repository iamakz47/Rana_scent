import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/features/admin/auth/dal";
import { getAdminDictionary } from "@/features/admin/i18n";
import { PendingSection } from "@/features/admin/ui/pending-section";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.pending.finance.title };
}

export default async function Page() {
  await requireStaff("finance.read");
  const supabase = await createClient();
  const { count } = await supabase.from("payments").select("*", { count: "exact", head: true });
  return <PendingSection section="finance" count={count} />;
}
