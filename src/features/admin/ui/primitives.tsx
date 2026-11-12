import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

// Admin design primitives. Same tokens as the storefront (ivory canvas,
// beige surfaces, espresso type, muted gold) but denser and calmer: hairline
// borders, small radii, display type only for page titles and figures.

export function AdminPageHeader({
  eyebrow,
  title,
  body,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-ink/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-[0.7rem] font-medium uppercase tracking-[0.22em] text-gold-deep">{eyebrow}</p>
        ) : null}
        <h1 className="font-display text-step-3 leading-tight text-ink">{title}</h1>
        {body ? <p className="mt-2 max-w-2xl text-step--1 text-ink-soft">{body}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-ink/10 bg-canvas shadow-[0_1px_0_rgba(53,42,36,0.04)]", className)}>
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/8 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-step-0 font-medium text-ink">{title}</h2>
            {description ? <p className="mt-0.5 text-step--1 text-ink-soft">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({ title, body, action }: { title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-gold/45 bg-surface/50 px-6 py-14 text-center">
      <span aria-hidden className="mb-4 block h-px w-12 bg-gradient-to-r from-transparent via-gold to-transparent" />
      <p className="font-display text-step-2 text-ink">{title}</p>
      {body ? <p className="mx-auto mt-2 max-w-md text-step--1 text-ink-soft">{body}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

type Tone = "neutral" | "gold" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "border-ink/15 bg-surface text-ink-soft",
  gold: "border-gold/40 bg-gold/12 text-gold-deep",
  success: "border-[#5f7f5a]/30 bg-[#5f7f5a]/10 text-[#3f5c3b]",
  warning: "border-[#b07a2a]/35 bg-[#b07a2a]/10 text-[#7a5112]",
  danger: "border-[#a4493d]/30 bg-[#a4493d]/10 text-[#86352b]",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[0.75rem] font-medium leading-5",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): Tone {
  if (status === "published") return "success";
  if (status === "archived") return "neutral";
  return "gold";
}

export function Notice({ tone = "gold", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div role="status" className={cn("rounded-xl border px-4 py-3 text-step--1", tones[tone])}>
      {children}
    </div>
  );
}

// ---------- Form controls ----------

const control =
  "block w-full min-w-0 rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-step--1 text-ink shadow-[inset_0_1px_0_rgba(53,42,36,0.03)] transition-colors placeholder:text-ink-soft/60 hover:border-ink/30 focus:border-gold-deep focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold-deep disabled:opacity-60 aria-[invalid=true]:border-[#a4493d]";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-step--1 font-medium text-ink">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1 text-[0.78rem] text-ink-soft">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1 text-[0.78rem] text-[#86352b]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "min-h-10", className)} {...props} />;
}

export function TextArea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "min-h-10 pe-8", className)} {...props} />;
}

export function Checkbox({ label, hint, className, ...props }: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 text-step--1 text-ink", className)}>
      <input type="checkbox" className="mt-1 size-4 shrink-0 accent-[#7a5f33]" {...props} />
      <span>
        {label}
        {hint ? <span className="block text-[0.78rem] text-ink-soft">{hint}</span> : null}
      </span>
    </label>
  );
}

type ButtonTone = "primary" | "outline" | "ghost" | "danger";

const buttonTones: Record<ButtonTone, string> = {
  primary: "bg-ink text-canvas hover:bg-espresso shadow-[0_8px_20px_-12px_rgba(53,42,36,0.6)]",
  outline: "border border-ink/20 bg-canvas text-ink hover:border-gold hover:bg-gold/8",
  ghost: "text-ink hover:bg-ink/6",
  danger: "border border-[#a4493d]/35 text-[#86352b] hover:bg-[#a4493d]/10",
};

export function adminButton(tone: ButtonTone = "primary", size: "sm" | "md" = "md") {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    size === "md" ? "min-h-10 px-4 text-step--1" : "min-h-8 px-3 text-[0.8rem]",
    buttonTones[tone],
  );
}

export function BilingualFields({
  name,
  label,
  values,
  multiline,
  maxLength,
  required,
  hint,
  labels,
  rows,
}: {
  name: string;
  label: ReactNode;
  values?: { ar?: string | null; en?: string | null };
  multiline?: boolean;
  maxLength?: number;
  required?: boolean;
  hint?: ReactNode;
  labels: { ar: string; en: string };
  rows?: number;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-step--1 font-medium text-ink">{label}</legend>
      <div className="grid gap-3 md:grid-cols-2">
        {(["ar", "en"] as const).map((lang) => {
          const id = `${name}_${lang}`;
          const common = {
            id,
            name: id,
            dir: lang === "ar" ? "rtl" : "ltr",
            lang,
            defaultValue: values?.[lang] ?? "",
            maxLength,
            required,
            "aria-label": `${typeof label === "string" ? label : name} (${labels[lang]})`,
          } as const;
          return (
            <div key={lang} className="min-w-0">
              <span className="mb-1 block text-[0.7rem] uppercase tracking-[0.18em] text-ink-soft">{labels[lang]}</span>
              {multiline ? <TextArea rows={rows ?? 4} {...common} /> : <TextInput {...common} />}
            </div>
          );
        })}
      </div>
      {hint ? <p className="mt-1 text-[0.78rem] text-ink-soft">{hint}</p> : null}
    </fieldset>
  );
}
