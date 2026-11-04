import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { localePath } from "@/i18n/config";
import { getLocale } from "@/i18n/dictionaries";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { isPermission, isStaffRole, type Permission, type StaffRole } from "./permissions";

// Admin Data Access Layer. Every admin page and Server Action calls
// requireStaff() before touching data; the database re-checks the same
// permissions through RLS, so hiding a button is never the only defence.

export type Staff = {
  userId: string;
  email: string;
  role: StaffRole;
  displayName: string;
  permissions: ReadonlySet<Permission>;
};

export type SessionState =
  | { status: "unconfigured" }
  | { status: "signed_out" }
  | { status: "not_staff"; email: string }
  | { status: "staff"; staff: Staff };

// Validates the session with Supabase Auth (getClaims verifies the JWT
// signature) and loads the caller's own staff row. Memoised per request.
export const getSession = cache(async (): Promise<SessionState> => {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return { status: "signed_out" };

  const userId = claims.sub;
  const email = typeof claims.email === "string" ? claims.email : "";

  const { data: member } = await supabase
    .from("staff_members")
    .select("role, display_name, is_active")
    .eq("user_id", userId)
    .maybeSingle();
  if (!member || !member.is_active || !isStaffRole(member.role)) {
    return { status: "not_staff", email };
  }

  const { data: grants } = await supabase
    .from("role_permissions")
    .select("permission")
    .eq("role", member.role);

  return {
    status: "staff",
    staff: {
      userId,
      email,
      role: member.role,
      displayName: member.display_name,
      permissions: new Set((grants ?? []).map((g) => g.permission).filter(isPermission)),
    },
  };
});

export function can(staff: Staff, permission: Permission): boolean {
  return staff.permissions.has(permission);
}

// Returns the signed-in staff member or redirects: to the login page when
// signed out, and to the dashboard with a notice when a permission is missing.
export async function requireStaff(permission: Permission = "dashboard.view"): Promise<Staff> {
  const [session, locale] = await Promise.all([getSession(), getLocale()]);
  if (session.status === "unconfigured") redirect(localePath(locale, "/admin/login?error=unconfigured"));
  if (session.status === "signed_out") redirect(localePath(locale, "/admin/login"));
  if (session.status === "not_staff") redirect(localePath(locale, "/admin/login?error=no_access"));
  const { staff } = session;
  if (!can(staff, permission)) {
    redirect(localePath(locale, permission === "dashboard.view" ? "/admin/login?error=no_access" : "/admin?denied=1"));
  }
  return staff;
}

// For Server Actions: same check, but returns an error instead of
// redirecting mid-mutation when the permission is missing.
export async function authorize(permission: Permission): Promise<Staff | null> {
  const session = await getSession();
  if (session.status !== "staff") return null;
  return can(session.staff, permission) ? session.staff : null;
}
