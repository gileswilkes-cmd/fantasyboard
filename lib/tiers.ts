export interface TierConfig {
  tier: number;
  label: string;
  description: string;
  color: string;
  icon: string;
  minVor: number;
}

export const TIERS: TierConfig[] = [
  { tier: 1, label: "Tier 1", description: "Must have",   color: "#1D9E75", icon: "♛", minVor: 150 },
  { tier: 2, label: "Tier 2", description: "Strong pick", color: "#9ca3af", icon: "↑",  minVor: 100 },
  { tier: 3, label: "Tier 3", description: "Solid value", color: "#9ca3af", icon: "—",  minVor: 60  },
  { tier: 4, label: "Tier 4", description: "Depth",       color: "#6b7280", icon: "↓",  minVor: 20  },
  { tier: 5, label: "Tier 5", description: "Dart throw",  color: "#E24B4A", icon: "✕",  minVor: -Infinity },
];

export function getTier(vor: number): number {
  if (vor >= 150) return 1;
  if (vor >= 100) return 2;
  if (vor >= 60)  return 3;
  if (vor >= 20)  return 4;
  return 5;
}

export function getTierConfig(tier: number): TierConfig {
  return TIERS.find((t) => t.tier === tier) ?? TIERS[4];
}
