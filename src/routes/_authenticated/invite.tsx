import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { createWsUser, fetchWsUsers, initials } from "@/lib/workspace";
import { canAssignRole, fetchRoles, useCan } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/invite")({
  head: () => ({
    meta: [
      { title: "Invite — IITEG Workspace" },
      { name: "description", content: "Create new IITEG Workspace users." },
      { property: "og:title", content: "Invite — IITEG Workspace" },
      { property: "og:description", content: "Create new IITEG Workspace users." },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("member");

  const { data: users } = useQuery({ queryKey: ["ws-users"], queryFn: fetchWsUsers });
  const { data: roles } = useQuery({ queryKey: ["ws-roles"], queryFn: fetchRoles });
  const { me } = useCan();

  // Only the roles you actually outrank — the server enforces the same rule.
  const assignable = (roles || []).filter((r) => canAssignRole(me, r));

  const create = useMutation({
    mutationFn: () => createWsUser({ email, password, name, role }),
    onSuccess: () => {
      toast.success(`${email} can now sign in`);
      setEmail("");
      setName("");
      setPassword("");
      qc.invalidateQueries({ queryKey: ["ws-users"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not create user"),
  });

  return (
    <WorkspaceShell>
      <header className="flex h-12 items-center border-b border-[var(--line)] px-6">
        <h1 className="text-[11px] uppercase text-[var(--txt-2)]" style={{ letterSpacing: "0.25em" }}>
          Invite user
        </h1>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-8 lg:grid-cols-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (password.length < 8) {
                toast.error("Password must be at least 6 characters");
                return;
              }
              create.mutate();
            }}
            className="space-y-4 border border-[var(--line)] bg-[var(--s-2)] backdrop-blur-md p-6"
          >
            <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="name@example.com" />
            <Field label="Display name" value={name} onChange={setName} placeholder="Optional" required={false} />
            <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="min 8 characters" />
            <div>
              <label className="mb-1 block text-[10px] uppercase text-[var(--txt-3)]" style={{ letterSpacing: "0.2em" }}>
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full border border-[var(--line)] bg-[var(--s-2)] backdrop-blur-md px-3 py-2 text-sm text-[var(--txt-1)] outline-none focus:border-[var(--line-strong)]"
              >
                {assignable.length === 0 && <option value="member">member</option>}
                {assignable.map((r) => (
                  <option key={r.id} value={r.slug}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={create.isPending}
              className="flex w-full items-center justify-center gap-2 bg-[var(--txt-1)] py-3 text-xs font-bold uppercase text-[var(--s-1)] transition hover:opacity-90 disabled:opacity-60"
              style={{ letterSpacing: "0.2em" }}
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Create user
            </button>
          </form>

          <div>
            <p className="mb-3 text-[10px] uppercase text-[var(--txt-3)]" style={{ letterSpacing: "0.2em" }}>
              Registered users
            </p>
            <div className="divide-y divide-zinc-900 border border-[var(--line)] bg-[var(--s-2)] backdrop-blur-md">
              {(users || []).map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--s-3)] text-[10px] text-[var(--txt-1)]">
                    {initials(u.name || u.email)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[var(--txt-1)]">{u.name}</p>
                    <p className="truncate text-[11px] text-[var(--txt-3)]">{u.email}</p>
                  </div>
                  <span className="ml-auto text-[9px] uppercase text-[var(--txt-3)]" style={{ letterSpacing: "0.2em" }}>
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase text-[var(--txt-3)]" style={{ letterSpacing: "0.2em" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-[var(--line)] bg-[var(--s-2)] backdrop-blur-md px-3 py-2 text-sm text-[var(--txt-1)] placeholder-[var(--txt-3)] outline-none focus:border-[var(--line-strong)]"
      />
    </div>
  );
}
