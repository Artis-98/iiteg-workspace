import { useEffect, useRef, useState } from "react";
import { Send, Smile, Sparkles, X, Search } from "lucide-react";
import { toast } from "sonner";
import { initials, mentionHandle, type WsUser } from "@/lib/workspace";
import { uploadFile } from "@/lib/api";

const labelStyle = { letterSpacing: "0.2em" } as const;

const EMOJI = [
  "😀","😄","😅","🤣","🙂","😉","😍","🤩","😎","🤔","🫡","🙌","👏","👍","👎","🙏",
  "💪","🔥","✨","🎉","🚀","💡","✅","❌","⚠️","⏳","📌","📎","📈","💰","🛠️","🧠",
  "❤️","🤝","👀","😴","😤","😭","🥳","🤷",
];

const GIPHY_KEY = (import.meta.env["VITE_GIPHY_API_KEY"] as string | undefined) || "";

/** upload.php validates the MIME type, and the clipboard rarely supplies a
 *  usable filename — Chrome says "image.png", Safari can say nothing at all —
 *  so the name is rebuilt from the MIME type instead of trusted. */
const IMAGE_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

type Gif = { id: string; url: string; preview: string };

/** Shared message box: @mentions, emoji and GIFs for channels, DMs and task chat. */
export function ChatComposer({
  users = [],
  placeholder = "Write a message…",
  pending,
  onSend,
  compact,
}: {
  users?: WsUser[];
  placeholder?: string;
  pending?: boolean;
  onSend: (body: string) => void;
  compact?: boolean;
}) {
  const [body, setBody] = useState("");
  const [emoji, setEmoji] = useState(false);
  const [gifs, setGifs] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  /** Images already uploaded and waiting to go out with the next message. */
  const [shots, setShots] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const attach = async (files: File[]) => {
    for (const f of files) {
      const ext = IMAGE_EXT[f.type];
      if (!ext) {
        toast.error(`${f.type || "That file"} is not an image type the server accepts`);
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const named = new File([f], `pasted-${Date.now()}.${ext}`, { type: f.type });
        const url = await uploadFile(named, "chat");
        setShots((prev) => [...prev, url]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not upload that image");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const images = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    // Pasting text stays pasting text; only take over when there is an image.
    if (!images.length) return;
    e.preventDefault();
    void attach(images);
  };

  const matches =
    mentionQuery === null
      ? []
      : users
          .filter((u) => {
            const q = mentionQuery.toLowerCase();
            return (
              mentionHandle(u).includes(q) ||
              (u.name || "").toLowerCase().includes(q) ||
              u.email.toLowerCase().includes(q)
            );
          })
          .slice(0, 6);

  const update = (value: string) => {
    setBody(value);
    const m = /@([\w.\-]*)$/.exec(value.slice(0, inputRef.current?.selectionStart ?? value.length));
    setMentionQuery(m ? m[1]! : null);
  };

  const pickMention = (u: WsUser) => {
    setBody((prev) => prev.replace(/@([\w.\-]*)$/, `@${mentionHandle(u)} `));
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const submit = () => {
    const value = body.trim();
    // An image on its own is a message; text is no longer required.
    if ((!value && !shots.length) || pending || uploading > 0) return;
    onSend([value, ...shots].filter(Boolean).join("\n"));
    setBody("");
    setShots([]);
    setMentionQuery(null);
  };

  return (
    <div className="relative">
      {mentionQuery !== null && matches.length > 0 && (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-64 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--s-2)] shadow-2xl backdrop-blur-xl">
          <p className="px-3 py-2 text-[9px] uppercase text-[var(--txt-3)]" style={labelStyle}>
            Mention someone
          </p>
          {matches.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => pickMention(u)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--txt-2)] transition hover:bg-[var(--tint-strong)] hover:text-[var(--txt-1)]"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--s-3)] text-[8px]">
                {initials(u.name || u.email)}
              </span>
              <span className="truncate">@{mentionHandle(u)}</span>
              <span className="ml-auto truncate text-[10px] text-[var(--txt-3)]">{u.name || u.email}</span>
            </button>
          ))}
        </div>
      )}

      {emoji && (
        <Popover title="Emoji" onClose={() => setEmoji(false)}>
          <div className="grid grid-cols-8 gap-1 p-2">
            {EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setBody((prev) => prev + e);
                  inputRef.current?.focus();
                }}
                className="rounded-lg p-1.5 text-lg transition hover:bg-[var(--tint-strong)]"
              >
                {e}
              </button>
            ))}
          </div>
        </Popover>
      )}

      {gifs && (
        <Popover title="GIFs" onClose={() => setGifs(false)}>
          <GifSearch
            onPick={(url) => {
              setGifs(false);
              onSend(url);
            }}
          />
        </Popover>
      )}

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--input)] px-3 py-2 transition focus-within:border-[var(--line-strong)]">
        {(shots.length > 0 || uploading > 0) && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {shots.map((url) => (
              <div key={url} className="relative">
                <img
                  src={url}
                  alt="Attachment"
                  className="h-16 w-16 rounded-lg border border-[var(--line)] object-cover"
                />
                <button
                  type="button"
                  title="Remove"
                  onClick={() => setShots((prev) => prev.filter((u) => u !== url))}
                  className="absolute -right-1.5 -top-1.5 rounded-full border border-[var(--line)] bg-[var(--s-4)] p-0.5 text-[var(--txt-2)] transition hover:text-[var(--txt-1)]"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {uploading > 0 && (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-[var(--line-strong)] text-[10px] text-[var(--txt-3)]">
                Uploading…
              </div>
            )}
          </div>
        )}
        <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          rows={compact ? 1 : 2}
          value={body}
          onChange={(e) => update(e.target.value)}
          onPaste={onPaste}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          className="max-h-32 min-h-[34px] flex-1 resize-none bg-transparent py-1.5 text-sm text-[var(--txt-1)] placeholder-[var(--txt-3)] outline-none"
        />
        <button
          type="button"
          title="Emoji"
          onClick={() => { setEmoji((v) => !v); setGifs(false); }}
          className="rounded-full p-1.5 text-[var(--txt-3)] transition hover:bg-[var(--tint-strong)] hover:text-[var(--txt-1)]"
        >
          <Smile className="h-4 w-4" strokeWidth={1.7} />
        </button>
        <button
          type="button"
          title="GIF"
          onClick={() => { setGifs((v) => !v); setEmoji(false); }}
          className="rounded-full p-1.5 text-[var(--txt-3)] transition hover:bg-[var(--tint-strong)] hover:text-[var(--txt-1)]"
        >
          <Sparkles className="h-4 w-4" strokeWidth={1.7} />
        </button>
        {/* Icon-only on phones: the word "Send" costs about a third of the
            row on a 375px screen, which is what squeezes the input. */}
        <button
          type="button"
          onClick={submit}
          disabled={pending || uploading > 0 || (!body.trim() && !shots.length)}
          title="Send"
          aria-label="Send"
          className="flex shrink-0 items-center gap-2 rounded-full bg-[var(--txt-1)] p-2 text-[10px] font-bold uppercase text-[var(--s-1)] transition hover:opacity-90 disabled:opacity-40 sm:px-4 sm:py-2"
          style={labelStyle}
        >
          <Send className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Send</span>
        </button>
        </div>
      </div>
    </div>
  );
}

function Popover({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <span className="fixed inset-0 z-20 block" onClick={onClose} />
      <div className="absolute bottom-full right-0 z-30 mb-2 w-[320px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--s-2)] shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
          <span className="text-[9px] uppercase text-[var(--txt-3)]" style={labelStyle}>{title}</span>
          <button onClick={onClose} className="text-[var(--txt-3)] hover:text-[var(--txt-1)]">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

function GifSearch({ onPick }: { onPick: (url: string) => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!GIPHY_KEY) {
      setError("Add VITE_GIPHY_API_KEY to .env to enable GIF search.");
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const endpoint = q.trim()
          ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&limit=18&rating=pg-13&q=${encodeURIComponent(q)}`
          : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=18&rating=pg-13`;
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error("GIF search failed");
        const json = (await res.json()) as { data: any[] };
        if (cancelled) return;
        setItems(
          json.data.map((g) => ({
            id: g.id,
            url: g.images?.downsized?.url || g.images?.original?.url,
            preview: g.images?.fixed_width_small?.url || g.images?.downsized?.url,
          }))
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "GIF search failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const t = setTimeout(run, q ? 350 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
        <Search className="h-3.5 w-3.5 text-[var(--txt-3)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search GIFs"
          className="w-full bg-transparent text-[12px] text-[var(--txt-1)] placeholder-[var(--txt-3)] outline-none"
        />
      </div>
      {error && <p className="px-3 py-4 text-[11px] text-[var(--txt-3)]">{error}</p>}
      {loading && !error && <p className="px-3 py-4 text-[11px] text-[var(--txt-3)]">Loading…</p>}
      {!error && (
        <div className="grid max-h-64 grid-cols-3 gap-1 overflow-y-auto p-2">
          {items.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onPick(g.url)}
              className="overflow-hidden rounded-lg border border-transparent transition hover:border-[var(--line-strong)]"
            >
              <img src={g.preview} alt="GIF" className="h-20 w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
