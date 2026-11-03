import { availabilityOf } from "@/features/catalog/types";
import { format } from "@/i18n/format";
import { cn } from "@/lib/cn";

type Labels = { inStock: string; lowStock: string; outOfStock: string };

export function Availability({ stock, labels, className }: { stock: number; labels: Labels; className?: string }) {
  const status = availabilityOf(stock);
  const text =
    status === "in_stock"
      ? labels.inStock
      : status === "low_stock"
        ? format(labels.lowStock, { count: stock })
        : labels.outOfStock;

  return (
    <span className={cn("inline-flex items-center gap-2 text-step--1", className)}>
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          status === "in_stock" && "bg-emerald-600 shadow-[0_0_10px] shadow-emerald-600/40",
          status === "low_stock" && "bg-gold shadow-[0_0_10px] shadow-gold/60",
          status === "out_of_stock" && "bg-taupe",
        )}
      />
      <span className={status === "out_of_stock" ? "text-ink-soft" : "text-ink"}>{text}</span>
    </span>
  );
}
