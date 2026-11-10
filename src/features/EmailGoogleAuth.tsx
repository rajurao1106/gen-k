"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
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
      <main className="flex min-h-screen items-center justify-center bg-[#F8F0E8] px-4 text-[#625C56]">
        <p role="status">Checking your account…</p>
      </main>
    );
  }

  const isSignup = mode === "signup";

  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-[#F8F0E8] px-4 py-8 text-[#171717] sm:px-6 lg:py-12">
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-12 h-72 w-72 rounded-full bg-[#F0D8B1]/45 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 bottom-8 h-80 w-80 rounded-full bg-[#E8B99A]/30 blur-3xl" />
      <section className="relative grid w-full max-w-[980px] overflow-hidden rounded-[30px] border border-[#E8D9CC] bg-white shadow-[0_28px_90px_rgba(80,54,32,0.16)] md:min-h-[610px] md:grid-cols-[0.9fr_1.1fr]">
        <header className="relative isolate flex min-h-[230px] flex-col justify-center overflow-hidden bg-gradient-to-br from-[#F8F0E8] via-[#F8E8D8] to-[#F8F0E8] px-7 py-9 text-center text-[#171717] sm:px-10 md:min-h-full md:items-start md:px-12 md:py-14 md:text-left">
          <div aria-hidden="true" className="absolute -left-14 top-8 -z-10 h-40 w-40 rounded-full bg-[#E8D17A]/75 sm:h-52 sm:w-52" />
          <div aria-hidden="true" className="absolute -right-16 top-20 -z-10 h-44 w-44 rounded-full bg-[#F5C2A1]/35 sm:h-56 sm:w-56 md:-right-24 md:top-8 md:h-64 md:w-64" />
          <div className="relative z-10 mx-auto max-w-sm md:mx-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#80602F]">Gen-K · Vedic astrology</p>
            <h1 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl">
              {isSignup ? "Create an account" : "Welcome back"}
            </h1>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-[#625C56] md:mx-0">
              {isSignup
                ? "Your kundali journey starts here. Sign up to continue."
                : "Sign in to open your dashboard and saved kundali."}
            </p>
          </div>
          <p className="absolute bottom-7 left-12 hidden text-xs font-medium tracking-wide text-[#80602F] md:block">
            Your chart. Your journey.
          </p>
        </header>

        <div className="relative z-10 -mt-11 rounded-t-[30px] bg-white px-5 pb-8 pt-7 sm:px-10 md:mt-0 md:flex md:items-center md:rounded-none md:px-12 md:py-12">
          <div className="mx-auto w-full max-w-[420px]">
            <button
              type="button"
              onClick={() => void continueWithGoogle()}
              disabled={saving}
              className="flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-[#E5E5E5] bg-white px-4 py-3 text-sm font-medium text-[#242424] transition hover:bg-[#FAF8F6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9A441] disabled:opacity-60"
            >
              <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.27c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.99 14.97 1 12 1 7.73 1 4.03 3.45 2.18 7.06l3.66 2.84C6.71 7.2 9.14 5.27 12 5.27z" />
              </svg>
              {isSignup ? "Sign up with Google" : "Sign in with Google"}
            </button>

            <div className="my-5 flex items-center gap-3 text-xs text-[#8A8178]">
              <span className="h-px flex-1 bg-[#EAE7E4]" />
              or
              <span className="h-px flex-1 bg-[#EAE7E4]" />
            </div>

            <form onSubmit={submit} className="space-y-3.5">
              <div>
                <label htmlFor="auth-email" className="sr-only">Email</label>
                <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="min-h-12 w-full rounded-2xl border border-transparent bg-[#F4F4F3] px-4 py-3 text-base text-[#171717] outline-none placeholder:text-[#8A8A88] focus:border-[#D9A441] focus:bg-white focus:ring-2 focus:ring-[#D9A441]/20" />
              </div>
              <div>
                <label htmlFor="auth-password" className="sr-only">Password</label>
                <input id="auth-password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="min-h-12 w-full rounded-2xl border border-transparent bg-[#F4F4F3] px-4 py-3 text-base text-[#171717] outline-none placeholder:text-[#8A8A88] focus:border-[#D9A441] focus:bg-white focus:ring-2 focus:ring-[#D9A441]/20" />
              </div>
              {!isSignup && (
                <div className="text-right text-xs">
                  <button type="button" onClick={() => void resetPassword()} disabled={saving} className="text-[#80602F] underline underline-offset-2 disabled:opacity-60">Forgot password?</button>
                </div>
              )}
              {error && <p role="alert" className="rounded-xl border border-[#B94E3D]/25 bg-[#B94E3D]/[0.07] px-3 py-2 text-sm text-[#8E3529]">{error}</p>}
              {info && <p role="status" className="rounded-xl border border-[#D9A441]/35 bg-[#F8E8D8]/70 px-3 py-2 text-sm text-[#70511F]">{info}</p>}
              <button type="submit" disabled={saving} className="min-h-12 w-full rounded-full bg-[#101010] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#302A25] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9A441] disabled:opacity-60">
                {saving ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
              </button>
            </form>

            <p className="mt-4 text-center text-[11px] leading-5 text-[#89837D]">
              By continuing, you agree to our{" "}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-[#A95F35]">Privacy Policy</Link>
              {" "}and{" "}
              <Link href="/terms" className="underline underline-offset-2 hover:text-[#A95F35]">Terms of Service</Link>.
            </p>

            <p className="mt-5 text-center text-sm text-[#625C56]">
              {isSignup ? "Already have an account?" : "Have an account?"}{" "}
              <button type="button" onClick={switchMode} className="font-semibold text-[#A95F35] underline underline-offset-2">
                {isSignup ? "Log in" : "Create an account"}
              </button>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}