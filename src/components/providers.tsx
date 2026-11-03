"use client";

import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { I18nProvider } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

// Client-side providers shared by the storefront. Motion loads only the DOM
// animation feature set, and honours the visitor's reduced-motion setting.
export function StoreProviders({
  locale,
  dir,
  dict,
  children,
}: {
  locale: Locale;
  dir: "rtl" | "ltr";
  dict: Dictionary;
  children: ReactNode;
}) {
  return (
    <I18nProvider value={{ locale, dir, dict }}>
      <MotionConfig reducedMotion="user">
        <LazyMotion features={domAnimation} strict>
          {children}
        </LazyMotion>
      </MotionConfig>
    </I18nProvider>
  );
}
