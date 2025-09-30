// lib/shiptype.ts
export function mapShipTypeToText(code?: number | null) {
  if (code == null || Number.isNaN(Number(code))) return { general: null, detailed: null };
  const c = Number(code);

  const ranges: Array<{min: number; max: number; general: string}> = [
    { min: 20, max: 29, general: "Wing in ground" },
    { min: 30, max: 39, general: "Fishing" },
    { min: 40, max: 49, general: "Towing/Offshore" },
    { min: 50, max: 59, general: "Pilot/Port Tender" },
    { min: 60, max: 69, general: "Passenger" },
    { min: 70, max: 79, general: "Cargo" },
    { min: 80, max: 89, general: "Tanker" },
    { min: 90, max: 99, general: "Other" }
  ];
  const range = ranges.find(r => c >= r.min && c <= r.max);
  const general = range?.general ?? "Unknown";

  const detailedMap: Record<number, string> = {
    50:"Pilot vessel", 52:"Tug", 55:"Law enforcement",
    60:"Passenger", 69:"Passenger, other",
    70:"Cargo", 79:"Cargo, other",
    80:"Tanker", 89:"Tanker, other"
  };
  return { general, detailed: detailedMap[c] ?? `Code ${c}` };
}
