import { Suspense } from "react";
import { adminSections } from "@/features/admin/auth/permissions";
import { can, requireStaff } from "@/features/admin/auth/dal";
import { AdminShell } from "@/features/admin/shell/admin-shell";

// Everything under the console needs an active staff session. The check runs
// inside Suspense (it reads cookies), and each page repeats it with the
// permission that page needs.
async function Console({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const items = adminSections
    .filter((section) => can(staff, section.permission))
    .map(({ key, href }) => ({ key, href }));
  return (
    <AdminShell items={items} user={{ email: staff.email, displayName: staff.displayName, role: staff.role }}>
      {children}
    </AdminShell>
  );
}

function ConsoleSkeleton() {
  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[17rem_minmax(0,1fr)]" aria-busy>
      <div className="hidden border-e border-ink/10 bg-canvas lg:block" />
      <div className="px-4 py-10 lg:px-10">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="h-10 w-56 animate-pulse rounded-lg bg-ink/6" />
          <div className="h-40 animate-pulse rounded-2xl bg-ink/5" />
        </div>
      </div>
    </div>
  );
}

export default function ConsoleLayout({ children }: LayoutProps<"/[lang]/admin">) {
  return (
    <Suspense fallback={<ConsoleSkeleton />}>
      <Console>{children}</Console>
    </Suspense>
  );
}
