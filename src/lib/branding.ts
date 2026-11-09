import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
export type WorkspaceBranding = { name: string; logo_url: string | null; logo_dark_url: string | null; show_name: boolean };
export const DEFAULT_BRANDING: WorkspaceBranding = { name: "IITEG Workspace", logo_url: null, logo_dark_url: null, show_name: true };
export const brandingKey = ["workspace-branding"] as const;
export const fetchBranding = () => api<{ branding: WorkspaceBranding }>("/branding.php").then(r => r.branding);
export const saveBranding = (branding: WorkspaceBranding) => api<{ branding: WorkspaceBranding }>("/branding.php", { method: "PUT", body: JSON.stringify(branding) }).then(r => r.branding);
export function useBranding() {
  return useQuery({ queryKey: brandingKey, queryFn: fetchBranding, staleTime: 30_000, refetchInterval: 60_000, retry: 1 });
}
