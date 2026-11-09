import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { login, getToken } from "@/lib/api";
import { Wordmark } from "@/components/Wordmark";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — IITEG Workspace" },
      { name: "description", content: "Sign in to the IITEG Workspace." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    if (getToken()) navigate({ to: "/home" });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login(email, password);
      toast.success(`Welcome back, ${res.user.name || res.user.email}`);
      navigate({ to: "/home" });
    } catch (err: any) {
      setError(
        err?.message?.includes("Unauthorized")
          ? "Invalid credentials"
          : err?.message || "Sign in failed"
      );
      setShake((s) => s + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-story" aria-label="IITEG workspace">
        <div className="login-brand"><Wordmark /></div>
        <div>
          <div className="login-eyebrow">The IITEG workspace</div>
          <h1>A place for<br />what comes next.</h1>
          <p>Bring your projects, people, and everyday operations into focus.</p>
          <div className="login-index" aria-hidden="true">
            <span><small>01</small>Projects & planning</span>
            <span><small>02</small>Team & conversations</span>
            <span><small>03</small>Daily operations</span>
          </div>
        </div>
        <div className="login-footnote">IITEG</div>
      </section>
      <section className="login-entry" aria-labelledby="sign-in-heading">
        <div key={shake} className={`login-form-wrap ${shake ? "animate-shake" : ""}`}>
          <h2 id="sign-in-heading">Welcome back.</h2>
          <p className="login-intro">Sign in to your workspace to pick up where you left off.</p>
          <form onSubmit={onSubmit} className="login-form">
            <FloatingInput label="Email address" value={email} onChange={setEmail} autoComplete="email" placeholder="you@example.com" type="email" />
            <FloatingInput label="Password" value={password} onChange={setPassword} autoComplete="current-password" placeholder="Enter your password" type="password" />
            {error && <div role="alert" className="login-error">{error}</div>}
            <button type="submit" disabled={loading} className="login-submit">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Signing in…" : "Sign in"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
          <p className="login-private">Private workspace · Access for IITEG members</p>
        </div>
      </section>
    </main>
  );
}

function FloatingInput({
  label, value, onChange, type = "text", autoComplete, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  const id = `login-${type}`;
  return (
    <div className="login-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={type === "email" ? "email" : "password"}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        placeholder={placeholder}
      />
    </div>
  );
}
