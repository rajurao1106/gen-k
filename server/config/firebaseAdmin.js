import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// verifyIdToken only needs the Firebase project id (no service-account key).
function getAdminApp() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    const error = new Error(
      "Firebase server configuration is missing. Add FIREBASE_PROJECT_ID to your .env.local (or reuse NEXT_PUBLIC_FIREBASE_PROJECT_ID).",
    );
    error.code = "FIREBASE_NOT_CONFIGURED";
    throw error;
  }
  return getApps()[0] ?? initializeApp({ projectId });
}

export async function verifyFirebaseIdToken(idToken) {
  return getAuth(getAdminApp()).verifyIdToken(idToken);
}