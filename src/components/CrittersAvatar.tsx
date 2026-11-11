"use client";

import { useState } from "react";

export default function CrittersAvatar({
  seed,
  name,
  className = "",
}: {
  seed?: string;
  name: string;
  className?: string;
}) {
  const [failedSeed, setFailedSeed] = useState("");
  const showAvatar = Boolean(seed) && failedSeed !== seed;

  return (
    <span
      role="img"
      aria-label={`${name || "Guest"}'s avatar`}
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#F8E8D8] font-semibold text-[#A95F35] ${className}`}
    >
      <span aria-hidden="true">{name.trim().charAt(0).toUpperCase() || "G"}</span>
      {showAvatar && (
        <img
          src={`https://api.dicebear.com/10.x/adventurer/svg?seed=${encodeURIComponent(seed!)}`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailedSeed(seed!)}
        />
      )}
    </span>
  );
}
