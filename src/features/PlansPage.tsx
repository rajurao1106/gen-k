"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createPaymentOrder,
  cancelMyPlan,
  fetchMyEntitlements,
  fetchPaymentHistory,
  fetchPlans,
  refundDemoPayment,
  verifyPayment,
  type EntitlementSummary,
  type PaymentHistoryItem,
  type Plan,
} from "../lib/api";
import LegalFooter from "../components/LegalFooter";
import { trackAnalytics } from "../lib/analytics";

type RazorpayResult = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (result: RazorpayResult) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
};

type RazorpayInstance = {
  open: () => void;
  on: (
    event: "payment.failed",
    handler: (result: { error?: { description?: string } }) => void,
  ) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () =>
      window.Razorpay
        ? resolve()
        : reject(new Error("Razorpay Checkout could not be initialized."));
    script.onerror = () =>
      reject(new Error("Razorpay Checkout failed to load."));
    document.body.appendChild(script);
  });
}

function openRazorpayCheckout(options: RazorpayOptions) {
  return loadRazorpayCheckout().then(
    () =>
      new Promise<RazorpayResult | null>((resolve, reject) => {
        if (!window.Razorpay) {
          reject(new Error("Razorpay Checkout could not be initialized."));
          return;
        }
        const checkout = new window.Razorpay({
          ...options,
          handler: resolve,
          modal: { ondismiss: () => resolve(null) },
        });
        checkout.on("payment.failed", ({ error }) => {
          reject(new Error(error?.description || "Razorpay payment failed."));
        });
        checkout.open();
      }),
  );
}

const PLAN_DETAILS: Record<
  string,
  { description: string; features: string[] }
> = {
  ai_chat_unlimited: {
    description: "One-time payment for permanent unlimited AI chat",
    features: [
      "10 free replies across Kundali and AI Friend",
      "Then unlimited Kundali chat and AI Friend replies",
      "One-time ₹19 payment; no renewal",
    ],
  },
  ai_chat_unlimited_money_test: {
    description: "One-time ₹1 real payment test; includes the same features as the ₹19 plan",
    features: [
      "10 free replies across Kundali and AI Friend",
      "Then unlimited Kundali chat and AI Friend replies",
      "One-time ₹1 charge; no renewal or refund on cancellation",
    ],
  },
};

const FEATURE_PLANS: Record<string, string[]> = {
  ai_chat_extended: ["ai_chat_unlimited"],
  QUOTA_EXCEEDED: ["ai_chat_unlimited"],
};

function formatPrice(amountPaise: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountPaise / 100);
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [account, setAccount] = useState<EntitlementSummary | null>(null);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [feature, setFeature] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState("");
  const [cancellingPlan, setCancellingPlan] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const trackedPaywallView = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [availablePlans, entitlements, payments] = await Promise.all([
        fetchPlans(),
        fetchMyEntitlements(),
        fetchPaymentHistory(),
      ]);
      setPlans(availablePlans);
      setAccount(entitlements);
      setHistory(payments);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Plans could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Context comes from a query parameter and is read only in the browser.
    // oxlint-disable-next-line react/set-state-in-effect
    setFeature(
      new URLSearchParams(window.location.search).get("feature") || "",
    );
    if (!trackedPaywallView.current) {
      trackedPaywallView.current = true;
      trackAnalytics("paywall_viewed");
    }
    void refresh();
  }, [refresh]);

  const recommended = useMemo(() => FEATURE_PLANS[feature] ?? [], [feature]);
  const activeSubscription =
    account?.plan.type === "subscription" &&
    account.entitlements.some(
      (entitlement) =>
        entitlement.planId === account.plan.planId &&
        entitlement.kind === "subscription",
    );

  const cancelPlan = async (planId: string, planName: string) => {
    if (
      !window.confirm(
        `Cancel ${planName} now? Your plan access will end immediately. No refund will be issued.`,
      )
    ) {
      return;
    }

    setCancellingPlan(true);
    setError("");
    setNotice("");
    try {
      await cancelMyPlan(planId);
      setNotice(`${planName} was cancelled. Its access ended immediately; no refund was issued.`);
      await refresh();
    } catch (cancellationError) {
      setError(
        cancellationError instanceof Error
          ? cancellationError.message
          : "The plan could not be cancelled.",
      );
    } finally {
      setCancellingPlan(false);
    }
  };

  const purchase = async (plan: Plan) => {
    setBusyPlan(plan.planId);
    setError("");
    setNotice("");
    try {
      trackAnalytics("checkout_started", { planId: plan.planId });
      const order = await createPaymentOrder(plan.planId);
      if (order.mode === "razorpay") {
        if (!order.keyId)
          throw new Error(
            "Razorpay key ID was not returned by the server.",
          );
        const result = await openRazorpayCheckout({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: "Gen-K",
          description: plan.name,
          order_id: order.providerOrderId,
          handler: () => undefined,
          modal: { ondismiss: () => undefined },
          theme: { color: "#D9A441" },
        });
        if (!result) return;
        if (result.razorpay_order_id !== order.providerOrderId) {
          throw new Error(
            "The Razorpay payment order did not match this checkout.",
          );
        }
        try {
          await verifyPayment({
            orderId: order.orderId,
            providerPaymentId: result.razorpay_payment_id,
            signature: result.razorpay_signature,
          });
        } catch {
          // Money may already be captured. Razorpay's webhook activates the plan
          // on the server, so wait briefly and re-check before showing an error.
          setNotice("Payment received. Activating your plan, please wait...");
          await new Promise((resolve) => setTimeout(resolve, 5000));
          const history = await fetchPaymentHistory().catch(() => []);
          const activated = history.some(
            (item) => item.id === order.orderId && item.status === "paid",
          );
          if (!activated) {
            throw new Error(
              "Your payment was received but activation is delayed. It will activate automatically within a few minutes; if not, contact support with your payment ID " +
                result.razorpay_payment_id +
                ".",
            );
          }
        }
      } else {
        throw new Error(
          "Demo mode never opens Razorpay and must not activate a plan. Set PAYMENT_MODE=razorpay to test checkout.",
        );
      }
      trackAnalytics("payment_success", { planId: plan.planId });
      setNotice(`${plan.name} is active on your account.`);
      await refresh();
    } catch (purchaseError) {
      setError(
        purchaseError instanceof Error
          ? purchaseError.message
          : "Checkout could not be completed.",
      );
    } finally {
      setBusyPlan("");
    }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 text-[#171717]">
      <header className="rounded-3xl border border-[#E8D9CC] bg-white p-5 shadow-[0_8px_24px_rgba(80,54,32,0.06)] sm:p-7">
        <p className="text-xs uppercase tracking-[0.2em] text-[#80602F]">
          Plans & access
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          Choose what works for you
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#625C56]">
          Compare the available plans and see what is active on your account.
          Payments are processed securely by Razorpay. Voice generation may
          still use paid AI provider credits.
        </p>
        {account && (
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full border border-[#E8D9CC] bg-[#F8F0E8] px-3 py-1.5">
              Current plan:{" "}
              <strong className="text-[#80602F]">{account.plan.name}</strong>
            </span>
            <span className="rounded-full border border-[#E8D9CC] bg-[#F8F0E8] px-3 py-1.5">
              {account.usage.ai_chat.scope === "trial"
                ? "Free AI replies used: "
                : account.usage.ai_chat.scope === "unlimited"
                  ? "AI chat access: "
                  : "AI messages today: "}
              <strong className="text-[#80602F]">
                {account.usage.ai_chat.scope === "unlimited"
                  ? "Unlimited"
                  : `${account.usage.ai_chat.used}/${account.usage.ai_chat.limit}`}
              </strong>
            </span>
            {activeSubscription && (
            <button
              type="button"
              disabled={cancellingPlan}
              onClick={() => void cancelPlan(account.plan.planId, account.plan.name)}
              className="rounded-full border border-[#B94E3D]/40 px-3 py-1.5 text-[#8E3529] transition-colors hover:bg-[#B94E3D]/[0.07] disabled:cursor-wait disabled:opacity-60"
            >
              {cancellingPlan ? "Cancelling…" : "Cancel active plan"}
            </button>
            )}
          </div>
        )}
      </header>

      {feature && (
        <aside className="rounded-2xl border border-[#D9A441]/40 bg-[#F8E8D8]/70 p-4 text-sm text-[#70511F]">
          {feature === "QUOTA_EXCEEDED"
            ? "Your 10 free Kundali and AI Friend replies are used. Pay ₹19 once for unlimited chat."
            : feature === "voice_reply"
              ? "Voice cloning is a separate paid feature and is not currently available for purchase."
              : `The ${feature.replaceAll("_", " ")} feature does not currently have a plan available for purchase.`}
        </aside>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-[#B94E3D]/25 bg-[#B94E3D]/[0.07] p-3 text-sm text-[#8E3529]"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-[#7A9B68]/35 bg-[#7A9B68]/[0.08] p-3 text-sm text-[#49643C]"
        >
          {notice}
        </p>
      )}

      {loading ? (
        <p role="status" className="py-8 text-center text-sm text-[#625C56]">
          Loading plans…
        </p>
      ) : (
        <section
          aria-label="Available plans"
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {plans.map((plan) => {
            const detail = PLAN_DETAILS[plan.planId];
            const current = account?.plan.planId === plan.planId;
            const activeAddon =
              account?.entitlements.some(
                (entitlement) =>
                  entitlement.planId === plan.planId &&
                  entitlement.kind === "addon",
              ) ?? false;
            const highlighted = recommended.includes(plan.planId);
            return (
              <article
                key={plan.planId}
                className={`flex flex-col rounded-2xl border bg-white p-5 shadow-[0_8px_24px_rgba(80,54,32,0.06)] ${
                  highlighted
                    ? "border-[#D9A441] shadow-[0_8px_24px_rgba(217,164,65,0.12)]"
                    : "border-[#E8D9CC]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-semibold text-[#80602F]">
                      {plan.name}
                    </h2>
                    {detail && (
                      <p className="mt-1 text-xs text-[#625C56]">
                        {detail.description}
                      </p>
                    )}
                  </div>
                  {highlighted && (
                    <span className="shrink-0 rounded-full bg-[#F8E8D8] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#80602F]">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="mt-5 font-display text-3xl font-bold">
                  {plan.amountPaise
                    ? formatPrice(plan.amountPaise, plan.currency)
                    : "Free"}
                  {plan.durationDays && (
                    <span className="ml-1 text-xs font-normal text-[#625C56]">
                      / {plan.durationDays} days
                    </span>
                  )}
                </p>
                {detail && (
                  <ul className="my-5 flex-1 space-y-2 text-sm text-[#625C56]">
                    {detail.features.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span aria-hidden="true" className="text-[#49643C]">
                          ✓
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
                {current ? (
                  <button
                    type="button"
                    disabled
                    className="mt-auto rounded-xl border border-[#7A9B68]/40 px-4 py-2.5 text-sm text-[#49643C]"
                  >
                    Current plan
                  </button>
                ) : activeAddon ? (
                  <div className="mt-auto flex flex-col gap-2">
                    <span className="rounded-xl border border-[#7A9B68]/40 px-4 py-2.5 text-center text-sm text-[#49643C]">
                      Active
                    </span>
                    {["ai_chat_unlimited", "ai_chat_unlimited_money_test"].includes(plan.planId) && (
                      <button
                        type="button"
                        disabled={cancellingPlan}
                        onClick={() => void cancelPlan(plan.planId, plan.name)}
                        className="rounded-xl border border-[#B94E3D]/40 px-4 py-2.5 text-sm text-[#8E3529] transition-colors hover:bg-[#B94E3D]/[0.07] disabled:cursor-wait disabled:opacity-60"
                      >
                        {cancellingPlan ? "Cancelling…" : "Cancel plan"}
                      </button>
                    )}
                  </div>
                ) : plan.type === "free" ? (
                  <button
                    type="button"
                    disabled
                    className="mt-auto rounded-xl border border-[#E8D9CC] px-4 py-2.5 text-sm text-[#625C56]"
                  >
                    Included
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(busyPlan)}
                    onClick={() => void purchase(plan)}
                    className="mt-auto rounded-xl bg-[#101010] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#302A25] disabled:cursor-wait disabled:opacity-60"
                  >
                    {busyPlan === plan.planId
                      ? "Opening checkout…"
                      : "Continue to checkout"}
                  </button>
                )}
              </article>
            );
          })}
        </section>
      )}

      <p className="rounded-xl border border-[#E8D9CC] bg-white p-4 text-xs leading-5 text-[#625C56]">
        For Razorpay checkout, configure test credentials. Test payments do not
        charge real money. Live Razorpay keys are rejected by this build.
      </p>
      <footer className="pb-5 text-xs text-[#89837D]">
        <LegalFooter />
      </footer>

      <section className="rounded-2xl border border-[#E8D9CC] bg-white p-5 shadow-[0_8px_24px_rgba(80,54,32,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#171717]">
              Recent payments
            </h2>
            <p className="mt-1 text-xs text-[#625C56]">
              Payment activity linked to your account
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg border border-[#D9A441]/40 px-3 py-2 text-xs text-[#80602F] hover:bg-[#F8E8D8]"
          >
            Refresh
          </button>
        </div>
        {history.length ? (
          <ul className="mt-4 divide-y divide-[#E8D9CC]">
            {history.slice(0, 5).map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <span>
                  <span className="block text-[#171717]">
                    {payment.planName}
                  </span>
                  <span className="text-xs text-[#89837D]">
                    {new Date(payment.createdAt).toLocaleDateString("en-IN")}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block">
                    {formatPrice(payment.amountPaise, payment.currency)}
                  </span>
                  <span
                    className={`text-xs ${payment.status === "paid" ? "text-[#49643C]" : "text-[#89837D]"}`}
                  >
                    {payment.status}
                  </span>
                  {payment.provider === "demo" && payment.status === "paid" && (
                    <button
                      type="button"
                      onClick={async () => {
                        setError("");
                        try {
                          await refundDemoPayment(payment.id);
                          setNotice("Test-only demo access was revoked.");
                          await refresh();
                        } catch (refundError) {
                          setError(
                            refundError instanceof Error
                              ? refundError.message
                              : "Could not revoke demo access.",
                          );
                        }
                      }}
                      className="mt-1 text-xs text-[#8E3529] underline"
                    >
                      Revoke demo access
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-[#625C56]">No orders yet.</p>
        )}
      </section>
    </main>
  );
}