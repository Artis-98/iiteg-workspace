import { useState } from "react";
import { initials } from "@/lib/workspace";

/**
 * A person's picture, falling back to their initials.
 *
 * The fallback also covers a broken image URL — an upload that later 404s
 * should degrade to initials rather than leave a torn-image icon in the header.
 */
export function Avatar({
  name,
  email,
  src,
  size = 32,
  className = "",
  title,
}: {
  name?: string | null;
  email?: string | null;
  src?: string | null;
  /** Pixel diameter. Text scales with it. */
  size?: number;
  className?: string;
  title?: string;
}) {
  const [failed, setFailed] = useState(false);
  const label = initials(name || email || "?");
  const showImage = !!src && !failed;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--tint-strong)] text-[var(--txt-1)] ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(7, Math.round(size * 0.36)) }}
      title={title ?? email ?? undefined}
    >
      {showImage ? (
        <img
          src={src as string}
          alt={name || email || ""}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="font-medium leading-none">{label}</span>
      )}
    </div>
  );
}
