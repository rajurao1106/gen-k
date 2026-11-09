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
            "Razorpay test key ID was not returned by the server.",
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
          theme: { color: "#f2c36b" },
        });
        if (!result) return;
        if (result.razorpay_order_id !== order.providerOrderId) {
          throw new Error(
            "The Razorpay payment order did not match this checkout.",
          );
        }
        await verifyPayment({
          orderId: order.orderId,
          providerPaymentId: result.razorpay_payment_id,
          signature: result.razorpay_signature,
        });
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
    <main className="mx-auto max-w-5xl space-y-6 text-[#f9f3eb]">
      <header className="rounded-3xl border border-[#f2c36b]/25 bg-[#10273d]/85 p-5 sm:p-7">
        <p className="text-xs uppercase tracking-[0.2em] text-[#f2c36b]">
          Plans & access
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          Choose what works for you
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#c9d8ed]">
          Compare the available plans and see what is active on your account.
          Checkout can use local simulation or Razorpay test mode; this build
          rejects live Razorpay keys. Voice generation may still use paid AI
          provider credits.
        </p>
        {account && (
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full border border-[#f2c36b]/30 bg-[#0a1a2e] px-3 py-1.5">
              Current plan:{" "}
              <strong className="text-[#f8d27a]">{account.plan.name}</strong>
            </span>
            <span className="rounded-full border border-[#f2c36b]/30 bg-[#0a1a2e] px-3 py-1.5">
              {account.usage.ai_chat.scope === "trial"
                ? "Free AI replies used: "
                : account.usage.ai_chat.scope === "unlimited"
                  ? "AI chat access: "
                  : "AI messages today: "}
              <strong className="text-[#f8d27a]">
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
              className="rounded-full border border-[#ef9f90]/40 px-3 py-1.5 text-[#ffd1c9] transition-colors hover:bg-[#ef9f90]/10 disabled:cursor-wait disabled:opacity-60"
            >
              {cancellingPlan ? "Cancelling…" : "Cancel active plan"}
            </button>
            )}
          </div>
        )}
      </header>

      {feature && (
        <aside className="rounded-2xl border border-[#f2c36b]/40 bg-[#f2c36b]/10 p-4 text-sm text-[#f9e6b2]">
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
          className="rounded-xl border border-[#ef9f90]/40 bg-[#ef9f90]/10 p-3 text-sm text-[#ffd1c9]"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-[#7fd18a]/40 bg-[#7fd18a]/10 p-3 text-sm text-[#c9f2d1]"
        >
          {notice}
        </p>
      )}

      {loading ? (
        <p role="status" className="py-8 text-center text-sm text-[#c9d8ed]">
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
                className={`flex flex-col rounded-2xl border bg-[#0d2138]/90 p-5 ${
                  highlighted
                    ? "border-[#f2c36b]/70 shadow-[0_0_24px_rgba(242,195,107,0.12)]"
                    : "border-[#f2c36b]/20"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-semibold text-[#f8d27a]">
                      {plan.name}
                    </h2>
                    {detail && (
                      <p className="mt-1 text-xs text-[#c9d8ed]">
                        {detail.description}
                      </p>
                    )}
                  </div>
                  {highlighted && (
                    <span className="shrink-0 rounded-full bg-[#f2c36b]/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#f8d27a]">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="mt-5 font-display text-3xl font-bold">
                  {plan.amountPaise
                    ? formatPrice(plan.amountPaise, plan.currency)
                    : "Free"}
                  {plan.durationDays && (
                    <span className="ml-1 text-xs font-normal text-[#c9d8ed]">
                      / {plan.durationDays} days
                    </span>
                  )}
                </p>
                {detail && (
                  <ul className="my-5 flex-1 space-y-2 text-sm text-[#d9e5f7]">
                    {detail.features.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span aria-hidden="true" className="text-[#7fd18a]">
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
                    className="mt-auto rounded-xl border border-[#7fd18a]/35 px-4 py-2.5 text-sm text-[#7fd18a]"
                  >
                    Current plan
                  </button>
                ) : activeAddon ? (
                  <div className="mt-auto flex flex-col gap-2">
                    <span className="rounded-xl border border-[#7fd18a]/35 px-4 py-2.5 text-center text-sm text-[#7fd18a]">
                      Active
                    </span>
                    {["ai_chat_unlimited", "ai_chat_unlimited_money_test"].includes(plan.planId) && (
                      <button
                        type="button"
                        disabled={cancellingPlan}
                        onClick={() => void cancelPlan(plan.planId, plan.name)}
                        className="rounded-xl border border-[#ef9f90]/40 px-4 py-2.5 text-sm text-[#ffd1c9] transition-colors hover:bg-[#ef9f90]/10 disabled:cursor-wait disabled:opacity-60"
                      >
                        {cancellingPlan ? "Cancelling…" : "Cancel plan"}
                      </button>
                    )}
                  </div>
                ) : plan.type === "free" ? (
                  <button
                    type="button"
                    disabled
                    className="mt-auto rounded-xl border border-[#f2c36b]/20 px-4 py-2.5 text-sm text-[#c9d8ed]"
                  >
                    Included
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(busyPlan)}
                    onClick={() => void purchase(plan)}
                    className="mt-auto rounded-xl bg-[#f2c36b] px-4 py-2.5 text-sm font-semibold text-[#0b1324] transition-colors hover:bg-[#ffdc91] disabled:cursor-wait disabled:opacity-60"
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

      <p className="rounded-xl border border-[#f2c36b]/20 bg-[#10273d]/70 p-4 text-xs leading-5 text-[#c9d8ed]">
        For Razorpay checkout, configure test credentials. Test payments do not
        charge real money. Live Razorpay keys are rejected by this build.
      </p>
      <footer className="pb-5 text-xs text-[#a6bddb]">
        <LegalFooter />
      </footer>

      <section className="rounded-2xl border border-[#f2c36b]/20 bg-[#10273d]/70 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#f8d27a]">
              Recent payments
            </h2>
            <p className="mt-1 text-xs text-[#c9d8ed]">
              Payment activity linked to your account
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg border border-[#f2c36b]/30 px-3 py-2 text-xs text-[#f8d27a] hover:bg-[#f2c36b]/10"
          >
            Refresh
          </button>
        </div>
        {history.length ? (
          <ul className="mt-4 divide-y divide-[#f2c36b]/10">
            {history.slice(0, 5).map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <span>
                  <span className="block text-[#f5efe6]">
                    {payment.planName}
                  </span>
                  <span className="text-xs text-[#a6bddb]">
                    {new Date(payment.createdAt).toLocaleDateString("en-IN")}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block">
                    {formatPrice(payment.amountPaise, payment.currency)}
                  </span>
                  <span
                    className={`text-xs ${payment.status === "paid" ? "text-[#7fd18a]" : "text-[#a6bddb]"}`}
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
                      className="mt-1 text-xs text-[#ef9f90] underline"
                    >
                      Revoke demo access
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-[#a6bddb]">No orders yet.</p>
        )}
      </section>
    </main>
  );
}
