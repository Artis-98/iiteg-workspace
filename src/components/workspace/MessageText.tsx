import { Fragment } from "react";

/* Pasted screenshots arrive as PNG or JPEG, so this covers every type
   upload.php accepts — not just the GIF formats the picker produces. */
const IMAGE_RE =
  /(https?:\/\/\S*\/file\.php\?id=[a-f0-9]{48}\.(?:jpg|png|gif|webp)&sig=[a-f0-9]{64}|https?:\/\/\S+\.(?:gif|webp|png|jpe?g|svg)(?:\?\S*)?|https?:\/\/media\d?\.giphy\.com\/\S+)/gi;

/** Renders message bodies: inline images, highlighted @mentions, plain text. */
export function MessageText({ body, myHandle }: { body: string; myHandle?: string }) {
  const images = body.match(IMAGE_RE) || [];
  const text = body.replace(IMAGE_RE, "").trim();

  return (
    <div className="space-y-2">
      {text && (
        <p className="whitespace-pre-wrap break-words text-[13px] text-[var(--txt-2)]">
          {text.split(/(@[\w.\-]+)/g).map((part, i) => {
            if (!part.startsWith("@")) return <Fragment key={i}>{part}</Fragment>;
            const mine =
              myHandle && part.slice(1).toLowerCase() === myHandle.toLowerCase();
            const broadcast = /^@(all|channel|everyone)$/i.test(part);
            return (
              <span
                key={i}
                className={`rounded px-1 ${
                  mine || broadcast
                    ? "bg-[var(--tint-strong)] font-medium text-[var(--txt-1)]"
                    : "bg-[var(--tint)] text-[var(--txt-1)]"
                }`}
              >
                {part}
              </span>
            );
          })}
        </p>
      )}
      {/* A screenshot shrunk to fit the thread is usually unreadable, so the
          thumbnail opens the original in a new tab. */}
      {images.map((src, i) => (
        <a key={i} href={src} target="_blank" rel="noreferrer" className="block w-fit">
          <img
            src={src}
            alt="Attachment"
            loading="lazy"
            className="max-h-56 rounded-xl border border-[var(--line)] transition hover:border-[var(--line-strong)]"
          />
        </a>
      ))}
    </div>
  );
}
