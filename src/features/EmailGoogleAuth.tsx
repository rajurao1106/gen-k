"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { useAuth } from "../lib/useAuth";
import { fetchMyProfiles, loginWithFirebase } from "../lib/api";
import { getFirebaseAuth, signOutFirebase } from "../lib/firebase";
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

function friendlyError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  switch (code) {
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/missing-password":
      return "Enter your password.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password. If you signed up with Google, use “Continue with Google”.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Please sign in instead (or use “Continue with Google”).";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    case "auth/popup-blocked":
      return "The sign-in popup was blocked. Allow popups for this site and try again.";
    case "auth/account-exists-with-different-credential":
      return "This email is already registered with another sign-in method. Sign in with your email and password first.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a little and try again.";
    case "auth/network-request-failed":
      return "Network problem. Check your connection and try again.";
    default:
      return error instanceof Error ? error.message : "Sign-in failed. Please try again.";
  }
}

export default function EmailGoogleAuth() {
  const router = useRouter();
  const { user: currentUser, status, acceptLogin } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [saving, setSaving] = useState(false);

  // Already logged in (or just logged in): details missing -> /start, otherwise dashboard.
  useEffect(() => {
    if (status !== "authenticated" || !currentUser) return;

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
  }, [currentUser, router, status]);

  // Exchange the Firebase ID token for our own session cookie.
  const finishLogin = async (idToken: string) => {
    const user = await loginWithFirebase(idToken);
    if (user.isNewAccount) trackAnalytics("signup");
    acceptLogin(user);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setError("");
    setInfo("");
    setSaving(true);
    try {
      const auth = getFirebaseAuth();
      const credential =
        mode === "signup"
          ? await createUserWithEmailAndPassword(auth, email.trim(), password)
          : await signInWithEmailAndPassword(auth, email.trim(), password);
      if (mode === "signup") {
        await sendEmailVerification(credential.user).catch(() => undefined);
      }
      await finishLogin(await credential.user.getIdToken());
    } catch (requestError) {
      setError(friendlyError(requestError));
    } finally {
      await signOutFirebase();
      setSaving(false);
    }
  };

  const continueWithGoogle = async () => {
    if (saving) return;
    setError("");
    setInfo("");
    setSaving(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await signInWithPopup(getFirebaseAuth(), provider);
      await finishLogin(await credential.user.getIdToken());
    } catch (requestError) {
      setError(friendlyError(requestError));
    } finally {
      await signOutFirebase();
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("Enter your email above first, then tap “Forgot password?”.");
      return;
    }
    setSaving(true);
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
      setInfo("If an account exists for this email, a password reset link has been sent.");
    } catch (requestError) {
      setError(friendlyError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const switchMode = () => {
    setMode((value) => (value === "signin" ? "signup" : "signin"));
    setError("");
    setInfo("");
  };

  if (status === "loading" || status === "authenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#071a2a] px-4 text-[#c9d8ed]">
        <p role="status">Checking your account…</p>
      </main>
    );
  }

  const isSignup = mode === "signup";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#071a2a] px-4 py-8 text-[#f9f3eb]">
      <section className="w-full max-w-md rounded-3xl border border-[#f2c36b]/30 bg-[#10273d] p-6 shadow-2xl sm:p-8">
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#f2c36b]/15 text-[#f2c36b]">
            <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.6-4 5-6 8-6s6.4 2 8 6"/></svg>
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold">{isSignup ? "Create your account" : "Welcome back"}</h1>
          <p className="mt-2 text-sm leading-6 text-[#c9d8ed]">
            {isSignup
              ? "Sign up with email or Google. Next, you will add your birth details."
              : "Sign in to open your dashboard and saved kundali."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void continueWithGoogle()}
          disabled={saving}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#f2c36b]/30 bg-white px-4 py-3 font-semibold text-[#1f1f1f] disabled:opacity-60"
        >
          <span aria-hidden="true" className="text-lg font-bold text-[#4285F4]">G</span>
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-[#a6bddb]">
          <span className="h-px flex-1 bg-white/10" />
          or use email
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label htmlFor="auth-email" className="block text-sm font-medium text-[#f9e6b2]">Email</label>
          <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-[#f2c36b]/30 bg-[#0a1a2e] px-4 py-3 text-base text-white outline-none focus:border-[#f2c36b]" />
          <label htmlFor="auth-password" className="block text-sm font-medium text-[#f9e6b2]">Password</label>
          <input id="auth-password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isSignup ? "At least 6 characters" : "Your password"} className="w-full rounded-xl border border-[#f2c36b]/30 bg-[#0a1a2e] px-4 py-3 text-base text-white outline-none focus:border-[#f2c36b]" />
          {!isSignup && (
            <div className="text-right text-xs">
              <button type="button" onClick={() => void resetPassword()} disabled={saving} className="text-[#a6bddb] underline disabled:opacity-60">Forgot password?</button>
            </div>
          )}
          {error && <p role="alert" className="rounded-lg border border-[#ef9f90]/40 bg-[#ef9f90]/10 px-3 py-2 text-sm text-[#ffd1c9]">{error}</p>}
          {info && <p role="status" className="rounded-lg border border-[#f2c36b]/30 bg-[#f2c36b]/10 px-3 py-2 text-sm text-[#f9e6b2]">{info}</p>}
          <button type="submit" disabled={saving} className="w-full rounded-xl bg-[#f2c36b] px-4 py-3 font-semibold text-[#0b1324] disabled:opacity-60">
            {saving ? "Please wait…" : isSignup ? "Sign up" : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[#c9d8ed]">
          {isSignup ? "Already have an account?" : "New here?"}{" "}
          <button type="button" onClick={switchMode} className="font-semibold text-[#f2c36b] underline">
            {isSignup ? "Sign in" : "Create an account"}
          </button>
        </p>
      </section>
    </main>
  );
}