import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Home,
  Menu,
  CalendarDays,
  Users,
  FileText,
  UserPlus,
  LogOut,
  Sun,
  Moon,
  Settings2,
} from "lucide-react";
import { getUser, logout } from "@/lib/api";
import { useCan } from "@/lib/permissions";
import { Wordmark } from "@/components/Wordmark";
import { Avatar } from "./Avatar";
import { ProfileModal } from "./ProfileModal";
import { BrandingModal } from "./BrandingModal";
import { DEFAULT_BRANDING, useBranding } from "@/lib/branding";
import { useTheme } from "@/lib/theme";
import { clearPresence, usePresenceHeartbeat, usePresenceMap } from "@/lib/presence";
import { useAppHeight } from "@/lib/viewport";
import { PresenceDot } from "./PresenceDot";
import { TimeTrackerButton } from "./TimeTracker";


const NAV = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/planner", label: "Planner", icon: CalendarDays },
  { to: "/teams", label: "Teams", icon: Users },
  { to: "/docs", label: "Docs", icon: FileText },
] as const;


export function WorkspaceShell({ children, onMenu }: { children: ReactNode; onMenu?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = getUser();
  const { can, me } = useCan();
  const [profileOpen, setProfileOpen] = useState(false);
  const [brandingOpen, setBrandingOpen] = useState(false);
  const branding = useBranding().data || DEFAULT_BRANDING;
  useEffect(() => { document.title = `${NAV.find(item => pathname.startsWith(item.to))?.label || "Workspace"} — ${branding.name}`; }, [branding.name, pathname]);
  // `me` is the live record; the localStorage copy is the pre-load fallback.
  const displayName = me?.name || user?.name || user?.email || "";
  useAppHeight();
  usePresenceHeartbeat();
  const presence = usePresenceMap();
  const myState = user ? presence.get(Number(user.id)) : undefined;

  return (
    <div
      /* Fixed, so the document cannot scroll it away when iOS lifts the
         page for the keyboard; the translate cancels that lift. */
      className="fixed inset-x-0 top-0 flex w-full flex-col overflow-hidden bg-transparent text-[var(--txt-1)]"
      style={{
        height: "var(--app-h, 100dvh)",
        transform: "translateY(var(--app-top, 0px))",
      }}
    >
      {/* Top horizontal panel — spans full width, always visible */}
      <header className="workspace-header panel-1 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          {onMenu && (
            <button
              onClick={onMenu}
              aria-label="Open navigation"
              className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--txt-2)] transition hover:bg-[var(--tint)] hover:text-[var(--txt-1)] md:hidden"
            >
              <Menu className="h-[18px] w-[18px]" strokeWidth={1.6} />
            </button>
          )}
          <Link to="/home" className="truncate text-[17px] text-[var(--txt-1)]">
            <Wordmark />
          </Link>
          <div className="workspace-context">
            <span>Workspace</span><span aria-hidden="true">/</span>
            <strong>{NAV.find((item) => pathname.startsWith(item.to))?.label || "Overview"}</strong>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <TimeTrackerButton />
          {displayName && (
            <span className="hidden text-[12.5px] text-[var(--txt-2)] sm:inline">{displayName}</span>
          )}
          <button
            type="button"
            onClick={() => me && setProfileOpen(true)}
            disabled={!me}
            aria-label="Your account"
            title="Your account"
            className="relative flex shrink-0 rounded-full ring-1 ring-[var(--line)] transition hover:ring-[var(--line-strong)] disabled:cursor-default"
          >
            <Avatar
              name={displayName}
              email={me?.email || user?.email}
              src={me?.avatar_url ?? user?.avatar_url}
              size={32}
              title=""
            />
            <PresenceDot state={myState} size={9} ring className="absolute -bottom-px -right-px" />
          </button>
          {can("roles.manage") && <button type="button" onClick={() => setBrandingOpen(true)} title="Workspace branding" aria-label="Workspace branding" className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--txt-3)] transition hover:bg-[var(--tint)] hover:text-[var(--txt-1)]"><Settings2 className="h-4 w-4" strokeWidth={1.7} /></button>}
          <ThemeToggle />
          <button
            onClick={() => {
              // Drop the heartbeat first, or you linger as online until the TTL.
              void clearPresence();
              logout();
            }}
            title="Sign out"
            aria-label="Sign out"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--txt-3)] transition hover:bg-[var(--tint)] hover:text-[var(--txt-1)]"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.6} />
          </button>
        </div>
      </header>

      <div className="workspace-body flex min-h-0 flex-1">
        {/* Icon rail — vertical on desktop, fixed bottom bar on phones */}
        <nav
          aria-label="Main navigation"
          className="workspace-rail panel-1 fixed inset-x-0 bottom-0 z-40 flex h-14 shrink-0 items-center justify-around border-t px-1 pb-[env(safe-area-inset-bottom)] md:static md:h-auto md:w-[68px] md:flex-col md:justify-start md:border-r md:border-t-0 md:py-3 md:pb-3"
        >
          <div className="flex flex-1 items-center justify-around gap-1 md:flex-col md:justify-start">
            {NAV.map((item) => (
              <RailLink key={item.to} {...item} active={pathname.startsWith(item.to)} />
            ))}
          </div>
          {can("users.create") && (
            <RailLink
              to="/invite"
              label="Invite"
              icon={UserPlus}
              active={pathname.startsWith("/invite")}
              className="md:mb-2"
            />
          )}
        </nav>

        <div className="workspace-content relative flex min-w-0 flex-1 flex-col overflow-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </div>
      </div>

      {profileOpen && me && <ProfileModal me={me} onClose={() => setProfileOpen(false)} />}
      {brandingOpen && <BrandingModal onClose={() => setBrandingOpen(false)} />}
    </div>
  );
}

/** Sun/moon switch. Shows the mode you'd get, not the one you're in. */
function ThemeToggle() {
  const [theme, set] = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      onClick={() => set(next)}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--txt-3)] transition hover:bg-[var(--tint)] hover:text-[var(--txt-1)]"
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" strokeWidth={1.7} />
      ) : (
        <Moon className="h-4 w-4" strokeWidth={1.7} />
      )}
    </button>
  );
}

/** Rail entry. The active item is marked with a bar rather than a filled pill —
 *  quieter, and it survives sitting next to a bright accent. */
function RailLink({
  to,
  label,
  icon: Icon,
  active,
  className = "",
}: {
  to: string;
  label: string;
  icon: typeof Home;
  active: boolean;
  className?: string;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={`rail-link group relative flex w-[52px] flex-col items-center gap-1.5 rounded-lg py-2 text-[9px] font-medium tracking-[0.1em] uppercase transition md:w-[56px] ${
        active
          ? "text-[var(--txt-1)]"
          : "text-[var(--txt-3)] hover:bg-[var(--tint)] hover:text-[var(--txt-2)]"
      } ${className}`}
    >
      <span
        aria-hidden
        className={`absolute rounded-full bg-[var(--txt-1)] transition-all ${
          active
            ? "inset-x-3 -top-px h-[2px] opacity-90 md:inset-x-auto md:-left-px md:top-1/2 md:h-7 md:w-[2px] md:-translate-y-1/2"
            : "opacity-0"
        }`}
      />
      <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 1.9 : 1.6} />
      <span className="leading-none">{label}</span>
    </Link>
  );
}

export function PlaceholderPane({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <h1 className="wordmark text-2xl text-[var(--txt-1)]">{title}</h1>
      <p className="mt-3 max-w-sm text-xs text-[var(--txt-3)]">{description}</p>
    </div>
  );
}
