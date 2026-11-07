import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/features/admin/auth/dal";
import { getAdminDictionary } from "@/features/admin/i18n";
import { SettingsForm } from "@/features/admin/settings/settings-form";
import { AdminPageHeader, Badge, Notice, Panel } from "@/features/admin/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.settings.title };
}

export default async function SettingsPage() {
  await requireStaff("settings.write");
  const { t } = await getAdminDictionary();
  const supabase = await createClient();
  const { data } = await supabase
    .from("store_settings")
    .select("contact_email, contact_phone, whatsapp_number, instagram_handle, default_low_stock_threshold")
    .eq("id", 1)
    .single();
  return (
    <div className="space-y-6">
      <AdminPageHeader title={t.settings.title} body={t.settings.body} />
      <Panel title={t.settings.title}>
        <SettingsForm values={data ?? {}} />
      </Panel>
      <Panel title={t.settings.shipping} actions={<Badge tone="gold">{t.pending.phase}</Badge>}>
        <Notice tone="gold">{t.settings.shippingPending}</Notice>
      </Panel>
    </div>
  );
}
