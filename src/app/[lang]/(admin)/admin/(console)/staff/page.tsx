import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isInviteConfigured } from "@/lib/supabase/admin";
import { can, requireStaff } from "@/features/admin/auth/dal";
import { assignableRoles, isStaffRole, permissions, staffRoles } from "@/features/admin/auth/permissions";
import { formatDateTime } from "@/features/admin/format";
import { getAdminDictionary } from "@/features/admin/i18n";
import { AddStaffForm, MemberControls } from "@/features/admin/staff/staff-forms";
import { AdminPageHeader, Badge, Panel } from "@/features/admin/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.staff.title };
}

export default async function StaffPage() {
  const staff = await requireStaff("staff.read");
  const { locale, t } = await getAdminDictionary();
  const supabase = await createClient();
  const [members, grants] = await Promise.all([
    supabase.rpc("list_staff"),
    supabase.from("role_permissions").select("role, permission"),
  ]);
  const writable = can(staff, "staff.write");
  const roles = assignableRoles(staff.role);
  const granted = new Set((grants.data ?? []).map((g) => `${g.role}:${g.permission}`));

  return (
    <div className="space-y-6">
      <AdminPageHeader title={t.staff.title} body={t.staff.body} />

      {writable ? (
        <div className="grid gap-6">
          <Panel title={t.staff.invite} description={t.staff.inviteBody}>
            <AddStaffForm mode="invite" roles={roles} enabled={isInviteConfigured()} />
          </Panel>
          <Panel title={t.staff.assign} description={t.staff.assignBody}>
            <AddStaffForm mode="assign" roles={roles} enabled />
          </Panel>
        </div>
      ) : null}

      <ul className="divide-y divide-ink/8 rounded-2xl border border-ink/10 bg-canvas">
        {(members.data ?? []).map((m) => {
          if (!isStaffRole(m.role)) return null;
          return (
            <li key={m.user_id} className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink" dir="auto">
                  {m.display_name || m.email}
                </p>
                <p className="truncate text-[0.78rem] text-ink-soft" dir="ltr">
                  {m.email}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[0.75rem] text-ink-soft">
                  <Badge tone="gold">{t.roles[m.role]}</Badge>
                  <Badge tone={m.is_active ? "success" : "neutral"}>{m.is_active ? t.staff.active : t.staff.inactive}</Badge>
                  <span>
                    {t.staff.lastSignIn}: {m.last_sign_in_at ? formatDateTime(m.last_sign_in_at, locale) : t.staff.never}
                  </span>
                </p>
              </div>
              {writable ? (
                <MemberControls
                  roles={roles}
                  member={{
                    userId: m.user_id,
                    email: m.email,
                    name: m.display_name,
                    role: m.role,
                    active: m.is_active,
                    lastSignIn: m.last_sign_in_at ?? "",
                    isSelf: m.user_id === staff.userId,
                  }}
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      <Panel title={t.staff.permissionsTitle} description={t.staff.permissionsBody}>
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[44rem] text-[0.8rem]">
            <thead>
              <tr>
                <th className="pb-2 text-start font-medium text-ink-soft" />
                {staffRoles.map((role) => (
                  <th key={role} className="pb-2 text-center font-medium text-ink">
                    {t.roles[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {permissions.map((permission) => (
                <tr key={permission}>
                  <td className="py-1.5 pe-3 text-ink-soft" dir="ltr">
                    {permission}
                  </td>
                  {staffRoles.map((role) => (
                    <td key={role} className="py-1.5 text-center">
                      {granted.has(`${role}:${permission}`) ? <span className="text-gold-deep">●</span> : <span className="text-ink/15">·</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
