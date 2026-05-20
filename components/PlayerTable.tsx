"use client";

import { Fragment, useState } from "react";
import type { Player } from "@/lib/data";
import PlayerCard from "./PlayerCard";

interface PlayerTableProps {
  players: Player[];
}

type SortKey = "rank" | "vor_score" | "projected_pts" | "adp" | "value_delta" | "avg_ppr_2025";
type SortDir = "asc" | "desc";

const POSITION_TAGS: Record<string, { color: string; bg: string }> = {
  WR:  { color: "var(--teal)",        bg: "var(--teal-bg)" },
  RB:  { color: "var(--green-tag)",   bg: "var(--green-tag-bg)" },
  QB:  { color: "var(--amber-tag)",   bg: "var(--amber-tag-bg)" },
  TE:  { color: "var(--amber-light)", bg: "var(--amber-tag-bg2)" },
};

const COLUMNS: { label: string; key: SortKey | null; align: "left" | "right" | "center"; width?: number }[] = [
  { label: "Rank",     key: "rank",          align: "center", width: 44 },
  { label: "Player",   key: null,            align: "left" },
  { label: "VOR",      key: "vor_score",     align: "right" },
  { label: "Proj Pts", key: "projected_pts", align: "right" },
  { label: "ADP",      key: "adp",           align: "right" },
  { label: "Value",    key: "value_delta",   align: "right" },
  { label: "Avg PPR",  key: "avg_ppr_2025",  align: "right" },
  { label: "Flag",     key: null,            align: "center" },
];

function sortPlayers(players: Player[], key: SortKey, dir: SortDir): Player[] {
  return [...players].sort((a, b) => {
    const av = a[key] ?? (dir === "asc" ? Infinity : -Infinity);
    const bv = b[key] ?? (dir === "asc" ? Infinity : -Infinity);
    return dir === "asc"
      ? (av as number) - (bv as number)
      : (bv as number) - (av as number);
  });
}

export default function PlayerTable({ players }: PlayerTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedRank, setExpandedRank] = useState<number | null>(null);
  const [hoveredRank, setHoveredRank] = useState<number | null>(null);

  const sorted = sortPlayers(players, sortKey, sortDir);

  function handleSort(key: SortKey | null) {
    if (!key) return;
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function handleRowClick(rank: number) {
    setExpandedRank((prev) => (prev === rank ? null : rank));
  }

  if (players.length === 0) {
    return (
      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ padding: "40px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                No players found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--bg-secondary)", position: "sticky", top: 0, zIndex: 1 }}>
            {COLUMNS.map((col) => (
              <th
                key={col.label}
                onClick={() => handleSort(col.key)}
                style={{
                  padding: "10px 16px",
                  fontSize: 10,
                  fontWeight: 600,
                  color: col.key === sortKey ? "var(--teal)" : "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  textAlign: col.align,
                  borderBottom: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                  cursor: col.key ? "pointer" : "default",
                  userSelect: "none",
                  width: col.width,
                }}
              >
                {col.label}
                {col.key === sortKey ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((player) => {
            const tag = POSITION_TAGS[player.position] ?? {
              color: "var(--text-secondary)",
              bg: "var(--bg-card)",
            };
            const isExpanded = expandedRank === player.rank;
            const isHovered = hoveredRank === player.rank;
            const rowBg = isExpanded || isHovered ? "#161a24" : "transparent";

            return (
              <Fragment key={player.rank}>
                <tr
                  onClick={() => handleRowClick(player.rank)}
                  onMouseEnter={() => setHoveredRank(player.rank)}
                  onMouseLeave={() => setHoveredRank(null)}
                  style={{
                    borderBottom: "1px solid #161a24",
                    background: rowBg,
                    cursor: "pointer",
                  }}
                >
                  {/* Rank */}
                  <td style={{ padding: "9px 16px", textAlign: "center", width: 44 }}>
                    <span style={{ color: "var(--teal)", fontWeight: 600, fontSize: 13 }}>
                      {player.rank}
                    </span>
                  </td>

                  {/* Player */}
                  <td style={{ padding: "9px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 700 }}>
                        {player.player_name}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 5px",
                          borderRadius: 3,
                          color: tag.color,
                          background: tag.bg,
                        }}
                      >
                        {player.position}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                      {player.team}
                    </div>
                  </td>

                  {/* VOR */}
                  <td style={{ padding: "9px 16px", textAlign: "right" }}>
                    <span style={{ color: "var(--text-primary)", fontSize: 12 }}>
                      {player.vor_score?.toFixed(1) ?? "—"}
                    </span>
                  </td>

                  {/* Proj Pts */}
                  <td style={{ padding: "9px 16px", textAlign: "right" }}>
                    <span style={{ color: "var(--text-primary)", fontSize: 12 }}>
                      {player.projected_pts?.toFixed(1) ?? "—"}
                    </span>
                  </td>

                  {/* ADP */}
                  <td style={{ padding: "9px 16px", textAlign: "right" }}>
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                      {player.adp != null ? player.adp.toFixed(1) : "—"}
                    </span>
                  </td>

                  {/* Value */}
                  <td style={{ padding: "9px 16px", textAlign: "right" }}>
                    {player.value_delta == null || player.value_delta === 0 ? (
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                    ) : player.value_delta > 0 ? (
                      <span style={{ color: "#4ade80", fontSize: 12 }}>↑ {player.value_delta}</span>
                    ) : (
                      <span style={{ color: "var(--red)", fontSize: 12 }}>↓ {Math.abs(player.value_delta)}</span>
                    )}
                  </td>

                  {/* Avg PPR */}
                  <td style={{ padding: "9px 16px", textAlign: "right" }}>
                    <span style={{ color: "var(--text-primary)", fontSize: 12 }}>
                      {player.avg_ppr_2025?.toFixed(1) ?? "—"}
                    </span>
                  </td>

                  {/* Flag */}
                  <td style={{ padding: "9px 16px", textAlign: "center" }}>
                    {player.risk_flag ? (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 6px",
                          borderRadius: 3,
                          color: "var(--amber-tag)",
                          background: "var(--amber-tag-bg)",
                        }}
                      >
                        ⚠
                      </span>
                    ) : null}
                  </td>
                </tr>

                {isExpanded && (
                  <tr>
                    <td colSpan={COLUMNS.length} style={{ padding: 0 }}>
                      <PlayerCard player={player} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
