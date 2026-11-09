export function Wordmark({ className = "", short = false }: { className?: string; short?: boolean }) {
  return <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
    <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-xl bg-[var(--action)] text-[13px] text-[var(--action-ink)]">W</span>
    <span>{short ? "IITEG" : "IITEG Workspace"}</span>
  </span>;
}
