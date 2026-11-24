import type { Metadata } from "next";
import Link from "next/link";
import { localePath } from "@/i18n/config";
import { format } from "@/i18n/format";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/features/admin/auth/dal";
import { formatDateTime } from "@/features/admin/format";
import { getAdminDictionary } from "@/features/admin/i18n";
import { MessageStatusForm } from "@/features/admin/messages/status-form";
import { telHref, whatsappHref } from "@/features/contact/channels";
import { adminButton, AdminPageHeader, Badge, EmptyState, Notice } from "@/features/admin/ui/primitives";
import { ADMIN_PAGE_SIZE, Pagination, pageFromQuery, pageRange } from "@/features/admin/ui/pagination";
import { cn } from "@/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.p8.messages.title };
}

const filters = ["new", "read", "archived", "all"] as const;
type Filter = (typeof filters)[number];

export default async function MessagesPage({ searchParams }: PageProps<"/[lang]/admin/messages">) {
  await requireStaff("customers.read");
  const [{ locale, t }, query] = await Promise.all([getAdminDictionary(), searchParams]);
  const c = t.p8.messages;
  const filter: Filter = filters.includes(query.status as Filter) ? (query.status as Filter) : "new";
  const page = pageFromQuery(query.page);
  const supabase = await createClient();
  let list = supabase
    .from("contact_messages")
    .select("id, name, email, phone, message, locale, status, created_at")
    .order("created_at", { ascending: false })
    .range(...pageRange(page));
  if (filter !== "all") list = list.eq("status", filter);
  const [{ data: rows, error }, { count: newCount }] = await Promise.all([
    list,
    supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);
  const hasNext = (rows?.length ?? 0) > ADMIN_PAGE_SIZE;
  const messages = rows?.slice(0, ADMIN_PAGE_SIZE) ?? [];
  const href = (f: Filter, p = 1) => {
    const params = new URLSearchParams({ ...(f !== "new" ? { status: f } : {}), ...(p > 1 ? { page: String(p) } : {}) });
    const qs = params.toString();
    return localePath(locale, `/admin/messages${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={c.title}
        body={c.body}
        actions={newCount ? <Badge tone="gold">{format(c.newCount, { count: String(newCount) })}</Badge> : null}
      />
      {error ? <Notice tone="danger">{c.unavailable}</Notice> : null}
      <nav aria-label={c.title} className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f}
            href={href(f)}
            aria-current={f === filter ? "page" : undefined}
            className={cn(adminButton(f === filter ? "primary" : "outline", "sm"))}
          >
            {c.filters[f]}
          </Link>
        ))}
      </nav>
      {!error && messages.length === 0 ? (
        <EmptyState title={c.empty} />
      ) : (
        <ul className="space-y-3" data-testid="messages">
          {messages.map((m) => {
            const wa = m.phone ? whatsappHref(m.phone) : null;
            const tel = m.phone ? telHref(m.phone) : null;
            return (
              <li key={m.id} className="rounded-2xl border border-ink/10 bg-canvas p-4 sm:p-5" data-testid="message">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{m.name}</p>
                    <p className="text-[0.78rem] text-ink-soft">
                      {format(c.received, { date: formatDateTime(m.created_at, locale) })} · {c.language[m.locale === "en" ? "en" : "ar"]}
                    </p>
                  </div>
                  {m.status === "new" ? <Badge tone="gold">{c.filters.new}</Badge> : m.status === "archived" ? <Badge>{c.filters.archived}</Badge> : null}
                </div>
                <p className="mt-3 whitespace-pre-line break-words text-step--1 text-ink" dir="auto">
                  {m.message}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-step--1" dir="ltr">
                  {m.email ? <span className="text-ink-soft">{m.email}</span> : null}
                  {m.phone ? <span className="text-ink-soft">{m.phone}</span> : null}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink/8 pt-3">
                  {m.email ? (
                    <a href={`mailto:${m.email}`} className={adminButton("primary", "sm")}>
                      {c.replyEmail}
                    </a>
                  ) : null}
                  {wa ? (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className={adminButton("outline", "sm")}>
                      {c.replyWhatsapp}
                    </a>
                  ) : null}
                  {tel ? (
                    <a href={tel} className={adminButton("outline", "sm")}>
                      {c.call}
                    </a>
                  ) : null}
                  <span className="grow" />
                  <MessageStatusForm id={m.id} status={m.status as "new" | "read" | "archived"} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination t={t} page={page} hasNext={hasNext} href={(p) => href(filter, p)} />
    </div>
  );
}
