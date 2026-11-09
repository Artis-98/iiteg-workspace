import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { initials, type WsUser } from "@/lib/workspace";

const labelStyle = { letterSpacing: "0.2em" } as const;

/** Toggleable person bubbles — click a bubble to assign, click again to unassign. */
export function AssigneeBubbles({
  users,
  selected,
  onToggle,
  size = "md",
}: {
  users: WsUser[];
  selected: number[];
  onToggle: (id: number) => void;
  size?: "sm" | "md";
}) {
  if (users.length === 0) {
    return <p className="text-[11px] text-[var(--txt-3)]">No people yet.</p>;
  }
  const dot = size === "sm" ? "h-5 w-5 text-[8px]" : "h-6 w-6 text-[9px]";
  return (
    <div className="flex flex-wrap gap-1.5">
      {users.map((u) => {
        const on = selected.includes(u.id);
        return (
          <button
            key={u.id}
            type="button"
            title={u.email}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(u.id);
            }}
            className={`flex items-center gap-1.5 rounded-full border px-1 py-1 pr-2.5 text-[11px] transition ${
              on
                ? "border-white/70 bg-[var(--tint-strong)] text-[var(--txt-1)]"
                : "border-[var(--line)] bg-[var(--input)] text-[var(--txt-3)] hover:border-[var(--line)] hover:text-[var(--txt-1)]"
            }`}
          >
            <span
              className={`flex items-center justify-center rounded-full ${dot} ${
                on ? "bg-[var(--txt-1)] text-[var(--s-1)]" : "bg-[var(--s-3)] text-[var(--txt-2)]"
              }`}
            >
              {initials(u.name || u.email)}
            </span>
            <span className="max-w-[110px] truncate">{u.name || u.email}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Small popover that shows assignee bubbles — used on kanban cards.
    Rendered in a portal at fixed coordinates so scrolling columns never clip it. */
export function BubblePopover({
  trigger,
  title,
  users,
  selected,
  onToggle,
  align = "right",
}: {
  trigger: ReactNode;
  title: string;
  users: WsUser[];
  selected: number[];
  onToggle: (id: number) => void;
  align?: "left" | "right";
}) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const open = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 224;
    const left = align === "right" ? Math.max(8, r.right - width) : Math.min(window.innerWidth - width - 8, r.left);
    setPos({ top: Math.min(r.bottom + 6, window.innerHeight - 280), left });
  };

  return (
    <span className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        title={title}
        onClick={() => (pos ? setPos(null) : open())}
        className="flex items-center rounded-[3px] px-1 py-0.5 transition hover:bg-[var(--tint-strong)]"
      >
        {trigger}
      </button>
      {pos &&
        createPortal(
          <div className="fixed inset-0 z-[80]" onClick={() => setPos(null)}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ top: pos.top, left: pos.left, width: 224 }}
              className="fixed max-h-64 overflow-auto border border-[var(--line)] bg-[var(--s-2)] p-2 shadow-xl backdrop-blur-md"
            >
              <p className="mb-2 text-[9px] uppercase text-[var(--txt-3)]" style={labelStyle}>
                {title}
              </p>
              <AssigneeBubbles users={users} selected={selected} onToggle={onToggle} size="sm" />
            </div>
          </div>,
          document.body
        )}
    </span>
  );
}
