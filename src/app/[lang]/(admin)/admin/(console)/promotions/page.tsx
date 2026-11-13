import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/features/admin/auth/dal";
import { filsToKwdInput } from "@/features/admin/format";
import { getAdminDictionary } from "@/features/admin/i18n";
import { DiscountForm } from "@/features/admin/marketing/discount-form";
import { AdminPageHeader, Badge, Panel } from "@/features/admin/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.commerce.discounts.title };
}

// Kuwait local time (UTC+3) for datetime-local inputs.
function toKuwaitLocal(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 3 * 3600_000).toISOString().slice(0, 16);
}

export default async function PromotionsPage() {
  await requireStaff("marketing.write");
  const { t } = await getAdminDictionary();
  const c = t.commerce.discounts;
  const supabase = await createClient();
  const { data: codes } = await supabase.from("discount_codes").select("*").order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <AdminPageHeader title={c.title} body={c.body} />
      <Panel title={c.new}>
        <DiscountForm values={{ code: "", kind: "percentage", value: "", minimum: "", starts: "", ends: "", limit: "", active: true }} />
      </Panel>
      {(codes ?? []).length === 0 ? (
        <p className="text-step--1 text-ink-soft">{c.empty}</p>
      ) : (
        (codes ?? []).map((code) => (
          <Panel
            key={code.id}
            title={code.code}
            actions={
              <span className="flex gap-1.5">
                <Badge tone={code.is_active ? "success" : "neutral"}>{code.is_active ? c.active : t.common.disabled}</Badge>
                <Badge>
                  {c.used}: {code.redemptions_count}
                  {code.max_redemptions ? ` / ${code.max_redemptions}` : ""}
                </Badge>
              </span>
            }
          >
            <DiscountForm
              compact
              values={{
                id: code.id,
                code: code.code,
                kind: code.kind === "fixed" ? "fixed" : "percentage",
                value: code.kind === "fixed" ? filsToKwdInput(code.value) : String(code.value),
                minimum: code.min_subtotal_fils ? filsToKwdInput(code.min_subtotal_fils) : "",
                starts: toKuwaitLocal(code.starts_at),
                ends: toKuwaitLocal(code.ends_at),
                limit: code.max_redemptions ? String(code.max_redemptions) : "",
                active: code.is_active,
              }}
            />
          </Panel>
        ))
      )}
    </div>
  );
}
