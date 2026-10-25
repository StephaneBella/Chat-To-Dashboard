import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { ApiError } from "../../api/http";

export default function LoginScreen() {
  const { login, status } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const from = (location.state as any)?.from?.pathname || "/agent";

  if (status === "authed") {
    return <Navigate to={from} replace />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Connexion échouée.");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="app-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-outline-variant/60 bg-white p-8 shadow-lift">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-primary/25">
            <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
          </div>
          <div>
            <h1 className="font-display text-xl font-extrabold tracking-tight">Connexion</h1>
            <p className="text-[12px] text-on-surface-variant">
              Accédez à l&apos;agent conversationnel
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-on-surface">
              Nom d&apos;utilisateur
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/60 px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-on-surface">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/60 px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={pending || !username.trim() || !password.trim()}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-md shadow-primary/20 disabled:opacity-50"
          >
            {pending ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
