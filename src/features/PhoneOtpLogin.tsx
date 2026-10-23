"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/useAuth";
import { fetchMyProfiles, logoutCurrentUser, requestOtp, verifyOtp } from "../lib/api";
import { trackAnalytics } from "../lib/analytics";

export default function PhoneOtpLogin({ adminOnly = false }: { adminOnly?: boolean }) {
  const router = useRouter();
  const { acceptLogin } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const sendCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const response = await requestOtp(phone);
      setStep("otp");
      setNotice(response.message || "Verification code sent. Check your phone.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not send the code.");
    } finally {
      setSaving(false);
    }
  };

  const confirmCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const user = await verifyOtp(phone, code);
      if (user.isNewAccount) trackAnalytics("signup");
      if (adminOnly && user.role !== "admin") {
        await logoutCurrentUser();
        setError("This number is not authorized for administrator access.");
        setStep("phone");
        setCode("");
        return;
      }
      if (!adminOnly && user.role === "admin") {
        await logoutCurrentUser();
        setError("Use the administrator sign-in page for this number.");
        setStep("phone");
        setCode("");
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
      setError(requestError instanceof Error ? requestError.message : "Could not verify the code.");
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
          <h1 className="mt-4 font-display text-2xl font-bold">{adminOnly ? "Administrator login" : "Continue with your mobile"}</h1>
          <p className="mt-2 text-sm leading-6 text-[#c9d8ed]">
            {step === "phone"
              ? "Enter your mobile number and we’ll send a one-time verification code."
              : `Enter the 6-digit code sent to ${phone}.`}
          </p>
        </div>
        <form onSubmit={step === "phone" ? sendCode : confirmCode} className="space-y-4">
          {step === "phone" ? (
            <>
              <label htmlFor="account-phone" className="block text-sm font-medium text-[#f9e6b2]">Mobile number</label>
              <input id="account-phone" type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="10-digit mobile number" className="w-full rounded-xl border border-[#f2c36b]/30 bg-[#0a1a2e] px-4 py-3 text-base text-white outline-none focus:border-[#f2c36b]" />
            </>
          ) : (
            <>
              <label htmlFor="account-otp" className="block text-sm font-medium text-[#f9e6b2]">Verification code</label>
              <input id="account-otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" className="w-full rounded-xl border border-[#f2c36b]/30 bg-[#0a1a2e] px-4 py-3 text-center text-xl tracking-[0.4em] text-white outline-none focus:border-[#f2c36b]" />
              <button type="button" onClick={() => { setStep("phone"); setCode(""); setError(""); setNotice(""); }} className="text-sm text-[#f2c36b] hover:text-[#ffda91]">Change number</button>
            </>
          )}
          {notice && <p role="status" className="text-sm text-[#a9e6b4]">{notice}</p>}
          {error && <p role="alert" className="rounded-lg border border-[#ef9f90]/40 bg-[#ef9f90]/10 px-3 py-2 text-sm text-[#ffd1c9]">{error}</p>}
          <button type="submit" disabled={saving} className="w-full rounded-xl bg-[#f2c36b] px-4 py-3 font-semibold text-[#0b1324] disabled:opacity-60">
            {saving ? "Please wait…" : step === "phone" ? "Send verification code" : "Verify and continue"}
          </button>
        </form>
        <p className="mt-5 rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-[#a6bddb]">
          Your account is verified by a one-time code. Your sign-in session is stored in a secure, httpOnly cookie.
        </p>
      </section>
    </main>
  );
}
