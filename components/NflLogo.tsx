"use client";

import { useState } from "react";

// ESPN CDN uses lowercase 2-3 letter codes; most match the abbreviation directly
// but a few need remapping
const ESPN_OVERRIDES: Record<string, string> = {
  LA: "lar",   // Rams
  WAS: "wsh",  // Commanders
};

function toEspnCode(team: string): string {
  return ESPN_OVERRIDES[team] ?? team.toLowerCase();
}

function teamFallbackColor(team: string): string {
  const palette = ["#1D9E75", "#378ADD", "#EF9F27", "#E24B4A", "#9ca3af", "#97C459", "#FAC775"];
  let h = 0;
  for (let i = 0; i < team.length; i++) h = (h * 31 + team.charCodeAt(i)) & 0xffff;
  return palette[h % palette.length];
}

export default function NflLogo({ team, size }: { team: string; size: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    const initials = team.slice(0, 2);
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: teamFallbackColor(team),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: Math.round(size * 0.35),
          fontWeight: 700,
          color: "#fff",
          letterSpacing: "0.02em",
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={`https://a.espncdn.com/i/teamlogos/nfl/500/${toEspnCode(team)}.png`}
      alt={`${team} logo`}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{ flexShrink: 0, objectFit: "contain" }}
    />
  );
}
