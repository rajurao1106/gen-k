"use client";

export default function ShareRashiButton({ rashi }: { rashi: string }) {
  const share = () => {
    const imageUrl = new URL("/api/og", window.location.origin);
    imageUrl.searchParams.set("rashi", rashi);
    const message = `My rashi reflection on Gen-K: ${imageUrl.toString()}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <button
      type="button"
      onClick={share}
      className="mt-3 rounded-full border border-[#f2c36b]/30 px-3 py-1.5 text-xs text-[#f8d27a] hover:bg-[#f2c36b]/10"
    >
      Share rashi
    </button>
  );
}
