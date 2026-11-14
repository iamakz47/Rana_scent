// Mirrors private.order_transition_allowed() for the admin UI. The database
// enforces the real rule; this only decides which buttons to offer.
export const staffNextStatuses: Record<string, string[]> = {
  pending: ["processing"],
  awaiting_payment: [],
  paid: ["processing"],
  processing: ["ready_for_delivery"],
  ready_for_delivery: ["out_for_delivery", "processing"],
  out_for_delivery: ["delivered", "ready_for_delivery"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  refunded: [],
};

export const cancellableStatuses = new Set(["pending", "awaiting_payment", "paid", "processing", "ready_for_delivery"]);

export const orderStatusFilters = [
  "all", "awaiting_payment", "pending", "paid", "processing", "ready_for_delivery", "out_for_delivery",
  "delivered", "cancelled", "refunded",
] as const;

export function orderStatusTone(status: string): "success" | "neutral" | "warning" | "gold" {
  if (["paid", "delivered"].includes(status)) return "success";
  if (["cancelled", "refunded"].includes(status)) return "neutral";
  if (status === "awaiting_payment") return "warning";
  return "gold";
}
