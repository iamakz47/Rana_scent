// Local-only test accounts created by global-setup against the local stack.
export const PASSWORD = "E2e-Local-Pass1";
export const accounts = {
  owner: "e2e-owner@rana.test",
  editor: "e2e-editor@rana.test",
  manager: "e2e-manager@rana.test",
  customer: "e2e-customer@rana.test",
} as const;
