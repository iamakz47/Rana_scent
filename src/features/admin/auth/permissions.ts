// Mirrors public.permissions / public.role_permissions in the database.
// The database is the source of truth and enforces every rule; this copy only
// decides what the admin UI offers (navigation, buttons) for a role.

export const staffRoles = ["owner", "admin", "manager", "editor", "support", "finance"] as const;
export type StaffRole = (typeof staffRoles)[number];

export const permissions = [
  "dashboard.view",
  "catalog.read",
  "catalog.write",
  "catalog.publish",
  "inventory.read",
  "inventory.adjust",
  "content.write",
  "media.write",
  "orders.read",
  "orders.write",
  "customers.read",
  "marketing.write",
  "finance.read",
  "finance.write",
  "settings.write",
  "staff.read",
  "staff.write",
  "audit.read",
] as const;
export type Permission = (typeof permissions)[number];

export function isPermission(value: string): value is Permission {
  return (permissions as readonly string[]).includes(value);
}

export function isStaffRole(value: string): value is StaffRole {
  return (staffRoles as readonly string[]).includes(value);
}

// Roles a given role may grant or revoke (the database guard enforces the
// same rule: only owners manage owner and admin access).
export function assignableRoles(actor: StaffRole): StaffRole[] {
  if (actor === "owner") return [...staffRoles];
  return staffRoles.filter((role) => role !== "owner" && role !== "admin");
}

export const adminSections = [
  { key: "dashboard", href: "/admin", permission: "dashboard.view" },
  { key: "products", href: "/admin/products", permission: "catalog.read" },
  { key: "categories", href: "/admin/categories", permission: "catalog.read" },
  { key: "inventory", href: "/admin/inventory", permission: "inventory.read" },
  { key: "orders", href: "/admin/orders", permission: "orders.read" },
  { key: "customers", href: "/admin/customers", permission: "customers.read" },
  { key: "homepage", href: "/admin/homepage", permission: "content.write" },
  { key: "media", href: "/admin/media", permission: "media.write" },
  { key: "promotions", href: "/admin/promotions", permission: "marketing.write" },
  { key: "finance", href: "/admin/finance", permission: "finance.read" },
  { key: "settings", href: "/admin/settings", permission: "settings.write" },
  { key: "staff", href: "/admin/staff", permission: "staff.read" },
] as const satisfies ReadonlyArray<{ key: string; href: string; permission: Permission }>;

export type AdminSectionKey = (typeof adminSections)[number]["key"];

// Post-login destinations must be admin paths on this site: never external.
export function safeAdminPath(value: unknown): string {
  if (typeof value !== "string") return "/admin";
  if (!/^\/admin(\/[A-Za-z0-9\-._~/]*)?(\?[A-Za-z0-9\-._~=&%]*)?$/.test(value)) return "/admin";
  if (value.includes("//") || value.includes("..")) return "/admin";
  return value;
}
