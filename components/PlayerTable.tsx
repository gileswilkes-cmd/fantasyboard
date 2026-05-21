"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import type { Player } from "@/lib/data";
import PlayerCard from "./PlayerCard";
import PlayerContextMenu from "./PlayerContextMenu";
import { getTier, getTierConfig } from "@/lib/tiers";
import NflLogo from "./NflLogo";

interface PlayerTableProps {
  players: Player[];
}

type SortKey = "rank" | "vor_score" | "projected_pts" | "adp" | "value_delta" | "avg_ppr_2025";
type SortDir = "asc" | "desc";

interface ContextMenuState {
  x: number;
  y: number;
  playerName: string;
}

const POSITION_TAGS: Record<string, { color: string; bg: string }> = {
  WR:  { color: "var(--teal)",        bg: "var(--teal-bg)" },
  RB:  { color: "var(--green-tag)",   bg: "var(--green-tag-bg)" },
  QB:  { color: "var(--amber-tag)",   bg: "var(--amber-tag-bg)" },
  TE:  { color: "var(--amber-light)", bg: "var(--amber-tag-bg2)" },
};

const COLUMNS: { label: string; key: SortKey | null; align: "left" | "right" | "center"; width?: number }[] = [
  { label: "",         key: null,            align: "center", width: 32 },
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

function TierDividerRow({ tier, colSpan }: { tier: number; colSpan: number }) {
  const config = getTierConfig(tier);
  return (
    <tr style={{ background: "#111318", pointerEvents: "none" }}>
      <td colSpan={colSpan} style={{ padding: "5px 16px", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: config.color, fontSize: 15, lineHeight: 1 }}>{config.icon}</span>
          <span style={{ color: config.color, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {config.label}
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>— {config.description}</span>
        </div>
      </td>
    </tr>
  );
}

function DndDividerRow({ colSpan }: { colSpan: number }) {
  return (
    <tr style={{ background: "#1a0d0d", pointerEvents: "none" }}>
      <td colSpan={colSpan} style={{ padding: "5px 16px", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#E24B4A", fontSize: 13, lineHeight: 1 }}>✕</span>
          <span style={{ color: "#E24B4A", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Do Not Draft
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>— excluded players</span>
        </div>
      </td>
    </tr>
  );
}

export default function PlayerTable({ players }: PlayerTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedRank, setExpandedRank] = useState<number | null>(null);
  const [hoveredRank, setHoveredRank] = useState<number | null>(null);
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [dnd, setDnd] = useState<Set<string>>(new Set());
  const [tierOverrides, setTierOverrides] = useState<Record<string, number>>({});
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ff_starred_players");
      if (saved) setStarred(new Set(JSON.parse(saved)));
      const savedDnd = localStorage.getItem("ff_dnd_players");
      if (savedDnd) setDnd(new Set(JSON.parse(savedDnd)));
      const savedTiers = localStorage.getItem("ff_tier_overrides");
      if (savedTiers) setTierOverrides(JSON.parse(savedTiers));
    } catch { /* ignore */ }
  }, []);

  function toggleStar(playerName: string) {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(playerName)) next.delete(playerName);
      else next.add(playerName);
      try { localStorage.setItem("ff_starred_players", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  function setTierOverride(playerName: string, tier: number) {
    setTierOverrides((prev) => {
      const next = { ...prev, [playerName]: tier };
      try { localStorage.setItem("ff_tier_overrides", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  function toggleDnd(playerName: string) {
    setDnd((prev) => {
      const next = new Set(prev);
      if (next.has(playerName)) next.delete(playerName);
      else next.add(playerName);
      try { localStorage.setItem("ff_dnd_players", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  function handleContextMenu(e: React.MouseEvent, playerName: string) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, playerName });
  }

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const sorted = sortPlayers(players, sortKey, sortDir);

  function effectiveTier(player: Player): number {
    return tierOverrides[player.player_name] ?? getTier(player.vor_score);
  }

  const nonDnd = sorted.filter((p) => !dnd.has(p.player_name));
  const dndPlayers = sorted.filter((p) => dnd.has(p.player_name));
  const reordered = [...nonDnd, ...dndPlayers];

  const sortedWithMeta = reordered.map((player, index) => {
    const isDndPlayer = dnd.has(player.player_name);
    const tier = effectiveTier(player);
    const prevIsDnd = index > 0 ? dnd.has(reordered[index - 1].player_name) : false;
    const isFirstDnd = isDndPlayer && !prevIsDnd;
    const prevTier = index > 0 ? effectiveTier(reordered[index - 1]) : null;

    const showDndDivider = isFirstDnd;
    const showDivider = !isDndPlayer && (index === 0 || tier !== prevTier);

    return { player, tier, showDivider, showDndDivider, isDndPlayer };
  });

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
            {COLUMNS.map((col, i) => (
              <th
                key={i}
                onClick={() => handleSort(col.key)}
                style={{
                  padding: "10px 16px",
                  fontSize: 11,
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
          {sortedWithMeta.map(({ player, tier, showDivider, showDndDivider, isDndPlayer }) => {
            const tag = POSITION_TAGS[player.position] ?? {
              color: "var(--text-secondary)",
              bg: "var(--bg-card)",
            };
            const isExpanded = expandedRank === player.rank;
            const isHovered = hoveredRank === player.rank;
            const isStarred = starred.has(player.player_name);

            let rowBg: string;
            if (isDndPlayer) {
              rowBg = isHovered ? "rgba(45,13,13,0.6)" : "rgba(45,13,13,0.3)";
            } else if (isStarred) {
              rowBg = isHovered ? "#0d1f1a" : "rgba(13,45,31,0.3)";
            } else {
              rowBg = isExpanded || isHovered ? "#22252f" : "transparent";
            }

            return (
              <Fragment key={player.rank}>
                {showDndDivider && <DndDividerRow colSpan={COLUMNS.length} />}
                {showDivider && <TierDividerRow tier={tier} colSpan={COLUMNS.length} />}
                <tr
                  onClick={() => handleRowClick(player.rank)}
                  onMouseEnter={() => setHoveredRank(player.rank)}
                  onMouseLeave={() => setHoveredRank(null)}
                  onContextMenu={(e) => handleContextMenu(e, player.player_name)}
                  style={{
                    borderBottom: "1px solid #22252f",
                    borderLeft: isStarred ? "2px solid #1D9E75" : "2px solid transparent",
                    background: rowBg,
                    cursor: "pointer",
                  }}
                >
                  {/* Star */}
                  <td style={{ padding: "9px 8px", textAlign: "center", width: 32 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStar(player.player_name); }}
                      title={isStarred ? "Remove star" : "Star player"}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 14,
                        color: isStarred ? "#EF9F27" : "var(--text-muted)",
                        padding: 0,
                        lineHeight: 1,
                      }}
                    >
                      {isStarred ? "★" : "☆"}
                    </button>
                  </td>

                  {/* Rank */}
                  <td style={{ padding: "9px 16px", textAlign: "center", width: 44 }}>
                    <span style={{ color: isDndPlayer ? "var(--red)" : "var(--teal)", fontWeight: 600, fontSize: 15 }}>
                      {player.rank}
                    </span>
                  </td>

                  {/* Player */}
                  <td style={{ padding: "9px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <NflLogo team={player.team} size={24} />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: isDndPlayer ? "var(--red)" : "#ffffff", fontSize: 15, fontWeight: 700 }}>
                            {player.player_name}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
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
                        <div style={{ fontSize: 12, color: "#c8cad4", fontWeight: 500, marginTop: 2 }}>
                          {player.team}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* VOR */}
                  <td style={{ padding: "9px 16px", textAlign: "right" }}>
                    <span style={{ color: isDndPlayer ? "var(--red)" : "var(--text-primary)", fontSize: 14 }}>
                      {player.vor_score?.toFixed(1) ?? "—"}
                    </span>
                  </td>

                  {/* Proj Pts */}
                  <td style={{ padding: "9px 16px", textAlign: "right" }}>
                    <span style={{ color: isDndPlayer ? "var(--red)" : "var(--text-primary)", fontSize: 14 }}>
                      {player.projected_pts?.toFixed(1) ?? "—"}
                    </span>
                  </td>

                  {/* ADP */}
                  <td style={{ padding: "9px 16px", textAlign: "right" }}>
                    <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
                      {player.adp != null ? player.adp.toFixed(1) : "—"}
                    </span>
                  </td>

                  {/* Value */}
                  <td style={{ padding: "9px 16px", textAlign: "right" }}>
                    {player.value_delta == null || player.value_delta === 0 ? (
                      <span style={{ color: "var(--text-muted)", fontSize: 14 }}>—</span>
                    ) : player.value_delta > 0 ? (
                      <span style={{ color: "#4ade80", fontSize: 14 }}>↑ {player.value_delta}</span>
                    ) : (
                      <span style={{ color: "var(--red)", fontSize: 14 }}>↓ {Math.abs(player.value_delta)}</span>
                    )}
                  </td>

                  {/* Avg PPR */}
                  <td style={{ padding: "9px 16px", textAlign: "right" }}>
                    <span style={{ color: isDndPlayer ? "var(--red)" : "var(--text-primary)", fontSize: 14 }}>
                      {player.avg_ppr_2025?.toFixed(1) ?? "—"}
                    </span>
                  </td>

                  {/* Flag */}
                  <td style={{ padding: "9px 16px", textAlign: "center" }}>
                    {isDndPlayer ? (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 6px",
                        borderRadius: 3,
                        color: "var(--red)",
                        background: "var(--red-bg)",
                      }}>
                        ✕
                      </span>
                    ) : player.risk_flag ? (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 6px",
                        borderRadius: 3,
                        color: "var(--amber-tag)",
                        background: "var(--amber-tag-bg)",
                      }}>
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

      {contextMenu && (
        <PlayerContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          playerName={contextMenu.playerName}
          isStarred={starred.has(contextMenu.playerName)}
          isDnd={dnd.has(contextMenu.playerName)}
          tierOverride={tierOverrides[contextMenu.playerName] ?? null}
          onStar={() => toggleStar(contextMenu.playerName)}
          onTier={(t) => setTierOverride(contextMenu.playerName, t)}
          onDnd={() => toggleDnd(contextMenu.playerName)}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
