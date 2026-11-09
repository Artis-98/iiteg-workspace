import { useState } from "react";
import { DEFAULT_BRANDING, useBranding } from "@/lib/branding";
import { useTheme } from "@/lib/theme";
/** Company identity is configuration; the product mark is only the fallback. */
export function Wordmark({ className = "", short = false }: { className?: string; short?: boolean }) {
  const { data } = useBranding();
  const branding = data || DEFAULT_BRANDING;
  const [theme] = useTheme();
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const customLogo = theme === "dark" ? branding.logo_dark_url || branding.logo_url : branding.logo_url || branding.logo_dark_url;
  const hasCustomLogo = !!customLogo && failedLogo !== customLogo;
  const logo = hasCustomLogo ? customLogo! : "/workspace-icon-6dcba744a2.svg";
  const showName = !hasCustomLogo || branding.show_name;
  return <span role="img" aria-label={branding.name} className={`inline-flex min-w-0 items-center gap-2 font-semibold tracking-tight ${className}`}>
    <img key={logo} src={logo} alt="" aria-hidden="true" className={`${hasCustomLogo && !showName ? "h-[1.65em] max-w-[9em]" : "h-[1.65em] max-w-[2.5em]"} w-auto shrink-0 object-contain`} onError={() => { if (hasCustomLogo) setFailedLogo(customLogo); }} />
    {showName && !short && <span className="truncate">{branding.name}</span>}
  </span>;
}
