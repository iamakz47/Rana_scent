import type { Metadata } from "next";
import Link from "next/link";
import { localePath } from "@/i18n/config";
import { formatKWD } from "@/lib/money";
import { can, requireStaff } from "@/features/admin/auth/dal";
import { listAdminOffers } from "@/features/admin/data/offers";
import type { ProductStatus } from "@/features/admin/data/catalog";
import { format } from "@/i18n/format";
import { getAdminDictionary } from "@/features/admin/i18n";
import { mediaUrl } from "@/features/media/url";
import { OfferRowActions } from "@/features/admin/offers/offer-editor";
import { AdminPageHeader, adminButton, Badge, EmptyState, Notice, statusTone } from "@/features/admin/ui/primitives";
import { cn } from "@/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.offers.title };
}

const filters = ["all", "draft", "published", "archived"] as const;

export default async function OffersPage({ searchParams }: PageProps<"/[lang]/admin/offers">) {
  const staff = await requireStaff("catalog.read");
  const [{ locale, t }, query] = await Promise.all([getAdminDictionary(), searchParams]);
  const status = filters.includes(query.status as never) && query.status !== "all" ? (query.status as ProductStatus) : undefined;
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 60) : "";
  // Before the offers database update, show a notice instead of an error page.
  const offers = await listAdminOffers(status, { search: q }).catch(() => null);
  if (!offers) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title={t.offers.title} body={t.offers.body} />
        <Notice tone="danger">{t.offers.unavailable}</Notice>
      </div>
    );
  }
  const writable = can(staff, "catalog.write");
  const href = (path: string) => localePath(locale, path);
  const listHref = (next: { status?: ProductStatus }) => {
    const params = new URLSearchParams({ ...(next.status ? { status: next.status } : {}), ...(q ? { q } : {}) });
    const qs = params.toString();
    return href(`/admin/offers${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t.offers.title}
        body={t.offers.body}
        actions={
          writable ? (
            <Link href={href("/admin/offers/new")} className={adminButton("primary")}>
              {t.offers.createButton}
            </Link>
          ) : (
            <Badge>{t.common.readOnly}</Badge>
          )
        }
      />

      <nav aria-label={t.common.status} className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const active = (status ?? "all") === filter;
          return (
            <Link
              key={filter}
              href={filter === "all" ? listHref({}) : listHref({ status: filter as ProductStatus })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-step--1 transition-colors",
                active ? "border-ink bg-ink text-canvas" : "border-ink/15 text-ink-soft hover:border-gold hover:text-ink",
              )}
            >
              {t.products.filters[filter]}
            </Link>
          );
        })}
      </nav>

      <form className="flex flex-wrap gap-2" action={href("/admin/offers")}>
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <label htmlFor="offer-search" className="sr-only">
          {t.p4.productSearch}
        </label>
        <input
          id="offer-search"
          name="q"
          defaultValue={q}
          placeholder={t.p4.productSearch}
          className="min-h-10 min-w-0 flex-1 rounded-full border border-ink/15 bg-canvas px-4 text-step--1 focus:border-gold-deep focus:outline-none sm:max-w-sm"
        />
        <button type="submit" className="min-h-10 rounded-full bg-ink px-4 text-step--1 text-canvas">
          {t.common.search}
        </button>
      </form>

      {offers.length === 0 && q ? (
        <EmptyState title={t.p4.noMatches} />
      ) : offers.length === 0 ? (
        <EmptyState
          title={t.offers.emptyTitle}
          body={t.offers.emptyBody}
          action={
            writable ? (
              <Link href={href("/admin/offers/new")} className={adminButton("primary")}>
                {t.offers.createButton}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-ink/8 overflow-hidden rounded-2xl border border-ink/10 bg-canvas">
          {offers.map((offer) => (
            <li key={offer.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
              <Link href={href(`/admin/offers/${offer.id}`)} className="flex min-w-0 flex-1 items-center gap-4 hover:text-gold-deep">
                <span className="block size-14 shrink-0 overflow-hidden rounded-lg bg-beige">
                  {offer.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(offer.cover)} alt="" className="size-full object-contain" loading="lazy" />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{offer.name[locale]}</span>
                  <span className="block truncate text-[0.78rem] text-ink-soft">
                    {format(t.offers.itemCount, { count: offer.itemCount })}
                  </span>
                </span>
                <span className="hidden text-step--1 tabular-nums text-ink md:block">
                  {offer.priceFils === null ? "—" : formatKWD(offer.priceFils, locale)}
                </span>
                <span className="ms-auto flex flex-wrap items-center justify-end gap-1.5">
                  <Badge tone={statusTone(offer.status)}>{t.status[offer.status]}</Badge>
                  {offer.windowState !== "active" ? <Badge tone="warning">{t.offers.windowBadges[offer.windowState]}</Badge> : null}
                </span>
              </Link>
              <OfferRowActions id={offer.id} status={offer.status} canWrite={writable} canPublish={can(staff, "catalog.publish")} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
