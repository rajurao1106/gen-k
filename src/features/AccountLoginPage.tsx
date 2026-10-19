"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getUserKundaliProfile } from "../lib/storage";
import { loginLocalAccount } from "../lib/localAccount";

export default function AccountLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      loginLocalAccount(phone);
      const next = new URLSearchParams(window.location.search).get("next");
      const destination = next?.startsWith("/") && !next.startsWith("//")
        ? next
        : getUserKundaliProfile()
          ? "/dashboard"
          : "/start";
      router.replace(destination);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login nahi ho saka. Dobara koshish karein.");
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
          <h1 className="mt-4 font-display text-2xl font-bold">Mobile number se continue karein</h1>
          <p className="mt-2 text-sm leading-6 text-[#c9d8ed]">Apna number daalein. Isi browser mein pehle save kiya data wapas milega.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label htmlFor="account-phone" className="block text-sm font-medium text-[#f9e6b2]">Mobile number</label>
          <input id="account-phone" type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="10-digit mobile number" className="w-full rounded-xl border border-[#f2c36b]/30 bg-[#0a1a2e] px-4 py-3 text-base text-white outline-none focus:border-[#f2c36b]" />
          {error && <p role="alert" className="rounded-lg border border-[#ef9f90]/40 bg-[#ef9f90]/10 px-3 py-2 text-sm text-[#ffd1c9]">{error}</p>}
          <button type="submit" disabled={saving} className="w-full rounded-xl bg-[#f2c36b] px-4 py-3 font-semibold text-[#0b1324] disabled:opacity-60">{saving ? "Opening your account?" : "Continue"}</button>
        </form>
        <p className="mt-5 rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-[#a6bddb]">Yeh phone-only local login hai?OTP se number verify nahi hota. Data isi browser ke localStorage mein rahega; browser data clear karne ya device badalne par wapas nahi milega.</p>
      </section>
    </main>
  );
}
