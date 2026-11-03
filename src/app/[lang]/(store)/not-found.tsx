import { ButtonLink } from "@/components/ui/button";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export default async function NotFound() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <section className="relative flex min-h-[70svh] items-center bg-beige/50 py-20">
      <div className="container-page text-center">
        <p className="font-display text-step-6 text-gold">404</p>
        <h1 className="mt-4 font-display text-step-4 text-ink">{dict.notFound.title}</h1>
        <p className="mx-auto mt-4 max-w-md text-ink-soft">{dict.notFound.body}</p>
        <ButtonLink href={localePath(locale)} size="lg" className="mt-10">
          {dict.notFound.cta}
        </ButtonLink>
      </div>
    </section>
  );
}
