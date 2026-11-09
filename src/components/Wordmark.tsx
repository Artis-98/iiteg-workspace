/** Original shared-panes identity. The SVG contains no external fonts or assets. */
export function Wordmark({ className = "", short = false }: { className?: string; short?: boolean }) {
  return <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
    <img src="/workspace-icon-6dcba744a2.svg" alt="" aria-hidden="true" width={28} height={28} className="h-7 w-7 shrink-0" />
    <span>{short ? "IITEG" : "IITEG Workspace"}</span>
  </span>;
}
