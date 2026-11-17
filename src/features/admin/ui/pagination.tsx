import Link from "next/link";
import { format } from "@/i18n/format";
import { cn } from "@/lib/cn";
import type { AdminDictionary } from "@/features/admin/i18n/en";

export const ADMIN_PAGE_SIZE = 50;

// Page number from the URL (1-based, bounded so offsets stay sane).
export function pageFromQuery(value: unknown): number {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : 1;
  return Number.isFinite(n) && n >= 1 && n <= 10_000 ? n : 1;
}

// Rows [from, to] for a page, fetching one extra row to know whether a next page exists.
export function pageRange(page: number, size = ADMIN_PAGE_SIZE): [number, number] {
  const from = (page - 1) * size;
  return [from, from + size];
}

export function Pagination({
  t,
  page,
  hasNext,
  href,
}: {
  t: AdminDictionary;
  page: number;
  hasNext: boolean;
  href: (page: number) => string;
}) {
  if (page === 1 && !hasNext) return null;
  const link = "inline-flex min-h-10 items-center rounded-full border border-ink/15 px-4 text-step--1 transition-colors";
  return (
    <nav aria-label={t.p4.pagination} className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={cn(link, "text-ink hover:border-gold")}>
          {t.p4.previousPage}
        </Link>
      ) : (
        <span aria-hidden className={cn(link, "text-ink-soft/50")}>
          {t.p4.previousPage}
        </span>
      )}
      <span className="text-step--1 text-ink-soft" aria-current="page">
        {format(t.p4.pageLabel, { page })}
      </span>
      {hasNext ? (
        <Link href={href(page + 1)} rel="next" className={cn(link, "text-ink hover:border-gold")}>
          {t.p4.nextPage}
        </Link>
      ) : (
        <span aria-hidden className={cn(link, "text-ink-soft/50")}>
          {t.p4.nextPage}
        </span>
      )}
    </nav>
  );
}
