"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/useAuth";
import { fetchMyProfiles, loginAdmin, requestPhoneOtp, verifyPhoneOtp } from "../lib/api";
import { trackAnalytics } from "../lib/analytics";

const SAFE_NEXT_ROUTES = [
  "/dashboard",
  "/kundali",
  "/ai-friend",
  "/milan",
  "/numerology",
  "/mahadasha",
  "/profile",
  "/start",
];

function getSafeNextRoute() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && SAFE_NEXT_ROUTES.some((route) => next === route || next.startsWith(`${route}?`))
    ? next
    : null;
}

export default function PhoneAccountLogin({ adminOnly = false }: { adminOnly?: boolean }) {
  const router = useRouter();
  const { user: currentUser, status, acceptLogin } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendOtp = async () => {
    setError("");
    setSaving(true);
    try {
      const result = await requestPhoneOtp(phone);
      setOtpSent(true);
      setOtp("");
      setDevOtp(result.devOtp || "");
      setCooldown(30);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not send the code.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (adminOnly || status !== "authenticated" || !currentUser) return;

    let active = true;
    const continueToAccount = async () => {
      if (currentUser.role === "admin") {
        router.replace("/user-data");
        return;
      }

      try {
        const profiles = await fetchMyProfiles();
        if (!active) return;
        router.replace(profiles.length ? getSafeNextRoute() || "/dashboard" : "/start");
      } catch {
        if (active) router.replace("/dashboard");
      }
    };

    void continueToAccount();
    return () => {
      active = false;
    };
  }, [adminOnly, currentUser, router, status]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!adminOnly && !otpSent) {
      await sendOtp();
      return;
    }
    setError("");
    setSaving(true);
    try {
      const user = adminOnly
        ? await loginAdmin(phone, password)
        : await verifyPhoneOtp(phone, otp);
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
      }
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : adminOnly ? "Administrator sign-in failed." : "Could not verify the code.");
    } finally {
      setSaving(false);
    }
  };

  if (!adminOnly && (status === "loading" || status === "authenticated")) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#071a2a] px-4 text-[#c9d8ed]">
        <p role="status">Checking your account…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#071a2a] px-4 py-8 text-[#f9f3eb]">
      <section className="w-full max-w-md rounded-3xl border border-[#f2c36b]/30 bg-[#10273d] p-6 shadow-2xl sm:p-8">
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#f2c36b]/15 text-[#f2c36b]">
            <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.6-4 5-6 8-6s6.4 2 8 6"/></svg>
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold">{adminOnly ? "Administrator login" : "Login or create account"}</h1>
          <p className="mt-2 text-sm leading-6 text-[#c9d8ed]">
            {adminOnly
              ? "Enter your registered administrator number and password."
              : otpSent
                ? "Enter the 6-digit code sent to your mobile number."
                : "Enter your mobile number. We will send a code to log you in or create your account."}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label htmlFor="account-phone" className="block text-sm font-medium text-[#f9e6b2]">Mobile number</label>
          <input id="account-phone" type="tel" inputMode="tel" autoComplete="tel" required value={phone} disabled={!adminOnly && otpSent} onChange={(event) => setPhone(event.target.value)} placeholder="10-digit mobile number" className="w-full rounded-xl border border-[#f2c36b]/30 bg-[#0a1a2e] px-4 py-3 text-base text-white outline-none focus:border-[#f2c36b]" />
          {!adminOnly && otpSent && (
            <>
              <label htmlFor="account-otp" className="block text-sm font-medium text-[#f9e6b2]">Verification code</label>
              <input id="account-otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} placeholder="6-digit code" className="w-full rounded-xl border border-[#f2c36b]/30 bg-[#0a1a2e] px-4 py-3 text-center text-xl tracking-[0.4em] text-white outline-none focus:border-[#f2c36b]" />
              {devOtp && <p className="rounded-lg border border-[#f2c36b]/30 bg-[#f2c36b]/10 px-3 py-2 text-xs text-[#f9e6b2]">Dev mode code: <strong>{devOtp}</strong></p>}
              <div className="flex items-center justify-between text-xs text-[#a6bddb]">
                <button type="button" className="underline" onClick={() => { setOtpSent(false); setOtp(""); setDevOtp(""); setError(""); }}>Change number</button>
                <button type="button" disabled={cooldown > 0 || saving} className="underline disabled:no-underline disabled:opacity-60" onClick={() => void sendOtp()}>{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}</button>
              </div>
            </>
          )}
          {adminOnly && (
            <>
              <label htmlFor="admin-password" className="block text-sm font-medium text-[#f9e6b2]">Administrator password</label>
              <input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-[#f2c36b]/30 bg-[#0a1a2e] px-4 py-3 text-base text-white outline-none focus:border-[#f2c36b]" />
            </>
          )}
          {error && <p role="alert" className="rounded-lg border border-[#ef9f90]/40 bg-[#ef9f90]/10 px-3 py-2 text-sm text-[#ffd1c9]">{error}</p>}
          <button type="submit" disabled={saving} className="w-full rounded-xl bg-[#f2c36b] px-4 py-3 font-semibold text-[#0b1324] disabled:opacity-60">
            {saving ? "Please wait…" : adminOnly ? "Sign in" : otpSent ? "Verify & continue" : "Send code"}
          </button>
        </form>
        <p className="mt-5 rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-[#a6bddb]">
          {adminOnly
            ? "Admin access requires a configured number and server-only password."
            : "Existing users are logged in after verification. New users get an account and can add their details."}
        </p>
      </section>
    </main>
  );
}