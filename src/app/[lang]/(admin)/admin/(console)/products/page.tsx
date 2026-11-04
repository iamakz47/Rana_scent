import type { Metadata } from "next";
import Link from "next/link";
import { localePath } from "@/i18n/config";
import { formatKWD } from "@/lib/money";
import { can, requireStaff } from "@/features/admin/auth/dal";
import { listAdminProducts, type ProductStatus } from "@/features/admin/data/catalog";
import { formatNumber } from "@/features/admin/format";
import { getAdminDictionary } from "@/features/admin/i18n";
import { mediaUrl } from "@/features/media/url";
import { AdminPageHeader, adminButton, Badge, EmptyState, statusTone } from "@/features/admin/ui/primitives";
import { cn } from "@/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.products.title };
}

const filters = ["all", "draft", "published", "archived"] as const;

export default async function ProductsPage({ searchParams }: PageProps<"/[lang]/admin/products">) {
  const staff = await requireStaff("catalog.read");
  const [{ locale, t }, query] = await Promise.all([getAdminDictionary(), searchParams]);
  const status = filters.includes(query.status as never) && query.status !== "all" ? (query.status as ProductStatus) : undefined;
  const products = await listAdminProducts(status);
  const href = (path: string) => localePath(locale, path);
  const price = (min: number | null, max: number | null) =>
    min === null ? "—" : min === max ? formatKWD(min, locale) : `${formatKWD(min, locale)} – ${formatKWD(max!, locale)}`;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t.products.title}
        body={t.products.body}
        actions={
          can(staff, "catalog.write") ? (
            <Link href={href("/admin/products/new")} className={adminButton("primary")}>
              {t.products.new}
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
              href={href(filter === "all" ? "/admin/products" : `/admin/products?status=${filter}`)}
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

      {products.length === 0 ? (
        <EmptyState
          title={t.products.emptyTitle}
          body={t.products.emptyBody}
          action={
            can(staff, "catalog.write") ? (
              <Link href={href("/admin/products/new")} className={adminButton("primary")}>
                {t.products.new}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-ink/8 overflow-hidden rounded-2xl border border-ink/10 bg-canvas">
          {products.map((product) => (
            <li key={product.id}>
              <Link
                href={href(`/admin/products/${product.id}`)}
                className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-surface/70 md:grid-cols-[3.5rem_minmax(0,1fr)_8rem_10rem_6rem_7rem]"
              >
                <span className="block size-14 overflow-hidden rounded-lg bg-beige">
                  {product.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(product.cover)} alt="" className="size-full object-contain" loading="lazy" />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{product.name[locale]}</span>
                  <span className="block truncate text-[0.78rem] text-ink-soft" dir="ltr">
                    /{product.slug}
                  </span>
                </span>
                <span className="hidden text-step--1 text-ink-soft md:block">{t.products.types[product.type]}</span>
                <span className="hidden text-step--1 tabular-nums text-ink md:block">{price(product.minPrice, product.maxPrice)}</span>
                <span className="hidden text-step--1 tabular-nums text-ink-soft md:block">
                  {formatNumber(product.stock, locale)}
                </span>
                <span className="flex flex-col items-end gap-1">
                  <Badge tone={statusTone(product.status)}>{t.status[product.status]}</Badge>
                  {product.featured ? <span className="text-[0.7rem] text-gold-deep">★</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
