import { getAdminDictionary } from "@/features/admin/i18n";
import { formatNumber } from "@/features/admin/format";
import { AdminPageHeader, Badge, EmptyState } from "./primitives";

// A section whose database foundation exists but whose workflow ships in a
// later phase. Shows the real record count (normally zero), never samples.
export async function PendingSection({
  section,
  count,
}: {
  section: "orders" | "customers" | "promotions" | "finance";
  count: number | null;
}) {
  const { locale, t } = await getAdminDictionary();
  const copy = t.pending[section];
  return (
    <div className="space-y-6">
      <AdminPageHeader title={copy.title} actions={<Badge tone="gold">{t.pending.phase}</Badge>} />
      <EmptyState
        title={count ? `${t.pending.count}: ${formatNumber(count, locale)}` : t.pending.noData}
        body={copy.body}
      />
    </div>
  );
}
