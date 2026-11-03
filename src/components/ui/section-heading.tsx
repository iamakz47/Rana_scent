import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  title: string;
  body?: string;
  as?: "h1" | "h2";
  id?: string;
  action?: ReactNode;
  className?: string;
};

export function SectionHeading({ title, body, as: Tag = "h2", id, action, className }: Props) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-6", className)}>
      <div className="max-w-2xl">
        <Tag id={id} className="font-display text-step-4 leading-[1.05] text-ink">
          {title}
        </Tag>
        {body && <p className="mt-4 max-w-xl text-step-1 text-ink-soft">{body}</p>}
      </div>
      {action}
    </div>
  );
}
