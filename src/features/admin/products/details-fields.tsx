"use client";

import { useAdminI18n } from "@/features/admin/i18n/client";
import { BilingualFields, Checkbox, Field, Panel, Select, TextInput } from "@/features/admin/ui/primitives";
import { infoKeys, textSpecKeys, type DeviceSpecs, type InfoSections } from "@/features/catalog/product-details";

type Errors = Record<string, string> | undefined;

function NumberField({ name, label, value, error }: { name: string; label: string; value?: number; error?: string }) {
  return (
    <Field label={label} htmlFor={name} error={error}>
      <TextInput id={name} name={name} inputMode="decimal" dir="ltr" defaultValue={value ?? ""} maxLength={12} />
    </Field>
  );
}

export function DeviceDetailsPanel({
  type,
  specs,
  freeFragrances,
  freeEligible,
  errors,
}: {
  type: string;
  specs: DeviceSpecs;
  freeFragrances: "" | "1" | "2";
  freeEligible: boolean;
  errors: Errors;
}) {
  const { t } = useAdminI18n();
  const c = t.p5;
  const labels = { ar: t.common.arabic, en: t.common.english };
  const err = (key: string) => (errors?.[key] ? c.errors[errors[key] as keyof typeof c.errors] : undefined);

  return (
    <Panel title={c.deviceDetails} description={c.deviceHint}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={c.freeCount} htmlFor="free_fragrances" hint={c.freeCountHint} error={err("free_fragrances")}>
            <Select id="free_fragrances" name="free_fragrances" defaultValue={freeFragrances}>
              <option value="">{c.freeChoose}</option>
              <option value="1">1</option>
              <option value="2">2</option>
            </Select>
          </Field>
          {type === "refill" ? (
            <div className="pt-6">
              <Checkbox name="free_fragrance_eligible" label={c.freeEligible} hint={c.freeEligibleHint} defaultChecked={freeEligible} />
            </div>
          ) : (
            <input type="hidden" name="free_fragrance_eligible" value={freeEligible ? "on" : "off"} />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField name="spec_coverage_m2" label={c.coverage} value={specs.coverage_m2} error={err("spec_coverage_m2")} />
          <NumberField name="spec_capacity_ml" label={c.capacity} value={specs.capacity_ml} error={err("spec_capacity_ml")} />
          <NumberField name="spec_power_consumption_w" label={c.powerConsumption} value={specs.power_consumption_w} error={err("spec_power_consumption_w")} />
          <NumberField name="spec_noise_db" label={c.noise} value={specs.noise_db} error={err("spec_noise_db")} />
        </div>

        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-step--1 font-medium text-ink">{c.dimensions}</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NumberField name="spec_dim_width" label={c.width} value={specs.dimensions?.width} />
            <NumberField name="spec_dim_height" label={c.height} value={specs.dimensions?.height} />
            <NumberField name="spec_dim_depth" label={c.depth} value={specs.dimensions?.depth} />
            <Field label={c.unit} htmlFor="spec_dim_unit">
              <Select id="spec_dim_unit" name="spec_dim_unit" defaultValue={specs.dimensions?.unit ?? "cm"}>
                <option value="cm">cm · سم</option>
                <option value="mm">mm · مم</option>
              </Select>
            </Field>
          </div>
          {err("spec_dimensions") ? <p className="mt-1 text-step--1 text-[#86352b]">{err("spec_dimensions")}</p> : null}
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-step--1 font-medium text-ink">{c.weight}</legend>
          <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
            <NumberField name="spec_weight_value" label={c.weightValue} value={specs.weight?.value} />
            <Field label={c.unit} htmlFor="spec_weight_unit">
              <Select id="spec_weight_unit" name="spec_weight_unit" defaultValue={specs.weight?.unit ?? "g"}>
                <option value="g">g · غ</option>
                <option value="kg">kg · كغ</option>
              </Select>
            </Field>
          </div>
          {err("spec_weight") ? <p className="mt-1 text-step--1 text-[#86352b]">{err("spec_weight")}</p> : null}
        </fieldset>

        {textSpecKeys.map((key) => (
          <div key={key}>
            <BilingualFields
              name={`spec_${key}`}
              label={c.textSpecs[key]}
              values={specs[key] as { ar: string; en: string } | undefined}
              maxLength={400}
              labels={labels}
            />
            {err(`spec_${key}`) ? <p className="mt-1 text-step--1 text-[#86352b]">{err(`spec_${key}`)}</p> : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function InfoSectionsPanel({ info, errors }: { info: InfoSections; errors: Errors }) {
  const { t } = useAdminI18n();
  const c = t.p5;
  const labels = { ar: t.common.arabic, en: t.common.english };
  return (
    <Panel title={c.information} description={c.informationHint}>
      <div className="space-y-5">
        {infoKeys.map((key) => (
          <div key={key}>
            <BilingualFields
              name={`info_${key}`}
              label={c.infoSections[key]}
              values={info[key]}
              multiline
              rows={4}
              maxLength={5000}
              labels={labels}
            />
            {errors?.[`info_${key}`] ? <p className="mt-1 text-step--1 text-[#86352b]">{c.errors.pair}</p> : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}
