import type { Metadata } from "next";
import { requireStaff } from "@/features/admin/auth/dal";
import { getAdminDictionary } from "@/features/admin/i18n";
import { PendingSection } from "@/features/admin/ui/pending-section";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.pending.customers.title };
}

export default async function Page() {
  await requireStaff("customers.read");
  // Customer accounts open with checkout; staff profiles are not customers,
  // so no count is shown here yet.
  return <PendingSection section="customers" count={null} />;
}
