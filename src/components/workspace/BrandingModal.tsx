import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { uploadFile } from "@/lib/api";
import { brandingKey, DEFAULT_BRANDING, saveBranding, useBranding, type WorkspaceBranding } from "@/lib/branding";
const field = "w-full rounded-xl border border-[var(--line-strong)] bg-[var(--input)] px-3 py-2.5 text-sm text-[var(--txt-1)] outline-none focus:border-[var(--action)]";
export function BrandingModal({ onClose }: { onClose: () => void }) {
  const query = useBranding();
  const [draft, setDraft] = useState<WorkspaceBranding>(query.data || DEFAULT_BRANDING);
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const qc = useQueryClient();
  useEffect(() => { if (query.data && !dirty) setDraft(query.data); }, [query.data, dirty]);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close); }, [onClose]);
  function patch(next: Partial<WorkspaceBranding>) { setDirty(true); setDraft(current => ({ ...current, ...next })); }
  const save = useMutation({ mutationFn: () => saveBranding({ ...draft, name: draft.name.trim(), logo_url: draft.logo_url?.trim() || null, logo_dark_url: draft.logo_dark_url?.trim() || null }), onSuccess: data => { qc.setQueryData(brandingKey, data); void qc.invalidateQueries({ queryKey: brandingKey }); toast.success("Workspace branding saved"); onClose(); }, onError: (error: Error) => toast.error(error.message || "Could not save branding") });
  async function upload(file: File | undefined, key: "logo_url" | "logo_dark_url") {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) { toast.error("Choose a PNG, JPEG, or WebP image under 2 MB"); return; }
    setUploading(key);
    try { patch({ [key]: await uploadFile(file, "branding") }); } catch (error) { toast.error((error as Error).message || "Logo upload failed"); } finally { setUploading(null); }
  }
  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="branding-heading" onClick={event => event.stopPropagation()} className="overlay-1 max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl p-6 text-[var(--txt-1)]">
      <div className="mb-2 flex items-center justify-between"><h2 id="branding-heading" className="text-xl font-semibold">Workspace branding</h2><button type="button" aria-label="Close branding settings" onClick={onClose} className="rounded-full p-2"><X className="h-4 w-4" /></button></div>
      <p className="mb-6 text-xs leading-relaxed text-[var(--txt-2)]">Your company name and logo appear on sign-in and throughout this workspace. Changes apply to everyone.</p>
      <form onSubmit={event => { event.preventDefault(); save.mutate(); }} className="space-y-5">
        <div><label htmlFor="workspace-name" className="mb-2 block text-xs font-medium">Workspace name</label><input id="workspace-name" className={field} autoFocus required maxLength={80} value={draft.name} onChange={event => patch({ name: event.target.value })} /></div>
        {([['logo_url', 'Logo'], ['logo_dark_url', 'Dark-mode logo (optional)']] as const).map(([key, label]) => <div key={key}>
          <label htmlFor={`brand-${key}`} className="mb-2 block text-xs font-medium">{label}</label>
          <div className="flex gap-2"><input id={`brand-${key}`} className={field} placeholder="https://… or upload an image" value={draft[key] || ""} onChange={event => patch({ [key]: event.target.value })} />
          <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-[var(--line-strong)] px-3 text-xs"><input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" disabled={!!uploading} aria-label={`Upload ${label.toLowerCase()}`} onChange={event => { void upload(event.target.files?.[0], key); event.target.value = ""; }} />{uploading === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Upload</label></div>
        </div>)}
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={draft.show_name} onChange={event => patch({ show_name: event.target.checked })} />Show the name beside the logo</label>
        <div className="grid grid-cols-2 gap-3">{([['Light', '#f3f5f8', '#172638', draft.logo_url || draft.logo_dark_url], ['Dark', '#182331', '#f3f5f8', draft.logo_dark_url || draft.logo_url]] as const).map(([label, background, color, logo]) => <div key={label}><p className="mb-1.5 text-[10px] text-[var(--txt-3)]">{label}</p><div className="flex h-20 items-center justify-center gap-2 rounded-2xl border border-[var(--line)] px-3" style={{ background, color }}>{logo && <img src={logo} alt={`${label} logo preview`} className={`${draft.show_name ? "max-w-12" : "max-w-full"} max-h-10 object-contain`} />}{(!logo || draft.show_name) && <span className="truncate text-sm font-semibold">{draft.name || "Workspace"}</span>}</div></div>)}</div>
        <p className="text-[10px] text-[var(--txt-3)]">Uploads: PNG, JPEG, or WebP under 2 MB. A separate dark logo is useful for a wordmark. Leave both URLs empty to use the product icon.</p>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-full border border-[var(--line-strong)] px-4 py-2 text-xs">Cancel</button><button type="submit" disabled={save.isPending || !!uploading || !draft.name.trim()} className="rounded-full bg-[var(--action)] px-5 py-2 text-xs font-semibold text-[var(--action-ink)] disabled:opacity-50">{save.isPending ? "Saving…" : "Save branding"}</button></div>
      </form>
    </section>
  </div>, document.body);
}
