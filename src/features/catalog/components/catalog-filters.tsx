"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useOptimistic, useRef, useState } from "react";
import { scentHex } from "@/components/brand/scent-colors";
import { SearchIcon } from "@/components/ui/icons";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { sortOptions } from "../queries";
import { productTypes, scentFamilies } from "../types";

// URL-driven filters: the server renders results from search params, so
// every filtered view is shareable and works without client data.
export function CatalogFilters() {
  const { dict } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [optimistic, setOptimistic] = useOptimistic(params.toString());
  const current = new URLSearchParams(optimistic);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const searchRef = useRef<HTMLInputElement>(null);

  const update = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(current);
    mutate(next);
    const qs = next.toString();
    startTransition(() => {
      setOptimistic(qs);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  const toggleList = (key: "type" | "family", value: string) =>
    update((next) => {
      const values = new Set((next.get(key) ?? "").split(",").filter(Boolean));
      if (values.has(value)) values.delete(value);
      else values.add(value);
      if (values.size) next.set(key, [...values].join(","));
      else next.delete(key);
    });

  // Debounce typing into the URL.
  useEffect(() => {
    if ((params.get("q") ?? "") === query) return;
    const timer = window.setTimeout(() => {
      update((next) => {
        if (query.trim()) next.set("q", query.trim());
        else next.delete("q");
      });
    }, 280);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (window.location.hash === "#search") searchRef.current?.focus();
  }, []);

  const selected = (key: "type" | "family") => (current.get(key) ?? "").split(",").filter(Boolean);
  const types = selected("type");
  const families = selected("family");
  const chip =
    "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-step--1 transition-colors duration-300";
  const hasFilters = [...current.keys()].length > 0;

  return (
    <div className="space-y-5">
      <label id="search" className="relative block scroll-mt-28">
        <span className="sr-only">{dict.shop.searchLabel}</span>
        <SearchIcon className="pointer-events-none absolute start-5 top-1/2 -translate-y-1/2 text-gold-300" />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={dict.shop.searchPlaceholder}
          maxLength={80}
          className="h-14 w-full rounded-full border border-white/12 bg-navy-900/70 ps-14 pe-5 text-step-0 text-ivory placeholder:text-ivory/40 transition-colors focus:border-gold-300/70 focus:outline-none"
        />
      </label>

      <div className="space-y-3">
        <fieldset className="min-w-0">
          <legend className="sr-only">{dict.shop.type}</legend>
          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {productTypes.map((type) => {
              const on = types.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleList("type", type)}
                  className={cn(chip, on ? "border-gold-300 bg-gold-400/15 text-gold-200" : "border-white/12 text-ivory/75 hover:border-gold-400/50")}
                >
                  {dict.types[type]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="sr-only">{dict.shop.family}</legend>
          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {scentFamilies.map((family) => {
              const on = families.includes(family);
              return (
                <button
                  key={family}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleList("family", family)}
                  className={cn(chip, on ? "text-ivory" : "border-white/12 text-ivory/75 hover:border-white/30")}
                  style={on ? { borderColor: scentHex[family], background: `${scentHex[family]}26` } : undefined}
                >
                  <span aria-hidden className="size-2.5 rounded-full" style={{ background: scentHex[family] }} />
                  {dict.families[family]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <label className={cn(chip, "cursor-pointer border-white/12 text-ivory/80 has-[:checked]:border-gold-300 has-[:checked]:text-gold-200")}>
            <input
              type="checkbox"
              checked={current.get("inStock") === "1"}
              onChange={(event) =>
                update((next) => (event.target.checked ? next.set("inStock", "1") : next.delete("inStock")))
              }
              className="size-4 accent-[var(--color-gold-400)]"
            />
            {dict.shop.inStock}
          </label>

          <label className="flex items-center gap-2 text-step--1 text-ivory/70">
            {dict.shop.sort}
            <select
              value={current.get("sort") ?? "featured"}
              onChange={(event) =>
                update((next) =>
                  event.target.value === "featured" ? next.delete("sort") : next.set("sort", event.target.value),
                )
              }
              className="min-h-11 rounded-full border border-white/12 bg-navy-900 px-4 text-ivory focus:border-gold-300/70 focus:outline-none"
            >
              {sortOptions.map((option) => (
                <option key={option} value={option}>
                  {dict.shop.sortOptions[option]}
                </option>
              ))}
            </select>
          </label>

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                update((next) => [...next.keys()].forEach((key) => next.delete(key)));
              }}
              className="min-h-11 px-2 text-step--1 text-ivory/60 underline-offset-4 hover:text-ivory hover:underline"
            >
              {dict.shop.clear}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
