import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/features/admin/auth/auth-card";
import { LoginForm } from "@/features/admin/auth/forms";
import { getAdminDictionary } from "@/features/admin/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.auth.signIn };
}

async function LoginFormFromQuery({ searchParams }: { searchParams: PageProps<"/[lang]/admin/login">["searchParams"] }) {
  const query = await searchParams;
  const next = typeof query.next === "string" ? query.next : undefined;
  const error = typeof query.error === "string" ? query.error : undefined;
  return <LoginForm next={next} initialError={error} />;
}

export default async function LoginPage({ searchParams }: PageProps<"/[lang]/admin/login">) {
  const { locale, t } = await getAdminDictionary();
  return (
    <AuthCard locale={locale} t={t} title={t.auth.loginTitle} body={t.auth.loginBody}>
      <Suspense fallback={<div className="h-64" />}>
        <LoginFormFromQuery searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}
