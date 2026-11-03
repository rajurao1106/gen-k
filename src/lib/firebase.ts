"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, signOut, type Auth } from "firebase/auth";

// NEXT_PUBLIC_* values must be written out in full so Next.js can inline them.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured() {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

export function getFirebaseAuth(): Auth {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured. Add the NEXT_PUBLIC_FIREBASE_* values to .env.local and restart the dev server.",
    );
  }
  const app = getApps().length ? getApp() : initializeApp(config);
  return getAuth(app);
}

// Firebase is only used to prove who the user is; our own session cookie keeps them logged in.
export async function signOutFirebase() {
  if (!isFirebaseConfigured()) return;
  try {
    await signOut(getFirebaseAuth());
  } catch {
    // Nothing to sign out of.
  }
}