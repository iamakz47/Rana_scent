import type { ReactNode } from "react";
import type { AdminSectionKey } from "@/features/admin/auth/permissions";

// Hairline section icons (24px grid, 1.5px stroke) matching the store's set.
const paths: Record<AdminSectionKey, ReactNode> = {
  dashboard: (
    <>
      <rect x="3.5" y="3.5" width="7" height="8" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
      <rect x="3.5" y="14.5" width="7" height="6" rx="1.5" />
    </>
  ),
  products: (
    <>
      <path d="M9 3.5h6v3l1.5 2v11a1.5 1.5 0 0 1-1.5 1.5H9a1.5 1.5 0 0 1-1.5-1.5v-11L9 6.5z" />
      <path d="M7.5 12h9" />
    </>
  ),
  categories: (
    <>
      <path d="M3.5 7.5 12 3.5l8.5 4-8.5 4z" />
      <path d="m3.5 12 8.5 4 8.5-4" />
      <path d="m3.5 16.5 8.5 4 8.5-4" />
    </>
  ),
  inventory: (
    <>
      <path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16z" />
      <path d="M3.5 8 12 12.5 20.5 8M12 12.5v8" />
    </>
  ),
  orders: (
    <>
      <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8.5h6M9 12h6" />
    </>
  ),
  customers: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </>
  ),
  homepage: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 9h17M8 14.5l2 2 4-4" />
    </>
  ),
  media: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.75" />
      <path d="m4 18 5.5-5 4 3.5 2.5-2 4 3.5" />
    </>
  ),
  promotions: (
    <>
      <path d="M20.5 12.5 12.5 20.5a1.5 1.5 0 0 1-2 0l-7-7V3.5h10l7 7a1.5 1.5 0 0 1 0 2z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  finance: (
    <>
      <path d="M4 19.5h16M6.5 16V11M11 16V7M15.5 16v-6M20 16V5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" />
    </>
  ),
  staff: (
    <>
      <circle cx="9" cy="9" r="3" />
      <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" />
      <path d="M15.5 6.5a3 3 0 0 1 0 5.5M17 14.7c1.9.5 3.1 1.9 3.5 4.3" />
    </>
  ),
};

export function NavIcon({ name }: { name: AdminSectionKey }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
