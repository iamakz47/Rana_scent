import Link from "next/link";
import { ViewTransition } from "react";
import { ProductArt } from "@/components/brand/product-art";
import { GOLD_HEX, scentHex } from "@/components/brand/scent-colors";
import { Availability } from "@/components/ui/availability";
import { Price } from "@/components/ui/price";
import { toCartLine } from "@/features/cart/to-cart-line";
import { WishlistButton } from "@/features/wishlist/wishlist-button";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, type Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { lowestPrice, productStock, type Product } from "../types";
import { QuickAdd } from "./quick-add";

type Props = {
  product: Product;
  locale: Locale;
  dict: Dictionary;
  size?: "default" | "feature";
  // Only one card per product per page may carry the shared-element name.
  morph?: boolean;
};

export function ProductCard({ product, locale, dict, size = "default", morph = true }: Props) {
  const stock = productStock(product);
  const firstAvailable = product.variants.find((variant) => variant.stock > 0) ?? product.variants[0];
  const multiplePrices = new Set(product.variants.map((v) => v.priceFils)).size > 1;
  const accent = product.scentFamily ? scentHex[product.scentFamily] : GOLD_HEX;
  const href = localePath(locale, `/products/${product.slug}`);

  return (
    <article
      className="group/card relative flex h-full flex-col"
      style={{ "--accent": accent } as React.CSSProperties}
    >
      {/* The title link below is the accessible link; this image link is a
          duplicate pointer target, hidden from assistive tech and tab order. */}
      <Link
        href={href}
        transitionTypes={["nav-forward"]}
        tabIndex={-1}
        aria-hidden
        className="relative block overflow-hidden rounded-[1.75rem] border border-ink/10 bg-beige/70 transition-[border-color,box-shadow] duration-700 ease-[var(--ease-out-expo)] group-hover/card:border-[color-mix(in_oklab,var(--accent)_45%,transparent)] group-hover/card:shadow-[0_28px_60px_-34px_rgba(53,42,36,0.45)]"
      >
        <span
          aria-hidden
          className="absolute inset-0 opacity-0 transition-opacity duration-700 group-hover/card:opacity-100"
          style={{ background: "radial-gradient(70% 55% at 50% 45%, color-mix(in oklab, var(--accent) 28%, transparent), transparent 70%)" }}
        />
        <ViewTransition name={morph ? `product-${product.slug}` : undefined} share="product-morph" default="none">
          <ProductArt
            art={product.images[0].art}
            family={product.scentFamily}
            uid={`card-${product.id}`}
            label={product.images[0].alt[locale]}
            className={cn(
              "transition-transform duration-[900ms] ease-[var(--ease-out-expo)] group-hover/card:-translate-y-2 group-hover/card:scale-[1.03] motion-reduce:transform-none",
              size === "feature" ? "aspect-[4/5] lg:aspect-[5/6]" : "aspect-[4/5]",
            )}
          />
        </ViewTransition>
        <span className="absolute start-4 top-4 flex gap-1.5">
          {product.isNew && (
            <span className="rounded-full bg-gold px-2.5 py-1 text-[0.65rem] font-semibold text-ink">
              {dict.product.new}
            </span>
          )}
          <span className="rounded-full border border-ink/12 bg-canvas/85 px-2.5 py-1 text-[0.65rem] text-ink-soft backdrop-blur-sm">
            {dict.common.sampleBadge}
          </span>
        </span>
      </Link>

      <div className="absolute end-3 top-3 z-10">
        <WishlistButton slug={product.slug} />
      </div>

      <div className="flex flex-1 items-start justify-between gap-3 px-1 pt-4">
        <div className="min-w-0">
          {product.scentFamily && (
            <p className="mb-1 flex items-center gap-2 text-step--1 text-ink-soft">
              <span aria-hidden className="h-px w-5" style={{ background: accent }} />
              {dict.families[product.scentFamily]}
            </p>
          )}
          <h3 className={cn("font-display leading-tight text-ink", size === "feature" ? "text-step-3" : "text-step-2")}>
            <Link href={href} transitionTypes={["nav-forward"]} className="after:absolute after:inset-0 after:rounded-[1.75rem] after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-gold-deep">
              {product.name[locale]}
            </Link>
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Price
              fils={multiplePrices ? lowestPrice(product) : firstAvailable.priceFils}
              compareAtFils={multiplePrices ? undefined : firstAvailable.compareAtFils}
              locale={locale}
              prefix={multiplePrices ? dict.common.from : undefined}
            />
            <Availability
              stock={stock}
              labels={{ inStock: dict.product.inStock, lowStock: dict.product.lowStock, outOfStock: dict.product.outOfStock }}
            />
          </div>
        </div>
        <QuickAdd
          line={toCartLine(product, firstAvailable)}
          disabled={firstAvailable.stock <= 0}
          className="relative z-10 shrink-0"
        />
      </div>
    </article>
  );
}
