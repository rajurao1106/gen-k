export type AnalyticsEvent =
  | "signup"
  | "kundali_created"
  | "paywall_viewed"
  | "checkout_started"
  | "payment_success";

export function trackAnalytics(
  event: AnalyticsEvent,
  properties: { planId?: string } = {},
) {
  if (process.env.NODE_ENV === "production") return;
  const safeProperties =
    properties.planId && /^[a-z0-9_]{1,80}$/i.test(properties.planId)
      ? { planId: properties.planId }
      : {};
  console.info("[analytics]", { event, ...safeProperties });
}
