import {
  dimensionUnits,
  infoKeys,
  textSpecKeys,
  weightUnits,
  type DeviceSpecs,
  type InfoSections,
} from "@/features/catalog/product-details";

// Reads the device-detail and information fields of the product form.
// Empty means "not provided" (never guessed). Errors are field keys.
type Result = {
  device_specs: DeviceSpecs;
  info_sections: InfoSections;
  free_fragrances: "" | "1" | "2";
  free_fragrance_eligible: boolean;
  errors: Record<string, "number" | "dimensions" | "weight" | "pair" | "freeRequired">;
};

const get = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

function positiveNumber(raw: string): number | null | undefined {
  if (!raw) return undefined;
  const normalized = raw.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  return value > 0 && value <= 1_000_000 ? value : null;
}

export function readProductDetails(formData: FormData, type: string): Result {
  const errors: Result["errors"] = {};
  const specs: Record<string, unknown> = {};

  for (const key of ["coverage_m2", "capacity_ml", "power_consumption_w", "noise_db"] as const) {
    const value = positiveNumber(get(formData, `spec_${key}`));
    if (value === null) errors[`spec_${key}`] = "number";
    else if (value !== undefined) specs[key] = value;
  }

  const dims = ["width", "height", "depth"].map((d) => positiveNumber(get(formData, `spec_dim_${d}`)));
  const unit = get(formData, "spec_dim_unit");
  if (dims.every((d) => d === undefined)) {
    // not provided
  } else if (dims.some((d) => d === undefined || d === null) || !(dimensionUnits as readonly string[]).includes(unit)) {
    errors.spec_dimensions = "dimensions";
  } else {
    specs.dimensions = { width: dims[0], height: dims[1], depth: dims[2], unit };
  }

  const weight = positiveNumber(get(formData, "spec_weight_value"));
  const weightUnit = get(formData, "spec_weight_unit");
  if (weight === null || (weight !== undefined && !(weightUnits as readonly string[]).includes(weightUnit))) {
    errors.spec_weight = "weight";
  } else if (weight !== undefined) {
    specs.weight = { value: weight, unit: weightUnit };
  }

  for (const key of textSpecKeys) {
    const ar = get(formData, `spec_${key}_ar`).slice(0, 400);
    const en = get(formData, `spec_${key}_en`).slice(0, 400);
    if (!ar && !en) continue;
    if (!ar || !en) errors[`spec_${key}`] = "pair";
    else specs[key] = { ar, en };
  }

  const info: Record<string, { ar: string; en: string }> = {};
  for (const key of infoKeys) {
    const ar = get(formData, `info_${key}_ar`).slice(0, 5000);
    const en = get(formData, `info_${key}_en`).slice(0, 5000);
    if (!ar && !en) continue;
    if (!ar || !en) errors[`info_${key}`] = "pair";
    else info[key] = { ar, en };
  }

  const free = get(formData, "free_fragrances");
  const freeValue = free === "1" || free === "2" ? free : "";
  if (type === "diffuser" && !freeValue) errors.free_fragrances = "freeRequired";

  return {
    device_specs: specs as DeviceSpecs,
    info_sections: info as InfoSections,
    free_fragrances: type === "diffuser" ? freeValue : "",
    free_fragrance_eligible: formData.get("free_fragrance_eligible") !== null ? formData.get("free_fragrance_eligible") === "on" : true,
    errors,
  };
}
