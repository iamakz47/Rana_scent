"use client";

import { m } from "motion/react";
import { HeartIcon } from "@/components/ui/icons";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { toggleWishlist, useWishlist } from "./store";

export function WishlistButton({ slug, className }: { slug: string; className?: string }) {
  const { dict } = useI18n();
  const saved = useWishlist().includes(slug);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? dict.product.removeFromWishlist : dict.product.addToWishlist}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleWishlist(slug);
      }}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-full border border-ink/12 bg-canvas/85 backdrop-blur-md transition-colors hover:border-gold",
        saved ? "text-gold-deep" : "text-ink",
        className,
      )}
    >
      <m.span
        key={String(saved)}
        initial={{ scale: saved ? 0.6 : 1 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 600, damping: 14 }}
        className="inline-flex"
      >
        <HeartIcon filled={saved} size={20} />
      </m.span>
    </button>
  );
}
