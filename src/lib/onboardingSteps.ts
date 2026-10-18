// All onboarding text + image paths live here. Edit this file to change copy
// or swap demo art. To use your own image, put it in /public/onboarding/ and
// set its path below, e.g. welcome: "/onboarding/welcome.png".
const INTRO =
  "It will help me generate a personalized horoscope, numerology and compatibility report.";

export const STEP_KEYS = ["welcome", "name", "gender", "status", "dob", "time", "place"] as const;
export type StepKey = (typeof STEP_KEYS)[number];

export const IMAGES: Record<StepKey, string> = {
  welcome: "", name: "", gender: "", status: "", dob: "", time: "", place: "",
};

// Demo art used while an image path above is empty.
export const ART: Record<StepKey, "moon" | "constellation" | "globe" | "hearts"> = {
  welcome: "moon", name: "moon", gender: "moon", status: "hearts",
  dob: "constellation", time: "moon", place: "globe",
};

export const TEXT = {
  cta: "CONTINUE",
  welcome: {
    title: "Do you want to know your future?",
    subtitle: "Nisi minim nisi irure voluptate voluptate cillum pariatur reprehenderit.", // dummy: replace
    cta: "GET STARTED",
    legalPre: "The data you submit will be processed in accordance with our",
    privacy: "Privacy Policy",
    legalMid: ". By continuing you agree to",
    terms: "Terms of Service",
    privacyHref: "/privacy",
    termsHref: "/terms",
  },
  name: { intro: "In order to build your birth chart,", title: "What's your name?", placeholder: "Type Your Name" },
  gender: {
    intro: "Ok, {name}, in order to see how the stars will influence you, we would like to ask for your gender",
    title: "Select your gender",
    // value is what gets saved in the existing profile (Other = old "Other")
    options: [
      { label: "Non-binary", value: "Other" },
      { label: "Female", value: "Female" },
      { label: "Male", value: "Male" },
    ],
  },
  status: {
    intro: "{name}, Pick your sentimental status, so I can advise you about your love life.",
    title: "Select your sentimental status",
    skip: "DON'T WANT TO SAY",
    options: ["Single", "In relationship", "Married", "Divorced", "Widowed"],
    note: "More than 70% of users are using already the app", // placeholder stat: replace or remove
  },
  dob: { intro: INTRO, title: "Select your date of birth" },
  time: { intro: INTRO, title: "Select your time of birth", unknown: "I DON'T KNOW" },
  place: { intro: INTRO, title: "What's your place of birth?", placeholder: "City" },
};