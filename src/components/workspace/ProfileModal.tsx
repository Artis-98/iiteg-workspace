import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { updateStoredUser } from "@/lib/api";
import { uploadFile } from "@/lib/api";
import { changeMyPassword, updateMyProfile, type WsMe } from "@/lib/permissions";
import { Avatar } from "./Avatar";

const labelCls = "mb-1 block text-[10px] uppercase text-[var(--txt-3)]";
const labelStyle = { letterSpacing: "0.2em" } as const;
const inputCls =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--txt-1)] placeholder-[var(--txt-3)] outline-none transition focus:border-[var(--line-strong)] disabled:opacity-60";

/** Your own account: name, picture and password. Email is shown but fixed. */
export function ProfileModal({ me, onClose }: { me: WsMe; onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(me.name || "");
  const [avatar, setAvatar] = useState<string | null>(me.avatar_url);
  const [uploading, setUploading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["ws-me"] });
    qc.invalidateQueries({ queryKey: ["ws-users"] });
  };

  const saveProfile = useMutation({
    mutationFn: () => updateMyProfile({ name: name.trim(), avatar_url: avatar }),
    onSuccess: (updated) => {
      // Keep the copy in localStorage in step, or the header would show the
      // old name until the next sign-in.
      updateStoredUser({ name: updated.name, avatar_url: updated.avatar_url });
      toast.success("Profile saved");
      refresh();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "Could not save your profile"),
  });

  const savePassword = useMutation({
    mutationFn: () => changeMyPassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e: Error) => toast.error(e.message || "Could not change your password"),
  });

  async function pickAvatar(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("That image is over 5MB — pick a smaller one");
      return;
    }
    setUploading(true);
    try {
      setAvatar(await uploadFile(file, "avatars"));
    } catch (e) {
      toast.error((e as Error).message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const passwordsMatch = newPassword === confirmPassword;
  const canSubmitPassword =
    currentPassword.length > 0 && newPassword.length >= 8 && passwordsMatch && !savePassword.isPending;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="overlay-1 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <span className="label-micro">Your account</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--txt-3)] transition hover:bg-[var(--tint)] hover:text-[var(--txt-1)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-auto p-4">
          {/* ---- Picture ---- */}
          <div className="flex items-center gap-4">
            <Avatar name={name} email={me.email} src={avatar} size={64} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[10px] uppercase text-[var(--txt-2)] transition hover:text-[var(--txt-1)] disabled:opacity-50"
                  style={labelStyle}
                >
                  {uploading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Camera className="h-3 w-3" strokeWidth={1.8} />
                  )}
                  {uploading ? "Uploading…" : "Change picture"}
                </button>
                {avatar && (
                  <button
                    type="button"
                    onClick={() => setAvatar(null)}
                    title="Remove picture"
                    className="flex items-center justify-center rounded-lg border border-[var(--line)] px-2.5 text-[var(--txt-3)] transition hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-[var(--txt-3)]">
                Square images look best. Remove it to go back to your initials.
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickAvatar(f);
                e.target.value = "";
              }}
            />
          </div>

          {/* ---- Name + email ---- */}
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveProfile.mutate();
            }}
          >
            <div>
              <label className={labelCls} style={labelStyle}>Display name</label>
              <input
                className={inputCls}
                required
                value={name}
                placeholder="Your name"
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls} style={labelStyle}>Email</label>
              <input className={inputCls} value={me.email} disabled readOnly />
              <p className="mt-1 text-[10px] text-[var(--txt-3)]">
                Your email is how you sign in, so it cannot be changed here.
              </p>
            </div>

            <div>
              <label className={labelCls} style={labelStyle}>Role</label>
              <p className="text-[13px] text-[var(--txt-2)]">
                {me.role_name}
                <span className="ml-2 text-[10px] text-[var(--txt-3)]">
                  set by an admin, not by you
                </span>
              </p>
            </div>

            <button
              type="submit"
              disabled={saveProfile.isPending || uploading}
              className="w-full rounded-lg bg-[var(--txt-1)] py-2.5 text-[11px] font-bold uppercase text-[var(--s-1)] transition hover:opacity-90 disabled:opacity-50"
              style={labelStyle}
            >
              {saveProfile.isPending ? "Saving…" : "Save profile"}
            </button>
          </form>

          {/* ---- Password ---- */}
          <form
            className="space-y-4 border-t border-[var(--line)] pt-5"
            onSubmit={(e) => {
              e.preventDefault();
              savePassword.mutate();
            }}
          >
            <span className="label-micro">Change password</span>

            <div>
              <label className={labelCls} style={labelStyle}>Current password</label>
              <input
                className={inputCls}
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>New password</label>
              <input
                className={inputCls}
                type="password"
                autoComplete="new-password"
                value={newPassword}
                placeholder="at least 8 characters"
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Repeat new password</label>
              <input
                className={inputCls}
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="mt-1 text-[10px] text-red-400">Those two do not match.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmitPassword}
              className="w-full rounded-lg border border-[var(--line)] py-2.5 text-[11px] font-bold uppercase text-[var(--txt-2)] transition hover:text-[var(--txt-1)] disabled:opacity-40"
              style={labelStyle}
            >
              {savePassword.isPending ? "Changing…" : "Change password"}
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
