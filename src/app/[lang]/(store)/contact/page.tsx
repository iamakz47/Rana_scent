import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/info-page";
import { RichText } from "@/components/ui/rich-text";
import { telHref, whatsappHref } from "@/features/contact/channels";
import { ContactForm } from "@/features/contact/contact-form";
import { getStoreContact } from "@/features/contact/store-contact";
import { getPublishedPage } from "@/features/site-pages/data";
import { pick } from "@/features/site-pages/schema";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const [dict, locale, published] = await Promise.all([getDictionary(), getLocale(), getPublishedPage("contact")]);
  return { title: published ? pick(published.title, locale) : dict.pages.contact.title };
}

const pill =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-step--1 font-medium transition-colors duration-300";

export default async function ContactPage() {
  const [dict, locale, published, contact] = await Promise.all([getDictionary(), getLocale(), getPublishedPage("contact"), getStoreContact()]);
  const page = dict.pages.contact;
  const title = published ? pick(published.title, locale) : page.title;
  const lead = published ? pick(published.lead, locale) || undefined : page.lead;
  const extra = published ? pick(published.body, locale) : "";
  const whatsapp = contact.whatsapp ? whatsappHref(contact.whatsapp) : null;
  const call = contact.phone ? telHref(contact.phone) : null;
  const channels = [
    { label: page.email, value: contact.email, href: contact.email ? `mailto:${contact.email}` : null },
    { label: page.phone, value: contact.phone || contact.whatsapp, href: call },
    { label: page.instagram, value: contact.instagram ? `@${contact.instagram}` : "", href: contact.instagram ? `https://instagram.com/${contact.instagram}` : null },
  ];

  return (
    <InfoPage title={title} lead={lead} draftNotice={published ? undefined : dict.pages.draftNotice}>
      <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
        <section aria-labelledby="channels-title">
          <h2 id="channels-title" className="font-display text-step-3 text-ink">
            {page.channels}
          </h2>
          {whatsapp || call || contact.email ? (
            <div className="mt-6 flex flex-wrap gap-3" data-testid="contact-buttons">
              {whatsapp ? (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={`${pill} bg-[#1f7a4d] text-white hover:bg-[#186641]`}>
                  {page.whatsapp}
                </a>
              ) : null}
              {call ? (
                <a href={call} className={`${pill} border border-ink/20 text-ink hover:border-gold hover:bg-gold/10`}>
                  {page.call}
                </a>
              ) : null}
              {contact.email ? (
                <a href={`mailto:${contact.email}`} className={`${pill} border border-ink/20 text-ink hover:border-gold hover:bg-gold/10`}>
                  {page.emailUs}
                </a>
              ) : null}
            </div>
          ) : null}
          <dl className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
            {channels.map((channel) => (
              <div key={channel.label} className="flex flex-wrap justify-between gap-2 py-5">
                <dt className="text-ink-soft">{channel.label}</dt>
                <dd className={channel.value ? "text-ink" : "text-ink-soft italic"} dir={channel.value ? "ltr" : undefined}>
                  {channel.value && channel.href ? (
                    <a href={channel.href} className="underline-offset-4 hover:text-gold-deep hover:underline">
                      {channel.value}
                    </a>
                  ) : (
                    channel.value || page.toBeProvided
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {extra ? <RichText text={extra} className="mt-8" /> : null}
        </section>

        <section aria-labelledby="form-title" className="rounded-[2rem] border border-gold/50 bg-surface p-6 sm:p-8">
          <h2 id="form-title" className="font-display text-step-3 text-ink">
            {page.formTitle}
          </h2>
          <ContactForm />
        </section>
      </div>
    </InfoPage>
  );
}
