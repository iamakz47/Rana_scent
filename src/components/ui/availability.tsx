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
          status === "in_stock" && "bg-emerald-300 shadow-[0_0_10px] shadow-emerald-300/70",
          status === "low_stock" && "bg-gold-300 shadow-[0_0_10px] shadow-gold-300/70",
          status === "out_of_stock" && "bg-ivory/30",
        )}
      />
      <span className={status === "out_of_stock" ? "text-ivory/50" : "text-ivory/80"}>{text}</span>
    </span>
  );
}
