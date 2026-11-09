import type { PresenceState } from "@/lib/presence";

const LOOK: Record<PresenceState, { color: string; label: string }> = {
  online: { color: "#22c55e", label: "Online" },
  afk: { color: "#eab308", label: "Away" },
  offline: { color: "#6b7280", label: "Offline" },
};

/**
 * Presence indicator.
 *
 * `ring` draws a border in the surface colour so the dot reads as separate when
 * it overlaps an avatar, rather than smudging into it.
 */
export function PresenceDot({
  state = "offline",
  size = 8,
  ring = false,
  className = "",
}: {
  state?: PresenceState;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const { color, label } = LOOK[state];
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        boxShadow: ring ? "0 0 0 2px var(--s-1)" : undefined,
      }}
    />
  );
}

/** Avatar with the dot pinned to its bottom-right corner. */
export function PresenceAvatar({
  initials,
  state,
  title,
  size = 18,
  src,
}: {
  initials: string;
  state?: PresenceState;
  title?: string;
  size?: number;
  /** Profile picture; the initials show through when absent. */
  src?: string | null;
}) {
  return (
    <span className="relative inline-flex shrink-0" title={title}>
      <span
        className="flex items-center justify-center overflow-hidden rounded-full bg-[var(--s-4)] text-[var(--txt-2)]"
        style={{ width: size, height: size, fontSize: Math.max(7, Math.round(size * 0.42)) }}
      >
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </span>
      <PresenceDot
        state={state}
        size={Math.max(6, Math.round(size * 0.38))}
        ring
        className="absolute -bottom-px -right-px"
      />
    </span>
  );
}
