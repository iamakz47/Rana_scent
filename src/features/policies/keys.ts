export const policyKeys = ["returns", "refunds", "warranty", "delivery", "terms", "privacy"] as const;
export type PolicyKey = (typeof policyKeys)[number];

export function isPolicyKey(value: unknown): value is PolicyKey {
  return typeof value === "string" && (policyKeys as readonly string[]).includes(value);
}

// Draft text still awaiting the owner's decision.
export const ownerMarker = /\[(OWNER TO CONFIRM|يحتاج تأكيد المالك|Legal review required|يحتاج مراجعة قانونية)[^\]]*\]/;
