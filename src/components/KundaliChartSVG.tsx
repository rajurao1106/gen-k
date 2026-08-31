import type { ChartData } from "../types";

// Fixed North-Indian style kundali layout: 12 house polygons + label centers
// drawn on a 400x400 viewBox. House 1 (Lagna) is always the top diamond,
// numbering proceeds clockwise, matching the classic North Indian chart.
const HOUSE_POLYGONS: Record<number, string> = {
  1: "200,0 300,100 200,200 100,100",
  2: "200,0 400,0 300,100",
  3: "400,0 400,200 300,100",
  4: "400,200 300,300 200,200 300,100",
  5: "400,200 400,400 300,300",
  6: "400,400 200,400 300,300",
  7: "200,400 100,300 200,200 300,300",
  8: "200,400 0,400 100,300",
  9: "0,400 0,200 100,300",
  10: "0,200 100,100 200,200 100,300",
  11: "0,200 0,0 100,100",
  12: "0,0 200,0 100,100",
};

const HOUSE_CENTERS: Record<number, [number, number]> = {
  1: [200, 100],
  2: [300, 33],
  3: [367, 100],
  4: [300, 200],
  5: [367, 300],
  6: [300, 367],
  7: [200, 300],
  8: [100, 367],
  9: [33, 300],
  10: [100, 200],
  11: [33, 100],
  12: [100, 33],
};

export function KundaliChartSVG({
  data,
  compact,
}: {
  data: ChartData;
  compact?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 400 400"
      className={compact ? "w-full max-w-[220px] mx-auto" : "w-full max-w-[320px] mx-auto"}
    >
      <rect x="1" y="1" width="398" height="398" fill="#0a1529" stroke="#d8b36a" strokeWidth="2" />
      <polygon points="200,0 400,200 200,400 0,200" fill="none" stroke="#d8b36a" strokeWidth="1.5" />
      <line x1="0" y1="0" x2="400" y2="400" stroke="#d8b36a" strokeWidth="1.5" />
      <line x1="400" y1="0" x2="0" y2="400" stroke="#d8b36a" strokeWidth="1.5" />
      {Object.entries(HOUSE_POLYGONS).map(([houseNum]) => {
        const n = Number(houseNum);
        const [cx, cy] = HOUSE_CENTERS[n];
        const planets = data.houses?.[houseNum] ?? [];
        return (
          <g key={houseNum}>
            <text x={cx} y={cy - 14} textAnchor="middle" fontSize="10" fill="#afbdd7">
              {houseNum}
              {n === 1 ? " (Lg)" : ""}
            </text>
            <text x={cx} y={cy + 8} textAnchor="middle" fontSize="12" fontWeight="700" fill="#f5efe6">
              {planets.join(" ")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
