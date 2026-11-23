import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { can, requireStaff } from "@/features/admin/auth/dal";
import { getAdminOffer, getOfferFormOptions } from "@/features/admin/data/offers";
import { getAdminDictionary } from "@/features/admin/i18n";
import { OfferEditor } from "@/features/admin/offers/offer-editor";
import { AdminPageHeader, Badge, statusTone } from "@/features/admin/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.offers.editTitle };
}

export default async function EditOfferPage({ params, searchParams }: PageProps<"/[lang]/admin/offers/[id]">) {
  const staff = await requireStaff("catalog.read");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const [{ locale, t }, offer, options] = await Promise.all([getAdminDictionary(), getAdminOffer(id), getOfferFormOptions()]);
  if (!offer) notFound();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={t.offers.title}
        title={locale === "ar" ? offer.name_ar : offer.name_en}
        actions={<Badge tone={statusTone(offer.status)}>{t.status[offer.status]}</Badge>}
      />
      {can(staff, "catalog.write") ? (
        <OfferEditor
          // A different offer (e.g. a fresh duplicate) starts a fresh form.
          key={offer.id}
          values={offer}
          options={options}
          canPublish={can(staff, "catalog.publish")}
          created={query.created === "1"}
          duplicated={query.duplicated === "1"}
        />
      ) : (
        <p className="text-ink-soft">{t.common.readOnly}</p>
      )}
    </div>
  );
}
