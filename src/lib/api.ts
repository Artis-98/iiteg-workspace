// import.meta.env only exists under Vite; guard it so this module can be
// imported by a plain node test runner.
export const BASE = import.meta.env?.VITE_API_URL || "/api";

const TOKEN_KEY = "workspace_token";
const USER_KEY = "workspace_user";

export type AdminUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  avatar_url?: string | null;
};

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuth(token: string, user: AdminUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser(): AdminUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  const u = JSON.parse(raw) as AdminUser;
  // the API returns ids as strings — keep them numeric so id comparisons work
  return { ...u, id: Number(u.id) };
}

/**
 * Patch the signed-in user held in localStorage. The login response seeds it,
 * so without this a changed name or avatar would only appear after signing out
 * and back in.
 */
export function updateStoredUser(patch: Partial<AdminUser>) {
  const current = getUser();
  if (!current) return;
  localStorage.setItem(USER_KEY, JSON.stringify({ ...current, ...patch }));
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = "/";
}

export async function api<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (res.status === 401) {
    if (path !== "/auth.php") logout();
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/* ===== Auth ===== */

export async function login(email: string, password: string) {
  const res = await api<{ token: string; user: AdminUser }>("/auth.php", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAuth(res.token, res.user);
  return res;
}


export async function uploadFile(file: File, folder = "chat"): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const token = getToken();
  const response = await fetch(`${BASE}/admin/upload.php?folder=${encodeURIComponent(folder)}`, {
    method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form,
  });
  if (!response.ok) throw new Error("Upload failed");
  return (await response.json()).url;
}
