import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/info-page";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.pages.contact.title };
}

export default async function ContactPage() {
  const dict = await getDictionary();
  const page = dict.pages.contact;
  const field =
    "mt-2 w-full rounded-2xl border border-white/12 bg-navy-900/70 px-4 py-3 text-ivory placeholder:text-ivory/35 focus:border-gold-300/70 focus:outline-none disabled:opacity-60";

  return (
    <InfoPage title={page.title} lead={page.lead} draftNotice={dict.pages.draftNotice}>
      <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
        <section aria-labelledby="channels-title">
          <h2 id="channels-title" className="font-display text-step-3 text-ivory">
            {page.channels}
          </h2>
          <dl className="mt-6 divide-y divide-white/8 border-y border-white/8">
            {[page.email, page.phone, page.hours].map((label) => (
              <div key={label} className="flex flex-wrap justify-between gap-2 py-5">
                <dt className="text-ivory/60">{label}</dt>
                <dd className="text-ivory/70 italic">{page.toBeProvided}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="form-title" className="rounded-[2rem] border border-gold-400/20 bg-navy-900/50 p-6 sm:p-8">
          <h2 id="form-title" className="font-display text-step-3 text-ivory">
            {page.formTitle}
          </h2>
          <p className="mt-2 text-step--1 text-ivory/55">{page.formSoon}</p>
          <form className="mt-6 space-y-5" aria-describedby="form-title">
            <fieldset disabled className="min-w-0 space-y-5">
              <label className="block text-step--1 text-ivory/70">
                {page.name}
                <input name="name" autoComplete="name" className={field} />
              </label>
              <label className="block text-step--1 text-ivory/70">
                {page.emailField}
                <input name="email" type="email" autoComplete="email" className={field} />
              </label>
              <label className="block text-step--1 text-ivory/70">
                {page.message}
                <textarea name="message" rows={5} className={field} />
              </label>
              <Button type="submit" size="lg">
                {page.send}
              </Button>
            </fieldset>
          </form>
        </section>
      </div>
    </InfoPage>
  );
}
