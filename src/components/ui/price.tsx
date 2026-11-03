import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { formatKWD, type Fils } from "@/lib/money";

type Props = {
  fils: Fils;
  compareAtFils?: Fils;
  locale: Locale;
  prefix?: string;
  className?: string;
};

export function Price({ fils, compareAtFils, locale, prefix, className }: Props) {
  const discounted = compareAtFils !== undefined && compareAtFils > fils;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2 tabular-nums", className)}>
      {prefix && <span className="text-[0.8em] text-ink-soft">{prefix}</span>}
      <span className="font-medium text-ink">{formatKWD(fils, locale)}</span>
      {discounted && (
        <s className="text-[0.82em] text-ink-soft decoration-ink/30">
          {formatKWD(compareAtFils, locale)}
        </s>
      )}
    </span>
  );
}
