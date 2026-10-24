"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/useAuth";
import { createAccount, fetchMyProfiles, loginAdmin } from "../lib/api";
import { trackAnalytics } from "../lib/analytics";

export default function PhoneAccountLogin({ adminOnly = false }: { adminOnly?: boolean }) {
  const router = useRouter();
  const { acceptLogin } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const user = adminOnly
        ? await loginAdmin(phone, password)
        : await createAccount(phone);
      if (user.isNewAccount) trackAnalytics("signup");
      if (adminOnly && user.role !== "admin") {
        setError("This number is not authorized for administrator access.");
        return;
      }
      if (!adminOnly && user.role === "admin") {
        setError("Use the administrator sign-in page for this number.");
        return;
      }
      acceptLogin(user);
      if (adminOnly) {
        router.replace("/user-data");
        return;
      }

      let profiles: Awaited<ReturnType<typeof fetchMyProfiles>>;
      try {
        profiles = await fetchMyProfiles();
      } catch {
        router.replace("/dashboard");
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      const safeRoutes = ["/dashboard", "/kundali", "/ai-friend", "/milan", "/numerology", "/mahadasha", "/profile", "/start"];
      const safeNext = next && safeRoutes.some((route) => next === route || next.startsWith(`${route}?`))
        ? next
        : null;
      router.replace(profiles.length ? safeNext || "/dashboard" : "/start");
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : adminOnly ? "Administrator sign-in failed." : "Could not create the account.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#071a2a] px-4 py-8 text-[#f9f3eb]">
      <section className="w-full max-w-md rounded-3xl border border-[#f2c36b]/30 bg-[#10273d] p-6 shadow-2xl sm:p-8">
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#f2c36b]/15 text-[#f2c36b]">
            <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.6-4 5-6 8-6s6.4 2 8 6"/></svg>
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold">{adminOnly ? "Administrator login" : "Create your account"}</h1>
          <p className="mt-2 text-sm leading-6 text-[#c9d8ed]">
            {adminOnly
              ? "Enter your registered administrator number and password."
              : "Enter your mobile number to create a new account instantly. No verification code needed."}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label htmlFor="account-phone" className="block text-sm font-medium text-[#f9e6b2]">Mobile number</label>
          <input id="account-phone" type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="10-digit mobile number" className="w-full rounded-xl border border-[#f2c36b]/30 bg-[#0a1a2e] px-4 py-3 text-base text-white outline-none focus:border-[#f2c36b]" />
          {adminOnly && (
            <>
              <label htmlFor="admin-password" className="block text-sm font-medium text-[#f9e6b2]">Administrator password</label>
              <input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-[#f2c36b]/30 bg-[#0a1a2e] px-4 py-3 text-base text-white outline-none focus:border-[#f2c36b]" />
            </>
          )}
          {error && <p role="alert" className="rounded-lg border border-[#ef9f90]/40 bg-[#ef9f90]/10 px-3 py-2 text-sm text-[#ffd1c9]">{error}</p>}
          <button type="submit" disabled={saving} className="w-full rounded-xl bg-[#f2c36b] px-4 py-3 font-semibold text-[#0b1324] disabled:opacity-60">
            {saving ? "Please wait…" : adminOnly ? "Sign in" : "Create account"}
          </button>
        </form>
        <p className="mt-5 rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-[#a6bddb]">
          {adminOnly
            ? "Admin access requires a configured number and server-only password."
            : "Each mobile number can create one account. Existing accounts cannot be accessed without verification."}
        </p>
      </section>
    </main>
  );
}
