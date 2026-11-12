import type { Metadata } from "next";
import { AuthCard } from "@/features/admin/auth/auth-card";
import { ForgotPasswordForm } from "@/features/admin/auth/forms";
import { getAdminDictionary } from "@/features/admin/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.auth.forgotTitle };
}

export default async function ForgotPasswordPage() {
  const { locale, t } = await getAdminDictionary();
  return (
    <AuthCard locale={locale} t={t} title={t.auth.forgotTitle} body={t.auth.forgotBody}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
