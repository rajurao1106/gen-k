import { useState } from "react";
import { useNavigate } from "react-router-dom";

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "admin123";

export default function LoginPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password === ADMIN_PASSWORD) {
      localStorage.setItem("genk_admin_session", "true");
      navigate("/user-data");
      return;
    }

    setError("Incorrect password. Please try again.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]/80 p-8 shadow-2xl shadow-black/30">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--gold)] text-2xl text-[var(--text-dark)]">
            🔐
          </div>
          <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
            Admin Login
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm text-[var(--gold-soft)]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface-strong)] px-3.5 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--gold)]"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-[var(--gold)] px-4 py-3 font-display text-base font-semibold text-[var(--text-dark)] transition hover:bg-[var(--gold-strong)]"
          >
            Open user data
          </button>
        </form>
      </div>
    </div>
  );
}
