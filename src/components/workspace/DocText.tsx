import { Fragment, type ReactNode } from "react";

/** Renders document bodies. A deliberately small Markdown subset — headings,
 *  lists, quotes, rules, fenced code and inline formatting — so notes read well
 *  without pulling a parser into the bundle. Anything unrecognised stays as
 *  plain text rather than disappearing. */

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*|\[[^\]]+\]\([^)\s]+\)|https?:\/\/\S+)/g;

const LINK =
  "text-[var(--txt-2)] underline decoration-white/25 underline-offset-2 transition hover:text-[var(--txt-1)]";

function inline(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter((part) => part !== "")
    .map((part, i) => {
      const key = `${keyPrefix}-${i}`;
      if (part.length > 1 && part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={key}
            className="rounded bg-[var(--tint-strong)] px-1 py-0.5 font-mono text-[12px] text-[var(--txt-1)]"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={key} className="font-semibold text-[var(--txt-1)]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) {
        return <em key={key}>{part.slice(1, -1)}</em>;
      }
      const md = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
      if (md && /^(https?:\/\/|mailto:|\/[^/]|#)/i.test(md[2])) {
        return (
          <a key={key} href={md[2]} target="_blank" rel="noreferrer" className={LINK}>
            {md[1]}
          </a>
        );
      }
      if (/^https?:\/\//.test(part)) {
        return (
          <a key={key} href={part} target="_blank" rel="noreferrer" className={LINK}>
            {part}
          </a>
        );
      }
      return <Fragment key={key}>{part}</Fragment>;
    });
}

const HEADING_CLS = [
  "mt-6 text-xl text-[var(--txt-1)] first:mt-0",
  "mt-6 text-base text-[var(--txt-1)] first:mt-0",
  "mt-5 text-[13px] uppercase text-[var(--txt-2)] first:mt-0",
];

export function DocText({ body }: { body: string }) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];

  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];
  let fence: string[] | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const key = `p-${out.length}`;
    out.push(
      <p key={key} className="text-[13px] leading-relaxed text-[var(--txt-2)]">
        {inline(paragraph.join(" "), key)}
      </p>,
    );
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    const { ordered, items } = list;
    const key = `l-${out.length}`;
    const cls = "ml-5 space-y-1 text-[13px] leading-relaxed text-[var(--txt-2)]";
    out.push(
      ordered ? (
        <ol key={key} className={`${cls} list-decimal`}>
          {items.map((item, i) => (
            <li key={i}>{inline(item, `${key}-${i}`)}</li>
          ))}
        </ol>
      ) : (
        <ul key={key} className={`${cls} list-disc`}>
          {items.map((item, i) => (
            <li key={i}>{inline(item, `${key}-${i}`)}</li>
          ))}
        </ul>
      ),
    );
    list = null;
  };

  const flushQuote = () => {
    if (!quote.length) return;
    const key = `q-${out.length}`;
    out.push(
      <blockquote
        key={key}
        className="border-l-2 border-[var(--line)] pl-3 text-[13px] leading-relaxed text-[var(--txt-2)]"
      >
        {inline(quote.join(" "), key)}
      </blockquote>,
    );
    quote = [];
  };

  /** Everything except the block currently being collected. */
  const flushOthers = (keep?: "paragraph" | "list" | "quote") => {
    if (keep !== "paragraph") flushParagraph();
    if (keep !== "list") flushList();
    if (keep !== "quote") flushQuote();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^```/.test(line.trim())) {
      if (fence === null) {
        flushOthers();
        fence = [];
      } else {
        const key = `c-${out.length}`;
        out.push(
          <pre
            key={key}
            className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--input)] p-3 font-mono text-[12px] leading-relaxed text-[var(--txt-1)]"
          >
            {fence.join("\n")}
          </pre>,
        );
        fence = null;
      }
      continue;
    }
    if (fence !== null) {
      fence.push(raw);
      continue;
    }

    if (line.trim() === "") {
      flushOthers();
      continue;
    }

    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      flushOthers();
      out.push(<hr key={`hr-${out.length}`} className="border-[var(--line)]" />);
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushOthers();
      const level = heading[1].length;
      const key = `h-${out.length}`;
      const Tag = (["h1", "h2", "h3"] as const)[level - 1];
      out.push(
        <Tag
          key={key}
          className={HEADING_CLS[level - 1]}
          style={level === 3 ? { letterSpacing: "0.15em" } : undefined}
        >
          {inline(heading[2], key)}
        </Tag>,
      );
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = !!numbered;
      const item = (bullet ?? numbered)![1];
      flushOthers("list");
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push(item);
      continue;
    }

    const quoted = /^\s*>\s?(.*)$/.exec(line);
    if (quoted) {
      flushOthers("quote");
      quote.push(quoted[1]);
      continue;
    }

    // Consecutive plain lines join into one paragraph, so only other blocks flush.
    flushOthers("paragraph");
    paragraph.push(line.trim());
  }

  if (fence !== null && fence.length) {
    // Unterminated fence — show the text rather than swallowing it.
    out.push(
      <pre
        key={`c-${out.length}`}
        className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--input)] p-3 font-mono text-[12px] leading-relaxed text-[var(--txt-1)]"
      >
        {fence.join("\n")}
      </pre>,
    );
  }
  flushOthers();

  return <div className="space-y-3">{out}</div>;
}
