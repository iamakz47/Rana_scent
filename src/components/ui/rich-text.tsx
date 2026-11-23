import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// Renders admin-entered text with a tiny, safe subset of formatting:
//   "## Heading", "- bullet", "1. numbered", blank line = new paragraph.
// Everything is rendered as text; HTML in the input is never interpreted.
type Block =
  | { kind: "heading"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "p"; text: string };

export function parseRichText(input: string): Block[] {
  const blocks: Block[] = [];
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  const flush = () => {
    // Line breaks inside a paragraph are kept as typed.
    if (paragraph.length) blocks.push({ kind: "p", text: paragraph.join("\n") });
    paragraph = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    // "## Heading", or a short line ending with a colon ("المميزات:").
    const heading = line.match(/^#{1,3}\s+(.*)$/) ?? line.match(/^([^.!؟?]{1,60}[:：])$/);
    const bullet = line.match(/^[-•*]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", text: heading[1] });
    } else if (bullet || numbered) {
      flush();
      const kind = bullet ? "ul" : "ol";
      const text = (bullet ?? numbered)![1];
      const last = blocks[blocks.length - 1];
      if (last && last.kind === kind) last.items.push(text);
      else blocks.push({ kind, items: [text] });
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

export function RichText({
  text,
  className,
  headingLevel = 3,
  ...rest
}: { text: string; className?: string; headingLevel?: 2 | 3; "data-testid"?: string }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const blocks = parseRichText(text);
  const out: ReactNode[] = blocks.map((block, index) => {
    switch (block.kind) {
      case "heading":
        return (
          <Heading key={index} className="mt-6 font-display text-step-1 text-ink first:mt-0">
            {block.text}
          </Heading>
        );
      case "ul":
        return (
          <ul key={index} className="list-disc space-y-1.5 ps-5 marker:text-gold">
            {block.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        );
      case "ol":
        return (
          <ol key={index} className="list-decimal space-y-1.5 ps-5 marker:text-gold-deep">
            {block.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
        );
      default:
        return (
          <p key={index} className="whitespace-pre-line">
            {block.text}
          </p>
        );
    }
  });
  return (
    <div className={cn("space-y-3 leading-relaxed text-ink-soft", className)} {...rest}>
      {out}
    </div>
  );
}
