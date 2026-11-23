"use client";

import { useAdminI18n } from "@/features/admin/i18n/client";
import { BilingualFields } from "@/features/admin/ui/primitives";
import { infoKeys, type InfoSections } from "@/features/catalog/product-details";

// Information sections from Phase 5, kept (under advanced settings) so
// existing text is preserved. New products use the single description.
export function InfoSectionsFields({ info }: { info: InfoSections }) {
  const { t } = useAdminI18n();
  const c = t.p5;
  const labels = { ar: t.common.arabic, en: t.common.english };
  return (
    <div className="space-y-5">
      {infoKeys.map((key) => (
        <BilingualFields
          key={key}
          name={`info_${key}`}
          label={c.infoSections[key]}
          values={info[key] ? { ar: info[key].ar, en: info[key].en ?? "" } : undefined}
          multiline
          rows={3}
          maxLength={5000}
          labels={labels}
        />
      ))}
    </div>
  );
}
