import {
  infoKeys,
  parseDeviceSpecs,
  simpleSpecKeys,
  type DeviceSpecs,
  type InfoSections,
} from "@/features/catalog/product-details";

// Reads the specification, information and free-fragrance fields of the
// product form. Empty means "not provided" (never guessed).
type Result = {
  device_specs: DeviceSpecs;
  info_sections: InfoSections;
  free_fragrances: "" | "1" | "2";
  free_fragrance_eligible: boolean;
  errors: Record<string, "freeCount">;
};

const get = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

// Values written before Phase 6 that the six simple fields now replace.
const replacedKeys = ["coverage_m2", "capacity_ml", "colors"] as const;

export function readProductDetails(formData: FormData, type: string): Result {
  const errors: Result["errors"] = {};

  // Specifications the simplified editor doesn't show are kept as they were.
  let kept: DeviceSpecs = {};
  try {
    kept = parseDeviceSpecs(JSON.parse(get(formData, "device_specs_keep") || "{}"));
  } catch {
    kept = {};
  }
  const specs: Record<string, unknown> = { ...kept };
  for (const key of [...simpleSpecKeys, ...replacedKeys]) delete specs[key];

  // The six specifications: Arabic is enough; English is optional.
  for (const key of simpleSpecKeys) {
    const ar = get(formData, `spec_${key}_ar`).slice(0, 400);
    const en = get(formData, `spec_${key}_en`).slice(0, 400);
    if (ar || en) specs[key] = { ar, en };
  }

  const info: Record<string, { ar: string; en: string }> = {};
  for (const key of infoKeys) {
    const ar = get(formData, `info_${key}_ar`).slice(0, 5000);
    const en = get(formData, `info_${key}_en`).slice(0, 5000);
    if (ar || en) info[key] = { ar, en };
  }

  const free = get(formData, "free_fragrances") || "0";
  if (!["0", "1", "2"].includes(free)) errors.free_fragrances = "freeCount";
  const freeValue = free === "1" || free === "2" ? free : "";

  return {
    device_specs: specs as DeviceSpecs,
    info_sections: info as InfoSections,
    free_fragrances: type === "diffuser" ? freeValue : "",
    free_fragrance_eligible: formData.get("free_fragrance_eligible") !== null ? formData.get("free_fragrance_eligible") === "on" : true,
    errors,
  };
}
