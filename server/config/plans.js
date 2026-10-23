export const PLANS = {
  free: {
    planId: "free",
    name: "Free",
    type: "free",
    amountPaise: 0,
    currency: "INR",
    durationDays: null,
    grants: {
      kundali: "basic",
      dailyGuide: "preview",
      aiMessagesPerDay: 5,
    },
  },
  report_milan: {
    planId: "report_milan",
    name: "Kundali Milan report",
    type: "one-time",
    amountPaise: 9900,
    currency: "INR",
    durationDays: null,
    grants: { report: "milan", uses: 1 },
  },
  report_kundali: {
    planId: "report_kundali",
    name: "Detailed Kundali report",
    type: "one-time",
    amountPaise: 4900,
    currency: "INR",
    durationDays: null,
    grants: { report: "kundali", uses: 1 },
  },
  premium_monthly: {
    planId: "premium_monthly",
    name: "Premium monthly",
    type: "subscription",
    amountPaise: 14900,
    currency: "INR",
    durationDays: 30,
    grants: {
      dailyGuide: "full",
      mahadasha: true,
      aiMessagesPerDay: 30,
    },
  },
  premium_yearly: {
    planId: "premium_yearly",
    name: "Premium yearly",
    type: "subscription",
    amountPaise: 99900,
    currency: "INR",
    durationDays: 365,
    grants: {
      dailyGuide: "full",
      mahadasha: true,
      aiMessagesPerDay: 30,
    },
  },
  voice_addon: {
    planId: "voice_addon",
    name: "Friend voice add-on",
    type: "add-on",
    amountPaise: 19900,
    currency: "INR",
    durationDays: 30,
    grants: { voiceReplies: true },
  },
};

export function getPublicPlans() {
  return Object.values(PLANS).map((plan) => ({ ...plan, grants: { ...plan.grants } }));
}
