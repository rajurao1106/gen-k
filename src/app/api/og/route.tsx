import { ImageResponse } from "next/og";

export const runtime = "nodejs";

const SIGN_DETAILS: Record<string, { label: string; glyph: string; insight: string }> = {
  Aries: { label: "Mesha", glyph: "♈", insight: "Take one clear step toward a goal that matters to you." },
  Taurus: { label: "Vrishabha", glyph: "♉", insight: "Steady choices can help you protect your time and energy." },
  Gemini: { label: "Mithuna", glyph: "♊", insight: "Curiosity and thoughtful conversation can open a new perspective." },
  Cancer: { label: "Karka", glyph: "♋", insight: "Make room for care, calm reflection and meaningful connection." },
  Leo: { label: "Simha", glyph: "♌", insight: "Share your ideas with confidence while listening to others." },
  Virgo: { label: "Kanya", glyph: "♍", insight: "Small practical improvements may bring a welcome sense of clarity." },
  Libra: { label: "Tula", glyph: "♎", insight: "Seek balance by giving your priorities an honest second look." },
  Scorpio: { label: "Vrishchika", glyph: "♏", insight: "Patience can help you understand what deserves your focus." },
  Sagittarius: { label: "Dhanu", glyph: "♐", insight: "Keep learning, and turn one promising idea into a simple plan." },
  Capricorn: { label: "Makara", glyph: "♑", insight: "Consistent effort can make a long-term goal feel more manageable." },
  Aquarius: { label: "Kumbha", glyph: "♒", insight: "A fresh point of view may help you find a useful next step." },
  Pisces: { label: "Meena", glyph: "♓", insight: "Pair imagination with a grounded action you can take today." },
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedSign = url.searchParams.get("rashi") || "";
  const sign = SIGN_DETAILS[requestedSign] ?? SIGN_DETAILS.Aries;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #071a2a 0%, #142b43 65%, #251d35 100%)",
          color: "#f9f3eb",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", width: 980, flexDirection: "column", border: "2px solid #f2c36b66", borderRadius: 36, padding: 64 }}>
          <div style={{ display: "flex", alignItems: "center", color: "#f2c36b", fontSize: 28, letterSpacing: 8 }}>GEN-K · VEDIC ASTROLOGY</div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 42 }}>
            <div style={{ display: "flex", height: 120, width: 120, alignItems: "center", justifyContent: "center", border: "2px solid #f2c36b", borderRadius: 100, color: "#f2c36b", fontSize: 76 }}>{sign.glyph}</div>
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 28 }}>
              <div style={{ display: "flex", color: "#aeb6c5", fontSize: 22 }}>RASHI</div>
              <div style={{ display: "flex", fontSize: 52, fontWeight: 700 }}>{sign.label}</div>
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 48, maxWidth: 820, color: "#e3d9c8", fontSize: 34, lineHeight: 1.35 }}>{sign.insight}</div>
          <div style={{ display: "flex", marginTop: 44, color: "#f2c36b", fontSize: 22 }}>A reflection for today · Gen-K</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
    },
  );
}
