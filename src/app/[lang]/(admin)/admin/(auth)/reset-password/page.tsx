import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { localePath } from "@/i18n/config";
import { AuthCard } from "@/features/admin/auth/auth-card";
import { getSession } from "@/features/admin/auth/dal";
import { ResetPasswordForm } from "@/features/admin/auth/forms";
import { getAdminDictionary } from "@/features/admin/i18n";
import { Notice } from "@/features/admin/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.auth.resetTitle };
}

// Reached from the recovery or invitation email, after /admin/auth/confirm
// has exchanged the link for a session.
async function ResetGate() {
  const [{ locale, t }, session] = await Promise.all([getAdminDictionary(), getSession()]);
  if (session.status === "signed_out" || session.status === "unconfigured") {
    return (
      <div className="space-y-4">
        <Notice tone="danger">{t.auth.errors.session}</Notice>
        <Link className="text-gold-deep underline-offset-4 hover:underline" href={localePath(locale, "/admin/forgot-password")}>
          {t.auth.forgotTitle}
        </Link>
      </div>
    );
  }
  return <ResetPasswordForm />;
}

export default async function ResetPasswordPage() {
  const { locale, t } = await getAdminDictionary();
  return (
    <AuthCard locale={locale} t={t} title={t.auth.resetTitle}>
      <Suspense fallback={<div className="h-48" />}>
        <ResetGate />
      </Suspense>
    </AuthCard>
  );
}
