import { describe, expect, it } from "vitest";
import { newPasswordSchema, signInSchema } from "./schemas";
import { assignableRoles, safeAdminPath } from "./permissions";

describe("admin permissions helpers", () => {
  it("only owners may assign owner or admin", () => {
    expect(assignableRoles("owner")).toContain("owner");
    expect(assignableRoles("owner")).toContain("admin");
    for (const role of ["admin", "manager", "editor", "support", "finance"] as const) {
      expect(assignableRoles(role)).not.toContain("owner");
      expect(assignableRoles(role)).not.toContain("admin");
    }
  });

  it("keeps post-login redirects inside the admin", () => {
    expect(safeAdminPath("/admin/products")).toBe("/admin/products");
    expect(safeAdminPath("/admin?denied=1")).toBe("/admin?denied=1");
    for (const bad of ["https://evil.example", "//evil.example", "/admin//evil", "/shop", "/admin/../x", 42, undefined]) {
      expect(safeAdminPath(bad)).toBe("/admin");
    }
  });
});

describe("admin auth schemas", () => {
  it("normalises email and enforces the password policy", () => {
    expect(signInSchema.parse({ email: " Owner@Example.COM ", password: "x" }).email).toBe("owner@example.com");
    expect(newPasswordSchema.safeParse({ password: "short", confirm: "short" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: "alllowercase1", confirm: "alllowercase1" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: "Strong-Pass1", confirm: "Strong-Pass2" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: "Strong-Pass1", confirm: "Strong-Pass1" }).success).toBe(true);
  });
});
