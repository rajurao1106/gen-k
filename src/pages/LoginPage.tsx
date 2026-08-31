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
    <div className="min-h-screen flex items-center justify-center bg-[#20100a] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#e8a13a]/20 bg-[#2a1608]/80 p-8 shadow-2xl shadow-black/30">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8a13a] text-2xl text-[#2a1608]">
            🔐
          </div>
          <h1 className="font-display text-2xl font-semibold text-[#fbe9d0]">
            Admin Login
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm text-[#f2b25c]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              className="w-full rounded-lg border border-[#e8a13a]/20 bg-[#1c0e05] px-3.5 py-3 text-[#f5e6d3] outline-none focus:border-[#e8a13a]/70"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-[#f0958a]/30 bg-[#f0958a]/10 px-3 py-2 text-sm text-[#f0958a]">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-[#e8a13a] px-4 py-3 font-display text-base font-semibold text-[#20100a] transition hover:bg-[#d68f28]"
          >
            Open user data
          </button>
        </form>
      </div>
    </div>
  );
}
