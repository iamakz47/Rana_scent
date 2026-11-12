import "server-only";
import { createClient } from "@/lib/supabase/server";
import { can, type Staff } from "@/features/admin/auth/dal";

// Dashboard figures, all read live through the staff member's own session
// (RLS applies). Anything the role can't read is returned as null and shown
// as unavailable: nothing is estimated or invented.

export type DashboardData = {
  products: { total: number; published: number; drafts: number } | null;
  stock: { low: number; out: number } | null;
  orders: { count: number; revenueFils: number | null } | null;
  activity: Array<{ id: number; action: string; table: string; createdAt: string; actor: string | null; hasActor: boolean }> | null;
};

export async function getDashboard(staff: Staff): Promise<DashboardData> {
  const supabase = await createClient();

  const products = can(staff, "catalog.read")
    ? supabase.from("products").select("status").neq("status", "archived")
    : null;
  const stock = can(staff, "inventory.read")
    ? supabase
        .from("inventory")
        .select("on_hand, low_stock_threshold, track_inventory, product_variants!inner(is_active, products!inner(status))")
        .eq("track_inventory", true)
        .eq("product_variants.is_active", true)
        .neq("product_variants.products.status", "archived")
    : null;
  const orders = can(staff, "orders.read")
    ? supabase.from("orders").select("id", { count: "exact", head: true }).neq("status", "pending")
    : null;
  const revenue = can(staff, "finance.read")
    ? supabase.from("payments").select("amount_fils").eq("status", "captured")
    : null;
  const activity = can(staff, "audit.read")
    ? supabase.from("audit_logs").select("id, action, table_name, created_at, actor_id").order("created_at", { ascending: false }).limit(8)
    : null;
  const team = can(staff, "staff.read") ? supabase.rpc("list_staff") : null;

  const [p, s, o, r, a, tm] = await Promise.all([products, stock, orders, revenue, activity, team]);

  const names = new Map<string, string>();
  for (const member of tm?.data ?? []) names.set(member.user_id, member.display_name || member.email);

  return {
    products: p?.data
      ? {
          total: p.data.length,
          published: p.data.filter((row) => row.status === "published").length,
          drafts: p.data.filter((row) => row.status === "draft").length,
        }
      : null,
    stock: s?.data
      ? {
          out: s.data.filter((row) => row.on_hand === 0).length,
          low: s.data.filter((row) => row.on_hand > 0 && row.on_hand <= row.low_stock_threshold).length,
        }
      : null,
    orders: o && !o.error
      ? {
          count: o.count ?? 0,
          revenueFils: r?.data ? r.data.reduce((total, row) => total + row.amount_fils, 0) : null,
        }
      : null,
    activity: a?.data
      ? a.data.map((row) => ({
          id: row.id,
          action: row.action,
          table: row.table_name,
          createdAt: row.created_at,
          actor: row.actor_id ? (names.get(row.actor_id) ?? null) : null,
          hasActor: Boolean(row.actor_id),
        }))
      : null,
  };
}
