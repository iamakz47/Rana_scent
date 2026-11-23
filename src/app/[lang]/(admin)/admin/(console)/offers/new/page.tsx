import type { Metadata } from "next";
import { can, requireStaff } from "@/features/admin/auth/dal";
import { getOfferFormOptions } from "@/features/admin/data/offers";
import { getAdminDictionary } from "@/features/admin/i18n";
import { emptyOffer, OfferEditor } from "@/features/admin/offers/offer-editor";
import { AdminPageHeader } from "@/features/admin/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.offers.newTitle };
}

export default async function NewOfferPage() {
  const staff = await requireStaff("catalog.write");
  const [{ t }, options] = await Promise.all([getAdminDictionary(), getOfferFormOptions()]);
  return (
    <div className="space-y-6">
      <AdminPageHeader eyebrow={t.offers.title} title={t.offers.newTitle} body={t.offers.emptyBody} />
      <OfferEditor values={emptyOffer} options={options} canPublish={can(staff, "catalog.publish")} />
    </div>
  );
}
