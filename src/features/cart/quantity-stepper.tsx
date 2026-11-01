"use client";

import { MinusIcon, PlusIcon } from "@/components/ui/icons";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { MAX_LINE_QUANTITY } from "./store";

type Props = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  compact?: boolean;
};

export function QuantityStepper({ value, onChange, min = 1, max = MAX_LINE_QUANTITY, compact }: Props) {
  const { dict } = useI18n();
  const button =
    "grid place-items-center rounded-full text-ivory/80 transition-colors hover:bg-white/8 hover:text-gold-200 disabled:opacity-30";

  return (
    <div
      role="group"
      aria-label={dict.product.quantity}
      className={cn("inline-flex items-center rounded-full border border-white/12", compact ? "h-11" : "h-13")}
    >
      <button
        type="button"
        className={cn(button, "size-11")}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={dict.product.decrease}
      >
        <MinusIcon size={18} />
      </button>
      <output aria-live="polite" className="min-w-8 text-center tabular-nums">
        {value}
      </output>
      <button
        type="button"
        className={cn(button, "size-11")}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={dict.product.increase}
      >
        <PlusIcon size={18} />
      </button>
    </div>
  );
}
