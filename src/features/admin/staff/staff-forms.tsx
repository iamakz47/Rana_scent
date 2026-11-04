"use client";

import { useActionState } from "react";
import { useAdminI18n } from "@/features/admin/i18n/client";
import type { StaffRole } from "@/features/admin/auth/permissions";
import { ActionMessage, idle, SubmitButton, type ActionResult } from "@/features/admin/ui/form";
import { Badge, Field, Notice, Select, TextInput } from "@/features/admin/ui/primitives";
import { assignRole, inviteStaff, updateMember } from "./actions";

export function AddStaffForm({ mode, roles, enabled }: { mode: "invite" | "assign"; roles: StaffRole[]; enabled: boolean }) {
  const { locale, t } = useAdminI18n();
  const [state, action] = useActionState<ActionResult, FormData>(mode === "invite" ? inviteStaff : assignRole, idle);
  if (!enabled) return <Notice tone="gold">{t.staff.invitePending}</Notice>;
  return (
    <form action={action} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem_auto] md:items-end">
      <input type="hidden" name="locale" value={locale} />
      <Field label={t.staff.email} htmlFor={`${mode}-email`}>
        <TextInput id={`${mode}-email`} name="email" type="email" required dir="ltr" autoComplete="off" />
      </Field>
      <Field label={t.staff.displayName} htmlFor={`${mode}-name`}>
        <TextInput id={`${mode}-name`} name="display_name" maxLength={80} />
      </Field>
      <Field label={t.staff.role} htmlFor={`${mode}-role`}>
        <Select id={`${mode}-role`} name="role" defaultValue="editor">
          {roles.map((role) => (
            <option key={role} value={role}>
              {t.roles[role]}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton>{mode === "invite" ? t.staff.sendInvite : t.staff.assignRole}</SubmitButton>
      <div className="md:col-span-4">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

export type MemberRow = {
  userId: string;
  email: string;
  name: string;
  role: StaffRole;
  active: boolean;
  lastSignIn: string;
  isSelf: boolean;
};

export function MemberControls({ member, roles }: { member: MemberRow; roles: StaffRole[] }) {
  const { locale, t } = useAdminI18n();
  const [state, action] = useActionState<ActionResult, FormData>(updateMember, idle);
  if (member.isSelf) return <Badge tone="gold">{t.staff.you}</Badge>;
  if (!roles.includes(member.role)) return <Badge>{t.common.readOnly}</Badge>;
  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="user_id" value={member.userId} />
    </>
  );
  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <form action={action} className="flex items-center gap-2">
          {hidden}
          <input type="hidden" name="intent" value="role" />
          <label className="sr-only" htmlFor={`role-${member.userId}`}>
            {t.staff.role}
          </label>
          <Select id={`role-${member.userId}`} name="role" defaultValue={member.role} className="min-h-8 w-32 py-1">
            {roles.map((role) => (
              <option key={role} value={role}>
                {t.roles[role]}
              </option>
            ))}
          </Select>
          <SubmitButton size="sm" tone="outline">
            {t.common.save}
          </SubmitButton>
        </form>
        <form action={action}>
          {hidden}
          <input type="hidden" name="intent" value={member.active ? "deactivate" : "reactivate"} />
          <SubmitButton size="sm" tone="ghost">
            {member.active ? t.staff.deactivate : t.staff.reactivate}
          </SubmitButton>
        </form>
        <form
          action={action}
          onSubmit={(event) => {
            if (!window.confirm(t.staff.removeAccess + "?")) event.preventDefault();
          }}
        >
          {hidden}
          <input type="hidden" name="intent" value="remove" />
          <SubmitButton size="sm" tone="danger">
            {t.staff.removeAccess}
          </SubmitButton>
        </form>
      </div>
      <ActionMessage state={state} />
    </div>
  );
}
