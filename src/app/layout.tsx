import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import "../index.css";
import { getSiteUrl } from "../lib/seo";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "Gen-K | Vedic Astrology and Kundali Tools",
    template: "%s | Gen-K",
  },
  description:
    "Explore online kundali, kundali milan, numerology and mahadasha tools with Gen-K.",
  applicationName: "Gen-K",
  icons: { icon: "/logo.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#071a2a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
