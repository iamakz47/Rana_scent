import { ScentField } from "@/components/brand/scent-field";
import { GOLD_HEX } from "@/components/brand/scent-colors";
import { ButtonLink } from "@/components/ui/button";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export default async function NotFound() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <section className="grain relative isolate flex min-h-[80svh] items-center overflow-hidden pt-24">
      <ScentField tint={GOLD_HEX} originX={0.5} originY={-0.1} intensity={0.7} />
      <div className="container-page relative text-center">
        <p className="font-display text-step-6 text-gold">404</p>
        <h1 className="mt-4 font-display text-step-4 text-ivory">{dict.notFound.title}</h1>
        <p className="mx-auto mt-4 max-w-md text-ivory/65">{dict.notFound.body}</p>
        <ButtonLink href={localePath(locale)} size="lg" className="mt-10">
          {dict.notFound.cta}
        </ButtonLink>
      </div>
    </section>
  );
}
